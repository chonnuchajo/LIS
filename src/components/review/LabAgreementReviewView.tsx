import { Badge } from '@/components/ui/badge';
import type { LabAgreementReview } from '@/types/petition.types';

const Row = ({ label, value }: { label: string; value: boolean }) => (
  <div className="flex items-center justify-between py-2 border-b border-black-50 last:border-b-0">
    <span className="text-sm text-black-500">{label}</span>
    <Badge variant={value ? 'green-soft' : 'red-soft'}>
      {value ? 'ผ่าน' : 'ไม่ผ่าน'}
    </Badge>
  </div>
);

export default function LabAgreementReviewView({ data }: { data: LabAgreementReview }) {
  return (
    <div>
      <Row label="ความสามารถของห้องปฏิบัติการ" value={!!data.capabilityOk} />
      <Row label="วิธีทดสอบ" value={!!data.methodOk} />
      <Row label="กำหนดเวลา" value={!!data.scheduleOk} />
      <Row label="พิจารณายอมรับ" value={!!data.acceptable} />
      {data.remark && (
        <p className="text-xs text-grey-500 mt-3">หมายเหตุ: <span className="text-black-500">{data.remark}</span></p>
      )}
      <p className="text-xs text-grey-500 mt-3">
        โดย {data.reviewedBy} ·{' '}
        {data.reviewedAt
          ? new Date(data.reviewedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
          : '-'}
      </p>
    </div>
  );
}
