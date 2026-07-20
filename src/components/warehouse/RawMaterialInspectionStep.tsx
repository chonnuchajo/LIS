// F-WAR-03-02 ใบตรวจสอบวัตถุดิบ — step ที่ 2 ของ wizard
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import type {
  Appearance, ContainerType, GrossWeightUnit, InspectionSummary,
  QuantityUnit, RawMaterialInspection, WeighBatch,
} from '@/types/goodsReceipt.types';
import {
  APPEARANCE_LABELS, CONTAINER_CONDITION_LABELS, CONTAINER_TYPE_LABELS,
  PRESENCE_LABELS, QUANTITY_UNIT_LABELS,
} from '@/lib/goodsReceipt';
import { CheckRow, Field, RadioRow, toggle } from './formControls';

interface Props {
  value: RawMaterialInspection;
  onChange: (next: RawMaterialInspection) => void;
  // "อ้างถึงใบรับวัตถุดิบ เลขที่/วันที่" — เลขที่ยังไม่มีจนกว่าจะบันทึก จึงโชว์เป็นข้อความอ่านอย่างเดียว
  receiptNoHint: string;
  receiptDateHint: string;
}

const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

// สรุปผลการตรวจ ใช้โครงเดียวกันทั้งข้อ 1-4 และ 5-6
const SummaryBlock = ({ title, value, onChange }:
  { title: string; value?: InspectionSummary; onChange: (next: InspectionSummary) => void }) => {
  const set = <K extends keyof InspectionSummary>(k: K, v: InspectionSummary[K]) =>
    onChange({ ...(value ?? {}), [k]: v });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <RadioRow checked={value?.accepted === true} onSelect={() => set('accepted', true)}>ยอมรับได้</RadioRow>
        {value?.accepted === true && (
          <Field label="หมายเหตุ">
            <Input value={value?.note ?? ''} onChange={(e) => set('note', e.target.value)} />
          </Field>
        )}
        <RadioRow checked={value?.accepted === false} onSelect={() => set('accepted', false)}>ยอมรับไม่ได้</RadioRow>
        {value?.accepted === false && (
          <Field label="เพราะ">
            <Textarea rows={2} value={value?.rejectReason ?? ''} onChange={(e) => set('rejectReason', e.target.value)} />
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          <Field label="ผู้ตรวจสอบ">
            <Input value={value?.inspectedBy ?? ''} onChange={(e) => set('inspectedBy', e.target.value)} />
          </Field>
          <Field label="วันที่">
            <Input type="date" value={value?.inspectedAt ?? ''} onChange={(e) => set('inspectedAt', e.target.value)} />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
};

export default function RawMaterialInspectionStep({ value, onChange, receiptNoHint, receiptDateHint }: Props) {
  const set = <K extends keyof RawMaterialInspection>(k: K, v: RawMaterialInspection[K]) =>
    onChange({ ...value, [k]: v });

  const setWeighBatch = (i: number, patch: Partial<WeighBatch>) => {
    const rows = [...(value.weighBatches ?? [])];
    rows[i] = { ...rows[i], ...patch };
    set('weighBatches', rows);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-grey-600">
        อ้างถึงใบรับวัตถุดิบ เลขที่ <span className="font-medium">{receiptNoHint}</span>
        {' '}วันที่ <span className="font-medium">{receiptDateHint}</span>
      </p>

      <Card>
        <CardHeader><CardTitle className="text-base">1. ลักษณะภาชนะที่ใส่</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {(Object.keys(CONTAINER_TYPE_LABELS) as ContainerType[]).map((k) => (
            <RadioRow key={k} checked={value.containerType === k} onSelect={() => set('containerType', k)}>
              {CONTAINER_TYPE_LABELS[k]}
            </RadioRow>
          ))}
          {value.containerType === 'other' && (
            <Field label="ระบุ">
              <Input value={value.containerTypeOther ?? ''} onChange={(e) => set('containerTypeOther', e.target.value)} />
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">2. สภาพภาชนะที่ใส่</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <RadioRow checked={value.containerCondition === 'normal'} onSelect={() => set('containerCondition', 'normal')}>
            {CONTAINER_CONDITION_LABELS.normal}
          </RadioRow>
          <RadioRow checked={value.containerCondition === 'leakOrBroken'} onSelect={() => set('containerCondition', 'leakOrBroken')}>
            {CONTAINER_CONDITION_LABELS.leakOrBroken}
          </RadioRow>
          {value.containerCondition === 'leakOrBroken' && (
            <Field label="แบชที่">
              <Input value={value.containerConditionBatches ?? ''} onChange={(e) => set('containerConditionBatches', e.target.value)} />
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">3. สัญลักษณ์บนภาชนะ (สำหรับสินค้าต่างประเทศ)</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-grey-600 mb-1">ฉลากปิด</p>
            <RadioRow checked={value.labelStatus === 'has'} onSelect={() => set('labelStatus', 'has')}>{PRESENCE_LABELS.has}ฉลากปิด</RadioRow>
            <RadioRow checked={value.labelStatus === 'none'} onSelect={() => set('labelStatus', 'none')}>{PRESENCE_LABELS.none}ฉลากปิด</RadioRow>
          </div>
          <div>
            <p className="text-sm text-grey-600 mb-1">ซีลปิ๊งมาร์ค</p>
            <RadioRow checked={value.sealMarkStatus === 'has'} onSelect={() => set('sealMarkStatus', 'has')}>{PRESENCE_LABELS.has}ซีลปิ๊งมาร์ค</RadioRow>
            <RadioRow checked={value.sealMarkStatus === 'none'} onSelect={() => set('sealMarkStatus', 'none')}>{PRESENCE_LABELS.none}ซีลปิ๊งมาร์ค</RadioRow>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">4. การสุ่มตัวอย่างชั่งน้ำหนัก</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="ถพ. (กรณีวัดได้)">
              <Input type="number" value={value.specificGravity ?? ''} onChange={(e) => set('specificGravity', num(e.target.value))} />
            </Field>
            <Field label="Gross weight">
              <div className="flex gap-2">
                <Input type="number" value={value.grossWeight ?? ''} onChange={(e) => set('grossWeight', num(e.target.value))} />
                <select className="h-9 rounded-md border px-2 text-sm" value={value.grossWeightUnit ?? ''}
                  onChange={(e) => set('grossWeightUnit', (e.target.value || undefined) as GrossWeightUnit)}>
                  <option value="">—</option>
                  <option value="litre">ลิตร</option>
                  <option value="kg">กก.</option>
                </select>
              </div>
            </Field>
            <Field label="ช่วงยอมรับ (กก.) — ต่ำกว่า Gross ไม่เกิน 0.2% / สูงกว่าไม่เกิน 1.5%">
              <Input type="number" value={value.toleranceKg ?? ''} onChange={(e) => set('toleranceKg', num(e.target.value))} />
            </Field>
            <Field label="Net weight (ลิตร)">
              <Input type="number" value={value.netWeightLitre ?? ''} onChange={(e) => set('netWeightLitre', num(e.target.value))} />
            </Field>
            <Field label="Net weight (กก.)">
              <Input type="number" value={value.netWeightKg ?? ''} onChange={(e) => set('netWeightKg', num(e.target.value))} />
            </Field>
          </div>
          {(value.weighBatches ?? []).map((b, i) => (
            <div key={i} className="flex gap-2 items-end">
              <Field label="แบช" className="flex-1">
                <Input value={b.batchNo ?? ''} onChange={(e) => setWeighBatch(i, { batchNo: e.target.value })} />
              </Field>
              <Field label="จำนวน" className="w-28">
                <Input type="number" value={b.quantity ?? ''} onChange={(e) => setWeighBatch(i, { quantity: num(e.target.value) })} />
              </Field>
              <Field label="หน่วย" className="w-24">
                <select className="h-9 rounded-md border px-2 text-sm" value={b.quantityUnit ?? ''}
                  onChange={(e) => setWeighBatch(i, { quantityUnit: (e.target.value || undefined) as QuantityUnit })}>
                  <option value="">—</option>
                  {(Object.keys(QUANTITY_UNIT_LABELS) as QuantityUnit[]).map((u) => (
                    <option key={u} value={u}>{QUANTITY_UNIT_LABELS[u]}</option>
                  ))}
                </select>
              </Field>
              <Field label="น้ำหนัก (กก.)" className="w-32">
                <Input type="number" value={b.weightKg ?? ''} onChange={(e) => setWeighBatch(i, { weightKg: num(e.target.value) })} />
              </Field>
              <Button type="button" variant="ghost" size="icon"
                onClick={() => set('weighBatches', (value.weighBatches ?? []).filter((_, x) => x !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm"
            onClick={() => set('weighBatches', [...(value.weighBatches ?? []), {}])}>
            <Plus className="h-4 w-4 mr-1" /> เพิ่มแถวชั่ง
          </Button>
        </CardContent>
      </Card>

      <SummaryBlock title="สรุปผลการตรวจ ข้อ 1-4"
        value={value.summary14} onChange={(v) => set('summary14', v)} />

      <Card>
        <CardHeader><CardTitle className="text-base">5. ลักษณะของสินค้า</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="แบชที่ลักษณะเหมือนเดิม คือ แบชที่">
            <Input value={value.appearanceSameBatches ?? ''} onChange={(e) => set('appearanceSameBatches', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-3">
            {(Object.keys(APPEARANCE_LABELS) as Appearance[]).map((k) => (
              <CheckRow key={k}
                checked={(value.appearance ?? []).includes(k)}
                onChange={(on) => set('appearance', toggle(value.appearance, k, on))}>
                {APPEARANCE_LABELS[k]}
              </CheckRow>
            ))}
          </div>
          {(value.appearance ?? []).includes('other') && (
            <Field label="ระบุ">
              <Input value={value.appearanceOther ?? ''} onChange={(e) => set('appearanceOther', e.target.value)} />
            </Field>
          )}
          <Field label="แบชที่ลักษณะไม่เหมือนเดิม คือ แบชที่">
            <Input value={value.appearanceDiffBatches ?? ''} onChange={(e) => set('appearanceDiffBatches', e.target.value)} />
          </Field>
          <Field label="ระบุสิ่งที่ไม่เหมือนเดิม">
            <Textarea rows={2} value={value.appearanceDiffDetail ?? ''} onChange={(e) => set('appearanceDiffDetail', e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">6. สีของสินค้า</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="แบชที่สีเหมือนเดิม คือ แบชที่">
            <Input value={value.colorSameBatches ?? ''} onChange={(e) => set('colorSameBatches', e.target.value)} />
          </Field>
          <Field label="สี">
            <Input value={value.colorSame ?? ''} onChange={(e) => set('colorSame', e.target.value)} />
          </Field>
          <Field label="แบชที่สีไม่เหมือนเดิม คือ แบชที่">
            <Input value={value.colorDiffBatches ?? ''} onChange={(e) => set('colorDiffBatches', e.target.value)} />
          </Field>
          <Field label="สี">
            <Input value={value.colorDiff ?? ''} onChange={(e) => set('colorDiff', e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <SummaryBlock title="สรุปผลการตรวจสอบ ข้อ 5-6"
        value={value.summary56} onChange={(v) => set('summary56', v)} />
    </div>
  );
}
