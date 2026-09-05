import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { selectDensitySyncRow } from '@/lib/densitySync';

interface DensitySyncButtonProps {
  /** Petition item batch number to match against Result-Density. */
  batchNo: string;
  /** Called with the selected matched rows. */
  onRows: (docs: Record<string, unknown>[]) => void;
  disabled?: boolean;
}

const EMPTY_DENSITY_DOCS: Record<string, unknown>[] = [];

/**
 * Pull DMA 501 density readings for `batchNo` from Result-Density. A single
 * valid row is used immediately; multiple rows use the repeat-selection rule.
 */
export default function DensitySyncButton({
  batchNo, onRows, disabled = false,
}: DensitySyncButtonProps) {
  const appliedKeyRef = useRef('');

  const { data, isError, error, isFetching } = useQuery({
    queryKey: ['density-by-batch', batchNo],
    queryFn: () => api.getResultDensitiesByBatch(batchNo),
    enabled: !disabled && !!batchNo,
    refetchInterval: (q) => (selectDensitySyncRow(q.state.data?.docs ?? EMPTY_DENSITY_DOCS) ? false : 30_000),
  });

  const docs = data?.docs ?? EMPTY_DENSITY_DOCS;

  useEffect(() => {
    appliedKeyRef.current = '';
  }, [batchNo]);

  useEffect(() => {
    const selected = selectDensitySyncRow(docs);
    if (selected) {
      const selectedIndex = Math.max(docs.indexOf(selected), 0);
      const selectedKey = `${batchNo}::${String(selected._id ?? selectedIndex)}`;
      if (appliedKeyRef.current === selectedKey) return;
      appliedKeyRef.current = selectedKey;
      onRows([selected]);
      toast.success('ใช้ค่า ถพ. จากเครื่องแล้ว (1 รายการ)');
    }
  }, [batchNo, docs, onRows]);

  useEffect(() => {
    if (isError) {
      toast.error('ตรวจค่า ถพ. จากฐานข้อมูลไม่ได้', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }, [isError, error]);

  if (disabled || !batchNo || selectDensitySyncRow(docs)) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-amber-600">
      {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      รอค่า ถพ. valid จาก Batch นี้ (ถ้ามีหลายค่า ต้องซ้ำ 3 ตำแหน่งต่อเนื่องอย่างน้อย 2 ครั้ง)
    </div>
  );
}
