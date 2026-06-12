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
import { labReceivedBy } from "@/lib/receiveStatus";
import { cn } from "@/lib/utils";
import { PETITION_DEPT_LABELS, type QCTestResult } from "@/types/petition.types";
import { buildApprovalGroups } from "@/lib/qcApprovalRows";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/context/ConfirmDialog";
import { useCanAccessPath } from "@/hooks/useCanAccessPath";
import { RevisionRequestDialog } from "@/components/petition/RevisionRequestDialog";

export default function LabApprovalReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { user } = useAuth();
  const confirm = useConfirm();
  const canAccessPath = useCanAccessPath();
  const canApproveLab = canAccessPath("/lab-approval");
  const [submitting, setSubmitting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const { data: petition, loading, error } = usePetition(id);
  const groupMembership = useItemGroupMembership();
  const [parameters, setParameters] = useState<ParameterItem[]>([]);
  const [results, setResults] = useState<QCTestResult[]>([]);
  const [petitionHasAbnormal, setPetitionHasAbnormal] = useState(false);

  useEffect(() => {
    api.getParameters()
      .then((all) =>
        setParameters(
          all.filter((p) => p.scope === "lab" || (p.scope === "qc" && p.shareWithLab === true)),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    api.getQCResults(id).then(setResults).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) { setPetitionHasAbnormal(false); return; }
    let alive = true;
    api.getAbnormalFlags([id])
      .then((m) => { if (alive) setPetitionHasAbnormal(!!m[id]); })
      .catch(() => { if (alive) setPetitionHasAbnormal(false); });
    return () => { alive = false; };
  }, [id]);

  const handleApprove = useCallback(async () => {
    if (!petition) return;
    if (!(await confirm({ title: "อนุมัติผล Lab", description: "อนุมัติผลการทดสอบ Lab นี้?" }))) return;
    setSubmitting(true);
    try {
      await api.labApprovePetition(petition._id, user?.name ?? "system");
      toast.success("อนุมัติผล Lab เรียบร้อย");
      navigate("/lab-approval");
    } catch {
      toast.error("อนุมัติไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }, [petition, user, confirm, navigate]);

  const handleReject = useCallback(async (note: string) => {
    if (!petition) return;
    setSubmitting(true);
    try {
      await api.labRejectPetition(petition._id, user?.name ?? "system", note);
      toast.success("ส่งกลับให้ผู้ทดสอบ Lab แก้ไขเรียบร้อย");
      setRejectDialogOpen(false);
      navigate("/lab-approval");
    } catch {
      toast.error("ส่งกลับไม่สำเร็จ");
      throw new Error("reject failed");
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
          onBack={() => navigate("/lab-approval")}
          title={
            <span className="inline-flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-sky-500" />
              อนุมัติผล Lab {petition.petitionNo}
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
            ผู้รับงาน Lab: {labReceivedBy(petition) ?? "-"}
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

        {petition.labRedoExplanation && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm">
            <p className="font-semibold text-violet-700 mb-1">คำอธิบายการทำใหม่</p>
            <p className="text-violet-800">Lab: {petition.labRedoExplanation}</p>
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

        {/* แผงตัดสิน — fixed bottom (เฉพาะผู้มีสิทธิ์อนุมัติ Lab) */}
        {canApproveLab && (
          <div className="fixed bottom-0 left-0 right-0 z-50 md:left-72 px-4 sm:px-6 py-3 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button variant="primary" size="sm" onClick={handleApprove} disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                อนุมัติผล Lab
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRejectDialogOpen(true)} disabled={submitting} className="gap-2">
                <RotateCcw className="h-4 w-4" /> ส่งกลับให้แก้
              </Button>
            </div>
          </div>
        )}

        <RevisionRequestDialog
          open={rejectDialogOpen}
          onOpenChange={setRejectDialogOpen}
          petitionNo={petition.petitionNo}
          submitterName={petition.submittedBy?.name ?? "ผู้ทดสอบ Lab"}
          recipientLabel="ผู้ทดสอบ Lab"
          warning="คำร้องจะถูกส่งกลับให้ผู้ทดสอบ Lab แก้ไข/ทดสอบใหม่ (ไม่ปิดคำร้อง)"
          onConfirm={handleReject}
        />
      </div>
    </AppLayout>
  );
}
