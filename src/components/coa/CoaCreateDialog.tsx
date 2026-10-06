import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FilePlus2, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { aiToleranceCriteriaForCommonName, isAiContentTestItem } from "@/lib/aiToleranceCriteria";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRoles, primaryRole } from "@/lib/roles";
import type { CoaDocument, CoaFormSelection, CoaResultSnapshot, CoaSampleSnapshot, EligibleCoaPetition } from "@/types/coa.types";

type Customer = NonNullable<CoaDocument["customerSnapshot"]>;
type SampleField = Exclude<keyof CoaSampleSnapshot, "itemSeq">;
type ResultField = Exclude<keyof CoaResultSnapshot, "itemSeq">;

const sampleFields: Array<[SampleField, string, boolean]> = [
  ["sampleName", "ชื่อตัวอย่าง", true],
  ["commonName", "ชื่อสามัญ", true],
  ["batchNo", "Batch No.", true],
  ["lotNo", "Lot No.", false],
  ["productionDate", "วันที่ผลิต", true],
  ["sampleId", "รหัสตัวอย่าง", false],
  ["condition", "สภาพตัวอย่าง", false],
  ["manufacturer", "ผู้ผลิต", false],
];
const resultFields: Array<[ResultField, string, boolean]> = [
  ["testItem", "รายการทดสอบ", true],
  ["result", "ผลทดสอบ", true],
  ["criteria", "เกณฑ์", false],
  ["unit", "หน่วย", false],
  ["method", "วิธีทดสอบ", false],
];
const customerFields: Array<[keyof Customer, string]> = [
  ["name", "ชื่อผู้ขอ"], ["company", "บริษัท"], ["department", "แผนก"], ["email", "อีเมล"], ["phone", "โทรศัพท์"],
];

function filled<T extends object>(value?: T) {
  return Object.fromEntries(Object.entries(value ?? {}).filter(([, entry]) => entry)) as Partial<T>;
}

function matchKey(value?: string) {
  return (value || "").toLowerCase().replace(/\s+/g, "");
}

function defaultCriteria(testItem = "", commonName?: string, appearance?: string) {
  if (isAiContentTestItem(testItem)) return aiToleranceCriteriaForCommonName(commonName) || "";
  return /appearance|กายภาพ|ลักษณะ|สี/i.test(testItem) ? appearance || "" : "";
}

function findErpMatch(petitions: EligibleCoaPetition[], sample?: CoaSampleSnapshot) {
  const commonName = matchKey(sample?.commonName);
  if (!commonName) return null;
  const candidates = petitions.flatMap((petition) => petition.items
    .filter((item) => !item.activeCoa && matchKey(item.commonName) === commonName)
    .map((item) => ({ petitionId: petition._id, seq: item.seq, sameTradeName: matchKey(item.sampleName) === matchKey(sample?.sampleName) })));
  return candidates.find((candidate) => candidate.sameTradeName) ?? candidates[0] ?? null;
}

function erpDefaultResults(request?: CoaDocument | null): CoaResultSnapshot[] {
  const erp = request?.externalCoaRequest;
  if (!erp) return [];
  const itemSeq = erp.line || 1;
  return [
    { itemSeq, testItem: "Appearance", result: "", criteria: erp.appearance || "", unit: "", method: "" },
    { itemSeq, testItem: "%AI content", result: "", criteria: defaultCriteria("%AI content", request?.sampleSnapshots?.[0]?.commonName), unit: "%", method: "" },
  ];
}

