import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { AlertCircle, CheckCircle2, QrCode, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { Petition } from '@/types/petition.types';
import { PETITION_STATUS_CONFIG } from '@/types/petition.types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

const READER_ID = 'qc-receive-qr-reader';
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

async function receivePetition(id: string, actor?: string): Promise<Petition> {
  const res = await api.patch<Petition>(`/petitions/${id}/receive`, { actor });
  return res.data.data;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onReceived: () => void;
}

export default function QrReceiveModal({ open, onClose, onReceived }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('scanning');
  const [petition, setPetition] = useState<Petition | null>(null);
  const [pendingId, setPendingId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setPhase('scanning');
      setPetition(null);
      setPendingId('');
      setErrorMsg('');
    }
  }, [open]);

  // Start camera when in scanning phase
  useEffect(() => {
    if (!open || phase !== 'scanning') return;
    let active = true;

    (async () => {
      const scanner = new Html5Qrcode(READER_ID);
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      const onScan = (text: string) => {
        if (!active) return;
        fetchAndConfirm(text);
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
        if (active) {
          setPhase('error');
          setErrorMsg('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง');
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
  }, [open, phase]);

  async function fetchAndConfirm(rawCode: string) {
    const code = extractScannedCode(rawCode);
    if (!code) return;
    setPendingId(code);
    setPhase('loading');
    try {
      const found = await fetchPetitionByScannedCode(code);
      setPetition(found);
      setPendingId(found._id);
      // Only allow receive if status is sampleSent
      if (found.status !== 'sampleSent') {
        setErrorMsg(`คำร้องนี้สถานะ "${PETITION_STATUS_CONFIG[found.status]?.label ?? found.status}" — ไม่สามารถรับตัวอย่างซ้ำได้`);
        setPhase('error');
        return;
      }
      setPhase('confirming');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'ไม่พบข้อมูลคำร้อง';
      setErrorMsg(msg);
      setPhase('error');
    }
  }

  async function confirmReceive() {
    const id = petition?._id || pendingId;
    if (!id) return;
    setPhase('loading');
    try {
      const received = await receivePetition(id, user?.name || user?.email);
      setPetition(received);
      setPhase('success');
      onReceived();
      // Navigate to detail page so QC can start entering values
      navigate(`/qc-testing/${received._id}`);
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

  const targetStatusCfg = PETITION_STATUS_CONFIG.pendingReview;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary-500" />
            <h2 className="text-base font-bold">สแกน QR รับตัวอย่าง</h2>
          </div>
          <button onClick={onClose} className="text-grey-400 hover:text-grey-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Camera reader element — must stay mounted while scanning */}
          <div className={phase === 'scanning' ? 'block' : 'hidden'}>
            <div id={READER_ID} className="w-full rounded-lg overflow-hidden border" />
            <p className="mt-2 text-center text-sm text-grey-500">
              เล็งกล้องไปที่ QR Code บนใบคำร้องเพื่อรับตัวอย่าง
            </p>
          </div>
          {phase !== 'scanning' && <div id={READER_ID} className="hidden" />}

          {phase === 'loading' && (
            <p className="text-center text-sm text-grey-400 animate-pulse">
              กำลังดำเนินการ...
            </p>
          )}

          {phase === 'no-camera' && (
            <p className="text-center text-sm text-grey-500">ไม่พบกล้องในอุปกรณ์นี้</p>
          )}

          {phase === 'confirming' && petition && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">{petition.petitionNo}</span>
                <Badge variant={targetStatusCfg.variant}>→ {targetStatusCfg.label}</Badge>
              </div>
              <div className="text-sm space-y-1 text-grey-600">
                <p>ผู้นำส่ง: <span className="text-black-500">{petition.submittedBy?.name ?? '-'}</span></p>
                <p>แผนก: <span className="text-black-500">{petition.dept}</span></p>
                <p>จำนวน: <span className="text-black-500">{petition.items.length} รายการ</span></p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1" onClick={rescan}>
                  สแกนใหม่
                </Button>
                <Button variant="primary" className="flex-1" onClick={confirmReceive}>
                  ยืนยันรับตัวอย่าง
                </Button>
              </div>
            </div>
          )}

          {phase === 'success' && petition && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-5 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <p className="text-lg font-bold text-green-700">รับตัวอย่างแล้ว</p>
              <p className="text-sm text-grey-600">
                <span className="font-semibold">{petition.petitionNo}</span>
              </p>
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" className="flex-1" onClick={rescan}>
                  สแกนต่อ
                </Button>
                <Button variant="primary" className="flex-1" onClick={onClose}>
                  เสร็จสิ้น
                </Button>
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
              <p className="text-red-600 text-sm">{errorMsg || 'เกิดข้อผิดพลาด'}</p>
              <Button variant="primary" className="w-full" onClick={rescan}>
                ลองใหม่
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
