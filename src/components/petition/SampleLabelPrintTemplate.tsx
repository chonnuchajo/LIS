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
      className="h-[24mm] w-[24mm] shrink-0"
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
      <span className="min-h-[3.5mm] flex-1 border-b border-black px-0.5">{value || ''}</span>
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
      className="label-card overflow-hidden border border-black text-[9px] leading-tight"
      style={{ width: '100mm', height: '50mm', padding: '2mm 3mm', boxSizing: 'border-box' }}
    >
      <div className="mb-1 flex items-start gap-1.5">
        <div className="shrink-0 pt-0.5">
          <QrCodeSvg value={qrValue} />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1 text-center font-semibold">
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
          <Field label="ชื่อผลิตภัณฑ์ และสารสำคัญ" value={productLine} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="วัน เดือน ปี ที่ผลิต/นำเข้า" value={toBuddhistShort(item.productionDate)} />
            <Field label="แบชนัมเบอร์" value={item.batchNo} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="ผู้ผลิต" value={item.labelManufacturer} />
            <Field label="ผู้ขาย" value={item.labelSeller} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="ปริมาณ" value={item.labelQuantity} />
            <Field label="สุ่มโดย" value={item.labelSampledBy} />
            <Field label="ว/ด/ป" value={toBuddhistShort(item.labelSampledDate)} />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Field label="หมายเหตุ" value={item.labelRemark} />
      </div>

      <div className="mt-1 text-[7px]">F-LAB-01-10 Rev : 01 01/04/67</div>

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
          size: 100mm 50mm;
          margin: 0;
        }
        html, body {
          margin: 0;
          padding: 0;
        }
        .sample-label-root {
          width: 100mm;
          margin: 0;
          padding: 0;
        }
        .label-page {
          display: flex;
          align-items: stretch;
          justify-content: stretch;
          width: 100mm;
          height: 50mm;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          overflow: hidden;
        }
        .label-card {
          flex: 0 0 100mm;
        }
        /* เครื่องพิมพ์ฉลากเป็น thermal ขาวดำ (1-bit) — บังคับดำล้วน/ขาวล้วน ไม่งั้น
           ตัวอักษรจะ inherit สี --foreground (กรมท่าเข้ม 215 25% 20%) ของ theme แล้ว
           ถูก dither เป็นเฉดเทาเพี้ยน (เส้นกรอบ .border-black ดำอยู่แล้วเลยไม่เพี้ยน) */
        .label-card, .label-card * {
          color: #000 !important;
          border-color: #000 !important;
          background-color: transparent !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .label-card { background-color: #fff !important; }
        @media print {
          html, body { margin: 0; padding: 0; width: 100mm; height: 50mm; }
          .label-page {
            break-after: page;
            page-break-after: always;
          }
          .label-page:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
      <div className="sample-label-root" style={{ fontFamily: 'inherit' }}>
        {petition.items.map((item) => (
          <div key={item.seq} className="label-page">
            <LabelCard petition={petition} item={item} yearShort={yearShort} />
          </div>
        ))}
      </div>
    </>
  );
}
