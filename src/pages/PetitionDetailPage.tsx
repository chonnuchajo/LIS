import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText, Pencil, Printer, Stamp, Trash2 } from 'lucide-react';
import AppSidebar from '@/components/lis/AppSidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PetitionView from '@/components/petition/PetitionView';
import PetitionPrintTemplate from '@/components/petition/PetitionPrintTemplate';
import SampleLabelPrintTemplate from '@/components/petition/SampleLabelPrintTemplate';
import ReviewHistory from '@/components/review/ReviewHistory';
import LabAgreementReviewView from '@/components/review/LabAgreementReviewView';
import { usePetition, deletePetition } from '@/hooks/usePetition';
import {
  PETITION_STATUS_CONFIG,
  type Petition,
  type ReviewEntry,
} from '@/types/petition.types';
import { useAuth } from '@/hooks/useAuth';
import { useSamples } from '@/context/SampleContext';

const FINAL_STATUSES = new Set(['normal', 'defective']);

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
          {(qcNote.specificGravities?.filter((sg) => sg.value).length ?? 0) > 0 && (
            <div className="space-y-1">
              {qcNote.specificGravities!.filter((sg) => sg.value).map((sg) => (
                <p key={sg.seq} className="text-xs text-grey-500">
                  {sg.seq}. {sg.sampleName} ·{' '}
                  <span className="font-semibold text-black-500">ค.ถ. {sg.value}</span>
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canActAsReviewer = user?.role === 'qc' || user?.role === 'admin';
  const autoPrintDone = useRef(false);
  const [printTarget, setPrintTarget] = useState<'label' | 'agreement' | null>(null);

  function triggerPrint(target: 'label' | 'agreement') {
    flushSync(() => setPrintTarget(target));
    window.print();
  }

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
      await deletePetition(data._id);
      refetchSamples();
      navigate('/petitions', { replace: true });
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background print:block print:min-h-0 print:bg-white">
      <div className="print:hidden">
        <AppSidebar />
      </div>
      <main className="flex-1 p-6 overflow-auto print:block print:w-full print:p-0 print:overflow-visible">
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
            const isRequester = user?.email === data.requester.email;
            const canEdit = data.status === 'deliveringQC' && isRequester;
            const canDelete = isAdmin || (data.status === 'deliveringQC' && isRequester);
            const canReview = !FINAL_STATUSES.has(data.status) && canActAsReviewer;

            return (
              <div className="space-y-6">
                {printTarget === 'label' && (
                  <div className="hidden print:block">
                    <SampleLabelPrintTemplate petition={data} />
                  </div>
                )}
                {printTarget === 'agreement' && (
                  <div className="hidden print:block">
                    <PetitionPrintTemplate petition={data} />
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
                      {data.labAgreementReview && (
                        <Button
                          variant="primary-outline"
                          size="sm"
                          onClick={() => triggerPrint('agreement')}
                        >
                          <FileText className="h-4 w-4" />
                          พิมพ์ข้อตกลง
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
                      {canDelete && !confirmDelete && (
                        <Button
                          variant="danger-outline"
                          size="sm"
                          onClick={() => setConfirmDelete(true)}
                        >
                          <Trash2 className="h-4 w-4" />
                          ลบคำร้อง
                        </Button>
                      )}
                      {canDelete && confirmDelete && (
                        <>
                          <span className="self-center text-sm text-red-500 font-medium">
                            ยืนยันการลบคำร้องนี้?
                          </span>
                          <Button variant="danger" size="sm" disabled={deleting} onClick={handleDelete}>
                            {deleting ? 'กำลังลบ...' : 'ยืนยัน'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deleting}
                            onClick={() => setConfirmDelete(false)}
                          >
                            ยกเลิก
                          </Button>
                        </>
                      )}
                      {canReview && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(`/petitions/${data._id}/review`)}
                        >
                          <Stamp className="h-4 w-4" />
                          พิจารณา
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-3">
                    <h1 className="text-2xl font-bold text-black-500">{data.petitionNo}</h1>
                    <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
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

                  {canActAsReviewer && data.labAgreementReview && (
                    <Card>
                      <CardHeader>
                        <CardTitle>การทบทวนข้อตกลงการให้บริการ (สำหรับเจ้าหน้าที่)</CardTitle>
                        <p className="text-xs text-grey-500 mt-0.5">
                          FM-QP-07-01-001-R02 — รายงานหัวหน้าห้องปฏิบัติการ
                        </p>
                      </CardHeader>
                      <CardContent>
                        <LabAgreementReviewView data={data.labAgreementReview} />
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            );
          })()
        )}
      </main>
    </div>
  );
}
