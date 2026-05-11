import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SAMPLE_RETURN_LABELS, type Petition } from '@/types/petition.types';

interface Props { petition: Petition; }

const TEST_DELIVERY_LABEL = {
  email: 'E-Mail',
  mail: 'ส่งทางไปรษณีย์',
  self: 'มารับผลเอง',
  report: 'ใบรายงานผล',
  fax: 'โทรสาร',
  taxInvoice: 'ใบกำกับภาษี',
} as const;

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div>
      <p className="text-xs text-grey-500 mb-0.5">{label}</p>
      <p className="text-sm text-black-500">{value}</p>
    </div>
  );
}

export default function PetitionView({ petition: p }: Props) {
  const sa = p.serviceAgreement;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>ข้อตกลงการให้บริการ</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Field
            label="วิธีจัดส่งตัวอย่าง"
            value={sa?.sampleDelivery === 'self' ? 'ลูกค้านำเอง' : sa?.sampleDelivery === 'courier' ? 'จัดส่งทางไปรษณีย์' : '-'}
          />
          <Field
            label="วิธีทดสอบ"
            value={
              sa?.testMethod === 'standard'
                ? 'วิธีมาตรฐาน'
                : sa?.testMethod === 'custom'
                  ? `วิธีอื่น: ${sa.testMethodDetail || '-'}`
                  : sa?.testMethod === 'previous'
                    ? `วิธีเดียวกับ ${sa.testMethodDoneBefore || '-'}`
                    : '-'
            }
          />
          <Field
            label="ระยะเวลา"
            value={
              sa?.testDuration === 'urgent'
                ? `เร็วกว่าปกติ ${sa.testDurationDays ?? '-'} วัน`
                : sa?.testDuration === 'extended'
                  ? `ช้ากว่าปกติ ${sa.testDurationDays ?? '-'} วัน`
                  : 'ปกติ'
            }
          />
          <Field
            label="ค่าความไม่แน่นอน"
            value={sa?.requireUncertainty ? 'ต้องการ' : 'ไม่ต้องการ'}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ผู้ยื่นคำร้อง</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Field label="ชื่อ-นามสกุล" value={p.requester.fullName} />
          <Field label="แผนก" value={p.requester.department} />
          <Field label="เบอร์โทรศัพท์" value={p.requester.phone} />
          <Field label="อีเมล" value={p.requester.email} />
          {p.requester.address && (
            <div className="md:col-span-2">
              <Field label="ที่อยู่" value={p.requester.address} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>การจัดการตัวอย่าง / ช่องทางส่งผล</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {p.sampleReturn && (
            <Field label="หลังทดสอบ" value={SAMPLE_RETURN_LABELS[p.sampleReturn]} />
          )}
          <Field
            label="ช่องทางส่งผล"
            value={
              p.testDelivery && p.testDelivery.length > 0 ? (
                <span className="flex flex-wrap gap-1.5">
                  {p.testDelivery.map((d) => (
                    <Badge key={d} variant="blue-soft">{TEST_DELIVERY_LABEL[d]}</Badge>
                  ))}
                </span>
              ) : '-'
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รายการตัวอย่าง ({p.items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {p.items.map((item) => (
            <div
              key={item.seq}
              className="rounded-[10px] border border-black-50 p-3 space-y-1"
            >
              <p className="text-sm font-semibold text-black-500">
                {item.seq}. {item.sampleName}
                {item.sampleId && (
                  <span className="ml-2 text-xs text-primary-500">[{item.sampleId}]</span>
                )}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-grey-500">
                {item.batchNo && <span>Batch: <span className="text-black-500">{item.batchNo}</span></span>}
                {item.productionDate && <span>วันผลิต: <span className="text-black-500">{item.productionDate}</span></span>}
                {item.packageUnit && <span>บรรจุ: <span className="text-black-500">{item.packageUnit}</span></span>}
                {item.testUnit && <span>หน่วยทดสอบ: <span className="text-black-500">{item.testUnit}</span></span>}
              </div>
              {item.testItems && (
                <p className="text-xs text-grey-500">รายการทดสอบ: <span className="text-black-500">{item.testItems}</span></p>
              )}
              {item.note && <p className="text-xs text-grey-500">หมายเหตุ: {item.note}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      {p.cause && (
        <Card>
          <CardHeader>
            <CardTitle>สาเหตุ / ข้อมูลเพิ่มเติม</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-black-500 whitespace-pre-wrap">{p.cause}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
