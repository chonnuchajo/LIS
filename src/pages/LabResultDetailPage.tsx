import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FlaskConical, Loader2, Printer } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type ParameterItem } from "@/lib/api";
import { usePetition, useLabRequestsByPetition } from "@/hooks/usePetition";
import { useItemGroupMembership } from "@/hooks/useItemGroupMembership";
import { buildApprovalGroups } from "@/lib/qcApprovalRows";
import { buildLabResultReportPages } from "@/lib/labResultReport";
import { canPrintLabResult } from "@/lib/petitionPrintability";
import LabResultGroups from "@/components/petition/LabResultGroups";
import LabResultReportTemplate, { LAB_REPORT_CSS } from "@/components/petition/LabResultReportTemplate";
import PrintPreviewDialog from "@/components/lis/PrintPreviewDialog";
import { PETITION_DEPT_LABELS, type QCTestResult } from "@/types/petition.types";

const PHYSICAL_PARAMETER_NAME = "กายภาพ";

function isLabReportSourceParameter(parameter: ParameterItem): boolean {
  return parameter.scope === "lab" || parameter.name?.trim() === PHYSICAL_PARAMETER_NAME;
}

export default function LabResultDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: petition, loading, error } = usePetition(id);
  const { data: labRequests } = useLabRequestsByPetition(id);
  const groupMembership = useItemGroupMembership();
  const [parameters, setParameters] = useState<ParameterItem[]>([]);
  const [results, setResults] = useState<QCTestResult[]>([]);
  const [paramsLoaded, setParamsLoaded] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  // รายงานต้องใช้ Lab parameters + กายภาพ เพื่อเติมสภาพตัวอย่างใน header
  useEffect(() => {
    api
      .getParameters()
      .then((all) => setParameters(all.filter(isLabReportSourceParameter)))
      .catch(() => setParameters([]))
      .finally(() => setParamsLoaded(true));
  }, []);

  useEffect(() => {
    if (!id) return;
    api.getQCResults(id).then(setResults).catch(() => setResults([]));
  }, [id]);

  const groups = useMemo(() => {
    if (!petition) return [];
    return buildApprovalGroups(petition, parameters.filter((parameter) => parameter.scope === "lab"), results, groupMembership);
  }, [petition, parameters, results, groupMembership]);

  const pages = useMemo(
    () => (petition ? buildLabResultReportPages({ petition, labRequests: labRequests ?? [], parameters, qcResults: results, groupMembership }) : []),
    [petition, labRequests, parameters, results, groupMembership],
  );

  const report = <LabResultReportTemplate pages={pages} />;
  const labResultPrintable = petition ? canPrintLabResult(petition) && pages.length > 0 : false;

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

  return (
    <AppLayout title={petition.petitionNo}>
      <div className="space-y-6 pb-10">
        <PageHeader
          onBack={() => navigate("/lab-results")}
          title={
            <span className="inline-flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-sky-500" />
              ผลวิเคราะห์ Lab {petition.petitionNo}
            </span>
          }
          actions={
            <Button variant="primary-outline" onClick={() => labResultPrintable && setPrintOpen(true)} disabled={!labResultPrintable} className="gap-2">
              <Printer className="h-4 w-4" /> พิมพ์ผลวิเคราะห์ Lab
            </Button>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="blue-soft">{PETITION_DEPT_LABELS[petition.dept]}</Badge>
          <Badge variant="gray-soft" className="font-normal">
            ผู้นำส่ง: {petition.submittedBy?.name ?? "-"}
          </Badge>
        </div>

        {!paramsLoaded ? (
          <div className="flex items-center justify-center py-16 text-grey-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> กำลังโหลด…
          </div>
        ) : groups.length === 0 ? (
          <div className="py-12 text-center text-grey-400">ไม่มีรายการทดสอบ</div>
        ) : (
          <LabResultGroups groups={groups} />
        )}
      </div>

      <PrintPreviewDialog open={printOpen} onOpenChange={setPrintOpen} docType="coa" css={LAB_REPORT_CSS}>
        {report}
      </PrintPreviewDialog>
    </AppLayout>
  );
}
