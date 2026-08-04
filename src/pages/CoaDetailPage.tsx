import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { FileCheck2, Printer } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import PrintPreviewDialog from "@/components/lis/PrintPreviewDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import CoaAuditTimeline from "@/components/coa/CoaAuditTimeline";
import CoaReportTemplate, { COA_REPORT_CSS } from "@/components/coa/CoaReportTemplate";
import CoaStatusBadge from "@/components/coa/CoaStatusBadge";
import { api } from "@/lib/api";
import { buildCoaReportPages } from "@/lib/coaReport";
import { allowedCoaActions, canPrintCoa } from "@/lib/coaStatus";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRoles, primaryRole } from "@/lib/roles";

export default function CoaDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [printOpen, setPrintOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { data: doc, isLoading, isError, error } = useQuery({
    queryKey: ["coa", id],
    queryFn: () => api.getCoaDocument(id),
    enabled: Boolean(id),
  });
  const roles = normalizeRoles(user);
  const activeRole = user?.role || primaryRole(roles);
  const actor = {
    name: user?.name,
    email: user?.email,
    role: activeRole,
    activeRole,
    roles,
    permissions: user?.permissions ?? [],
    position: user?.position,
  };
  const isQcHead = [user?.role, actor.activeRole, user?.position]
    .some((value) => String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_") === "qc_head")
    || actor.permissions.includes("coa.approve");
  const pages = useMemo(() => (doc ? buildCoaReportPages(doc) : []), [doc]);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["coa", id] });
  const submit = useMutation({ mutationFn: () => api.submitCoaDocument(id, { _user: actor }), onSuccess: invalidate });
  const approve = useMutation({ mutationFn: () => api.approveCoaDocument(id, { _user: actor }), onSuccess: invalidate });
  const reject = useMutation({ mutationFn: () => api.rejectCoaDocument(id, { reason, _user: actor }), onSuccess: invalidate });
  const revise = useMutation({ mutationFn: () => api.reviseCoaDocument(id, { _user: actor }), onSuccess: (next) => navigate(`/coa/${next._id}`) });
  const cancel = useMutation({ mutationFn: () => api.cancelCoaDocument(id, { reason, _user: actor }), onSuccess: invalidate });
  const recordPrint = useMutation({
    mutationFn: (meta: { copies: number; outputMode: string }) => api.recordCoaPrintEvent(id, { event: "printDialogOpened", ...meta, _user: actor }),
    onSuccess: invalidate,
  });

  if (isLoading || !doc) {
    if (isError) {
      return <AppLayout><div className="p-6 text-destructive">{error instanceof Error ? error.message : "ไม่สามารถโหลด COA ได้"}</div></AppLayout>;
    }
    return <AppLayout><div className="p-6 text-muted-foreground">กำลังโหลด...</div></AppLayout>;
  }

  const actions = allowedCoaActions(doc.status, isQcHead);
  const printable = actions.includes("print") && canPrintCoa(doc.status);

  return (
    <AppLayout title={doc.coaNo || "COA"}>
      <div className="space-y-6 p-6">
        <PageHeader
          onBack={() => navigate("/coa")}
          title={<span className="inline-flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-sky-500" />{doc.coaNo || "ร่าง COA"}</span>}
          actions={<Button className="gap-2" disabled={!printable} onClick={() => setPrintOpen(true)}><Printer className="h-4 w-4" />พิมพ์ COA</Button>}
        />
        <div className="flex flex-wrap items-center gap-2">
          <CoaStatusBadge status={doc.status} />
          <span className="text-sm text-muted-foreground">{doc.petitionNoSnapshot}</span>
          {doc.revision > 0 && <span className="text-sm text-muted-foreground">Rev.{doc.revision}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.includes("submit") && <Button onClick={() => submit.mutate()}>ส่งอนุมัติ</Button>}
          {actions.includes("approve") && (
            <>
              <Button onClick={() => approve.mutate()}>QC Head อนุมัติ</Button>
              <Button variant="destructive" disabled={!reason.trim()} onClick={() => reject.mutate()}>ไม่อนุมัติ</Button>
            </>
          )}
          {actions.includes("revise") && (
            <>
              <Button variant="outline" onClick={() => revise.mutate()}>สร้างฉบับแก้ไข</Button>
              {isQcHead && <Button variant="destructive" disabled={!reason.trim()} onClick={() => cancel.mutate()}>ยกเลิก COA</Button>}
            </>
          )}
        </div>
        <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="เหตุผลสำหรับไม่อนุมัติหรือยกเลิก" />
        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-semibold">ตัวอย่างและผลทดสอบ</h2>
          {doc.sampleSnapshots.map((sample) => (
            <div key={sample.itemSeq} className="mb-4 rounded-md border p-3">
              <div className="font-medium">{sample.sampleName || sample.commonName || `Sample ${sample.itemSeq}`}</div>
              <div className="text-sm text-muted-foreground">{sample.batchNo || sample.lotNo || "-"}</div>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {doc.resultSnapshots.filter((row) => row.itemSeq === sample.itemSeq).map((row, index) => (
                  <li key={index}>{row.testItem}: {row.result}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
        <section>
          <h2 className="mb-3 font-semibold">ประวัติเอกสาร</h2>
          <CoaAuditTimeline audit={doc.audit} />
        </section>
      </div>
      <PrintPreviewDialog open={printOpen} onOpenChange={setPrintOpen} docType="coa" css={COA_REPORT_CSS} onPrinted={(meta) => recordPrint.mutate(meta)}>
        <CoaReportTemplate pages={pages} />
      </PrintPreviewDialog>
    </AppLayout>
  );
}
