import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type {
  ProductionPlan,
  PhysicalCheck,
  WeighingRow,
  ProductionStep,
  DowntimeEntry,
} from '@/types/productionPlan.types';

interface Props {
  value: ProductionPlan;
  onChange: (next: ProductionPlan) => void;
}

export default function PlanSection4({ value, onChange }: Props) {
  function set<K extends keyof ProductionPlan>(key: K, v: ProductionPlan[K]) {
    onChange({ ...value, [key]: v });
  }
  function setStart(patch: Partial<NonNullable<ProductionPlan['actualStart']>>) {
    onChange({ ...value, actualStart: { ...(value.actualStart ?? {}), ...patch } });
  }
  function setEnd(patch: Partial<NonNullable<ProductionPlan['actualEnd']>>) {
    onChange({ ...value, actualEnd: { ...(value.actualEnd ?? {}), ...patch } });
  }
  function setPhys(idx: number, patch: Partial<PhysicalCheck>) {
    set('physicalChecks', value.physicalChecks.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function setWeighingRow(idx: number, patch: Partial<WeighingRow>) {
    set('weighingRows', value.weighingRows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function setWeighingAmount(rowIdx: number, colIdx: number, num: number | null) {
    const row = value.weighingRows[rowIdx];
    const amounts = [...row.amounts];
    amounts[colIdx] = num;
    setWeighingRow(rowIdx, { amounts });
  }
  function setStep(idx: number, patch: Partial<ProductionStep>) {
    set('steps', value.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function addDowntime() {
    set('downtimes', [...value.downtimes, { fromTime: '', toTime: '', reason: '' }]);
  }
  function setDowntime(idx: number, patch: Partial<DowntimeEntry>) {
    set('downtimes', value.downtimes.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }
  function removeDowntime(idx: number) {
    set('downtimes', value.downtimes.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-5">
      <h3 className="font-semibold">ส่วนที่ 4: การควบคุมการผลิต</h3>

      {/* 4A: actual start/end */}
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label>เริ่มผลิตจริง — วัน/เดือน/ปี</Label>
          <Input
            type="date"
            value={value.actualStart?.date ?? ''}
            onChange={(e) => setStart({ date: e.target.value })}
          />
        </div>
        <div>
          <Label>เริ่มผลิต — เวลา</Label>
          <Input
            type="time"
            value={value.actualStart?.time ?? ''}
            onChange={(e) => setStart({ time: e.target.value })}
          />
        </div>
        <div>
          <Label>จำนวนที่ผลิตได้</Label>
          <Input
            value={value.actualQty ?? ''}
            onChange={(e) => set('actualQty', e.target.value)}
          />
        </div>
        <div>
          <Label>สิ้นสุดการผลิต — วัน/เดือน/ปี</Label>
          <Input
            type="date"
            value={value.actualEnd?.date ?? ''}
            onChange={(e) => setEnd({ date: e.target.value })}
          />
        </div>
        <div>
          <Label>สิ้นสุด — เวลา</Label>
          <Input
            type="time"
            value={value.actualEnd?.time ?? ''}
            onChange={(e) => setEnd({ time: e.target.value })}
          />
        </div>
      </div>

      {/* Downtimes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>เวลาที่เครื่องไม่สามารถทำงานได้</Label>
          <Button size="sm" variant="primary-outline" onClick={addDowntime}>
            <Plus className="h-4 w-4" /> เพิ่มแถว
          </Button>
        </div>
        {value.downtimes.length === 0 && (
          <p className="text-sm text-grey-400">ยังไม่มีข้อมูล downtime</p>
        )}
        {value.downtimes.map((d, idx) => (
          <div key={idx} className="grid items-end gap-2 md:grid-cols-4">
            <div>
              <Label className="text-xs">ตั้งแต่เวลา</Label>
              <Input
                type="time"
                value={d.fromTime ?? ''}
                onChange={(e) => setDowntime(idx, { fromTime: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">ถึงเวลา</Label>
              <Input
                type="time"
                value={d.toTime ?? ''}
                onChange={(e) => setDowntime(idx, { toTime: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs">สาเหตุ (รวมไฟดับ)</Label>
                <Input
                  value={d.reason ?? ''}
                  onChange={(e) => setDowntime(idx, { reason: e.target.value })}
                />
              </div>
              <Button size="sm" variant="danger-outline" onClick={() => removeDowntime(idx)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Physical inspection */}
      <div>
        <Label>การตรวจสอบทางกายภาพ</Label>
        <div className="overflow-x-auto mt-1">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-grey-50">
                <th className="border border-grey-300 p-2 text-left">หัวข้อ</th>
                <th className="border border-grey-300 p-2">ครั้งที่ 1</th>
                <th className="border border-grey-300 p-2">ผ่าน</th>
                <th className="border border-grey-300 p-2">ไม่ผ่าน</th>
                <th className="border border-grey-300 p-2">ผู้ตรวจ</th>
                <th className="border border-grey-300 p-2">ครั้งที่ 2</th>
                <th className="border border-grey-300 p-2">ผ่าน</th>
                <th className="border border-grey-300 p-2">ไม่ผ่าน</th>
              </tr>
            </thead>
            <tbody>
              {value.physicalChecks.map((p, idx) => (
                <tr key={idx}>
                  <td className="border border-grey-300 p-2">{p.name}</td>
                  <td className="border border-grey-300 p-2">
                    <Input value={p.result1 ?? ''} onChange={(e) => setPhys(idx, { result1: e.target.value })} />
                  </td>
                  <td className="border border-grey-300 p-2 text-center">
                    <Checkbox
                      checked={p.pass1 === true}
                      onCheckedChange={(c) => setPhys(idx, { pass1: c === true ? true : undefined })}
                    />
                  </td>
                  <td className="border border-grey-300 p-2 text-center">
                    <Checkbox
                      checked={p.pass1 === false}
                      onCheckedChange={(c) => setPhys(idx, { pass1: c === true ? false : undefined })}
                    />
                  </td>
                  <td className="border border-grey-300 p-2">
                    <Input value={p.inspector1 ?? ''} onChange={(e) => setPhys(idx, { inspector1: e.target.value })} />
                  </td>
                  <td className="border border-grey-300 p-2">
                    <Input value={p.result2 ?? ''} onChange={(e) => setPhys(idx, { result2: e.target.value })} />
                  </td>
                  <td className="border border-grey-300 p-2 text-center">
                    <Checkbox
                      checked={p.pass2 === true}
                      onCheckedChange={(c) => setPhys(idx, { pass2: c === true ? true : undefined })}
                    />
                  </td>
                  <td className="border border-grey-300 p-2 text-center">
                    <Checkbox
                      checked={p.pass2 === false}
                      onCheckedChange={(c) => setPhys(idx, { pass2: c === true ? false : undefined })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <Checkbox
            checked={value.sendToLab === true}
            onCheckedChange={(c) => set('sendToLab', c === true)}
          />
          ส่งสารวิเคราะห์
        </label>
        <div className="grid gap-3 md:grid-cols-2 mt-2">
          <div>
            <Label>การดำเนินการเมื่อครั้งที่ 1 ไม่ผ่าน</Label>
            <Input
              value={value.followUpFail1 ?? ''}
              onChange={(e) => set('followUpFail1', e.target.value)}
            />
          </div>
          <div>
            <Label>การดำเนินการเมื่อครั้งที่ 2 ไม่ผ่าน</Label>
            <Input
              value={value.followUpFail2 ?? ''}
              onChange={(e) => set('followUpFail2', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Weighing */}
      <div>
        <div className="grid gap-3 md:grid-cols-2 mb-2">
          <div>
            <Label>ใบเบิกวัตถุดิบ — เลขที่</Label>
            <Input
              value={value.weighingRef?.docNo ?? ''}
              onChange={(e) =>
                set('weighingRef', { ...(value.weighingRef ?? {}), docNo: e.target.value })
              }
            />
          </div>
          <div>
            <Label>วันที่ใบเบิก</Label>
            <Input
              type="date"
              value={value.weighingRef?.docDate ?? ''}
              onChange={(e) =>
                set('weighingRef', { ...(value.weighingRef ?? {}), docDate: e.target.value })
              }
            />
          </div>
        </div>
        <Label>รายละเอียดการชั่งน้ำหนัก (30 แถว × 9 ช่อง)</Label>
        <div className="overflow-x-auto mt-1 max-h-[400px]">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-grey-50">
              <tr>
                <th className="border border-grey-300 p-1 w-10">#</th>
                <th className="border border-grey-300 p-1">วัตถุดิบ</th>
                {Array.from({ length: 9 }, (_, i) => (
                  <th key={i} className="border border-grey-300 p-1 w-16">
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {value.weighingRows.map((row, rIdx) => (
                <tr key={rIdx}>
                  <td className="border border-grey-300 p-1 text-center">{row.seq}</td>
                  <td className="border border-grey-300 p-1">
                    <Input
                      className="h-7 text-xs"
                      value={row.rawMaterial ?? ''}
                      onChange={(e) => setWeighingRow(rIdx, { rawMaterial: e.target.value })}
                    />
                  </td>
                  {row.amounts.map((amt, cIdx) => (
                    <td key={cIdx} className="border border-grey-300 p-0">
                      <Input
                        className="h-7 text-xs border-0 rounded-none"
                        type="number"
                        value={amt ?? ''}
                        onChange={(e) =>
                          setWeighingAmount(rIdx, cIdx, e.target.value ? Number(e.target.value) : null)
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>พนักงานชั่ง</Label>
          <Input value={value.weigher ?? ''} onChange={(e) => set('weigher', e.target.value)} />
        </div>
        <div>
          <Label>เวลา (พนักงานชั่ง)</Label>
          <Input
            type="time"
            value={value.weigherTime ?? ''}
            onChange={(e) => set('weigherTime', e.target.value)}
          />
        </div>
        <div>
          <Label>ผู้ควบคุมการชั่ง</Label>
          <Input
            value={value.weighSupervisor ?? ''}
            onChange={(e) => set('weighSupervisor', e.target.value)}
          />
        </div>
        <div>
          <Label>เวลา (ผู้ควบคุมชั่ง)</Label>
          <Input
            type="time"
            value={value.weighSupervisorTime ?? ''}
            onChange={(e) => set('weighSupervisorTime', e.target.value)}
          />
        </div>
        <div>
          <Label>พนักงานผสม</Label>
          <Input value={value.mixer ?? ''} onChange={(e) => set('mixer', e.target.value)} />
        </div>
        <div>
          <Label>เวลา (พนักงานผสม)</Label>
          <Input
            type="time"
            value={value.mixerTime ?? ''}
            onChange={(e) => set('mixerTime', e.target.value)}
          />
        </div>
        <div>
          <Label>ผู้ควบคุมการผสม</Label>
          <Input
            value={value.mixSupervisor ?? ''}
            onChange={(e) => set('mixSupervisor', e.target.value)}
          />
        </div>
        <div>
          <Label>เวลา (ผู้ควบคุมผสม)</Label>
          <Input
            type="time"
            value={value.mixSupervisorTime ?? ''}
            onChange={(e) => set('mixSupervisorTime', e.target.value)}
          />
        </div>
        <div>
          <Label>ผู้อนุมัติ</Label>
          <Input value={value.approver ?? ''} onChange={(e) => set('approver', e.target.value)} />
        </div>
        <div>
          <Label>วันที่อนุมัติ</Label>
          <Input
            type="date"
            value={value.approvedAt ?? ''}
            onChange={(e) => set('approvedAt', e.target.value)}
          />
        </div>
      </div>

      {/* Production steps */}
      <div>
        <Label>ขั้นตอนการผลิต (30 แถว)</Label>
        <div className="overflow-x-auto mt-1 max-h-[400px]">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-grey-50">
              <tr>
                <th className="border border-grey-300 p-1">ขั้นตอน</th>
                <th className="border border-grey-300 p-1">เริ่ม วัน/เดือน/ปี</th>
                <th className="border border-grey-300 p-1">เริ่ม เวลา</th>
                <th className="border border-grey-300 p-1">สิ้นสุด วัน/เดือน/ปี</th>
                <th className="border border-grey-300 p-1">สิ้นสุด เวลา</th>
              </tr>
            </thead>
            <tbody>
              {value.steps.map((s, idx) => (
                <tr key={idx}>
                  <td className="border border-grey-300 p-0">
                    <Textarea
                      className="min-h-7 text-xs border-0 rounded-none resize-none"
                      rows={1}
                      value={s.description ?? ''}
                      onChange={(e) => setStep(idx, { description: e.target.value })}
                    />
                  </td>
                  <td className="border border-grey-300 p-0">
                    <Input
                      className="h-7 text-xs border-0 rounded-none"
                      type="date"
                      value={s.startDate ?? ''}
                      onChange={(e) => setStep(idx, { startDate: e.target.value })}
                    />
                  </td>
                  <td className="border border-grey-300 p-0">
                    <Input
                      className="h-7 text-xs border-0 rounded-none"
                      type="time"
                      value={s.startTime ?? ''}
                      onChange={(e) => setStep(idx, { startTime: e.target.value })}
                    />
                  </td>
                  <td className="border border-grey-300 p-0">
                    <Input
                      className="h-7 text-xs border-0 rounded-none"
                      type="date"
                      value={s.endDate ?? ''}
                      onChange={(e) => setStep(idx, { endDate: e.target.value })}
                    />
                  </td>
                  <td className="border border-grey-300 p-0">
                    <Input
                      className="h-7 text-xs border-0 rounded-none"
                      type="time"
                      value={s.endTime ?? ''}
                      onChange={(e) => setStep(idx, { endTime: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
