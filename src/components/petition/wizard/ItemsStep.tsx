import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLotOptions } from '@/hooks/useExternalLookups';
import { isLabBatch } from '@/types/productionPlan.types';
import SubmitterPicker, { type SubmitterValues } from './SubmitterPicker';

export interface ItemRowValues {
  seq: number;
  sampleName: string;
  commonName: string;
  batchNo: string;
  productionDate: string | null;
  packageUnit: string;
  submissionNo: string;
  testUnit: string;
  testItems: string;
  note: string;
}

interface Props {
  value: ItemRowValues[];
  onChange: (v: ItemRowValues[]) => void;
  submitter: SubmitterValues;
  onSubmitterChange: (v: SubmitterValues) => void;
  submitterReadOnly?: boolean;
  deliverer: SubmitterValues;
  onDelivererChange: (v: SubmitterValues) => void;
}

export default function ItemsStep({
  value,
  onChange,
  submitter,
  onSubmitterChange,
  submitterReadOnly,
  deliverer,
  onDelivererChange,
}: Props) {
  const { options, optionMap, loading, error } = useLotOptions();

  function setItem(idx: number, patch: Partial<ItemRowValues>) {
    onChange(value.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function applyLot(idx: number, text: string) {
    const opt = optionMap.get(text);
    if (opt) {
      setItem(idx, {
        sampleName: opt.sampleName,
        batchNo: opt.batchNo,
        commonName: opt.commonName,
        productionDate: opt.productionDate,
        packageUnit: opt.packageUnit,
        note: opt.note,
      });
    } else {
      setItem(idx, { sampleName: text });
    }
  }

  function addItem() {
    onChange([
      ...value,
      {
        seq: value.length + 1,
        sampleName: '',
        commonName: '',
        batchNo: '',
        productionDate: null,
        packageUnit: '',
        submissionNo: '',
        testUnit: '',
        testItems: '',
        note: '',
      },
    ]);
  }

  function removeItem(idx: number) {
    onChange(value.filter((_, i) => i !== idx).map((it, i) => ({ ...it, seq: i + 1 })));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">ผู้ยื่นคำขอ และ ผู้นำส่ง</h2>
        <p className="text-sm text-grey-500">
          ผู้ยื่นคำขอ = ผู้ใช้งานที่เข้าสู่ระบบ · ผู้นำส่ง = ผู้ที่จะถือตัวอย่างไปส่ง (เลือกจากระบบ HR)
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <SubmitterPicker value={submitter} onChange={onSubmitterChange} readOnly={submitterReadOnly} />
          <SubmitterPicker value={deliverer} onChange={onDelivererChange} />
        </div>
      </div>

      <div className="border-t border-grey-200 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">รายการตัวอย่าง</h2>
          <p className="text-sm text-grey-500">
            กรอกเลข batch สำหรับทุกตัวอย่าง — batch ที่ลงท้ายด้วย 1 หรือ 6 จะถูกขอใบคำขอรับบริการในขั้นถัดไป
          </p>
        </div>
        <Button size="sm" variant="primary-outline" onClick={addItem}>
          <Plus className="h-4 w-4" />
          เพิ่มตัวอย่าง
        </Button>
      </div>

      {loading && <p className="text-sm text-grey-500">กำลังโหลด lot จาก MF/LDI...</p>}
      {error && <p className="text-sm text-yellow-600">{error}</p>}

      <datalist id="lot-options">
        {options.map((opt) => (
          <option key={opt.id} value={opt.label} />
        ))}
      </datalist>

      <div className="space-y-4">
        {value.map((it, idx) => {
          const lab = isLabBatch(it.batchNo);
          return (
            <div key={idx} className="rounded-[10px] border border-grey-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-base font-semibold">ตัวอย่างที่ {it.seq}</div>
                  {lab && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                      ส่ง lab (ลงท้าย {it.batchNo.slice(-1)})
                    </span>
                  )}
                </div>
                {value.length > 1 && (
                  <Button size="sm" variant="danger-outline" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-4 w-4" />
                    ลบ
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>ชื่อตัวอย่าง / ค้นหาจาก lot</Label>
                  <Input
                    list="lot-options"
                    value={it.sampleName}
                    onChange={(e) => applyLot(idx, e.target.value)}
                    placeholder="พิมพ์ชื่อหรือเลือก lot"
                  />
                </div>
                <div>
                  <Label>เลขแบช (Batch No.)</Label>
                  <Input
                    value={it.batchNo}
                    onChange={(e) => setItem(idx, { batchNo: e.target.value })}
                    placeholder="เช่น BN240601"
                  />
                </div>
                <div>
                  <Label>ชื่อสามัญ / Active Ingredient</Label>
                  <Input
                    value={it.commonName}
                    onChange={(e) => setItem(idx, { commonName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>วันผลิต</Label>
                  <Input
                    type="date"
                    value={it.productionDate ?? ''}
                    onChange={(e) => setItem(idx, { productionDate: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label>ขนาดบรรจุ / จำนวน</Label>
                  <Input
                    value={it.packageUnit}
                    onChange={(e) => setItem(idx, { packageUnit: e.target.value })}
                    placeholder="เช่น 1 kg × 20 ถุง"
                  />
                </div>
                <div>
                  <Label>เลขที่ใบนำส่ง</Label>
                  <Input
                    value={it.submissionNo}
                    onChange={(e) => setItem(idx, { submissionNo: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>หมายเหตุ</Label>
                  <Textarea
                    rows={2}
                    value={it.note}
                    onChange={(e) => setItem(idx, { note: e.target.value })}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
