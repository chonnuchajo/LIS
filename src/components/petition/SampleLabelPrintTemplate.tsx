import QRCode from 'qrcode';
import type { Petition } from '@/types/petition.types';

function toBuddhistShort(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String((d.getFullYear() + 543) % 100).padStart(2, '0');
  return `${dd}/${mm}/${yy}`;
}

function currentBuddhistYearShort(): string {
  return String((new Date().getFullYear() + 543) % 100).padStart(2, '0');
}

function getQrValue(petition: Petition, item: Petition['items'][number]): string {
  return JSON.stringify({
    id: petition._id,
    petitionNo: petition.petitionNo,
    sampleId: item.sampleId || '',
    itemSeq: item.seq,
  });
}

function QrCodeSvg({ value }: { value: string }) {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const modules = Array.from(qr.modules.data as Uint8Array);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-[1.8cm] w-[1.8cm] shrink-0"
      role="img"
      aria-label={`QR ${value}`}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      {modules.map((filled, index) => {
        if (!filled) return null;
        const x = index % size;
        const y = Math.floor(index / size);
        return <rect key={index} x={x} y={y} width="1" height="1" fill="#000" />;
      })}
    </svg>
  );
}

function Field({
  label,
  value,
  className = '',
}: {
  label: string;
  value?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-end gap-1 ${className}`}>
      <span className="whitespace-nowrap">{label}</span>
      <span className="flex-1 border-b border-black px-1 min-h-[1.25rem]">{value || ''}</span>
    </div>
  );
}

function LabelCard({
  petition,
  item,
  yearShort,
}: {
  petition: Petition;
  item: Petition['items'][number];
  yearShort: string;
}) {
  const productLine = [item.sampleName, item.commonName].filter(Boolean).join(' ');
  const qrValue = getQrValue(petition, item);
  return (
    <div
      className="label-card border border-black"
      style={{ width: '14cm', padding: '0.3cm 0.4cm' }}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="pt-0.5">
          <QrCodeSvg value={qrValue} />
        </div>
        <div className="flex-1 text-center font-semibold">
          ป้ายนำส่งตัวอย่าง บริษัท ไอ ซี พี ลัดดา จำกัด
        </div>
        <div className="flex items-end gap-1 whitespace-nowrap">
          <span>เลขที่</span>
          <span className="inline-block border-b border-black px-1 min-w-[2.5rem] text-center">
            {item.sampleId || '\u00a0'}
          </span>
          <span>/</span>
          <span className="inline-block border-b border-black px-1 min-w-[2rem] text-center">
            {yearShort}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Field label="ชื่อผลิตภัณฑ์ และสารสำคัญ" value={productLine} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="วัน เดือน ปี ที่ผลิต/นำเข้า" value={toBuddhistShort(item.productionDate)} />
          <Field label="แบชนัมเบอร์" value={item.batchNo} />
        </div>

        <Field label="ผู้ผลิต" value={item.labelManufacturer} />
        <Field label="ผู้ขาย" value={item.labelSeller} />

        <div className="grid grid-cols-3 gap-3">
          <Field label="ปริมาณ" value={item.labelQuantity} />
          <Field label="สุ่มโดย" value={item.labelSampledBy} />
          <Field label="ว/ด/ป" value={toBuddhistShort(item.labelSampledDate)} />
        </div>

        <Field label="หมายเหตุ" value={item.labelRemark} />
      </div>

      <div className="mt-3 text-[10px]">F-LAB-01-10 Rev : 01 01/04/67</div>

      <div className="sr-only">{petition.petitionNo}</div>
    </div>
  );
}

export default function SampleLabelPrintTemplate({ petition }: { petition: Petition }) {
  const yearShort = currentBuddhistYearShort();
  return (
    <>
      <style>{`
        @page {
          size: 6in 4in;
          margin: 0;
        }
        @media print {
          html, body { margin: 0; padding: 0; }
          .label-page {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 6in;
            height: 4in;
            box-sizing: border-box;
            break-after: page;
            page-break-after: always;
          }
          .label-page:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
      <div className="text-sm" style={{ fontFamily: 'inherit' }}>
        {petition.items.map((item) => (
          <div key={item.seq} className="label-page">
            <LabelCard petition={petition} item={item} yearShort={yearShort} />
          </div>
        ))}
      </div>
    </>
  );
}
