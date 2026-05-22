import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PETITION_DEPT_LABELS, type Petition } from '@/types/petition.types';
import { isLabBatch } from '@/types/productionPlan.types';

interface Props { petition: Petition; }

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  const display = value === undefined || value === null || value === '' ? '-' : value;
  return (
    <div>
      <p className="text-xs text-grey-500 mb-0.5">{label}</p>
      <div className="text-sm text-black-500">{display}</div>
    </div>
  );
}

export default function PetitionView({ petition: p }: Props) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">ข้อมูลคำขอ</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="ผู้ยื่นคำขอ" value={p.submittedBy?.name} />
          <Field
            label="วัน-เวลาที่ส่งคำร้อง"
            value={
              p.submittedBy?.submittedAt
                ? new Date(p.submittedBy.submittedAt).toLocaleString('th-TH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : '-'
            }
          />
          <Field label="แผนก" value={<Badge variant="blue-soft">{PETITION_DEPT_LABELS[p.dept]}</Badge>} />
          <Field label="เลขที่คำร้อง" value={p.petitionNo} />
          <Field label="ผู้นำส่ง" value={p.submittedBy?.name} />
          <Field
            label="วันที่นำส่ง"
            value={
              p.sampleSentAt
                ? new Date(p.sampleSentAt).toLocaleString('th-TH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : '-'
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รายการตัวอย่าง ({p.items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {p.items.map((item) => {
            const lab = item.batchNo && isLabBatch(item.batchNo);
            return (
              <div key={item.seq} className="rounded-[10px] border border-black-50 p-4 space-y-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-sm font-semibold text-black-500">
                    ตัวอย่างที่ {item.seq}: {item.sampleName || '-'}
                  </p>
                  {item.sampleId && (
                    <span className="text-xs text-primary-500">[{item.sampleId}]</span>
                  )}
                  {lab && <Badge variant="blue-soft">ส่ง lab</Badge>}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Batch / Lot No." value={item.batchNo} />
                  <Field label="วันที่ผลิต" value={item.productionDate} />
                  <Field label="ขนาดบรรจุ" value={item.packageUnit} />
                  <Field label="ชื่อสามัญ" value={item.commonName} />
                </div>
                {item.note && <Field label="หมายเหตุ" value={item.note} />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {p.cause && (
        <Card>
          <CardHeader>
            <CardTitle>สาเหตุการตรวจ / ข้อมูลเพิ่มเติม</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-black-500 whitespace-pre-wrap">{p.cause}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
