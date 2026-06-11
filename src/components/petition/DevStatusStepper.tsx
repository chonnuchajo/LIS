import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { DEV_MODE } from '@/config/dev';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { nextPetitionStatuses } from '@/lib/petitionStatusFlow';
import {
  PETITION_STATUS_CONFIG,
  type PetitionStatus,
} from '@/types/petition.types';

interface DevStatusStepperProps {
  petitionId: string;
  status: PetitionStatus;
  onChanged: () => void;
}

// เครื่องมือ dev-only: ดัน petition.status ไปสเตปถัดไปทีละขั้น (ห้ามข้าม)
// เพื่อเทสต์ feature ที่ขึ้นกับ status โดยไม่ต้องเดิน flow จริง
// โผล่เฉพาะ DEV_MODE — return null ใน prod
export const DevStatusStepper = ({ petitionId, status, onChanged }: DevStatusStepperProps) => {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!DEV_MODE) return null;

  const actor = user?.name || user?.email || '__dev__';
  const nexts = nextPetitionStatuses(status);

  const advance = async (to: PetitionStatus) => {
    setBusy(true);
    setError(null);
    try {
      if (to === 'approved') {
        await api.approvePetition(petitionId, actor);
      } else if (to === 'rejected') {
        await api.rejectPetition(petitionId, actor, '[dev] ทดสอบ reject');
      } else {
        await api.devSetPetitionStatus(petitionId, to, actor);
      }
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-orange-300 bg-orange-50 p-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          dev
        </span>
        <span className="text-xs text-orange-700">เปลี่ยน status (สเตปถัดไป):</span>
        {nexts.length === 0 ? (
          <span className="text-xs font-medium text-orange-600">ปิดแล้ว — ไม่มีสเตปถัดไป</span>
        ) : (
          nexts.map((to) => (
            <button
              key={to}
              type="button"
              disabled={busy}
              onClick={() => advance(to)}
              className="inline-flex items-center gap-1 rounded border border-orange-400 bg-white px-2 py-1 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-50"
            >
              <ArrowRight className="h-3 w-3" />
              {PETITION_STATUS_CONFIG[to]?.label ?? to}
            </button>
          ))
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};
