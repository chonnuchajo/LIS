import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { releaseBodyPointerLock } from '@/context/ConfirmDialog';
import type { LabAgreementReview, TestMethod } from '@/types/labRequest.types';
import {
  PERSONNEL_ABLE_REASON_LABELS, PERSONNEL_UNABLE_REASON_LABELS,
  WORKLOAD_LABELS, EQUIP_READY_REASON_LABELS, EQUIP_NOT_READY_REASON_LABELS,
} from '@/lib/labAgreementReview';

type Draft = Omit<LabAgreementReview, 'reviewedAt' | 'reviewedBy'>;

// ค่าตั้งต้นเมื่อหัวหน้า Lab เปิดฟอร์มใหม่ (ยังไม่เคยบันทึก) — กรณีวิธีปกติ
const DEFAULT_DRAFT: Draft = {
  personnel: 'able',
  personnelAbleReasons: ['trained'],
  workload: 'normal',
  subcontractor: 'none',
  acceptable: true,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: LabAgreementReview | null;
  onSave: (draft: Draft) => Promise<void>;
  testMethod?: TestMethod | null;
}

function toggle<T>(arr: T[] | undefined, v: T, on: boolean): T[] {
  const set = new Set(arr ?? []);
  if (on) set.add(v); else set.delete(v);
  return Array.from(set);
}

