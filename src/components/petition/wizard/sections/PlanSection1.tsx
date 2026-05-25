import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ProductionPlan } from '@/types/productionPlan.types';

interface Props {
  value: ProductionPlan;
  batchNos: string[];
  onChange: (next: ProductionPlan) => void;
}

export default function PlanSection1({ value, batchNos, onChange }: Props) {
  function set<K extends keyof ProductionPlan>(key: K, v: ProductionPlan[K]) {
    onChange({ ...value, [key]: v, batchNos });
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">ส่วนที่ 1: การวางแผนผลิต</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>ว.ด.ป.ที่วางแผน</Label>
          <Input
            type="date"
            value={value.planDate ?? ''}
            onChange={(e) => set('planDate', e.target.value)}
          />
        </div>
        <div>
          <Label>ว.ด.ป.ที่จะผลิต</Label>
          <Input
            type="date"
            value={value.productionDate ?? ''}
            onChange={(e) => set('productionDate', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>ชื่อสามัญ, % สารและลักษณะสูตร</Label>
          <Textarea
            rows={2}
            value={value.commonName ?? ''}
            onChange={(e) => set('commonName', e.target.value)}
          />
        </div>
        <div>
          <Label>จำนวนที่ผลิต (กก./ลิตร) ต่อ batch</Label>
          <Input
            value={value.quantity ?? ''}
            onChange={(e) => set('quantity', e.target.value)}
          />
        </div>
        <div>
          <Label>แบชนัมเบอร์ (ทั้งหมด {batchNos.length} batch)</Label>
          <div className="mt-1 rounded-[10px] border border-black-50 bg-grey-50 px-3 py-2 text-sm text-black-500">
            {batchNos.join(', ')}
          </div>
        </div>
        <div className="sm:col-span-2">
          <Label>รายชื่อพนักงานผลิต</Label>
          <Textarea
            rows={2}
            value={value.staffNames ?? ''}
            onChange={(e) => set('staffNames', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
