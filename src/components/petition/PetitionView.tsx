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

const STORAGE_CONDITION_LABEL = {
  room: 'อุณหภูมิห้อง',
  chilled: 'แช่เย็น',
} as const;

const PACKAGE_TYPE_LABEL = {
  plasticBag: 'ถุงพลาสติก',
  glassBottle: 'ขวดแก้ว',
  plasticBottle: 'ขวดพลาสติก',
  can: 'กระป๋อง',
  other: 'อื่นๆ',
} as const;

const SAMPLE_DELIVERY_LABEL = {
  self: 'ลูกค้านำเอง',
  courier: 'จัดส่งทางไปรษณีย์',
} as const;

const TEST_DURATION_LABEL = {
  normal: 'ปกติ',
  extended: 'ช้ากว่าปกติได้',
  urgent: 'เร็วกว่าปกติได้',
} as const;

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
  const sa = p.serviceAgreement;

  const testMethodValue =
    sa?.testMethod === 'standard'
      ? 'วิธีปกติ (กรณีลูกค้าไม่ระบุวิธี)'
      : sa?.testMethod === 'custom'
        ? `วิธีเฉพาะตามเอกสารของลูกค้า${sa.testMethodDetail ? `: ${sa.testMethodDetail}` : ''}`
        : sa?.testMethod === 'previous'
          ? `วิธีเดียวกับ ${sa.testMethodDoneBefore || '-'}`
          : '-';

  const testDurationValue =
    sa?.testDuration === 'urgent'
      ? `เร็วกว่าปกติได้ ภายใน ${sa.testDurationDays ?? '-'} วัน`
      : sa?.testDuration === 'extended'
        ? `ช้ากว่าปกติได้ ภายใน ${sa.testDurationDays ?? '-'} วัน`
        : sa?.testDuration
          ? TEST_DURATION_LABEL[sa.testDuration]
          : '-';

  const reportAddressValue =
    p.reportAddressType === 'other'
      ? p.reportAddressOther || '-'
      : p.reportAddressType === 'default'
        ? 'ตามที่อยู่บริษัทที่เลือก'
        : '-';

  const invoiceAddressValue =
    p.invoiceAddressType === 'other'
      ? p.invoiceAddressOther || '-'
      : p.invoiceAddressType === 'default'
        ? 'ตามที่อยู่บริษัทที่เลือก'
        : '-';

  const packageValue =
    p.packageType === 'other'
      ? `อื่นๆ${p.packageTypeOther ? `: ${p.packageTypeOther}` : ''}`
      : p.packageType
        ? PACKAGE_TYPE_LABEL[p.packageType]
        : '-';

  return (
    <div className="space-y-4">
      {/* ===== Section 1: Service Agreement Review ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">การทบทวนข้อตกลงการบริการทดสอบ</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field
            label="1. ตัวอย่างนำส่งห้องปฏิบัติการโดย"
            value={sa?.sampleDelivery ? SAMPLE_DELIVERY_LABEL[sa.sampleDelivery] : '-'}
          />
          <Field label="2. วิธีทดสอบ" value={testMethodValue} />
          <Field label="3. ระยะเวลาดำเนินการทดสอบ" value={testDurationValue} />
          <Field
            label="4. ค่า Uncertainty"
            value={sa?.requireUncertainty ? 'ต้องการ' : 'ไม่ต้องการ'}
          />
        </CardContent>
      </Card>

      {/* ===== Section 2: Service Request Form ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">ใบคำขอรับบริการ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="ชื่อบริษัทผู้ส่งตัวอย่างที่ระบุในใบรายงานผล" value={p.reportCustomerName} />
            <Field label="ที่อยู่ที่ระบุในใบรายงานผล" value={reportAddressValue} />
            <Field label="ที่อยู่ในการออกใบกำกับภาษี" value={invoiceAddressValue} />
            <Field label="ชื่อ-สกุลผู้ติดต่อ" value={p.requester.contactName || p.requester.fullName} />
            <Field label="ตำแหน่ง" value={p.requester.position} />
            <Field label="แผนก" value={p.requester.department} />
            <Field label="เบอร์โทรศัพท์" value={p.requester.phone} />
            <Field label="โทรสาร" value={p.requester.fax} />
            <Field label="อีเมล" value={p.requester.email} />
          </div>

          <Field label="ตัวอย่างหลังการทดสอบ" value={p.sampleReturn ? SAMPLE_RETURN_LABELS[p.sampleReturn] : '-'} />

          <Field
            label="รายละเอียดการทดสอบ (การส่งผล)"
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

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="การเก็บรักษาตัวอย่าง"
              value={p.storageCondition ? STORAGE_CONDITION_LABEL[p.storageCondition] : '-'}
            />
            <Field label="ภาชนะบรรจุ" value={packageValue} />
          </div>
        </CardContent>
      </Card>

      {/* ===== Items ===== */}
      <Card>
        <CardHeader>
          <CardTitle>รายการตัวอย่าง ({p.items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {p.items.map((item) => (
            <div
              key={item.seq}
              className="rounded-[10px] border border-black-50 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-sm font-semibold text-black-500">
                  ตัวอย่างที่ {item.seq}: {item.sampleName || '-'}
                </p>
                {item.sampleId && (
                  <span className="text-xs text-primary-500">[{item.sampleId}]</span>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Batch / Lot No." value={item.batchNo} />
                <Field label="วันที่ผลิต" value={item.productionDate} />
                <Field label="ขนาดบรรจุ" value={item.packageUnit} />
                <Field label="หน่วยทดสอบ" value={item.testUnit} />
              </div>

              <Field label="รายการทดสอบ" value={item.testItems} />

              {item.note && <Field label="หมายเหตุ" value={item.note} />}
            </div>
          ))}
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

      {(p.sampleSubmittedBy || p.sampleSubmittedDate) && (
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลผู้นำส่งตัวอย่าง</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="ผู้นำส่งตัวอย่าง" value={p.sampleSubmittedBy} />
            <Field label="วันที่นำส่ง" value={p.sampleSubmittedDate} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
