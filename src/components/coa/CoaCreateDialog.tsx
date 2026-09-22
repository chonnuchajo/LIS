import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FilePlus2 } from "lucide-react";
import { api } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRoles, primaryRole } from "@/lib/roles";
import type { CoaDocument, CoaFormSelection, EligibleCoaPetition } from "@/types/coa.types";

function formatProductionDate(value?: string | null) {
  if (!value) return "";
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

export default function CoaCreateDialog({
  open,
  onOpenChange,
  onCreated,
  request,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (doc: CoaDocument) => void;
  request?: CoaDocument | null;
}) {
  const { user } = useAuth();
  const [petitionId, setPetitionId] = useState("");
  const [selectedSeqs, setSelectedSeqs] = useState<number[]>([]);
  const [selections, setSelections] = useState<Record<number, CoaFormSelection>>({});
  const { data, isFetching, error: loadError, refetch } = useQuery({ queryKey: ["coa", "eligible-petitions"], queryFn: api.getEligibleCoaPetitions, enabled: open });
  const petitions = useMemo(() => data?.items ?? [], [data]);
  const selectedPetition = useMemo(
    () => petitions.find((petition: EligibleCoaPetition) => petition._id === petitionId),
    [petitions, petitionId],
  );
  const selectedItems = useMemo(
    () => selectedPetition?.items.filter((item) => selectedSeqs.includes(item.seq)) ?? [],
    [selectedPetition, selectedSeqs],
  );
  const reusableActiveCoa = useMemo(() => {
    if (selectedItems.length === 0) return null;
    const activeCoas = selectedItems.map((item) => item.activeCoa).filter(Boolean);
    const coaIds = new Set(activeCoas.map((coa) => coa?.coaId));
    return activeCoas.length === selectedItems.length && coaIds.size === 1 ? activeCoas[0] : null;
  }, [selectedItems]);
  const source = useQuery({
    queryKey: ["coa", "source-data", petitionId, selectedSeqs],
    queryFn: () => api.getCoaSourceData(petitionId, selectedSeqs),
    enabled: open && Boolean(selectedPetition) && selectedSeqs.length > 0 && !reusableActiveCoa,
  });
  const sourceResults = source.data?.results.filter((result) => result.kind === "result") ?? [];
  const canCreate = !isFetching && !source.isFetching && !source.isError && !loadError
    && selectedItems.length > 0 && selectedItems.length === selectedSeqs.length
    && selectedItems.every((item) => {
      const selection = selections[item.seq];
      if (!selection || !item.commonName?.trim()) return false;
      const options = sourceResults.filter((result) => result.itemSeq === item.seq);
      const resultKeys = selection.resultKeys ?? [];
      return resultKeys.length > 0 && resultKeys.every((key) => options.some((result) => result.key === key));
    });
  const reusableActiveCoaFields = useMemo(() => {
    if (!reusableActiveCoa) return "ชื่อสามัญ/Batch/วันที่ผลิตนี้";
    return [
      reusableActiveCoa.commonName ? `ชื่อสามัญ ${reusableActiveCoa.commonName}` : null,
      reusableActiveCoa.batchNo ? `Batch No. ${reusableActiveCoa.batchNo}` : null,
      reusableActiveCoa.productionDate ? `วันที่ผลิต ${formatProductionDate(reusableActiveCoa.productionDate)}` : null,
    ].filter(Boolean).join(" · ") || "ชื่อสามัญ/Batch/วันที่ผลิตนี้";
  }, [reusableActiveCoa]);
  const actor = useMemo(() => {
    const roles = normalizeRoles(user);
    const activeRole = user?.role || primaryRole(roles);
    return {
      name: user?.name,
      email: user?.email,
      role: activeRole,
      activeRole,
    };
  }, [user]);
  const create = useMutation({
    mutationFn: () => api.createCoaDocument({
      petitionId, selectedItemSeqs: selectedSeqs,
      formSelections: selectedSeqs.map((seq) => selections[seq]), _user: actor,
    }),
    onSuccess: (doc) => {
      onOpenChange(false);
      onCreated(doc);
    },
  });
  const submitExisting = useMutation({
    mutationFn: async () => {
      if (!reusableActiveCoa) throw new Error("ไม่พบ COA ใบเดิมสำหรับส่งอนุมัติ");
      const revision = await api.reviseCoaDocument(reusableActiveCoa.coaId, { _user: actor });
      return api.submitCoaDocument(revision._id, { _user: actor });
    },
    onSuccess: (doc) => {
      onOpenChange(false);
      onCreated(doc);
    },
  });

  const resetCreate = create.reset;
  const resetSubmitExisting = submitExisting.reset;
  useEffect(() => {
    if (!open) return;
    setPetitionId(request?.petitionId || "");
    setSelectedSeqs(request?.selectedItemSeqs || []);
    setSelections({});
    resetCreate();
    resetSubmitExisting();
  }, [open, request, resetCreate, resetSubmitExisting]);

  function toggleSeq(seq: number) {
    setSelectedSeqs((value) => (value.includes(seq) ? value.filter((item) => item !== seq) : [...value, seq]));
  }

  function updateSelection(itemSeq: number, update: Partial<CoaFormSelection>) {
    setSelections((current) => ({
      ...current,
      [itemSeq]: {
        itemSeq, resultKeys: [],
        ...current[itemSeq], ...update,
      },
    }));
  }

  function toggleResult(itemSeq: number, key: string) {
    const selected = selections[itemSeq]?.resultKeys ?? [];
    updateSelection(itemSeq, {
      resultKeys: selected.includes(key) ? selected.filter((value) => value !== key) : [...selected, key],
    });
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!create.isPending && !submitExisting.isPending) onOpenChange(nextOpen); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>สร้าง COA</DialogTitle>
          <DialogDescription>เลือกผลพารามิเตอร์ที่ต้องการใส่ใน COA ระบบดึงค่าที่บันทึกไว้ให้อัตโนมัติ แล้วส่งไปแท็บดำเนินการแล้ว</DialogDescription>
        </DialogHeader>
        {isFetching && <p role="status" className="text-sm text-muted-foreground">กำลังโหลดคำร้อง...</p>}
        {loadError && <div role="alert" className="text-sm text-destructive">โหลดคำร้องไม่สำเร็จ <Button variant="outline" onClick={() => refetch()}>ลองใหม่</Button></div>}
        {!isFetching && !loadError && petitions.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีคำร้องที่อนุมัติผล Lab พร้อมสร้าง COA</p>}
        {reusableActiveCoa && (
          <Alert className="border-yellow-500/30 bg-yellow-50 text-yellow-500">
            <AlertTitle>พบประวัติการทำ COA แล้ว</AlertTitle>
            <AlertDescription>
              {reusableActiveCoaFields} เคยออก COA แล้ว เลข COA No. {reusableActiveCoa.coaNo}
              {reusableActiveCoa.petitionNo ? ` จากคำร้อง ${reusableActiveCoa.petitionNo}` : ""}
              <span className="mt-1 block">กด “ส่งใบเดิมไปรออนุมัติ” เพื่อส่งข้อมูลไปหน้า “รออนุมัติ” ได้ทันที</span>
            </AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="max-h-80 overflow-auto rounded-md border bg-muted/50">
            {petitions.map((petition) => (
              <button
                key={petition._id}
                type="button"
                disabled={create.isPending || submitExisting.isPending}
                className={`block w-full border-b px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${petition._id === petitionId ? "bg-primary-50 text-foreground" : "text-foreground"}`}
                onClick={() => {
                  setPetitionId(petition._id);
                  setSelectedSeqs([]);
                  setSelections({});
                }}
              >
                <div className="font-medium">{petition.petitionNo}</div>
                <div className="text-xs text-muted-foreground">{petition.items.length} รายการ</div>
              </button>
            ))}
          </div>
          <div className="max-h-80 overflow-auto rounded-md border bg-card">
            {!selectedPetition && <div className="p-6 text-center text-sm text-muted-foreground">เลือกคำร้องที่อนุมัติผล Lab แล้ว</div>}
        {selectedPetition?.items.map((item) => (
              <label key={item.seq} className="flex items-start gap-3 border-b p-3 text-sm hover:bg-accent">
                <Checkbox checked={selectedSeqs.includes(item.seq)} disabled={create.isPending || submitExisting.isPending} onCheckedChange={() => toggleSeq(item.seq)} />
                  <span>
                    <span className="block font-medium text-foreground">{item.sampleName || item.commonName || `Sample ${item.seq}`}</span>
                    <span className="block text-foreground">ชื่อสามัญ: {item.commonName || "ยังไม่ระบุชื่อสามัญ"}</span>
                    <span className="block text-xs text-muted-foreground">{[item.batchNo || item.lotNo || "-", item.productionDate ? `ผลิต ${formatProductionDate(item.productionDate)}` : null].filter(Boolean).join(" · ")}</span>
                    {item.activeCoa && (
                      <span className="mt-1 block rounded-md bg-yellow-50 px-2 py-1 text-xs text-yellow-500">
                      มีประวัติ COA แล้ว: {item.activeCoa.coaNo}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
        {!reusableActiveCoa && selectedItems.length > 0 && (
          <fieldset disabled={create.isPending} className="space-y-4">
            <legend className="text-base font-semibold text-foreground">ข้อมูลที่ใช้ในฟอร์ม COA</legend>
            {source.isFetching && <p role="status" className="text-sm text-muted-foreground">กำลังโหลดผลพารามิเตอร์...</p>}
            {source.isError && <div role="alert" className="text-sm text-destructive">{source.error instanceof Error ? source.error.message : "โหลดผลไม่สำเร็จ"} <Button variant="outline" onClick={() => source.refetch()}>โหลดผลอีกครั้ง</Button></div>}
            {!source.isFetching && !source.isError && selectedItems.map((item) => {
              const options = sourceResults.filter((result) => result.itemSeq === item.seq);
              const selection = selections[item.seq];
              const selectedResultKeys = new Set(selection?.resultKeys ?? []);
              return (
                <section key={item.seq} className="space-y-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
                  <h3 className="text-base font-semibold">{item.commonName || "ยังไม่ระบุชื่อสามัญ"} · {item.batchNo || item.lotNo || "-"}</h3>
                  {options.length === 0 ? (
                    <p role="alert" className="text-sm text-destructive">ไม่พบค่าพารามิเตอร์ที่ใช้ใน COA ของตัวอย่างนี้</p>
                  ) : (
                    <fieldset className="space-y-2">
                      <legend className="text-sm font-semibold text-foreground">เลือกข้อมูลจากค่าพารามิเตอร์</legend>
                      {options.map((option) => (
                        <label key={option.key} className="flex items-start gap-3 rounded-md border p-3 text-sm hover:bg-accent">
                          <Checkbox checked={selectedResultKeys.has(option.key)} onCheckedChange={() => toggleResult(item.seq, option.key)} />
                          <span className="min-w-0">
                            <span className="block font-medium text-foreground">{option.label}</span>
                            <span className="block break-words text-muted-foreground">ผล: {option.result}{option.unit && !option.result.endsWith(option.unit) ? ` ${option.unit}` : ""}</span>
                            {option.criteria && <span className="block text-xs text-muted-foreground">เกณฑ์: {option.criteria}</span>}
                          </span>
                        </label>
                      ))}
                      <p className="text-xs text-muted-foreground">เลือกอย่างน้อยหนึ่งค่าต่อตัวอย่าง ระบบจะดึงผลที่เลือกไปใส่ใน COA อัตโนมัติ</p>
                    </fieldset>
                  )}
                </section>
              );
            })}
          </fieldset>
        )}
        {(create.error || submitExisting.error) && <p role="alert" className="text-sm text-destructive">{(create.error || submitExisting.error)?.message}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={create.isPending || submitExisting.isPending} onClick={() => onOpenChange(false)}>ปิด</Button>
          {reusableActiveCoa ? (
            <Button
              className="gap-2 bg-yellow-500 text-white hover:bg-yellow-500/90"
              disabled={submitExisting.isPending || create.isPending}
              onClick={() => submitExisting.mutate()}
            >
              ส่งใบเดิมไปรออนุมัติ
            </Button>
          ) : (
            <Button className="gap-2" disabled={!canCreate || create.isPending || submitExisting.isPending} onClick={() => create.mutate()}>
              <FilePlus2 className="h-4 w-4" />
              สร้างร่าง COA
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
