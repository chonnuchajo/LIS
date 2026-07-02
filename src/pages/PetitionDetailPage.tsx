import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileCheck2, FileText, Pencil, Printer, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import AppLayout from '@/components/lis/AppLayout';
import PageHeader from '@/components/lis/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import PetitionView from '@/components/petition/PetitionView';
import { DevStatusStepper } from '@/components/petition/DevStatusStepper';
import PetitionPrintTemplate from '@/components/petition/PetitionPrintTemplate';
import ResultReportPrintTemplate from '@/components/petition/ResultReportPrintTemplate';
import PrintPreviewDialog from '@/components/lis/PrintPreviewDialog';
import SampleLabelPrintTemplate from '@/components/petition/SampleLabelPrintTemplate';
import ReviewHistory from '@/components/review/ReviewHistory';
import {
  usePetition,
  deletePetition,
  useLabRequestsByPetition,
} from '@/hooks/usePetition';
import {
  PETITION_DEPT_LABELS,
  PETITION_STATUS_CONFIG,
  type Petition,
  type ReviewEntry,
} from '@/types/petition.types';
import { useAuth } from '@/hooks/useAuth';
import { useSamples } from '@/context/SampleContext';
import { useItemGroupMembership } from '@/hooks/useItemGroupMembership';
import { normalizeRoles } from "@/lib/roles";
import { api, type ParameterItem } from '@/lib/api';
import type { QCTestResult } from '@/types/petition.types';
import { findSgParameter, type SgParameter } from '@/lib/formSpecificGravity';
import { buildApprovalGroups } from '@/lib/qcApprovalRows';
import { buildLaLisAssistant, type LaLisIssue } from '@/lib/laLisAssistant';

