import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import {
  AlertCircle, CheckCircle2, QrCode,
  Package, User, Building2, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Petition } from '@/types/petition.types';
import { PETITION_STATUS_CONFIG } from '@/types/petition.types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ICP_LADDA_LOGO_URL } from '@/lib/branding';
import { useAuth } from '@/hooks/useAuth';

const READER_ID = 'icp-qr-reader';
type Phase = 'idle' | 'scanning' | 'confirming' | 'loading' | 'success' | 'error' | 'no-camera';

function extractScannedCode(raw: string): string {
  const text = raw.trim();
  if (!text) return '';

  try {
    const payload = JSON.parse(text) as { id?: unknown; petitionId?: unknown; petitionNo?: unknown; sampleId?: unknown };
    const value = payload.id ?? payload.petitionId ?? payload.petitionNo ?? payload.sampleId;
    if (value) return String(value).trim();
  } catch {
    // QR may be plain text or a URL.
  }

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
  } catch (scanErr) {
    const res = await api.get<Petition>(`/petitions/${encodeURIComponent(code)}`);
    return res.data.data;
  }
}

async function deliverPetition(id: string, actor?: string): Promise<Petition> {
  try {
    const res = await api.patch<Petition>(`/petitions/${id}/deliver`, { status: 'sampleSent', actor });
    return res.data.data;
  } catch {
    const res = await api.patch<Petition>(`/petitions/${id}`, { status: 'sampleSent', actor });
    return res.data.data;
  }
}