const RadioRow = ({ checked, onSelect, children }:
  { checked: boolean; onSelect: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onSelect}
    className={`flex items-start gap-2 text-left text-sm w-full py-1 ${checked ? 'font-medium text-sky-700' : 'text-grey-700'}`}>
    <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${checked ? 'border-sky-600 bg-sky-600' : 'border-grey-400'}`} />
    <span>{children}</span>
  </button>
);

const CheckRow = ({ checked, onChange, children }:
  { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) => (
  <label className="flex items-start gap-2 text-sm py-1 cursor-pointer">
    <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5" />
    <span>{children}</span>
  </label>
);

export default function LabAgreementReviewDialog({ open, onOpenChange, initial, onSave, testMethod }: Props) {
  const [d, setD] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  // วิธีเฉพาะตามเอกสารลูกค้า (2.2) ครอบ 'custom' และ 'previous'; อย่างอื่น (รวม undefined) = วิธีปกติ (2.1)
  const isCustom = testMethod === 'custom' || testMethod === 'previous';

  useEffect(() => {
    if (open) {
      if (initial) {
        const { reviewedAt: _a, reviewedBy: _b, ...rest } = initial;
        setD(rest);
      } else {
        // ฟอร์มใหม่ — เติมค่าตั้งต้นให้หัวหน้า Lab
        setD({ ...DEFAULT_DRAFT });
      }
    }
  }, [open, initial]);

  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));

  const close = (v: boolean) => { if (!v) releaseBodyPointerLock(); onOpenChange(v); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(d);
      close(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>การทบทวนข้อตกลงการบริการทดสอบ — สำหรับหัวหน้าห้องปฏิบัติการ</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* กรณีวิธีปกติ — โชว์เมื่อวิธี standard (ไม่ใช่ custom/previous) */}
          {!isCustom && (
          <section className="space-y-2">
            <h3 className="font-semibold underline text-sm">กรณีลูกค้าระบุวิธีทดสอบตามปกติ</h3>

            <p className="font-medium text-sm">1. บุคลากร</p>
            <RadioRow checked={d.personnel === 'able'} onSelect={() => set({ personnel: 'able' })}>
              1.1 ทำได้เนื่องจาก
            </RadioRow>
            {d.personnel === 'able' && (
              <div className="ml-6 space-y-1">
                {(Object.keys(PERSONNEL_ABLE_REASON_LABELS) as (keyof typeof PERSONNEL_ABLE_REASON_LABELS)[]).map((k) => (
                  <CheckRow key={k} checked={d.personnelAbleReasons?.includes(k) ?? false}
                    onChange={(v) => set({ personnelAbleReasons: toggle(d.personnelAbleReasons, k, v) })}>
                    {PERSONNEL_ABLE_REASON_LABELS[k]}
                  </CheckRow>
                ))}
              </div>
            )}
            <RadioRow checked={d.personnel === 'unable'} onSelect={() => set({ personnel: 'unable' })}>
              1.2 ไม่สามารถทำได้เนื่องจาก
            </RadioRow>
            {d.personnel === 'unable' && (
              <div className="ml-6 space-y-1">
                {(Object.keys(PERSONNEL_UNABLE_REASON_LABELS) as (keyof typeof PERSONNEL_UNABLE_REASON_LABELS)[]).map((k) => (
                  <CheckRow key={k} checked={d.personnelUnableReasons?.includes(k) ?? false}
                    onChange={(v) => set({ personnelUnableReasons: toggle(d.personnelUnableReasons, k, v) })}>
                    {PERSONNEL_UNABLE_REASON_LABELS[k]}
                  </CheckRow>
                ))}
              </div>
            )}

            <p className="font-medium text-sm pt-2">2. ปริมาณงาน</p>
            {(Object.keys(WORKLOAD_LABELS) as (keyof typeof WORKLOAD_LABELS)[]).map((k, i) => (
              <RadioRow key={k} checked={d.workload === k} onSelect={() => set({ workload: k })}>
                {`2.${i + 1} ${WORKLOAD_LABELS[k]}`}
              </RadioRow>
            ))}

            <p className="font-medium text-sm pt-2">3. การใช้บริการผู้รับเหมาช่วง (Sub contractor)</p>
            <RadioRow checked={d.subcontractor === 'none'} onSelect={() => set({ subcontractor: 'none' })}>
              3.1 ไม่ใช้ผู้รับเหมาช่วง
            </RadioRow>
            <RadioRow checked={d.subcontractor === 'used'} onSelect={() => set({ subcontractor: 'used' })}>
              3.2 ใช้บริการทดสอบโดยผู้รับเหมาช่วง
            </RadioRow>
            {d.subcontractor === 'used' && (
              <Input className="ml-6" placeholder="บริษัท/หน่วยงาน"
                value={d.subcontractorName ?? ''} onChange={(e) => set({ subcontractorName: e.target.value })} />
            )}
          </section>

          )}

          {/* กรณีวิธีเฉพาะ — โชว์เมื่อวิธี custom/previous */}
          {isCustom && (
          <section className="space-y-2">
            <h3 className="font-semibold underline text-sm">กรณีลูกค้าระบุวิธีการทดสอบตามเอกสารของลูกค้า</h3>

            <p className="font-medium text-sm">1. พิจารณาแล้วว่า</p>
            <RadioRow checked={d.methodSuitable === true} onSelect={() => set({ methodSuitable: true })}>
              เหมาะสม
            </RadioRow>
            <RadioRow checked={d.methodSuitable === false} onSelect={() => set({ methodSuitable: false })}>
              ไม่เหมาะสม เนื่องจาก
            </RadioRow>
            {d.methodSuitable === false && (
              <Input className="ml-6" placeholder="เหตุผล"
                value={d.methodSuitableReason ?? ''} onChange={(e) => set({ methodSuitableReason: e.target.value })} />
            )}

            <p className="font-medium text-sm pt-2">2. เครื่องมือทดสอบ</p>
            <Input placeholder="ชื่อเครื่องมือ"
              value={d.equipmentName ?? ''} onChange={(e) => set({ equipmentName: e.target.value })} />
            <RadioRow checked={d.equipment === 'ready'} onSelect={() => set({ equipment: 'ready' })}>
              2.1 มีความพร้อม เนื่องจาก
            </RadioRow>
            {d.equipment === 'ready' && (
              <div className="ml-6 space-y-1">
                {(Object.keys(EQUIP_READY_REASON_LABELS) as (keyof typeof EQUIP_READY_REASON_LABELS)[]).map((k) => (
                  <CheckRow key={k} checked={d.equipmentReadyReasons?.includes(k) ?? false}
                    onChange={(v) => set({ equipmentReadyReasons: toggle(d.equipmentReadyReasons, k, v) })}>
                    {EQUIP_READY_REASON_LABELS[k]}
                  </CheckRow>
                ))}
              </div>
            )}
            <RadioRow checked={d.equipment === 'notReady'} onSelect={() => set({ equipment: 'notReady' })}>
              2.2 ไม่มีความพร้อม เนื่องจาก
            </RadioRow>
            {d.equipment === 'notReady' && (
              <div className="ml-6 space-y-1">
                {(Object.keys(EQUIP_NOT_READY_REASON_LABELS) as (keyof typeof EQUIP_NOT_READY_REASON_LABELS)[]).map((k) => (
                  <CheckRow key={k} checked={d.equipmentNotReadyReasons?.includes(k) ?? false}
                    onChange={(v) => set({ equipmentNotReadyReasons: toggle(d.equipmentNotReadyReasons, k, v) })}>
                    {EQUIP_NOT_READY_REASON_LABELS[k]}
                  </CheckRow>
                ))}
              </div>
            )}
          </section>

          )}

          {/* สรุป — โชว์เสมอ ใช้ร่วมทั้งสองวิธี */}
          <section className="space-y-2 border-t pt-3">
            <p className="font-semibold text-sm">สรุปความพร้อมของงานบริการ</p>
            <RadioRow checked={d.acceptable === true} onSelect={() => set({ acceptable: true })}>
              พร้อมรับงาน
            </RadioRow>
            <RadioRow checked={d.acceptable === false} onSelect={() => set({ acceptable: false })}>
              ไม่พร้อมรับงาน เนื่องจาก
            </RadioRow>
            {d.acceptable === false && (
              <Input className="ml-6" placeholder="เหตุผล"
                value={d.notAcceptableReason ?? ''} onChange={(e) => set({ notAcceptableReason: e.target.value })} />
            )}
            <div className="pt-2">
              <Label className="text-sm">หมายเหตุ</Label>
              <Textarea value={d.remark ?? ''} onChange={(e) => set({ remark: e.target.value })} rows={2} />
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => close(false)} disabled={saving}>ยกเลิก</Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            บันทึกการทบทวน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
