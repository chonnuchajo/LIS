import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import type { PetitionFormValues } from '@/lib/validations';

export interface LabelItem {
  labelManufacturer: string;
  labelSeller: string;
  labelQuantity: string;
  labelSampledBy: string;
  labelSampledDate: string;
  labelRemark: string;
}

interface Props {
  petitionValues: PetitionFormValues;
  onBack: () => void;
  onSubmit: (labels: LabelItem[]) => void | Promise<void>;
  submitting?: boolean;
}

const empty: LabelItem = {
  labelManufacturer: '',
  labelSeller: '',
  labelQuantity: '',
  labelSampledBy: '',
  labelSampledDate: '',
  labelRemark: '',
};

export default function SampleLabelStep({ petitionValues, onBack, onSubmit, submitting }: Props) {
  const [labels, setLabels] = useState<LabelItem[]>(
    petitionValues.items.map((it) => ({
      labelManufacturer: it.labelManufacturer || '',
      labelSeller: it.labelSeller || '',
      labelQuantity: it.labelQuantity || '',
      labelSampledBy: it.labelSampledBy || '',
      labelSampledDate: it.labelSampledDate || '',
      labelRemark: it.labelRemark || '',
    })) || [empty],
  );

  function update(idx: number, field: keyof LabelItem, value: string) {
    setLabels((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        ย้อนกลับ
      </Button>

      <p className="text-sm text-grey-500">
        ป้อนข้อมูลที่ติดอยู่บนฉลากของแต่ละตัวอย่าง (ถ้ามี) เพื่อใช้พิมพ์ฉลาก/บันทึกประวัติ
      </p>

      {petitionValues.items.map((item, idx) => (
        <Card key={idx}>
          <CardHeader>
            <CardTitle className="text-base">
              {idx + 1}. {item.sampleName}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium block mb-1">ผู้ผลิต</label>
              <Input
                value={labels[idx]?.labelManufacturer || ''}
                onChange={(e) => update(idx, 'labelManufacturer', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">ผู้จำหน่าย</label>
              <Input
                value={labels[idx]?.labelSeller || ''}
                onChange={(e) => update(idx, 'labelSeller', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">จำนวน</label>
              <Input
                value={labels[idx]?.labelQuantity || ''}
                onChange={(e) => update(idx, 'labelQuantity', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">ผู้สุ่มตัวอย่าง</label>
              <Input
                value={labels[idx]?.labelSampledBy || ''}
                onChange={(e) => update(idx, 'labelSampledBy', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">วันที่สุ่มตัวอย่าง</label>
              <Input
                type="date"
                value={labels[idx]?.labelSampledDate || ''}
                onChange={(e) => update(idx, 'labelSampledDate', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">หมายเหตุ</label>
              <Input
                value={labels[idx]?.labelRemark || ''}
                onChange={(e) => update(idx, 'labelRemark', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end gap-2 pb-4">
        <Button variant="ghost" onClick={onBack}>
          ย้อนกลับ
        </Button>
        <Button variant="primary" onClick={() => onSubmit(labels)} disabled={submitting}>
          {submitting ? 'กำลังบันทึก...' : 'ยืนยันและสร้างคำร้อง'}
        </Button>
      </div>
    </div>
  );
}
