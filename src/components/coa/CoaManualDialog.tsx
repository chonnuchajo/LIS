import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CoaDocument, CoaResultSnapshot, CoaSampleSnapshot } from "@/types/coa.types";

export default function CoaManualDialog({ open, onOpenChange, request, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; request: CoaDocument; onSaved: (doc: CoaDocument) => void;
}) {
  const { user } = useAuth();
  const [sample, setSample] = useState<CoaSampleSnapshot>({ itemSeq: 1 });
  const [results, setResults] = useState<CoaResultSnapshot[]>([]);
  const [remark, setRemark] = useState("");
  const editing = request.sourceType === "erpManual";
  const save = useMutation({
    mutationFn: () => {
      const body = { externalRequestId: request.externalRequestId || request._id, sample, results, remark,
        _user: { name: user?.name, email: user?.email, role: user?.role, activeRole: user?.role } };
      return editing ? api.updateCoaDocument(request._id, body) : api.createManualCoaDocument(body);
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
  const valid = [sample.sampleName, sample.commonName, sample.batchNo, sample.productionDate].every((value) => value?.trim())
    && results.length > 0 && results.every((row) => row.testItem?.trim() && row.criteria?.trim() && row.result?.trim());
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
        <p className="text-sm text-muted-foreground">ผลทดสอบในฟอร์มนี้กรอกโดยผู้ใช้ กรุณาตรวจสอบข้อมูลก่อนส่งอนุมัติ</p>
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
