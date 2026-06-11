import { AlertTriangle } from 'lucide-react';
import type { OutlierCheckResult } from '@/lib/aiApi';

interface AiOutlierBadgeProps {
  result: OutlierCheckResult | null | undefined;
}

export function AiOutlierBadge({ result }: AiOutlierBadgeProps) {
  if (!result?.warning) return null;
  const mean = result.mean != null ? result.mean.toFixed(4) : '?';
  const z = result.zScore != null ? result.zScore.toFixed(1) : '?';
  return (
    <p className="text-[11px] text-orange-600 flex items-center gap-1 mt-0.5">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      ค่าผิดปกติทางสถิติ — ค่าเฉลี่ยเดิม: {mean}, z = {z}
      {result.sampleSize != null && (
        <span className="text-orange-400 ml-0.5">(n={result.sampleSize})</span>
      )}
    </p>
  );
}
