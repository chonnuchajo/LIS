import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FlaskConical, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Badge } from "@/components/ui/badge";
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

export default function QCApprovalReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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
      </div>
    </AppLayout>
  );
}
