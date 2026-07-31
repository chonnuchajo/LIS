// F-WAR-03-01 ใบรับสินค้า (ลัดดา) — step แรกของ wizard สร้างคำขอ RM
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import type {
  CaBatch, GoodsReceiptReceipt, ProductBatch, QuantityUnit, WeightUnit,
} from '@/types/goodsReceipt.types';
import {
  QUANTITY_UNIT_LABELS, WEIGHT_UNIT_LABELS, RECEIPT_REFERENCE_LABELS,
  TOLERANCE_RESULT_LABELS, LATE_DELIVERY_LABELS,
} from '@/lib/goodsReceipt';
import { CheckRow, Field, RadioRow, toggle } from './formControls';

interface Props {
  value: GoodsReceiptReceipt;
  onChange: (next: GoodsReceiptReceipt) => void;
  warehouse: string;
  onWarehouseChange: (v: string) => void;
}

const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

export default function GoodsReceiptStep({ value, onChange, warehouse, onWarehouseChange }: Props) {
  const set = <K extends keyof GoodsReceiptReceipt>(k: K, v: GoodsReceiptReceipt[K]) =>
    onChange({ ...value, [k]: v });

  // ตารางแบชแก้ทีละแถว — เพิ่มแถวผ่านปุ่มเท่านั้น ไม่เด้งแถวว่างอัตโนมัติ
  const setCaBatch = (i: number, patch: Partial<CaBatch>) => {
    const rows = [...(value.caBatches ?? [])];
    rows[i] = { ...rows[i], ...patch };
    set('caBatches', rows);
  };
  const setProductBatch = (i: number, patch: Partial<ProductBatch>) => {
    const rows = [...(value.productBatches ?? [])];
    rows[i] = { ...rows[i], ...patch };
    set('productBatches', rows);
  };

  // productName ↔ Petition.items[].sampleName และ productBatches[].batchNo ↔ Petition.items[].batchNo
  // เป็น key เดียวที่ผูกใบรับสินค้ากับ petition (ดูทั้งสองแก้ไม่ได้หลัง submit) — rmPetitionMapping.ts
  // trim ค่าทั้งสองตอนสร้าง petition item อยู่แล้ว ฝั่งฟอร์มนี้ต้อง trim ตอน commit ค่า (blur) ให้ตรงกัน
  // ไม่ trim ทุก keystroke (onChange) เพราะจะพิมพ์คำที่มีเว้นวรรคต่อท้ายไม่ได้
  const commitTrimmed = (raw: string | undefined, save: (trimmed: string) => void) => {
    if (typeof raw !== 'string') return;
    const trimmed = raw.trim();
    if (trimmed !== raw) save(trimmed);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">หัวใบ</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="คลังสินค้า">
            <Input value={warehouse} onChange={(e) => onWarehouseChange(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">อ้างถึง</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(Object.keys(RECEIPT_REFERENCE_LABELS) as (keyof typeof RECEIPT_REFERENCE_LABELS)[]).map((k) => (
            <CheckRow key={k}
              checked={(value.references ?? []).includes(k)}
              onChange={(on) => set('references', toggle(value.references, k, on))}>
              {RECEIPT_REFERENCE_LABELS[k]}
            </CheckRow>
          ))}
          <div className="grid gap-3 sm:grid-cols-3 pt-2">
            <Field label="ใบสั่งซื้อเลขที่">
              <Input value={value.purchaseOrderNo ?? ''} onChange={(e) => set('purchaseOrderNo', e.target.value)} />
            </Field>
            <Field label="วันที่">
              <Input type="date" value={value.purchaseOrderDate ?? ''} onChange={(e) => set('purchaseOrderDate', e.target.value)} />
            </Field>
            <Field label="เลขที่ใบส่งของ">
              <Input value={value.deliveryNoteNo ?? ''} onChange={(e) => set('deliveryNoteNo', e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">รายการที่ตรวจรับ</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="1. รหัสสินค้า">
              <Input value={value.productCode ?? ''} onChange={(e) => set('productCode', e.target.value)} />
            </Field>
            <Field label="ชื่อสินค้า">
              <Input value={value.productName ?? ''} onChange={(e) => set('productName', e.target.value)}
                onBlur={() => commitTrimmed(value.productName, (v) => set('productName', v))} />
            </Field>
            <Field label="% สารออกฤทธิ์">
              <Input value={value.activeIngredientPercent ?? ''} onChange={(e) => set('activeIngredientPercent', e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="2. ขนาดบรรจุ">
              <Input value={value.packageSize ?? ''} onChange={(e) => set('packageSize', e.target.value)} />
            </Field>
            <Field label="จำนวน">
              <Input type="number" value={value.quantity ?? ''} onChange={(e) => set('quantity', num(e.target.value))} />
            </Field>
            <Field label="หน่วย">
              <select className="h-9 rounded-md border px-2 text-sm"
                value={value.quantityUnit ?? ''}
                onChange={(e) => set('quantityUnit', (e.target.value || undefined) as QuantityUnit)}>
                <option value="">—</option>
                {(Object.keys(QUANTITY_UNIT_LABELS) as QuantityUnit[]).map((u) => (
                  <option key={u} value={u}>{QUANTITY_UNIT_LABELS[u]}</option>
                ))}
              </select>
            </Field>
            <Field label="น้ำหนักรวม">
              <div className="flex gap-2">
                <Input type="number" value={value.totalWeight ?? ''} onChange={(e) => set('totalWeight', num(e.target.value))} />
                <select className="h-9 rounded-md border px-2 text-sm"
                  value={value.totalWeightUnit ?? ''}
                  onChange={(e) => set('totalWeightUnit', (e.target.value || undefined) as WeightUnit)}>
                  <option value="">—</option>
                  {(Object.keys(WEIGHT_UNIT_LABELS) as WeightUnit[]).map((u) => (
                    <option key={u} value={u}>{WEIGHT_UNIT_LABELS[u]}</option>
                  ))}
                </select>
              </div>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="3. ข้อมูลจากผู้ขาย Gross Weight (กก.)">
              <Input type="number" value={value.sellerGrossWeightKg ?? ''} onChange={(e) => set('sellerGrossWeightKg', num(e.target.value))} />
            </Field>
            <Field label="Net Weight (ลิตร)">
              <Input type="number" value={value.sellerNetWeightLitre ?? ''} onChange={(e) => set('sellerNetWeightLitre', num(e.target.value))} />
            </Field>
            <Field label="Net Weight (กก.)">
              <Input type="number" value={value.sellerNetWeightKg ?? ''} onChange={(e) => set('sellerNetWeightKg', num(e.target.value))} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">กรณีมีแบชนัมเบอร์ — ข้อมูลจากผู้ขาย (CA)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-4">
            <RadioRow checked={value.caBatchMode === 'has'} onSelect={() => set('caBatchMode', 'has')}>มีแบชนัมเบอร์</RadioRow>
            <RadioRow checked={value.caBatchMode === 'none'} onSelect={() => set('caBatchMode', 'none')}>ไม่มีแบชนัมเบอร์</RadioRow>
          </div>
          {(value.caBatches ?? []).map((b, i) => (
            <div key={i} className="flex gap-2 items-end">
              <Field label="แบชนัมเบอร์" className="flex-1">
                <Input value={b.batchNo ?? ''} onChange={(e) => setCaBatch(i, { batchNo: e.target.value })} />
              </Field>
              <Field label="จำนวน" className="w-28">
                <Input type="number" value={b.amount ?? ''} onChange={(e) => setCaBatch(i, { amount: num(e.target.value) })} />
              </Field>
              <Field label="หน่วย" className="w-24">
                <select className="h-9 rounded-md border px-2 text-sm" value={b.unit ?? ''}
                  onChange={(e) => setCaBatch(i, { unit: (e.target.value || undefined) as WeightUnit })}>
                  <option value="">—</option>
                  {(Object.keys(WEIGHT_UNIT_LABELS) as WeightUnit[]).map((u) => (
                    <option key={u} value={u}>{WEIGHT_UNIT_LABELS[u]}</option>
                  ))}
                </select>
              </Field>
              <Button type="button" variant="ghost" size="icon"
                onClick={() => set('caBatches', (value.caBatches ?? []).filter((_, x) => x !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm"
            onClick={() => set('caBatches', [...(value.caBatches ?? []), {}])}>
            <Plus className="h-4 w-4 mr-1" /> เพิ่มแบช (CA)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">กรณีมีแบชนัมเบอร์ — ข้อมูลจากสินค้า</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-4">
            <RadioRow checked={value.productBatchMode === 'has'} onSelect={() => set('productBatchMode', 'has')}>มีแบชนัมเบอร์</RadioRow>
            <RadioRow checked={value.productBatchMode === 'none'} onSelect={() => set('productBatchMode', 'none')}>ไม่มีแบชนัมเบอร์</RadioRow>
          </div>
          <p className="text-xs text-grey-500">ติ๊ก "ส่งตรวจ" แบชที่ต้องการส่งให้ Lab — แบชที่ติ๊กจะกลายเป็นรายการในคำขอ</p>
          {(value.productBatches ?? []).map((b, i) => (
            <div key={i} className="flex gap-2 items-end">
              <Field label="แบชนัมเบอร์" className="flex-1">
                <Input value={b.batchNo ?? ''} onChange={(e) => setProductBatch(i, { batchNo: e.target.value })}
                  onBlur={() => commitTrimmed(b.batchNo, (v) => setProductBatch(i, { batchNo: v }))} />
              </Field>
              <Field label="จำนวน" className="w-28">
                <Input type="number" value={b.amount ?? ''} onChange={(e) => setProductBatch(i, { amount: num(e.target.value) })} />
              </Field>
              <Field label="หน่วย" className="w-24">
                <select className="h-9 rounded-md border px-2 text-sm" value={b.unit ?? ''}
                  onChange={(e) => setProductBatch(i, { unit: (e.target.value || undefined) as WeightUnit })}>
                  <option value="">—</option>
                  {(Object.keys(WEIGHT_UNIT_LABELS) as WeightUnit[]).map((u) => (
                    <option key={u} value={u}>{WEIGHT_UNIT_LABELS[u]}</option>
                  ))}
                </select>
              </Field>
              <div className="pb-1">
                <CheckRow checked={!!b.sendToLab} onChange={(on) => setProductBatch(i, { sendToLab: on })}>
                  ส่งตรวจ
                </CheckRow>
              </div>
              <Button type="button" variant="ghost" size="icon"
                onClick={() => set('productBatches', (value.productBatches ?? []).filter((_, x) => x !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm"
            onClick={() => set('productBatches', [...(value.productBatches ?? []), {}])}>
            <Plus className="h-4 w-4 mr-1" /> เพิ่มแบช
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">ผู้ขาย / ผู้ผลิต / เกณฑ์ / การส่งมอบ</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="5. ชื่อผู้ขาย">
              <Input value={value.seller ?? ''} onChange={(e) => set('seller', e.target.value)} />
            </Field>
            <Field label="ประเทศ">
              <Input value={value.sellerCountry ?? ''} onChange={(e) => set('sellerCountry', e.target.value)} />
            </Field>
            <Field label="6. ชื่อผู้ผลิต">
              <Input value={value.manufacturer ?? ''} onChange={(e) => set('manufacturer', e.target.value)} />
            </Field>
            <Field label="ประเทศ">
              <Input value={value.manufacturerCountry ?? ''} onChange={(e) => set('manufacturerCountry', e.target.value)} />
            </Field>
          </div>
          <Field label="7. เกณฑ์คลาดเคลื่อนมาตรฐานสารออกฤทธิ์ (สารเคมีหลัก)">
            <Input value={value.activeIngredientTolerance ?? ''} onChange={(e) => set('activeIngredientTolerance', e.target.value)} />
          </Field>
          <div className="flex gap-4">
            <RadioRow checked={value.toleranceResult === 'within'} onSelect={() => set('toleranceResult', 'within')}>
              {TOLERANCE_RESULT_LABELS.within}
            </RadioRow>
            <RadioRow checked={value.toleranceResult === 'outside'} onSelect={() => set('toleranceResult', 'outside')}>
              {TOLERANCE_RESULT_LABELS.outside}
            </RadioRow>
          </div>
          {value.toleranceResult === 'outside' && (
            <Field label="คือ">
              <Input value={value.toleranceOutsideReason ?? ''} onChange={(e) => set('toleranceOutsideReason', e.target.value)} />
            </Field>
          )}
          <div className="pt-2">
            <p className="text-sm text-grey-600 mb-1">8. การส่งมอบ (กรอกเฉพาะกรณีส่งมอบล่าช้า)</p>
            {(Object.keys(LATE_DELIVERY_LABELS) as (keyof typeof LATE_DELIVERY_LABELS)[]).map((k) => (
              <CheckRow key={k}
                checked={(value.lateDelivery ?? []).includes(k)}
                onChange={(on) => set('lateDelivery', toggle(value.lateDelivery, k, on))}>
                {LATE_DELIVERY_LABELS[k]}
              </CheckRow>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            <Field label="ผู้รับสินค้า">
              <Input value={value.receivedByName ?? ''} onChange={(e) => set('receivedByName', e.target.value)} />
            </Field>
            <Field label="วันที่">
              <Input type="date" value={value.receivedAt ?? ''} onChange={(e) => set('receivedAt', e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
