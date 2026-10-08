import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CoaDocument, CoaResultSnapshot, CoaSampleSnapshot } from "@/types/coa.types";

const formLabels = {
  standard: "มาตรฐาน",
  grWpSp: "GR / WP / SP",
  liquid: "ยาน้ำ",
  bromadiolone0005: "Bromadiolone 0.005%",
} as const;

export default function CoaManualDialog({ open, onOpenChange, request, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; request: CoaDocument; onSaved: (doc: CoaDocument) => void;
}) {
  const { user } = useAuth();
  const [sample, setSample] = useState<CoaSampleSnapshot>({ itemSeq: 1 });
  const [results, setResults] = useState<CoaResultSnapshot[]>([]);
  const [remark, setRemark] = useState("");
  const editing = request.sourceType === "erpManual";
  const autofill = useQuery({
    queryKey: ["coa", "erp-autofill", request.externalRequestId || request._id],
    queryFn: () => api.getErpCoaAutofill(request.externalRequestId || request._id),
    enabled: open && !editing,
  });
  const save = useMutation({
    mutationFn: () => {
      const body = { externalRequestId: request.externalRequestId || request._id, sample, results, remark,
        _user: { name: user?.name, email: user?.email, role: user?.role, activeRole: user?.role } };
      return editing ? api.updateCoaDocument(request._id, body) : api.createErpManualCoaDocument(body);
    },
    onSuccess: (doc) => { onSaved(doc); onOpenChange(false); },
  });
  const reset = save.reset;
  useEffect(() => {
    if (!open) return;
    const source = request.sampleSnapshots[0] || { itemSeq: request.selectedItemSeqs[0] || 1 };
    setSample({ ...source, productionDate: source.productionDate?.slice(0, 10) || "" });
    setResults(request.resultSnapshots.length ? request.resultSnapshots.map((row) => ({ ...row }))
      : [{ itemSeq: source.itemSeq, testItem: "", criteria: "", result: "", unit: "", method: "" }]);
    setRemark(request.remark || "");
    reset();
  }, [open, request, reset]);
  useEffect(() => {
    if (!open || editing || !autofill.data) return;
    setSample((current) => ({ ...current, ...autofill.data.sample, productionDate: autofill.data.sample.productionDate?.slice(0, 10) || "" }));
    setResults(autofill.data.results.length
      ? autofill.data.results.map((row) => ({ ...row }))
      : [{ itemSeq: autofill.data.sample.itemSeq, testItem: "", criteria: "", result: "", unit: "", method: "" }]);
  }, [autofill.data, editing, open]);
  const valid = [sample.sampleName, sample.commonName, sample.batchNo, sample.productionDate].every((value) => value?.trim())
    && results.length > 0 && results.every((row) => row.testItem?.trim() && row.criteria?.trim() && row.result?.trim());
  function selectStockLot(lotNo: string) {
    const selected = autofill.data?.stockCandidates.find((candidate) => candidate.lotNo === lotNo);
    if (!selected) return;
    setSample((current) => ({ ...current, lotNo: selected.lotNo, batchNo: selected.lotNo, productionDate: selected.productionDate }));
  }
  const sampleFields: Array<[keyof CoaSampleSnapshot, string, string?]> = [
    ["sampleName", "ชื่อการค้า *"], ["commonName", "ชื่อสามัญ *"], ["batchNo", "Batch No. *"],
    ["productionDate", "วันที่ผลิต *", "date"], ["lotNo", "Lot No."], ["manufacturer", "ผู้ผลิต"],
  ];
  const resultFields: Array<[keyof CoaResultSnapshot, string]> = [
    ["testItem", "รายการทดสอบ *"], ["criteria", "เกณฑ์มาตรฐาน *"], ["result", "ผลทดสอบ *"], ["unit", "หน่วย"], ["method", "วิธีทดสอบ"],
  ];
  return <Dialog open={open} onOpenChange={(value) => { if (!save.isPending) onOpenChange(value); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{editing ? "แก้ไข COA แบบกรอกเอง" : "สร้าง COA แบบกรอกเอง"}</DialogTitle>
        <DialogDescription>ใบขาย {request.petitionNoSnapshot} · {request.customerSnapshot?.name} — บันทึกเป็นร่างแล้วส่งให้ QC Head อนุมัติ</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (valid && !save.isPending) save.mutate(); }}>
        {!editing && autofill.isFetching && <p role="status" className="text-sm text-muted-foreground">กำลังดึงข้อมูล ERP, LOT, MF และผล Lab...</p>}
        {!editing && autofill.isError && <Alert variant="destructive">
          <AlertTitle>ดึงข้อมูลอัตโนมัติไม่สำเร็จ</AlertTitle>
          <AlertDescription>{autofill.error instanceof Error ? autofill.error.message : "สามารถกรอกข้อมูลเองได้"}</AlertDescription>
        </Alert>}
        {!editing && autofill.data && <div className="space-y-2 rounded-lg border bg-card p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">สถานะการจับคู่ข้อมูล</span>
            <Badge variant={autofill.data.match?.matchKind === "exact" ? "green-soft" : "yellow-soft"}>
              {autofill.data.match?.matchKind === "exact" ? "ตรงกัน" : autofill.data.match ? "ใกล้เคียง" : "ไม่พบผล Lab"}
            </Badge>
            <Badge variant="blue-soft">แบบฟอร์ม: {formLabels[autofill.data.form.template]}</Badge>
            {autofill.data.dataSources.density && <Badge variant="blue-soft">มี Density</Badge>}
          </div>
          <p className="text-muted-foreground">
            {autofill.data.match ? `ผล Lab: ${autofill.data.match.petitionNo || "-"} · Batch ${autofill.data.match.batchNo || "-"}` : "ยังไม่พบผล Lab ที่ตรงกัน"}
          </p>
          {autofill.data.warnings.map((warning) => <p key={warning} className="text-sm text-muted-foreground">{warning}</p>)}
          <p className="text-xs text-muted-foreground">ตรวจสอบและแก้ไขข้อมูลทุกช่องได้ก่อนบันทึกร่าง COA</p>
        </div>}
        <p className="text-sm text-muted-foreground">ผลทดสอบที่ดึงจากระบบเป็นข้อมูลตั้งต้น กรุณาตรวจสอบก่อนส่งอนุมัติ</p>
        {!editing && (autofill.data?.stockCandidates.length || 0) > 0 && <div className="space-y-1">
          <Label htmlFor="erp-stock-lot">เลือก LOT NO. จาก Stock</Label>
          <select
            id="erp-stock-lot"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={autofill.data.stockCandidates.some((candidate) => candidate.lotNo === sample.lotNo) ? sample.lotNo : "__manual__"}
            onChange={(event) => selectStockLot(event.target.value)}
          >
            <option value="__manual__">กรอกเอง / ใช้ค่าปัจจุบัน</option>
            {autofill.data.stockCandidates.map((candidate) => <option key={candidate.lotNo} value={candidate.lotNo}>
              {candidate.lotNo} · ผลิต {candidate.productionDate || "ไม่ระบุ"} · คงเหลือ {candidate.quantity || 0}
            </option>)}
          </select>
        </div>}
        <div className="grid gap-3 sm:grid-cols-2">
          {sampleFields.map(([key, label, type]) => <div key={key} className="space-y-1">
            <Label htmlFor={`manual-${key}`}>{label}</Label>
            <Input id={`manual-${key}`} type={type || "text"} required={label.endsWith("*")} maxLength={1000}
              value={String(sample[key] || "")} onChange={(event) => setSample({ ...sample, [key]: event.target.value })} />
          </div>)}
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">ผลทดสอบ</h2>
          {results.map((row, index) => <div key={index} className="space-y-3 rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">รายการที่ {index + 1}</span>
              <Button type="button" variant="ghost" size="sm" disabled={results.length === 1} aria-label={`ลบผลทดสอบ ${index + 1}`}
                onClick={() => setResults(results.filter((_, i) => i !== index))}>ลบ</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {resultFields.map(([key, label]) => <div key={key} className="space-y-1">
                <Label htmlFor={`manual-result-${index}-${key}`}>{label}</Label>
                <Input id={`manual-result-${index}-${key}`} required={label.endsWith("*")} maxLength={1000} value={String(row[key] || "")}
                  onChange={(event) => setResults(results.map((entry, i) => i === index ? { ...entry, [key]: event.target.value } : entry))} />
              </div>)}
            </div>
          </div>)}
          <Button type="button" variant="outline" disabled={results.length >= 50}
            onClick={() => setResults([...results, { itemSeq: sample.itemSeq, testItem: "", criteria: "", result: "" }])}>เพิ่มรายการทดสอบ</Button>
        </div>
        <div className="space-y-1"><Label htmlFor="manual-remark">หมายเหตุ</Label>
          <Textarea id="manual-remark" maxLength={3000} value={remark} onChange={(event) => setRemark(event.target.value)} /></div>
        {save.isError && <p role="alert" className="text-sm text-destructive">{save.error instanceof Error ? save.error.message : "บันทึก COA ไม่สำเร็จ"}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button type="submit" disabled={!valid || save.isPending}>{save.isPending ? "กำลังบันทึก..." : "บันทึกร่าง COA"}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
