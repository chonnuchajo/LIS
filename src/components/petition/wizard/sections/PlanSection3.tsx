import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { ProductionPlan } from '@/types/productionPlan.types';

interface Props {
  value: ProductionPlan;
  onChange: (next: ProductionPlan) => void;
}

export default function PlanSection3({ value, onChange }: Props) {
  const cleaning = value.cleaning;
  function setCleaning(patch: Partial<typeof cleaning>) {
    onChange({ ...value, cleaning: { ...cleaning, ...patch } });
  }
  const disabled = cleaning.continuous;
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">ส่วนที่ 3: ตรวจสอบการทำความสะอาดเครื่องจักร</h3>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={cleaning.continuous}
          onCheckedChange={(c) => setCleaning({ continuous: c === true })}
        />
        งานต่อเนื่อง — ไม่ล้างเครื่อง
      </label>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label>โซเวสโซ่ (ลิตร)</Label>
          <Input
            type="number"
            disabled={disabled}
            value={cleaning.solvent ?? ''}
            onChange={(e) => setCleaning({ solvent: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div>
          <Label>น้ำ (ลิตร)</Label>
          <Input
            type="number"
            disabled={disabled}
            value={cleaning.water ?? ''}
            onChange={(e) => setCleaning({ water: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div>
          <Label>ดินขาว (กก.)</Label>
          <Input
            type="number"
            disabled={disabled}
            value={cleaning.kaolin ?? ''}
            onChange={(e) => setCleaning({ kaolin: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div>
          <Label>ทราย (กก.)</Label>
          <Input
            type="number"
            disabled={disabled}
            value={cleaning.sand ?? ''}
            onChange={(e) => setCleaning({ sand: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>ตรวจสอบโดย</Label>
          <Input
            value={cleaning.inspectedBy ?? ''}
            onChange={(e) => setCleaning({ inspectedBy: e.target.value })}
          />
        </div>
        <div>
          <Label>วันที่/เวลา</Label>
          <Input
            type="datetime-local"
            value={cleaning.inspectedAt ?? ''}
            onChange={(e) => setCleaning({ inspectedAt: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
