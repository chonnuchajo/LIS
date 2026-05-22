import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isLabBatch, type ProductionPlan } from '@/types/productionPlan.types';
import type { ItemRowValues } from './ItemsStep';
import PlanSection1 from './sections/PlanSection1';
import PlanSection2 from './sections/PlanSection2';
import PlanSection3 from './sections/PlanSection3';
import PlanSection4 from './sections/PlanSection4';

interface Props {
  items: ItemRowValues[];
  plan: ProductionPlan;
  onChange: (next: ProductionPlan) => void;
}

export default function ProductionPlanStep({ items, plan, onChange }: Props) {
  const [section, setSection] = useState('1');

  const batchNos = items.filter((it) => it.batchNo).map((it) => it.batchNo);

  if (batchNos.length === 0) {
    return (
      <p className="text-sm text-grey-500">
        กรุณากลับไปกรอกเลข batch ของตัวอย่างก่อน
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">ใบวางแผน-ควบคุมการผลิต</h2>
        <p className="text-sm text-grey-500">
          กรอกข้อมูลครั้งเดียวใช้กับทุก batch — batch ในชุดนี้:{' '}
          {batchNos.map((b, i) => (
            <span key={b}>
              <span className={isLabBatch(b) ? 'font-semibold text-primary-600' : ''}>
                {b}
                {isLabBatch(b) && ' ★'}
              </span>
              {i < batchNos.length - 1 && ', '}
            </span>
          ))}
        </p>
      </div>

      <Tabs value={section} onValueChange={setSection}>
        <TabsList>
          <TabsTrigger value="1">ส่วนที่ 1 วางแผน</TabsTrigger>
          <TabsTrigger value="2">ส่วนที่ 2 เครื่องจักร</TabsTrigger>
          <TabsTrigger value="3">ส่วนที่ 3 ทำความสะอาด</TabsTrigger>
          <TabsTrigger value="4">ส่วนที่ 4 ควบคุมการผลิต</TabsTrigger>
        </TabsList>
        <TabsContent value="1" className="mt-4">
          <PlanSection1 value={plan} batchNos={batchNos} onChange={onChange} />
        </TabsContent>
        <TabsContent value="2" className="mt-4">
          <PlanSection2 value={plan} onChange={onChange} />
        </TabsContent>
        <TabsContent value="3" className="mt-4">
          <PlanSection3 value={plan} onChange={onChange} />
        </TabsContent>
        <TabsContent value="4" className="mt-4">
          <PlanSection4 value={plan} onChange={onChange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
