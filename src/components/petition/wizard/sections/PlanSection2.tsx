import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import type { ProductionPlan, MachineCheck } from '@/types/productionPlan.types';

interface Props {
  value: ProductionPlan;
  onChange: (next: ProductionPlan) => void;
}

export default function PlanSection2({ value, onChange }: Props) {
  function setRow(idx: number, patch: Partial<MachineCheck>) {
    const machineChecks = value.machineChecks.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    onChange({ ...value, machineChecks });
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">ส่วนที่ 2: ตรวจสอบสภาพเครื่องจักร</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-grey-300 bg-grey-50">
              <th className="border border-grey-300 p-2 text-left">หัวข้อ</th>
              <th className="border border-grey-300 p-2">ใช้ได้</th>
              <th className="border border-grey-300 p-2">ใช้ไม่ได้</th>
              <th className="border border-grey-300 p-2">ว/ด/ป ที่ใช้ได้</th>
            </tr>
          </thead>
          <tbody>
            {value.machineChecks.map((row, idx) => (
              <tr key={idx}>
                <td className="border border-grey-300 p-2">{row.name}</td>
                <td className="border border-grey-300 p-2 text-center">
                  <Checkbox
                    checked={row.ok === true}
                    onCheckedChange={(c) => setRow(idx, { ok: c === true ? true : undefined })}
                  />
                </td>
                <td className="border border-grey-300 p-2 text-center">
                  <Checkbox
                    checked={row.ok === false}
                    onCheckedChange={(c) => setRow(idx, { ok: c === true ? false : undefined })}
                  />
                </td>
                <td className="border border-grey-300 p-2">
                  <Input
                    type="date"
                    value={row.dateOk ?? ''}
                    onChange={(e) => setRow(idx, { dateOk: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <Label>กรณีใช้ไม่ได้ — ระบุอาการ</Label>
        <Textarea
          rows={2}
          value={value.machineDefectNote ?? ''}
          onChange={(e) => onChange({ ...value, machineDefectNote: e.target.value })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>ตรวจสอบโดย</Label>
          <Input
            value={value.machineInspectedBy ?? ''}
            onChange={(e) => onChange({ ...value, machineInspectedBy: e.target.value })}
          />
        </div>
        <div>
          <Label>วันที่/เวลา</Label>
          <Input
            type="datetime-local"
            value={value.machineInspectedAt ?? ''}
            onChange={(e) => onChange({ ...value, machineInspectedAt: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
