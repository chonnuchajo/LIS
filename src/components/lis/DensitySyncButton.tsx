import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Radio, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface DensitySyncButtonProps {
  /** Petition item batch number to match against Result-Density. */
  batchNo: string;
  /** Whether existing entries hold hand-typed values (triggers overwrite confirm). */
  hasHandTyped: boolean;
  /** Called with the selected matched rows. */
  onRows: (docs: Record<string, unknown>[]) => void;
  disabled?: boolean;
}

/**
 * Pull DMA 501 density readings for `batchNo` from Result-Density. If none exist
 * yet, poll every 30 s until they appear. Staff choose which readings to apply.
 */
export default function DensitySyncButton({
  batchNo, hasHandTyped, onRows, disabled = false,
}: DensitySyncButtonProps) {
  const qc = useQueryClient();
  const [active, setActive] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const initializedRef = useRef(false);

  const { data, isError, error } = useQuery({
    queryKey: ['density-by-batch', batchNo],
    queryFn: () => api.getResultDensitiesByBatch(batchNo),
    enabled: active && !!batchNo,
    refetchInterval: (q) => (q.state.data?.docs?.length ? false : 30_000),
  });

  const docs = data?.docs ?? [];
  const rowKey = (doc: Record<string, unknown>, idx: number) => String(doc._id ?? idx);

  useEffect(() => {
    if (active && docs.length && !initializedRef.current) {
      initializedRef.current = true;
      setSelectedKeys(docs.map(rowKey));
      toast.success(`พบค่า ถพ. จากเครื่อง (${docs.length} รายการ)`);
    }
  }, [active, docs]);

  useEffect(() => {
    if (active && isError) {
      toast.error('ดึงค่าจากเครื่องไม่ได้ - กรอกมือได้', {
        description: error instanceof Error ? error.message : undefined,
      });
      setActive(false);
    }
  }, [active, isError, error]);

  const start = async () => {
    if (!batchNo) return;
    if (hasHandTyped && !window.confirm('มีค่าที่กรอกเอง จะเขียนทับด้วยค่าจากเครื่อง?')) return;
    initializedRef.current = false;
    setSelectedKeys([]);
    qc.removeQueries({ queryKey: ['density-by-batch', batchNo] });
    setActive(true);
    try {
      await api.triggerDensitySync();
    } catch {
      toast.warning('สั่งเครื่องส่งค่าไม่สำเร็จ - กำลังตรวจค่าที่มีอยู่');
    }
  };

  const toggle = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => (checked ? [...prev, key] : prev.filter((k) => k !== key)));
  };

  const applySelected = () => {
    const selected = docs.filter((doc, idx) => selectedKeys.includes(rowKey(doc, idx)));
    if (!selected.length) {
      toast.warning('กรุณาเลือกค่าที่จะใช้');
      return;
    }
    onRows(selected);
    toast.success(`ใช้ค่า ถพ. ที่เลือกแล้ว (${selected.length} รายการ)`);
    setActive(false);
  };

  if (active && docs.length) {
    return (
      <div className="w-full rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-semibold">เลือกค่า ถพ. ที่จะใช้รายงาน</span>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setActive(false)}>
            <X className="h-3.5 w-3.5" /> ยกเลิก
          </Button>
        </div>
        <div className="max-h-48 space-y-1 overflow-auto">
          {docs.map((doc, idx) => {
            const key = rowKey(doc, idx);
            return (
              <label key={key} className="flex cursor-pointer items-center gap-2 rounded bg-white/70 px-2 py-1.5">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selectedKeys.includes(key)}
                  onChange={(e) => toggle(key, e.target.checked)}
                />
                <span className="flex-1">{String(doc['Sample name'] ?? doc['Sample ID'] ?? `#${idx + 1}`)}</span>
                <span className="font-mono font-semibold">{String(doc['Density [g/cm³]'] ?? '')}</span>
                <span className="font-mono text-amber-700">{String(doc['T (block) [°C]'] ?? '')}</span>
              </label>
            );
          })}
        </div>
        <div className="mt-2 flex justify-end">
          <Button type="button" size="sm" className="h-8 px-3 text-xs" onClick={applySelected}>
            ใช้ค่าที่เลือก
          </Button>
        </div>
      </div>
    );
  }

  if (active && !docs.length) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        รอค่าจากเครื่อง...
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
