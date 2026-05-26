import { useEffect, useState } from 'react';
import { Clock, Hourglass, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

type Phase = 1 | 2;

interface PhaseBannerProps {
  currentPhase: Phase;
  selectedPhase: Phase;
  onSelectPhase: (phase: Phase) => void;
  phase2DueAt?: string | null;
  phase2UnlockedAt?: string | null;
  triggeredByName?: string;
  /**
   * Hide the banner entirely when no parameter on the petition uses phases.
   * Caller controls; pass false to suppress rendering.
   */
  show?: boolean;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'พร้อม unlock';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days} วัน ${hours} ชม.`;
  if (hours > 0) return `${hours} ชม. ${mins} นาที`;
  if (mins > 0) return `${mins} นาที ${secs} วิ`;
  return `${secs} วินาที`;
}

export function PhaseBanner({
  currentPhase,
  selectedPhase,
  onSelectPhase,
  phase2DueAt,
  phase2UnlockedAt,
  triggeredByName,
  show = true,
}: PhaseBannerProps) {
  const [now, setNow] = useState(() => Date.now());
  const dueMs = phase2DueAt ? new Date(phase2DueAt).getTime() : null;
  const remaining = dueMs ? dueMs - now : null;
  const isWaiting = currentPhase === 1 && remaining != null && remaining > 0;

  useEffect(() => {
    if (!isWaiting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isWaiting]);

  if (!show) return null;

  const phase2Locked = currentPhase === 1;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs text-amber-800">
        <FlaskConical className="h-4 w-4" />
        <span className="font-medium">Parameter แบบ 2 phase</span>
        {isWaiting && dueMs ? (
          <span className="inline-flex items-center gap-1 ml-auto">
            <Hourglass className="h-3.5 w-3.5" />
            <span>เหลือ {formatRemaining(remaining ?? 0)}</span>
          </span>
        ) : null}
        {!isWaiting && phase2UnlockedAt ? (
          <span className="inline-flex items-center gap-1 ml-auto">
            <Clock className="h-3.5 w-3.5" />
            <span>Phase 2 พร้อมแล้ว</span>
          </span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSelectPhase(1)}
          className={cn(
            'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left',
            selectedPhase === 1
              ? 'bg-amber-200 text-amber-900 ring-1 ring-amber-300'
              : 'bg-white/60 text-grey-600 hover:bg-amber-100',
          )}
        >
          <div className="font-semibold">Phase 1: ค่าก่อน</div>
          <div className="text-xs opacity-80">บันทึกผลก่อนกระบวนการ (อบ/บ่ม/รอ)</div>
        </button>
        <button
          type="button"
          onClick={() => !phase2Locked && onSelectPhase(2)}
          disabled={phase2Locked}
          className={cn(
            'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left',
            selectedPhase === 2 && !phase2Locked
              ? 'bg-amber-200 text-amber-900 ring-1 ring-amber-300'
              : 'bg-white/60 text-grey-600 hover:bg-amber-100',
            phase2Locked && 'opacity-50 cursor-not-allowed hover:bg-white/60',
          )}
          title={phase2Locked ? 'รอ trigger ครบกำหนด' : ''}
        >
          <div className="font-semibold">
            Phase 2: ค่าหลัง {phase2Locked ? '🔒' : ''}
          </div>
          <div className="text-xs opacity-80">
            {triggeredByName ? `trigger: ${triggeredByName}` : 'บันทึกผลหลังกระบวนการ'}
          </div>
        </button>
      </div>
    </div>
  );
}
