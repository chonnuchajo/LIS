import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { isLabBatch } from '@/types/productionPlan.types';
import SubmitterPicker, { type SubmitterValues } from './SubmitterPicker';

export interface ItemRowValues {
  seq: number;
  sampleName: string;
  commonName: string;
  batchNo: string;
  lotNo: string;
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
  submitterDepartment?: string;
  deliverer: SubmitterValues;
  onDelivererChange: (v: SubmitterValues) => void;
  itemsReadOnly?: boolean;
}

export default function ItemsStep({
  value,
  onChange,
  submitter,
  onSubmitterChange,
  submitterReadOnly,
  submitterDepartment,
  deliverer,
  onDelivererChange,
  itemsReadOnly = false,
}: Props) {
  function setItem(idx: number, patch: Partial<ItemRowValues>) {
    onChange(value.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addItem() {
    onChange([
      ...value,
      {
        seq: value.length + 1,
        sampleName: '',
        commonName: '',
        batchNo: '',
        lotNo: '',
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
          <SubmitterPicker value={submitter} onChange={onSubmitterChange} readOnly={submitterReadOnly} department={submitterDepartment} />
          <SubmitterPicker value={deliverer} onChange={onDelivererChange} />
        </div>
      </div>

      <div className="border-t border-grey-200 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">รายการตัวอย่าง</h2>
          <p className="text-sm text-grey-500">
            กรอกเลข batch และ lot สำหรับทุกตัวอย่าง — batch ที่ลงท้ายด้วย 1 หรือ 6 จะถูกขอใบคำขอรับบริการในขั้นถัดไป
          </p>
        </div>
        <Button size="sm" variant="primary-outline" onClick={addItem} disabled={itemsReadOnly}>
          <Plus className="h-4 w-4" />
          เพิ่มตัวอย่าง
        </Button>
      </div>

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
                {value.length > 1 && !itemsReadOnly && (
                  <Button size="sm" variant="danger-outline" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-4 w-4" />
                    ลบ
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>ชื่อตัวอย่าง</Label>
                  <Input
                    value={it.sampleName}
                    onChange={(e) => setItem(idx, { sampleName: e.target.value })}
                    disabled={itemsReadOnly}
                    placeholder="พิมพ์ชื่อตัวอย่าง"
                  />
                </div>
                <div>
                  <Label>เลขแบช (Batch No.)</Label>
                  <Input
                    value={it.batchNo}
                    onChange={(e) => setItem(idx, { batchNo: e.target.value })}
                    disabled={itemsReadOnly}
                    placeholder="เช่น BN240601"
                  />
                </div>
                <div>
                  <Label>เลข Lot (Lot No.)</Label>
                  <Input
                    value={it.lotNo}
                    onChange={(e) => setItem(idx, { lotNo: e.target.value })}
                    disabled={itemsReadOnly}
                    placeholder="เช่น L240601"
                  />
                </div>
                <div>
                  <Label>ชื่อสามัญ / Active Ingredient</Label>
                  <Input
                    value={it.commonName}
                    onChange={(e) => setItem(idx, { commonName: e.target.value })}
                    disabled={itemsReadOnly}
                  />
                </div>
                <div>
                  <Label>วันผลิต</Label>
                  <Input
                    type="date"
                    value={it.productionDate ?? ''}
                    onChange={(e) => setItem(idx, { productionDate: e.target.value || null })}
                    disabled={itemsReadOnly}
                  />
                </div>
                <div>
                  <Label>ขนาดบรรจุ / จำนวน</Label>
                  <Input
                    value={it.packageUnit}
                    onChange={(e) => setItem(idx, { packageUnit: e.target.value })}
                    disabled={itemsReadOnly}
                    placeholder="เช่น 1 kg × 20 ถุง"
                  />
                </div>
                <div>
                  <Label>เลขที่ใบนำส่ง</Label>
                  <Input
                    value={it.submissionNo}
                    readOnly
                    disabled
                    placeholder="ใช้เลขคำขออัตโนมัติเมื่อบันทึก"
                    className="bg-grey-50 text-grey-500"
                  />
                  <p className="mt-1 text-xs text-grey-400">= เลขคำขอ (กำหนดอัตโนมัติ แก้ไขไม่ได้)</p>
                </div>
                <div className="sm:col-span-2">
                  <Label>หมายเหตุ</Label>
                  <Textarea
                    rows={2}
                    value={it.note}
                    onChange={(e) => setItem(idx, { note: e.target.value })}
                    disabled={itemsReadOnly}
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
