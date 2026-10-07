import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FilePlus2, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRoles, primaryRole } from "@/lib/roles";
import type { CoaDocument, EligibleCoaPetition } from "@/types/coa.types";

type ManualSample = NonNullable<CoaDocument["sampleSnapshots"]>[number];
type ManualResult = NonNullable<CoaDocument["resultSnapshots"]>[number];
type Customer = NonNullable<CoaDocument["customerSnapshot"]>;
type SampleField = Exclude<keyof ManualSample, "itemSeq">;

function blankSample(item: EligibleCoaPetition["items"][number]): ManualSample {
  return {
    itemSeq: item.seq,
    sampleName: item.sampleName || "",
    commonName: item.commonName || "",
    batchNo: item.batchNo || "",
    lotNo: item.lotNo || "",
    productionDate: item.productionDate || "",
  };
}

function blankResult(itemSeq: number): ManualResult {
  return { itemSeq, testItem: "", result: "", criteria: "", method: "", unit: "" };
}

function fieldValue(value?: string | null) {
  return value || "";
}

export default function CoaManualRequestDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (doc: CoaDocument) => void;
}) {
  const { user } = useAuth();
  const [petitionId, setPetitionId] = useState("");
  const [selectedSeqs, setSelectedSeqs] = useState<number[]>([]);
  const [samples, setSamples] = useState<Record<number, ManualSample>>({});
  const [results, setResults] = useState<ManualResult[]>([]);
  const [customer, setCustomer] = useState<Customer>({ name: "", company: "", department: "", email: "", phone: "" });
  const [remark, setRemark] = useState("");
  const { data, isFetching, error: loadError, refetch } = useQuery({
    queryKey: ["coa", "eligible-petitions", "manual"],
    queryFn: api.getEligibleCoaPetitions,
    enabled: open,
  });
  const petitions = useMemo(() => data?.items ?? [], [data]);
  const selectedPetition = petitions.find((petition) => petition._id === petitionId);
  const selectedItems = selectedPetition?.items.filter((item) => selectedSeqs.includes(item.seq)) ?? [];
  const actor = useMemo(() => {
    const roles = normalizeRoles(user);
    const activeRole = user?.role || primaryRole(roles);
    return { name: user?.name, email: user?.email, role: activeRole, activeRole };
  }, [user]);
  const canSubmit = selectedItems.length > 0
    && selectedItems.every((item) => {
      const sample = samples[item.seq];
      return Boolean(sample?.sampleName?.trim() && sample.commonName?.trim() && sample.batchNo?.trim() && sample.productionDate?.trim())
        && results.some((row) => row.itemSeq === item.seq && row.testItem?.trim() && row.result?.trim());
    });
  const create = useMutation({
    mutationFn: () => api.createManualCoaDocument({
      petitionId,
      selectedItemSeqs: selectedSeqs,
      customerSnapshot: customer,
      sampleSnapshots: selectedSeqs.map((seq) => samples[seq]),
      resultSnapshots: results.filter((row) => selectedSeqs.includes(row.itemSeq)),
      remark,
      _user: actor,
    }),
    onSuccess: (doc) => {
      onOpenChange(false);
      onCreated(doc);
    },
  });

  const resetCreate = create.reset;
  useEffect(() => {
    if (!open) return;
    setPetitionId("");
    setSelectedSeqs([]);
    setSamples({});
    setResults([]);
    setCustomer({ name: "", company: "", department: "", email: "", phone: "" });
    setRemark("");
    resetCreate();
  }, [open, resetCreate]);

  function selectPetition(nextPetitionId: string) {
    setPetitionId(nextPetitionId);
    setSelectedSeqs([]);
    setSamples({});
    setResults([]);
  }

  function toggleItem(item: EligibleCoaPetition["items"][number]) {
    if (selectedSeqs.includes(item.seq)) {
      setSelectedSeqs((current) => current.filter((seq) => seq !== item.seq));
      setSamples((current) => {
        const next = { ...current };
        delete next[item.seq];
        return next;
      });
      setResults((current) => current.filter((row) => row.itemSeq !== item.seq));
      return;
    }
    setSelectedSeqs((current) => [...current, item.seq]);
    setSamples((current) => ({ ...current, [item.seq]: blankSample(item) }));
    setResults((current) => [...current, blankResult(item.seq)]);
  }

  function updateSample(itemSeq: number, key: SampleField, value: string) {
    setSamples((current) => ({ ...current, [itemSeq]: { ...current[itemSeq], itemSeq, [key]: value } }));
  }

  function updateResult(index: number, key: keyof ManualResult, value: string) {
    setResults((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  }

  function updateCustomer(key: keyof Customer, value: string) {
    setCustomer((current) => ({ ...current, [key]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!create.isPending) onOpenChange(nextOpen); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>คำขอ COA แบบกรอกข้อมูล</DialogTitle>
          <DialogDescription>ใช้เมื่อข้อมูลที่ดึงจากระบบไม่ถูกต้อง ระบบจะเก็บข้อมูลที่กรอกเป็น snapshot ในร่าง COA โดยไม่ดึงผล QC มาทับ</DialogDescription>
        </DialogHeader>
        {isFetching && <p role="status" className="text-sm text-muted-foreground">กำลังโหลดคำร้อง...</p>}
        {loadError && <div role="alert" className="text-sm text-destructive">โหลดคำร้องไม่สำเร็จ <Button type="button" variant="outline" onClick={() => refetch()}>ลองใหม่</Button></div>}
        {!isFetching && !loadError && petitions.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีคำร้องที่อนุมัติผล Lab พร้อมสร้าง COA</p>}
        {!isFetching && !loadError && petitions.length > 0 && (
          <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label>คำร้องที่อนุมัติผล Lab</Label>
              <div className="max-h-64 overflow-auto rounded-md border bg-muted/50">
                {petitions.map((petition) => (
                  <button
                    key={petition._id}
                    type="button"
                    disabled={create.isPending}
                    className={"block w-full border-b px-3 py-2 text-left text-sm transition-colors hover:bg-accent " + (petition._id === petitionId ? "bg-primary-50 text-foreground" : "text-foreground")}
                    onClick={() => selectPetition(petition._id)}
                  >
                    <span className="block font-medium">{petition.petitionNo}</span>
                    <span className="text-xs text-muted-foreground">{petition.items.length} รายการ</span>
                  </button>
                ))}
              </div>
              {selectedPetition && (
                <div className="space-y-2">
                  <Label>รายการตัวอย่าง</Label>
                  <div className="rounded-md border bg-card">
                    {selectedPetition.items.map((item) => (
                      <label key={item.seq} className="flex items-start gap-3 border-b p-3 text-sm last:border-b-0 hover:bg-accent">
                        <input type="checkbox" checked={selectedSeqs.includes(item.seq)} disabled={create.isPending} onChange={() => toggleItem(item)} className="mt-1 h-4 w-4 rounded border-input" />
                        <span>
                          <span className="block font-medium">{item.sampleName || item.commonName || ("Sample " + item.seq)}</span>
                          <span className="block text-xs text-muted-foreground">{item.commonName || "ยังไม่ระบุชื่อสามัญ"}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {selectedItems.length === 0 && <div className="rounded-lg border bg-muted/50 p-6 text-center text-sm text-muted-foreground">เลือกคำร้องและตัวอย่างที่ต้องการก่อนกรอกข้อมูล</div>}
              {selectedItems.map((item) => {
                const sample = samples[item.seq] || blankSample(item);
                return (
                  <section key={item.seq} className="space-y-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
                    <h3 className="text-base font-semibold">ข้อมูลตัวอย่าง {item.seq}</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {([
                        ["sampleName", "ชื่อตัวอย่าง", true],
                        ["commonName", "ชื่อสามัญ", true],
                        ["batchNo", "Batch No.", true],
                        ["lotNo", "Lot No.", false],
                        ["productionDate", "วันที่ผลิต", true],
                        ["sampleId", "รหัสตัวอย่าง", false],
                        ["condition", "สภาพตัวอย่าง", false],
                        ["manufacturer", "ผู้ผลิต", false],
                      ] as Array<[SampleField, string, boolean]>).map(([key, label, required]) => (
                        <div key={key} className="space-y-1">
                          <Label htmlFor={"manual-" + item.seq + "-" + key}>{label}{required ? " *" : ""}</Label>
                          <Input id={"manual-" + item.seq + "-" + key} value={fieldValue(sample[key])} required={required} disabled={create.isPending} onChange={(event) => updateSample(item.seq, key, event.target.value)} type={key === "productionDate" ? "date" : "text"} />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">ผลทดสอบ</h4>
                        <Button type="button" variant="outline" size="sm" className="gap-2" disabled={create.isPending} onClick={() => setResults((current) => [...current, blankResult(item.seq)])}><Plus className="h-4 w-4" />เพิ่มผล</Button>
                      </div>
                      {results.map((row, index) => row.itemSeq === item.seq && (
                        <div key={item.seq + "-" + index} className="grid gap-2 rounded-md border bg-muted/50 p-3 sm:grid-cols-2">
                          <div className="space-y-1"><Label htmlFor={"manual-result-item-" + index}>รายการทดสอบ *</Label><Input id={"manual-result-item-" + index} value={fieldValue(row.testItem)} disabled={create.isPending} onChange={(event) => updateResult(index, "testItem", event.target.value)} /></div>
                          <div className="space-y-1"><Label htmlFor={"manual-result-value-" + index}>ผลทดสอบ *</Label><Input id={"manual-result-value-" + index} value={fieldValue(row.result)} disabled={create.isPending} onChange={(event) => updateResult(index, "result", event.target.value)} /></div>
                          <div className="space-y-1"><Label htmlFor={"manual-result-criteria-" + index}>เกณฑ์</Label><Input id={"manual-result-criteria-" + index} value={fieldValue(row.criteria)} disabled={create.isPending} onChange={(event) => updateResult(index, "criteria", event.target.value)} /></div>
                          <div className="space-y-1"><Label htmlFor={"manual-result-unit-" + index}>หน่วย</Label><Input id={"manual-result-unit-" + index} value={fieldValue(row.unit)} disabled={create.isPending} onChange={(event) => updateResult(index, "unit", event.target.value)} /></div>
                          <div className="space-y-1 sm:col-span-2"><Label htmlFor={"manual-result-method-" + index}>วิธีทดสอบ</Label><Input id={"manual-result-method-" + index} value={fieldValue(row.method)} disabled={create.isPending} onChange={(event) => updateResult(index, "method", event.target.value)} /></div>
                          {results.filter((result) => result.itemSeq === item.seq).length > 1 && <Button type="button" variant="outline" size="sm" className="gap-2 justify-self-start" disabled={create.isPending} onClick={() => setResults((current) => current.filter((_result, rowIndex) => rowIndex !== index))}><Trash2 className="h-4 w-4" />ลบผลนี้</Button>}
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
              {selectedItems.length > 0 && (
                <section className="space-y-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
                  <h3 className="text-base font-semibold">ข้อมูลผู้ขอ/ลูกค้า</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([
                      ["name", "ชื่อผู้ขอ"], ["company", "บริษัท"], ["department", "แผนก"], ["email", "อีเมล"], ["phone", "โทรศัพท์"],
                    ] as Array<[keyof Customer, string]>).map(([key, label]) => (
                      <div key={key} className="space-y-1"><Label htmlFor={"manual-customer-" + key}>{label}</Label><Input id={"manual-customer-" + key} value={fieldValue(customer[key])} disabled={create.isPending} onChange={(event) => updateCustomer(key, event.target.value)} /></div>
                    ))}
                  </div>
                  <div className="space-y-1"><Label htmlFor="manual-coa-remark">หมายเหตุ</Label><Textarea id="manual-coa-remark" value={remark} disabled={create.isPending} onChange={(event) => setRemark(event.target.value)} placeholder="ข้อมูลประกอบคำขอ COA" /></div>
                </section>
              )}
            </div>
          </div>
        )}
        {create.error && <Alert variant="destructive"><AlertTitle>บันทึกคำขอไม่สำเร็จ</AlertTitle><AlertDescription>{create.error instanceof Error ? create.error.message : "เกิดข้อผิดพลาด"}</AlertDescription></Alert>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={create.isPending} onClick={() => onOpenChange(false)}>ปิด</Button>
          <Button type="button" className="gap-2" disabled={!canSubmit || create.isPending} onClick={() => create.mutate()}><FilePlus2 className="h-4 w-4" />สร้างร่าง COA</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

