import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FlaskConical, Loader2, AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePetition } from "@/hooks/usePetition";
import { api, type ParameterItem } from "@/lib/api";
import { useItemGroupMembership } from "@/hooks/useItemGroupMembership";
import { qcReceivedBy } from "@/lib/receiveStatus";
import { cn } from "@/lib/utils";
import {
  PETITION_DEPT_LABELS,
  type QCTestResult,
} from "@/types/petition.types";
import { buildApprovalGroups } from "@/lib/qcApprovalRows";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/context/ConfirmDialog";
import { RevisionRequestDialog } from "@/components/petition/RevisionRequestDialog";

export default function QCApprovalReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { user } = useAuth();
  const confirm = useConfirm();
  const [submitting, setSubmitting] = useState(false);
  const [retestTarget, setRetestTarget] = useState<"lab" | "qc" | "both">("lab");
  const [retestDialogOpen, setRetestDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [acceptReasonDialogOpen, setAcceptReasonDialogOpen] = useState(false);

  const { data: petition, loading, error } = usePetition(id);
  const groupMembership = useItemGroupMembership();
  const [parameters, setParameters] = useState<ParameterItem[]>([]);
  const [results, setResults] = useState<QCTestResult[]>([]);
  const [petitionHasAbnormal, setPetitionHasAbnormal] = useState(false);

  useEffect(() => {
    api.getParameters()
      .then((all) => setParameters(all.filter((p) => (p.scope ?? "qc") === "qc")))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    api.getQCResults(id).then(setResults).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) { setPetitionHasAbnormal(false); return; }
    api.getAbnormalFlags([id])
      .then((m) => setPetitionHasAbnormal(!!m[id]))
      .catch(() => {});
  }, [id]);

  const doApprove = useCallback(async (conclusion: "pass" | "accepted-oos", note?: string) => {
    if (!petition) return;
    setSubmitting(true);
    try {
      await api.approvePetition(petition._id, user?.name ?? "system", conclusion, note);
      toast.success(conclusion === "accepted-oos" ? "ยอมรับผลเรียบร้อย" : "อนุมัติเรียบร้อย");
      navigate("/qc-approval");
    } catch {
      toast.error("ดำเนินการไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }, [petition, user, navigate]);

  const handleApprovePass = useCallback(async () => {
    if (!(await confirm({ title: "ผลถูกต้อง", description: "ยืนยันว่าผลถูกต้องและอนุมัติคำร้องนี้?" }))) return;
    await doApprove("pass");
  }, [confirm, doApprove]);

  const handleAcceptOos = useCallback(async (note: string) => {
    setAcceptReasonDialogOpen(false);
    await doApprove("accepted-oos", note);
  }, [doApprove]);

  const handleRetest = useCallback(async (note: string) => {
    if (!petition) return;
    setSubmitting(true);
    try {
      await api.rejectPetition(petition._id, user?.name ?? "system", note, retestTarget);
      const label = retestTarget === "lab" ? "Lab" : retestTarget === "qc" ? "QC" : "Lab และ QC";
      toast.success(`ส่งกลับให้ ${label} ทดสอบใหม่เรียบร้อย`);
      setRetestDialogOpen(false);
      navigate("/qc-approval");
    } catch {
      toast.error("ส่งกลับไม่สำเร็จ");
      throw new Error("retest failed");
    } finally {
      setSubmitting(false);
    }
  }, [petition, user, retestTarget, navigate]);

  const handleReturnToRequester = useCallback(async (note: string) => {
    if (!petition) return;
    setSubmitting(true);
    try {
      await api.rejectPetition(petition._id, user?.name ?? "system", note, "requester");
      toast.success("ส่งคืนผู้ส่งให้แก้ product เรียบร้อย", { description: `ส่งให้ ${petition.submittedBy?.name ?? "ผู้ยื่น"}` });
      setReturnDialogOpen(false);
      navigate("/qc-approval");
    } catch {
      toast.error("ส่งคืนไม่สำเร็จ");
      throw new Error("return failed");
    } finally {
      setSubmitting(false);
    }
  }, [petition, user, navigate]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      </AppLayout>
    );
  }
  if (error || !petition) {
    return (
      <AppLayout>
        <div className="text-center text-grey-500">{error || "ไม่พบข้อมูลคำร้อง"}</div>
      </AppLayout>
    );
  }

  const groups = buildApprovalGroups(petition, parameters, results, groupMembership);

  return (
    <AppLayout title={petition.petitionNo}>
      <div className="space-y-6 pb-28">
        <PageHeader
          onBack={() => navigate("/qc-approval")}
          title={
            <span className="inline-flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary-500" />
              อนุมัติผล {petition.petitionNo}
            </span>
          }
          actions={
            <span className="text-sm text-grey-500">
              ผู้นำส่ง: {petition.submittedBy?.name ?? "-"}
            </span>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="blue-soft">{PETITION_DEPT_LABELS[petition.dept]}</Badge>
          <Badge variant="gray-soft" className="font-normal">
            ผู้รับงาน QC: {qcReceivedBy(petition) ?? "-"}
          </Badge>
          {petitionHasAbnormal ? (
            <span className="inline-flex items-center gap-1 text-red-600 text-sm">
              <AlertTriangle className="h-4 w-4" /> มีค่าผิดปกติ
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-green-600 text-sm">
              <CheckCircle2 className="h-4 w-4" /> ผลปกติทุกรายการ
            </span>
          )}
        </div>

        {(petition.labRedoExplanation || petition.qcRedoExplanation) && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm">
            <p className="font-semibold text-violet-700 mb-1">คำอธิบายการทำใหม่</p>
            {petition.labRedoExplanation && <p className="text-violet-800">Lab: {petition.labRedoExplanation}</p>}
            {petition.qcRedoExplanation && <p className="text-violet-800">QC: {petition.qcRedoExplanation}</p>}
          </div>
        )}

        {groups.map((g) => (
          <Card key={g.seq} className="overflow-hidden">
            <CardHeader className="pb-3 bg-grey-50">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <span>รายการที่ {g.seq}: {g.sampleName}</span>
                {g.batchNo && <Badge variant="gray-soft" className="font-normal">Batch: {g.batchNo}</Badge>}
                {g.sampleId && <Badge variant="primary-soft" className="font-normal text-xs">{g.sampleId}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-5">
              {g.unmatched ? (
                <p className="text-sm text-grey-400 italic">ไม่พบพารามิเตอร์ที่ตรงกับรายการทดสอบ</p>
              ) : (
                g.params.map((param) => (
                  <div key={param.parameterId} className="space-y-2">
                    <h3 className="text-sm font-semibold text-grey-800 border-b pb-1">{param.parameterName}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs text-grey-500">
                          <tr>
                            <th className="py-1 pr-3 font-medium">ช่อง</th>
                            <th className="py-1 pr-3 font-medium">ค่าที่บันทึก</th>
                            <th className="py-1 pr-3 font-medium">เกณฑ์มาตรฐาน</th>
                            <th className="py-1 pr-3 font-medium">สถานะ</th>
                            <th className="py-1 font-medium">หมายเหตุ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {param.rows.map((row) => (
                            <tr key={row.key} className={cn("border-t", row.abnormal && "bg-red-50")}>
                              <td className="py-1.5 pr-3">
                                {row.label}{row.unit ? <span className="text-grey-400"> ({row.unit})</span> : null}
                                {param.hasPhases && <span className="ml-1 text-[10px] text-amber-600">P{row.phase}</span>}
                              </td>
                              <td className="py-1.5 pr-3 font-mono font-semibold">{row.value || "-"}</td>
                              <td className="py-1.5 pr-3 text-grey-500">{row.standardText || "-"}</td>
                              <td className="py-1.5 pr-3">
                                {row.abnormal ? (
                                  <span className="inline-flex items-center gap-1 text-red-600">
                                    <AlertTriangle className="h-3.5 w-3.5" /> ผิดปกติ
                                  </span>
                                ) : (
                                  <span className="text-green-600">ปกติ</span>
                                )}
                              </td>
                              <td className="py-1.5 text-grey-600">{row.note || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}

        {/* แผงตัดสิน — fixed bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-50 md:left-72 px-4 sm:px-6 py-3 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">ถ้าให้ทดสอบใหม่ ส่งกลับไปยัง:</span>
              {([["lab", "Lab"], ["qc", "QC"], ["both", "ทั้งคู่"]] as const).map(([val, label]) => (
                <label key={val} className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="retestTarget" checked={retestTarget === val} onChange={() => setRetestTarget(val)} />
                  {label}
                </label>
              ))}
            </div>
            {!petitionHasAbnormal ? (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button variant="primary" size="sm" onClick={handleApprovePass} disabled={submitting} className="gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  ผลถูกต้อง
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRetestDialogOpen(true)} disabled={submitting} className="gap-2">
                  <RotateCcw className="h-4 w-4" /> ผลไม่ถูกต้อง
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button variant="primary" size="sm" onClick={() => setAcceptReasonDialogOpen(true)} disabled={submitting} className="gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  ยอมรับผล
                </Button>
                <Button variant="outline" size="sm" onClick={() => setReturnDialogOpen(true)} disabled={submitting} className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50">
                  <RotateCcw className="h-4 w-4" /> ส่งคืนผู้ส่งแก้ product
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRetestDialogOpen(true)} disabled={submitting} className="gap-2">
                  <RotateCcw className="h-4 w-4" /> ทดสอบใหม่
                </Button>
              </div>
            )}
          </div>
        </div>

        <RevisionRequestDialog
          open={retestDialogOpen}
          onOpenChange={setRetestDialogOpen}
          petitionNo={petition.petitionNo}
          submitterName={petition.submittedBy?.name ?? "ผู้ยื่น"}
          recipientLabel={retestTarget === "lab" ? "ผู้ทดสอบ Lab" : retestTarget === "qc" ? "ผู้ทดสอบ QC" : "ผู้ทดสอบ Lab และ QC"}
          warning={`คำร้องจะถูกส่งกลับให้${retestTarget === "both" ? "ทั้ง Lab และ QC" : retestTarget === "lab" ? "Lab" : "QC"}ทดสอบใหม่ (ไม่ปิดคำร้อง ไม่เกี่ยวกับผู้ส่ง)`}
          onConfirm={handleRetest}
        />
        <RevisionRequestDialog
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          petitionNo={petition.petitionNo}
          submitterName={petition.submittedBy?.name ?? "ผู้ยื่น"}
          recipientLabel={petition.submittedBy?.name ?? "ผู้ยื่น"}
          warning="คำร้องจะถูกปิดและส่งคืนผู้ส่งให้แก้ไข product ตามคำแนะนำ"
          onConfirm={handleReturnToRequester}
        />
        <RevisionRequestDialog
          open={acceptReasonDialogOpen}
          onOpenChange={setAcceptReasonDialogOpen}
          petitionNo={petition.petitionNo}
          submitterName={petition.submittedBy?.name ?? "ผู้ยื่น"}
          recipientLabel="ยอมรับผลไม่ปกติ"
          warning="คำร้องจะถูกอนุมัติโดยบันทึกผลไม่ปกติเป็นผลจริง — โปรดระบุเหตุผล"
          onConfirm={handleAcceptOos}
        />
      </div>
    </AppLayout>
  );
}