function QcNoteSection({ petition }: { petition: Petition }) {
  const qcNote = (petition.reviewHistory ?? []).find((e) => e.action === 'note') ?? null;
  const qcItems = petition.items.filter((item) => item.sampleId || item.condition);

  return (
    <div>
      <p className="text-sm font-semibold text-black-700 mb-2">QC บันทึก</p>
      {qcNote ? (
        <div className="rounded-[10px] border border-primary-200 bg-primary-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="text-sm font-semibold text-primary-600">บันทึก QC</span>
            <span className="text-xs text-grey-500">
              โดย {qcNote.reviewedBy} ·{' '}
              {new Date(qcNote.reviewedAt).toLocaleString('th-TH', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </div>
          {qcNote.note && (
            <p className="text-sm text-black-500 whitespace-pre-wrap">{qcNote.note}</p>
          )}
          {qcItems.length > 0 && (
            <div className="space-y-1.5">
              {qcItems.map((item) => (
                <p key={item.seq} className="text-xs text-grey-500">
                  <span className="font-semibold text-black-500">
                    {item.seq}. {item.sampleName}
                  </span>
                  {item.sampleId && (
                    <span> · เลขตัวอย่าง: <span className="text-black-500">{item.sampleId}</span></span>
                  )}
                  {item.condition && (
                    <span>
                      {' '}· สภาพ:{' '}
                      <span
                        className={
                          item.condition === 'normal'
                            ? 'text-green-500 font-medium'
                            : 'text-red-500 font-medium'
                        }
                      >
                        {item.condition === 'normal' ? 'ปกติ' : 'ไม่ปกติ'}
                      </span>
                    </span>
                  )}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-grey-500">ยังไม่มีการบันทึก QC</p>
      )}
    </div>
  );
}

function DecisionSection({ history }: { history: ReviewEntry[] }) {
  if (history.length === 0) return null;
  return (
    <div className="border-t border-black-50 pt-4">
      <p className="text-sm font-semibold text-black-700 mb-3">ผลการพิจารณา</p>
      <ReviewHistory history={history} />
    </div>
  );
}

function IssueList({ items }: { items: LaLisIssue[] }) {
  return (
    <div className="space-y-1.5">
      {items.map((item, index) => (
        <div key={`${item.text}-${index}`} className="flex gap-2 text-sm">
          {item.level === 'danger' ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          ) : item.level === 'warn' ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          )}
          <span className={item.level === 'danger' ? 'text-red-700' : item.level === 'warn' ? 'text-amber-700' : 'text-grey-600'}>
            {item.text}
          </span>
        </div>
      ))}
    </div>
  );
}

function LaLisAssistantPanel({
  summary,
}: {
  summary: ReturnType<typeof buildLaLisAssistant>;
}) {
  return (
    <Card className="border-primary-100 bg-primary-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary-500" />
          La-LIS Assistant
          <Badge variant={summary.abnormalCount ? 'red-soft' : 'green-soft'}>
            OOS {summary.abnormalCount}
          </Badge>
          <Badge variant={summary.missingResultCount ? 'yellow-soft' : 'green-soft'}>
            Missing {summary.missingResultCount}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-3">
        <div>
          <p className="mb-2 text-sm font-semibold text-black-700">Report Completeness</p>
          <IssueList items={summary.readiness} />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-black-700">OOS / Deviation</p>
          <IssueList items={summary.oos} />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-black-700">COA Draft Assistant</p>
          <p className="rounded-md border border-primary-100 bg-white/70 p-3 text-sm text-grey-700">
            {summary.draft}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

type PetitionDetailPageProps = {
  mode?: 'petition' | 'result';
};

export default function PetitionDetailPage({ mode = 'petition' }: PetitionDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, loading, error, refresh } = usePetition(id);
  const { user } = useAuth();
  const { refetch: refetchSamples } = useSamples();
  const groupMembership = useItemGroupMembership();
  const { data: labRequests } = useLabRequestsByPetition(data?._id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const autoPrintDone = useRef(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [labelPrintOpen, setLabelPrintOpen] = useState(false);
  const [preReportOpen, setPreReportOpen] = useState(false);
  const [finalReportOpen, setFinalReportOpen] = useState(false);
  // ค่า ถ.พ. บนใบคำขอรับบริการ ดึงจากผล QC + พารามิเตอร์ ถพ. — โหลดแบบ lazy ตอนเปิดพิมพ์
  const [parameters, setParameters] = useState<ParameterItem[]>([]);
  const [qcResults, setQcResults] = useState<QCTestResult[]>([]);
  const [sgParam, setSgParam] = useState<SgParameter | null>(null);

  useEffect(() => {
    if (!data?._id) return;
    let cancelled = false;
    (async () => {
      try {
        const [results, params] = await Promise.all([
          api.getQCResults(data._id),
          api.getParameters(),
        ]);
        if (cancelled) return;
        setQcResults(results ?? []);
        setParameters(params ?? []);
        setSgParam(findSgParameter(params));
      } catch {
        /* คอลัมน์ ค่า ถ.พ. ปล่อยว่างถ้าโหลดไม่สำเร็จ */
      }
    })();
    return () => { cancelled = true; };
  }, [data?._id]);

  const assistantGroups = useMemo(
    () => data ? buildApprovalGroups(data, parameters, qcResults, groupMembership) : [],
    [data, parameters, qcResults, groupMembership],
  );
  const laLisSummary = useMemo(
    () => data ? buildLaLisAssistant(data, labRequests, assistantGroups) : null,
    [data, labRequests, assistantGroups],
  );

  useEffect(() => {
    const state = location.state as { autoPrint?: boolean } | null;
    if (state?.autoPrint && data && !loading && !autoPrintDone.current) {
      autoPrintDone.current = true;
      navigate(location.pathname, { replace: true, state: {} });
      setTimeout(() => setLabelPrintOpen(true), 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading]);

  async function handleDelete() {
    if (!data) return;
    setDeleting(true);
    try {
      await deletePetition(data._id, user?.name || user?.email);
      refetchSamples();
      navigate('/petitions', { replace: true });
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <AppLayout
      className="print:block print:min-h-0 print:bg-white"
      mainClassName="p-4 sm:p-6 overflow-auto print:block print:w-full print:p-0 print:overflow-visible"
    >
      {loading ? (
        <p className="text-grey-500">กำลังโหลดข้อมูล...</p>
      ) : error || !data ? (
        <div className="rounded-[10px] border border-red-500 bg-red-50 p-4 text-sm text-red-500">
          โหลดข้อมูลไม่สำเร็จ: {error ?? 'ไม่พบคำร้อง'}
        </div>
      ) : (
        (() => {
          const statusCfg =
            PETITION_STATUS_CONFIG[data.status] ?? { label: data.status, variant: 'gray-soft' as const };
          const isAdmin = normalizeRoles(user).includes('admin');
          const isRequester = user?.name === data.submittedBy?.name;
          const canEdit = data.status === 'deliveringQC' && isRequester;
          const canDelete = isAdmin || (data.status === 'deliveringQC' && isRequester);
          const hasLabRequests = (labRequests?.length ?? 0) > 0;
          const isResultMode = mode === 'result';

          return (
            <div className="space-y-6">
              <div className="print:hidden space-y-6">
                {data.status === 'rejected' && (() => {
                  const rejectEntry = [...(data.reviewHistory ?? [])].reverse().find((e) => e.action === 'reject');
                  const isSubmitter =
                    !!user?.employeeId &&
                    !!data.submittedBy?.employeeId &&
                    user.employeeId === data.submittedBy.employeeId;
                  return (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-5 w-5 text-orange-500" />
                        <p className="text-sm font-semibold text-orange-800">คำร้องนี้ถูกส่งกลับให้แก้ไข</p>
                      </div>
                      {rejectEntry && (
                        <>
                          <p className="text-xs text-orange-700">
                            ผู้ตรวจสอบ: {rejectEntry.reviewedBy} · เมื่อ{' '}
                            {new Date(rejectEntry.reviewedAt).toLocaleString('th-TH', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                          {rejectEntry.note && (
                            <p className="text-sm text-black-700 whitespace-pre-wrap rounded border border-orange-200 bg-white px-3 py-2">
                              {rejectEntry.note}
                            </p>
                          )}
                        </>
                      )}
                      {isSubmitter && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(`/petitions/new?revisionOf=${data._id}`)}
                          className="gap-2"
                        >
                          <RotateCcw className="h-4 w-4" />
                          ยื่นแก้ไขใหม่
                        </Button>
                      )}
                    </div>
                  );
                })()}
                <PageHeader
                  onBack={() => navigate(isResultMode ? '/record-results' : '/petitions')}
                  title={isResultMode ? `ผลวิเคราะห์ ${data.petitionNo}` : data.petitionNo}
                  actions={
                    <>
                      {isResultMode ? null : <Button variant="primary-outline" size="sm" onClick={() => setLabelPrintOpen(true)}>
                        <Printer className="h-4 w-4" />
                        พิมพ์ฉลาก
                      </Button>}
                      {!isResultMode && hasLabRequests && (
                        <Button
                          variant="primary-outline"
                          size="sm"
                          onClick={() => setPrintOpen(true)}
                        >
                          <FileText className="h-4 w-4" />
                          พิมพ์ใบคำขอรับบริการ
                        </Button>
                      )}
                      <Button
                        variant="primary-outline"
                        size="sm"
                        onClick={() => setPreReportOpen(true)}
                      >
                        <FileText className="h-4 w-4" />
                        Pre Report
                      </Button>
                      {data.status === 'approved' && (
                        <Button
                          variant="primary-outline"
                          size="sm"
                          onClick={() => setFinalReportOpen(true)}
                        >
                          <FileCheck2 className="h-4 w-4" />
                          Final Report
                        </Button>
                      )}
                      {!isResultMode && canEdit && (
                        <Button
                          variant="primary-outline"
                          size="sm"
                          onClick={() => navigate(`/petitions/${data._id}/edit`)}
                        >
                          <Pencil className="h-4 w-4" />
                          แก้ไข
                        </Button>
                      )}
                      {!isResultMode && canDelete && (
                        <Button
                          variant="danger-outline"
                          size="sm"
                          onClick={() => setConfirmDelete(true)}
                        >
                          <Trash2 className="h-4 w-4" />
                          ลบคำร้อง
                        </Button>
                      )}
                    </>
                  }
                />

                <AlertDialog
                  open={confirmDelete}
                  onOpenChange={(open) => {
                    if (!open && !deleting) setConfirmDelete(false);
                  }}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>ยืนยันการลบคำร้องนี้?</AlertDialogTitle>
                      <AlertDialogDescription>
                        กำลังจะลบคำร้อง "{data.petitionNo}" — การลบไม่สามารถย้อนกลับได้
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleting}>ยกเลิก</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={deleting}
                        onClick={(e) => {
                          e.preventDefault();
                          handleDelete();
                        }}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {deleting ? 'กำลังลบ...' : 'ยืนยัน'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <div className="flex flex-wrap items-baseline gap-3">
                  <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                  <Badge variant="blue-soft">{PETITION_DEPT_LABELS[data.dept]}</Badge>
                  <span className="text-xs text-grey-500">
                    ยื่นเมื่อ{' '}
                    {new Date(data.createdAt).toLocaleString('th-TH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>

                <DevStatusStepper petitionId={data._id} status={data.status} onChanged={refresh} />

                {laLisSummary && <LaLisAssistantPanel summary={laLisSummary} />}

                <PetitionView petition={data} />

                {(data.reviewHistory?.length ?? 0) > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>บันทึก QC / ผลการพิจารณา</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <QcNoteSection petition={data} />
                      <DecisionSection history={data.reviewHistory ?? []} />
                    </CardContent>
                  </Card>
                )}
              </div>

              {hasLabRequests && (
                <PrintPreviewDialog open={printOpen} onOpenChange={setPrintOpen} docType="service-request">
                  <PetitionPrintTemplate labRequest={labRequests![0]} petition={data} qcResults={qcResults} sgParam={sgParam} />
                </PrintPreviewDialog>
              )}
              {data && (
                <PrintPreviewDialog open={labelPrintOpen} onOpenChange={setLabelPrintOpen} docType="sample-label">
                  <SampleLabelPrintTemplate petition={data} />
                </PrintPreviewDialog>
              )}
              <PrintPreviewDialog open={preReportOpen} onOpenChange={setPreReportOpen} docType="coa">
                <ResultReportPrintTemplate kind="pre" petition={data} labRequests={labRequests ?? []} qcResults={qcResults} />
              </PrintPreviewDialog>
              <PrintPreviewDialog open={finalReportOpen} onOpenChange={setFinalReportOpen} docType="coa">
                <ResultReportPrintTemplate kind="final" petition={data} labRequests={labRequests ?? []} qcResults={qcResults} />
              </PrintPreviewDialog>
            </div>
          );
        })()
      )}
    </AppLayout>
  );
}
