import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Radio, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface DensitySyncButtonProps {
  /** Petition item batch number to match against Result-Density. */
  batchNo: string;
  /** Whether existing entries hold hand-typed values (triggers overwrite confirm). */
  hasHandTyped: boolean;
  /** Called once with the matched rows when readings arrive. */
  onRows: (docs: Record<string, unknown>[]) => void;
  disabled?: boolean;
}

/**
 * Pull DMA 501 density readings for `batchNo` from Result-Density and hand them to
 * `onRows`. If none exist yet, poll every 30 s until they appear, then stop. The
 * parent owns persistence (saveQCEntries) and entry mapping.
 */
export default function DensitySyncButton({
  batchNo, hasHandTyped, onRows, disabled = false,
}: DensitySyncButtonProps) {
  const [active, setActive] = useState(false);
  const appliedRef = useRef(false);

  const { data, isError, error } = useQuery({
    queryKey: ['density-by-batch', batchNo],
    queryFn: () => api.getResultDensitiesByBatch(batchNo),
    enabled: active && !!batchNo,
    refetchInterval: (q) => (q.state.data?.docs?.length ? false : 30_000),
  });

  const docs = data?.docs ?? [];

  // Apply once when readings arrive (initial fetch or a later poll).
  useEffect(() => {
    if (active && docs.length && !appliedRef.current) {
      appliedRef.current = true;
      onRows(docs);
      toast.success(`ดึงค่า ถพ. จากเครื่องแล้ว (${docs.length} รายการ)`);
      setActive(false);
    }
  }, [active, docs, onRows]);

  useEffect(() => {
    if (active && isError) {
      toast.error('ดึงค่าจากเครื่องไม่ได้ — กรอกมือได้', {
        description: error instanceof Error ? error.message : undefined,
      });
      setActive(false);
    }
  }, [active, isError, error]);

  const start = () => {
    if (!batchNo) return;
    if (hasHandTyped && !window.confirm('มีค่าที่กรอกเอง จะเขียนทับด้วยค่าจากเครื่อง?')) return;
    appliedRef.current = false;
    setActive(true);
  };

  if (active && !docs.length) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        รอค่าจากเครื่อง…
        <Button
          type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2"
          onClick={() => setActive(false)}
        >
          <X className="h-3.5 w-3.5" /> ยกเลิก
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button" variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs"
      onClick={start}
      disabled={disabled || !batchNo}
      title={!batchNo ? 'ไม่มีเลข batch' : 'ดึงค่า ถพ. จากเครื่อง DMA 501 ตามเลข batch'}
    >
      <Radio className="h-3.5 w-3.5" /> ดึงค่า ถพ.
    </Button>
  );
}