function dateInputValue(value?: string | null) {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? value ?? "";
}

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
  const [sampleEdits, setSampleEdits] = useState<Record<number, Partial<CoaSampleSnapshot>>>({});
  const [resultEdits, setResultEdits] = useState<Record<string, Partial<CoaResultSnapshot>>>({});
  const [customerEdits, setCustomerEdits] = useState<Customer>({});
  const [remark, setRemark] = useState("");
  const [manualResults, setManualResults] = useState<CoaResultSnapshot[]>([]);
  const [erpMatchChecked, setErpMatchChecked] = useState(false);
  const erp = request?.externalCoaRequest;
  const erpSeq = erp?.line || 1;
  const erpSample = erp ? request?.sampleSnapshots?.[0] : undefined;
  const erpBase = filled({ sampleName: erpSample?.sampleName, commonName: erpSample?.commonName });
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
    if (erp || selectedItems.length === 0) return null;
    const activeCoas = selectedItems.map((item) => item.activeCoa).filter(Boolean);
    const coaIds = new Set(activeCoas.map((coa) => coa?.coaId));
    return activeCoas.length === selectedItems.length && coaIds.size === 1 ? activeCoas[0] : null;
  }, [erp, selectedItems]);
  const source = useQuery({
    queryKey: ["coa", "source-data", petitionId, selectedSeqs],
    queryFn: () => api.getCoaSourceData(petitionId, selectedSeqs),
    enabled: open && Boolean(selectedPetition) && selectedSeqs.length > 0 && !reusableActiveCoa,
  });
  const sourceResults = source.data?.results.filter((result) => result.kind === "result") ?? [];
  const formSamples: CoaSampleSnapshot[] = selectedItems.map((item) => ({
    itemSeq: item.seq,
    sampleName: item.sampleName,
    commonName: item.commonName,
    batchNo: item.batchNo,
    lotNo: item.lotNo,
    productionDate: item.productionDate,
    ...source.data?.sampleSnapshots?.find((sample) => sample.itemSeq === item.seq),
    ...erpBase,
    ...sampleEdits[item.seq],
  }));
  const erpFormSample: CoaSampleSnapshot = { itemSeq: erpSeq, ...erpBase, ...sampleEdits[erpSeq] };
  const manualMode = Boolean(erp) && selectedItems.length === 0;
  const formResults = selectedItems.flatMap((item) => (selections[item.seq]?.resultKeys ?? []).flatMap((key) => {
    const option = sourceResults.find((result) => result.itemSeq === item.seq && result.key === key);
    return option ? [{
      key,
      row: {
        itemSeq: item.seq, testItem: option.testItem || option.label, result: option.result,
        criteria: option.criteria || (erp ? defaultCriteria(option.testItem || option.label, erpBase.commonName || item.commonName, erp.appearance) : ""),
        unit: option.unit || "", method: "", ...resultEdits[key],
      } as CoaResultSnapshot,
    }] : [];
  }));
  const formCustomer: Customer = { ...source.data?.customerSnapshot, ...(erp ? filled(request?.customerSnapshot) : {}), ...customerEdits };
  const edited = Boolean(erp) || Object.keys(sampleEdits).length + Object.keys(resultEdits).length + Object.keys(customerEdits).length > 0;
  const sampleComplete = (sample: CoaSampleSnapshot) => sampleFields.every(([field, , required]) => !required || sample[field]?.toString().trim());
  const resultComplete = (row: CoaResultSnapshot) => Boolean(row.testItem?.trim() && row.result?.trim());
  const editedFormComplete = manualMode
    ? sampleComplete(erpFormSample) && manualResults.length > 0 && manualResults.every(resultComplete)
    : !edited || (formSamples.every(sampleComplete) && formResults.every(({ row }) => resultComplete(row)));
  const erpLink = erp ? { saleOrderNo: erp.saleOrderNo, line: erp.line, itemNo: erp.itemNo } : undefined;
  const canCreate = manualMode ? editedFormComplete : editedFormComplete && !isFetching && !source.isFetching && !source.isError && !loadError
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
    mutationFn: () => (manualMode ? api.createManualCoaDocument({
      selectedItemSeqs: [erpSeq],
      customerSnapshot: formCustomer,
      sampleSnapshots: [erpFormSample],
      resultSnapshots: manualResults,
      remark: remark.trim() || undefined,
      externalCoaRequest: erpLink,
      _user: actor,
    }) : api.createCoaDocument({
      petitionId, selectedItemSeqs: selectedSeqs,
      formSelections: selectedSeqs.map((seq) => selections[seq]),
      ...(edited ? {
        customerSnapshot: formCustomer,
        sampleSnapshots: formSamples,
        resultSnapshots: formResults.map(({ row }) => row),
      } : {}),
      remark: remark.trim() || undefined,
      externalCoaRequest: erpLink,
      _user: actor,
    })),
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
    const fromErp = Boolean(request?.externalCoaRequest);
    setPetitionId(fromErp ? "" : request?.petitionId || "");
    setSelectedSeqs(fromErp ? [] : request?.selectedItemSeqs || []);
    setSelections({});
    setSampleEdits({});
    setResultEdits({});
    setCustomerEdits({});
    setRemark("");
    setManualResults(erpDefaultResults(request));
    setErpMatchChecked(false);
    resetCreate();
    resetSubmitExisting();
  }, [open, request, resetCreate, resetSubmitExisting]);

  useEffect(() => {
    if (!open || !erp || erpMatchChecked || isFetching || !data) return;
    setErpMatchChecked(true);
    const match = findErpMatch(petitions, erpSample);
    if (!match) return;
    setPetitionId(match.petitionId);
    setSelectedSeqs([match.seq]);
  }, [open, erp, erpMatchChecked, isFetching, data, petitions, erpSample]);

  function toggleSeq(seq: number) {
    if (erp) {
      setSelectedSeqs((value) => (value.includes(seq) ? [] : [seq]));
      return;
    }
    setSelectedSeqs((value) => (value.includes(seq) ? value.filter((item) => item !== seq) : [...value, seq]));
  }

  function renderSampleFields(itemSeq: number, sample?: CoaSampleSnapshot) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {sampleFields.map(([field, label, required]) => (
          <div key={field} className="space-y-1">
            <Label htmlFor={`coa-sample-${itemSeq}-${field}`}>{label}{required ? " *" : ""}</Label>
            <Input
              id={`coa-sample-${itemSeq}-${field}`}
              type={field === "productionDate" ? "date" : "text"}
              value={field === "productionDate" ? dateInputValue(sample?.[field]) : sample?.[field] ?? ""}
              onChange={(event) => setSampleEdits((current) => ({ ...current, [itemSeq]: { ...current[itemSeq], [field]: event.target.value } }))}
            />
          </div>
        ))}
      </div>
    );
  }

  function renderResultFields(id: string, row: CoaResultSnapshot, onChange: (field: ResultField, value: string) => void) {
    return resultFields.map(([field, label, required]) => (
      <div key={field} className="space-y-1">
        <Label htmlFor={`${id}-${field}`}>{label}{required ? " *" : ""}</Label>
        <Input id={`${id}-${field}`} value={row[field] ?? ""} onChange={(event) => onChange(field, event.target.value)} />
      </div>
    ));
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
          <DialogDescription>เลือกผลพารามิเตอร์ที่ต้องการใส่ใน COA ระบบดึงค่าที่บันทึกไว้ให้อัตโนมัติ ตรวจและแก้ข้อมูลที่ไม่ตรงได้ก่อนสร้างร่าง</DialogDescription>
        </DialogHeader>
        {isFetching && <p role="status" className="text-sm text-muted-foreground">กำลังโหลดคำร้อง...</p>}
        {loadError && <div role="alert" className="text-sm text-destructive">โหลดคำร้องไม่สำเร็จ <Button variant="outline" onClick={() => refetch()}>ลองใหม่</Button></div>}
        {!isFetching && !loadError && petitions.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีคำร้องที่อนุมัติผล Lab พร้อมสร้าง COA</p>}
        {erp && (
          <Alert>
            <AlertTitle>คำขอจาก ERP {erp.saleOrderNo}</AlertTitle>
            <AlertDescription>
              {selectedItems.length
                ? `จับคู่กับคำร้อง ${selectedPetition?.petitionNo ?? ""} แล้ว ตรวจหรือแก้ข้อมูลด้านล่างได้ เลือกตัวอย่างอื่นได้ถ้าไม่ถูกต้อง`
                : "ยังไม่พบคำร้องที่ตรงกัน กรอกข้อมูลที่ขาดเองได้เลย หรือเลือกคำร้องเพื่อดึงผล Lab"}
            </AlertDescription>
          </Alert>
        )}
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
                  if (!erp) setSampleEdits({});
                  setResultEdits({});
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
        {!reusableActiveCoa && (selectedItems.length > 0 || manualMode) && (
          <fieldset disabled={create.isPending} className="space-y-4">
            <legend className="text-base font-semibold text-foreground">ข้อมูลที่ใช้ในฟอร์ม COA</legend>
            {manualMode && (
              <section className="space-y-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
                <h3 className="text-base font-semibold">ข้อมูลตัวอย่างจาก ERP</h3>
                {renderSampleFields(erpSeq, erpFormSample)}
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold">ผลที่จะแสดงใน COA</h4>
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setManualResults((current) => [...current, { itemSeq: erpSeq, testItem: "", result: "", criteria: "", unit: "", method: "" }])}>
                    <Plus className="h-4 w-4" />
                    เพิ่มผล
                  </Button>
                </div>
                {manualResults.map((row, index) => (
                  <div key={index} className="grid gap-2 rounded-md border bg-muted/50 p-3 sm:grid-cols-2">
                    {renderResultFields(`coa-manual-result-${index}`, row, (field, value) => setManualResults((current) => current.map((entry, rowIndex) => (rowIndex === index ? { ...entry, [field]: value } : entry))))}
                    {manualResults.length > 1 && (
                      <Button type="button" variant="outline" size="sm" className="gap-2 justify-self-start" onClick={() => setManualResults((current) => current.filter((_entry, rowIndex) => rowIndex !== index))}>
                        <Trash2 className="h-4 w-4" />
                        ลบผลนี้
                      </Button>
                    )}
                  </div>
                ))}
              </section>
            )}
            {source.isFetching && <p role="status" className="text-sm text-muted-foreground">กำลังโหลดผลพารามิเตอร์...</p>}
            {source.isError && <div role="alert" className="text-sm text-destructive">{source.error instanceof Error ? source.error.message : "โหลดผลไม่สำเร็จ"} <Button variant="outline" onClick={() => source.refetch()}>โหลดผลอีกครั้ง</Button></div>}
            {!source.isFetching && !source.isError && selectedItems.map((item) => {
              const options = sourceResults.filter((result) => result.itemSeq === item.seq);
              const selection = selections[item.seq];
              const selectedResultKeys = new Set(selection?.resultKeys ?? []);
              const sample = formSamples.find((entry) => entry.itemSeq === item.seq);
              const itemResults = formResults.filter(({ row }) => row.itemSeq === item.seq);
              return (
                <section key={item.seq} className="space-y-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
                  <h3 className="text-base font-semibold">{item.commonName || "ยังไม่ระบุชื่อสามัญ"} · {item.batchNo || item.lotNo || "-"}</h3>
                  {renderSampleFields(item.seq, sample)}
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
                  {itemResults.length > 0 && (
                    <fieldset className="space-y-2">
                      <legend className="text-sm font-semibold text-foreground">ผลที่จะแสดงใน COA</legend>
                      {itemResults.map(({ key, row }, index) => (
                        <div key={key} className="grid gap-2 rounded-md border bg-muted/50 p-3 sm:grid-cols-2">
                          {renderResultFields(`coa-result-${item.seq}-${index}`, row, (field, value) => setResultEdits((current) => ({ ...current, [key]: { ...current[key], [field]: value } })))}
                        </div>
                      ))}
                    </fieldset>
                  )}
                </section>
              );
            })}
            {!source.isFetching && !source.isError && (
              <section className="space-y-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
                <h3 className="text-base font-semibold">ข้อมูลผู้ขอ/ลูกค้า</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {customerFields.map(([field, label]) => (
                    <div key={field} className="space-y-1">
                      <Label htmlFor={`coa-customer-${field}`}>{label}</Label>
                      <Input id={`coa-customer-${field}`} value={formCustomer[field] ?? ""} onChange={(event) => setCustomerEdits((current) => ({ ...current, [field]: event.target.value }))} />
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="coa-remark">หมายเหตุ</Label>
                  <Textarea id="coa-remark" value={remark} onChange={(event) => setRemark(event.target.value)} />
                </div>
              </section>
            )}
            {!editedFormComplete && <p role="alert" className="text-sm text-destructive">แก้ไขข้อมูลแล้ว กรุณากรอกช่องที่มี * ให้ครบ</p>}
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
