import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { AlertCircle, CheckCircle2, Keyboard, QrCode, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { Petition } from '@/types/petition.types';
import { PETITION_DEPT_LABELS, PETITION_STATUS_CONFIG } from '@/types/petition.types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { normalizeRoles } from '@/lib/roles';
import { isAssignedTo } from '@/lib/assignment';

const READER_ID = 'lab-accept-qr-reader';
const FULL_ACCESS_ROLES = new Set(['admin', 'lab-head']);
const isLabBatchNo = (batchNo?: string | null) => /[16]$/.test(String(batchNo ?? '').trim());

type Phase = 'scanning' | 'confirming' | 'loading' | 'success' | 'error' | 'no-camera';

function extractScannedCode(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  try {
    const payload = JSON.parse(text) as { id?: unknown; petitionId?: unknown; petitionNo?: unknown; sampleId?: unknown };
    const value = payload.id ?? payload.petitionId ?? payload.petitionNo ?? payload.sampleId;
    if (value) return String(value).trim();
  } catch { /* not JSON */ }
  try {
    const url = new URL(text);
    const parts = url.pathname.split('/').filter(Boolean);
    return decodeURIComponent(parts[parts.length - 1] || text).trim();
  } catch {
    return text;
  }
}

async function fetchPetitionByScannedCode(code: string): Promise<Petition> {
  try {
    const res = await api.get<Petition>(`/petitions/scan/${encodeURIComponent(code)}`);
    return res.data.data;
  } catch {
    const res = await api.get<Petition>(`/petitions/${encodeURIComponent(code)}`);
    return res.data.data;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAccepted: () => void;
  /** โหมดกรอกเลขคำร้องอย่างเดียว (ไม่เปิดกล้อง) — ใช้กับปุ่ม "กรอกเลขรับงาน" */
  manualOnly?: boolean;
}

export default function LabScanAcceptModal({ open, onClose, onAccepted, manualOnly = false }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isFullAccess = normalizeRoles(user).some((r) => FULL_ACCESS_ROLES.has(r));

  const [phase, setPhase] = useState<Phase>('scanning');
  const [petition, setPetition] = useState<Petition | null>(null);
  const [pendingId, setPendingId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (open) {
      setPhase('scanning');
      setPetition(null);
      setPendingId('');
      setErrorMsg('');
      setManualCode('');
    }
  }, [open]);

  useEffect(() => {
    if (!open || phase !== 'scanning' || manualOnly) return;
    let active = true;

    (async () => {
      const scanner = new Html5Qrcode(READER_ID);
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      const onScan = (text: string) => {
        if (!active) return;
        fetchAndCheck(text);
      };

      const startWith = (source: MediaTrackConstraints | string) =>
        scanner.start(source, config, onScan, () => {});

      try {
        try {
          await startWith({ facingMode: { exact: 'environment' } });
        } catch {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras.length === 0) {
            if (active) setPhase('no-camera');
            return;
          }
          const back = cameras.find((c) => /back|environment|rear|หลัง|后|背面/i.test(c.label));
          const cam = back ?? (cameras.length > 1 ? cameras[cameras.length - 1] : cameras[0]);
          await startWith(cam.id);
        }
        if (!active) { scanner.stop().catch(() => {}); return; }
        scannerRef.current = scanner;
      } catch {
        // เปิดกล้องไม่ได้ (PC ไม่มีกล้อง / permission โดน block / enumerate ล้ม)
        // → fallback ไปกรอกเลขเอง แทนที่จะค้างหน้า error ทางตัน
        if (active) {
          setErrorMsg('เปิดกล้องไม่ได้ — กรอกเลขคำร้องเองได้เลย');
          setPhase('no-camera');
        }
      }
    })();

    return () => {
      active = false;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        try {
          const state = s.getState();
          if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
            s.stop().catch(() => {});
          }
        } catch { /* ignore */ }
      }
    };
  }, [open, phase, manualOnly]);

  async function fetchAndCheck(rawCode: string) {
    const code = extractScannedCode(rawCode);
    if (!code) return;
    setPendingId(code);
    setPhase('loading');
    try {
      const found = await fetchPetitionByScannedCode(code);

      // Must have at least one lab item
      const hasLab = (found.items ?? []).some((it) => isLabBatchNo(it.batchNo));
      if (!hasLab) {
        setErrorMsg('คำร้องนี้ไม่มีรายการ Lab');
        setPhase('error');
        return;
      }

      // Check assignment
      if (!found.assignedTo) {
        setErrorMsg('คำร้องนี้ยังไม่ได้รับการมอบหมาย กรุณาติดต่อหัวหน้า');
        setPhase('error');
        return;
      }
      if (!isFullAccess && !isAssignedTo(found.assignedTo, user)) {
        setErrorMsg(`คุณไม่ได้ถูก assign งานนี้ (มอบหมายให้: ${found.assignedTo.name})`);
        setPhase('error');
        return;
      }

      // Already completed
      if (found.status === 'success') {
        setErrorMsg(`คำร้องนี้ทดสอบเสร็จสิ้นแล้ว`);
        setPhase('error');
        return;
      }

      // Already received by Lab — navigate directly (status อาจ pendingReview จากฝั่ง QC รับก่อน)
      if (found.labReceivedAt) {
        onAccepted();
        navigate(`/lab-testing/${found._id}`);
        return;
      }

      setPetition(found);
      setPendingId(found._id);
      setPhase('confirming');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'ไม่พบข้อมูลคำร้อง';
      setErrorMsg(msg);
      setPhase('error');
    }
  }

  async function confirmAccept() {
    const id = petition?._id || pendingId;
    if (!id) return;
    setPhase('loading');
    try {
      const received = await api.patch<Petition>(`/petitions/${id}/receive`, {
        actor: user?.name || user?.email,
        side: 'lab',
      });
      const updated = received.data.data;
      setPetition(updated);
      setPhase('success');
      onAccepted();
      navigate(`/lab-testing/${updated._id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      setErrorMsg(msg);
      setPhase('error');
    }
  }

  function rescan() {
    setPetition(null);
    setPendingId('');
    setErrorMsg('');
    setPhase('scanning');
  }

  if (!open) return null;

  const labItemCount = petition ? (petition.items ?? []).filter((it) => isLabBatchNo(it.batchNo)).length : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            {manualOnly ? (
              <Keyboard className="h-5 w-5 text-sky-500" />
            ) : (
              <QrCode className="h-5 w-5 text-sky-500" />
            )}
            <h2 className="text-base font-bold">
              {manualOnly ? 'กรอกเลขรับงาน Lab' : 'สแกน QR รับงาน Lab'}
            </h2>
          </div>
          <button onClick={onClose} className="text-grey-400 hover:text-grey-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Camera reader — keep mounted during scanning (ไม่ใช้ในโหมด manualOnly) */}
          <div className={phase === 'scanning' && !manualOnly ? 'block' : 'hidden'}>
            <div id={READER_ID} className="w-full rounded-lg overflow-hidden border" />
            <p className="mt-2 text-center text-sm text-grey-500">
              เล็งกล้องไปที่ QR Code บนใบคำร้องเพื่อรับงาน
            </p>
          </div>
          {phase !== 'scanning' && <div id={READER_ID} className="hidden" />}

          {phase === 'loading' && (
            <p className="text-center text-sm text-grey-400 animate-pulse">
              กำลังดำเนินการ...
            </p>
          )}

          {phase === 'no-camera' && (
            <p className="text-center text-sm text-grey-500">{errorMsg || 'ไม่พบกล้องในอุปกรณ์นี้'}</p>
          )}

          {(phase === 'scanning' || phase === 'no-camera') && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const code = manualCode.trim();
                if (!code) return;
                setManualCode('');
                fetchAndCheck(code);
              }}
              className="space-y-2"
            >
              {!manualOnly && (
                <div className="flex items-center gap-2 text-xs text-grey-400">
                  <div className="h-px flex-1 bg-grey-200" />
                  <span>หรือ</span>
                  <div className="h-px flex-1 bg-grey-200" />
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="พิมพ์เลขที่คำร้อง เช่น P-2506-0001"
                  autoFocus={manualOnly}
                  className="flex-1 rounded-lg border border-grey-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
                />
                <Button type="submit" variant="primary" disabled={!manualCode.trim()}>
                  รับงาน
                </Button>
              </div>
            </form>
          )}

          {phase === 'confirming' && petition && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-sky-600">{petition.petitionNo}</span>
                <Badge variant={PETITION_STATUS_CONFIG.pendingReview.variant}>
                  → {PETITION_STATUS_CONFIG.pendingReview.label}
                </Badge>
              </div>
              <div className="text-sm space-y-1 text-grey-600">
                <p>แผนก: <span className="text-grey-900">{PETITION_DEPT_LABELS[petition.dept]}</span></p>
                <p>รายการ Lab: <span className="text-grey-900">{labItemCount} รายการ</span></p>
                {petition.assignedTo && (
                  <p>มอบหมายให้: <span className="font-medium text-sky-700">{petition.assignedTo.name}</span></p>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1" onClick={rescan}>
                  {manualOnly ? 'กรอกใหม่' : 'สแกนใหม่'}
                </Button>
                <Button variant="primary" className="flex-1" onClick={confirmAccept}>
                  รับงาน
                </Button>
              </div>
            </div>
          )}

          {phase === 'success' && petition && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-5 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
              <p className="text-base font-bold text-green-700">รับงานแล้ว</p>
              <p className="text-sm text-grey-600">{petition.petitionNo}</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
              <p className="text-red-600 text-sm">{errorMsg || 'เกิดข้อผิดพลาด'}</p>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={onClose}>
                  ปิด
                </Button>
                <Button variant="primary" className="flex-1" onClick={rescan}>
                  {manualOnly ? 'กรอกใหม่' : 'สแกนใหม่'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
