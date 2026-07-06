import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import { api, type ParameterItem } from "@/lib/api";
import { useLabRequestsByPetition } from "@/hooks/usePetition";
import { useItemGroupMembership } from "@/hooks/useItemGroupMembership";
import { buildApprovalGroups } from "@/lib/qcApprovalRows";
import { buildLabReportPages } from "@/lib/labReport";
import LabResultReportTemplate, { LAB_REPORT_CSS } from "@/components/petition/LabResultReportTemplate";
import PrintPreviewDialog from "@/components/lis/PrintPreviewDialog";
import type { Petition, QCTestResult } from "@/types/petition.types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  petition: Petition | null;
}

export default function LabReportDialog({ open, onOpenChange, petition }: Props) {
  const petitionId = petition?._id;
  const { data: labRequests } = useLabRequestsByPetition(petitionId);
  const groupMembership = useItemGroupMembership();
  const [parameters, setParameters] = useState<ParameterItem[]>([]);
  const [results, setResults] = useState<QCTestResult[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [paramsLoaded, setParamsLoaded] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setParamsLoaded(false);
    api
      .getParameters()
      .then((all) =>
        setParameters(all.filter((p) => p.scope === "lab" || (p.scope === "qc" && p.shareWithLab === true))),
      )
      .catch(() => setParameters([]))
      .finally(() => setParamsLoaded(true));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!petitionId) {
      // No petition to load — resolve immediately so the dialog doesn't spin forever.
      setResults([]);
      setLoaded(true);
      return;
    }
    setLoaded(false);
    api
      .getQCResults(petitionId)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoaded(true));
  }, [open, petitionId]);

  // Both fetches (results + full parameter catalogue) must finish before the report
  // is considered ready — printing early risks a report with blank results (params=[]).
  const ready = loaded && paramsLoaded;

  const pages = useMemo(() => {
    if (!petition) return [];
    const groups = buildApprovalGroups(petition, parameters, results, groupMembership);
    return buildLabReportPages(petition, labRequests ?? [], groups);
  }, [petition, parameters, results, groupMembership, labRequests]);

  const report = <LabResultReportTemplate pages={pages} />;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>ใบรายงานผลการทดสอบ — {petition?.petitionNo ?? ""}</DialogTitle>
          </DialogHeader>

          {!ready ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> กำลังโหลด…
            </div>
          ) : (
            <div className="overflow-x-auto">{report}</div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>ปิด</Button>
            <Button onClick={() => setPrintOpen(true)} disabled={!ready || pages.length === 0} className="gap-2">
              <Printer className="h-4 w-4" /> พิมพ์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrintPreviewDialog open={printOpen} onOpenChange={setPrintOpen} docType="coa" css={LAB_REPORT_CSS}>
        {report}
      </PrintPreviewDialog>
    </>
  );
}
