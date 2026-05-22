import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText, Pencil, Printer, Trash2 } from 'lucide-react';
import AppLayout from '@/components/lis/AppLayout';
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
import PetitionPrintTemplate from '@/components/petition/PetitionPrintTemplate';
import ProductionPlanPrintTemplate from '@/components/petition/ProductionPlanPrintTemplate';
import SampleLabelPrintTemplate from '@/components/petition/SampleLabelPrintTemplate';
import { ICP_LADDA_LOGO_URL } from '@/lib/branding';
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

type PrintTarget = 'label' | 'agreement' | 'production-plan' | null;

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

export default function PetitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, loading, error } = usePetition(id);
  const { user } = useAuth();
  const { refetch: refetchSamples } = useSamples();
  const { data: labRequests } = useLabRequestsByPetition(data?._id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const autoPrintDone = useRef(false);
  const [printTarget, setPrintTarget] = useState<PrintTarget>(null);

  function triggerPrint(target: Exclude<PrintTarget, null>) {
    flushSync(() => setPrintTarget(target));
    const img = new Image();
    img.src = ICP_LADDA_LOGO_URL;
    if (img.complete && img.naturalWidth > 0) {
      window.print();
    } else {
      const done = () => window.print();
      img.onload = done;
      img.onerror = done;
    }
  }

  useEffect(() => {
    const img = new Image();
    img.src = ICP_LADDA_LOGO_URL;
  }, []);

  useEffect(() => {
    const before = () => {
      document.title = ' ';
    };
    const after = () => {
      document.title = 'ICPLadda - LIS';
      setPrintTarget(null);
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  useEffect(() => {
    const state = location.state as { autoPrint?: boolean } | null;
    if (state?.autoPrint && data && !loading && !autoPrintDone.current) {
      autoPrintDone.current = true;
      navigate(location.pathname, { replace: true, state: {} });
      setTimeout(() => triggerPrint('label'), 300);
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
          const isAdmin = user?.role === 'admin';
          const isRequester = user?.name === data.submittedBy?.name;
          const canEdit = data.status === 'deliveringQC' && isRequester;
          const canDelete = isAdmin || (data.status === 'deliveringQC' && isRequester);
          const isProduction = data.dept === 'production';
          const hasLabRequests = (labRequests?.length ?? 0) > 0;

          return (
            <div className="space-y-6">
              {printTarget === 'label' && (
                <div className="hidden print:block">
                  <SampleLabelPrintTemplate petition={data} />
                </div>
              )}
              {printTarget === 'agreement' && hasLabRequests && (
                <div className="hidden print:block">
                  <PetitionPrintTemplate labRequest={labRequests![0]} petition={data} />
                </div>
              )}
              {printTarget === 'production-plan' && isProduction && (
                <div className="hidden print:block">
                  {data.productionPlans.map((plan) => (
                    <ProductionPlanPrintTemplate
                      key={plan.batchNo}
                      plan={plan}
                      petition={data}
                    />
                  ))}
                </div>
              )}

              <div className="print:hidden space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={() => navigate('/petitions')}>
                    <ArrowLeft className="h-4 w-4" />
                    กลับ
                  </Button>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button variant="primary-outline" size="sm" onClick={() => triggerPrint('label')}>
                      <Printer className="h-4 w-4" />
                      พิมพ์ฉลาก
                    </Button>
                    {hasLabRequests && (
                      <Button
                        variant="primary-outline"
                        size="sm"
                        onClick={() => triggerPrint('agreement')}
                      >
                        <FileText className="h-4 w-4" />
                        พิมพ์ใบคำขอรับบริการ
                      </Button>
                    )}
                    {isProduction && (
                      <Button
                        variant="primary-outline"
                        size="sm"
                        onClick={() => triggerPrint('production-plan')}
                      >
                        <FileText className="h-4 w-4" />
                        พิมพ์ใบวางแผน-ควบคุมการผลิต
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        variant="primary-outline"
                        size="sm"
                        onClick={() => navigate(`/petitions/${data._id}/edit`)}
                      >
                        <Pencil className="h-4 w-4" />
                        แก้ไข
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="danger-outline"
                        size="sm"
                        onClick={() => setConfirmDelete(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                        ลบคำร้อง
                      </Button>
                    )}
                  </div>
                </div>

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
                  <h1 className="text-2xl font-bold text-black-500">{data.petitionNo}</h1>
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
            </div>
          );
        })()
      )}
    </AppLayout>
  );
}