export default function ScannerPage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>('idle');
  const [petition, setPetition] = useState<Petition | null>(null);
  const [pendingId, setPendingId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (phase !== 'scanning') return;
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
          const back = cameras.find((c) =>
            /back|environment|rear|หลัง|后|背面/i.test(c.label),
          );
          const cam = back ?? (cameras.length > 1 ? cameras[cameras.length - 1] : cameras[0]);
          await startWith(cam.id);
        }

        if (!active) { scanner.stop().catch(() => {}); return; }
        scannerRef.current = scanner;
      } catch {
        if (active) {
          setPhase('error');
          setErrorMsg('ไม่สามารถเปิดกล้องหลังได้ กรุณาอนุญาตการเข้าถึงกล้อง');
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
  }, [phase]);

  async function fetchAndConfirm(id: string) {
    const code = extractScannedCode(id);
    if (!code) return;
    setPendingId(code);
    setPhase('loading');
    try {
      const found = await fetchPetitionByScannedCode(code);
      setPetition(found);
      setPendingId(found._id);
      setPhase('confirming');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'ไม่พบข้อมูลคำร้อง กรุณาตรวจสอบรหัส';
      setErrorMsg(msg);
      setPhase('error');
    }
  }

  async function confirmDeliver() {
    const id = petition?._id || pendingId;
    if (!id) return;
    setPhase('loading');
    try {
      const delivered = await deliverPetition(id, user?.name || user?.email);
      setPetition(delivered);
      setPhase('success');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      setErrorMsg(msg);
      setPhase('error');
    }
  }

  function reset() {
    setPetition(null);
    setPendingId('');
    setErrorMsg('');
    setPhase('idle');
  }

  useEffect(() => {
    if (phase !== 'success') return;
    const t = setTimeout(reset, 10000);
    return () => clearTimeout(t);
  }, [phase]);

  const targetStatusCfg = PETITION_STATUS_CONFIG.sampleSent;

  return (
    <div className="min-h-screen bg-grey-50 flex flex-col items-center py-8 px-4">
      <div className="mb-6 text-center">
        <img
          src={ICP_LADDA_LOGO_URL}
          alt="ICP Ladda"
          className="h-10 mx-auto mb-3"
        />
        <div className="flex items-center gap-2 justify-center">
          <QrCode className="w-5 h-5 text-primary-500" />
          <h1 className="text-lg font-bold text-black-500">ส่งตัวอย่าง</h1>
        </div>
        <p className="mt-2 text-xs text-grey-500">
          กดปุ่ม "สแกน QR Code" แล้วเล็งกล้องไปที่ QR Code บนใบคำร้องเพื่อยืนยันการส่งตัวอย่าง
        </p>
      </div>

      <div className={`w-full max-w-sm mb-4 ${phase === 'scanning' ? 'block' : 'hidden'}`}>
        <div id={READER_ID} className="w-full rounded-xl overflow-hidden border border-grey-200" />
        <button
          onClick={reset}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm text-grey-500 hover:text-grey-700 transition-colors"
        >
          <X className="w-4 h-4" />
          ยกเลิกการสแกน
        </button>
      </div>
      {phase !== 'scanning' && <div id={READER_ID} className="hidden" />}

      <div className="w-full max-w-sm space-y-4">

        {(phase === 'idle' || phase === 'no-camera') && (
          <>
            {phase !== 'no-camera' && (
              <Button
                variant="primary"
                className="w-full flex items-center gap-2 justify-center"
                onClick={() => setPhase('scanning')}
              >
                <QrCode className="w-4 h-4" />
                สแกน QR Code
              </Button>
            )}

            {phase === 'no-camera' && (
              <p className="text-center text-xs text-grey-400">ไม่พบกล้องในอุปกรณ์นี้</p>
            )}
          </>
        )}

        {phase === 'scanning' && (
          <p className="text-center text-sm text-grey-500">
            วางกล้องให้เห็น QR Code บนหน้าจอ
          </p>
        )}

        {phase === 'loading' && (
          <p className="text-center text-sm text-grey-400 animate-pulse">
            กำลังดำเนินการ...
          </p>
        )}

        {phase === 'confirming' && petition && (
          <div className="rounded-xl border border-primary-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-primary-500 px-4 py-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-white" />
              <span className="text-white font-semibold text-sm">ตรวจสอบคำร้องก่อนยืนยัน</span>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-black-500">{petition.petitionNo}</span>
                <Badge variant={targetStatusCfg.variant}>{targetStatusCfg.label}</Badge>
              </div>

              <div className="border-t border-grey-100" />

              <div className="flex gap-2 text-sm">
                <User className="w-4 h-4 text-grey-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-black-500">{petition.requester.fullName}</p>
                  <p className="text-grey-400 text-xs">{petition.requester.email}</p>
                </div>
              </div>

              <div className="flex gap-2 text-sm">
                <Building2 className="w-4 h-4 text-grey-400 mt-0.5 shrink-0" />
                <span className="text-grey-600">{petition.requester.department}</span>
              </div>

              {petition.items.length > 0 && (
                <div className="bg-grey-50 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-medium text-grey-500 mb-1.5">
                    รายการตัวอย่าง ({petition.items.length} รายการ)
                  </p>
                  {petition.items.slice(0, 3).map((item, i) => (
                    <p key={i} className="text-xs text-black-500">
                      {i + 1}. {item.sampleName}
                      {item.batchNo && (
                        <span className="text-grey-400 ml-1">Lot: {item.batchNo}</span>
                      )}
                    </p>
                  ))}
                  {petition.items.length > 3 && (
                    <p className="text-xs text-grey-400">+{petition.items.length - 3} รายการ</p>
                  )}
                </div>
              )}

              <div className="border-t border-grey-100" />

              <div className="flex gap-2 pt-1">
                <Button variant="danger" className="flex-1" onClick={reset}>
                  ยกเลิก
                </Button>
                <Button
                  variant="success"
                  className="flex-1 flex items-center gap-1.5 justify-center"
                  onClick={confirmDeliver}
                >
                  ยืนยัน
                </Button>
              </div>
            </div>
          </div>
        )}

        {phase === 'success' && petition && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-3">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <p className="text-2xl font-bold text-green-700">ส่งตัวอย่างแล้ว</p>
            <div className="flex justify-center">
              <Badge variant={targetStatusCfg.variant}>{targetStatusCfg.label}</Badge>
            </div>
            <p className="text-sm text-grey-500">
              คำร้องเลขที่{' '}
              <span className="font-semibold text-black-500">{petition.petitionNo}</span>
            </p>
            <p className="text-xs text-grey-400">
              {petition.requester.fullName} · {petition.requester.department}
            </p>
            <Button variant="primary" className="mt-2 w-full" onClick={reset}>
              กลับ
            </Button>
          </div>
        )}

        {phase === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <p className="text-red-600 font-medium">{errorMsg || 'เกิดข้อผิดพลาด'}</p>
            <Button variant="primary" className="w-full" onClick={reset}>
              ลองใหม่
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
