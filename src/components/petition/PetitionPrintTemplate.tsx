import { ICP_LADDA_LOGO_URL } from '@/lib/branding';
import type { Petition, PetitionItem } from '@/types/petition.types';

function buddhistShort(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String((d.getFullYear() + 543) % 100).padStart(2, '0');
  return `${dd}/${mm}/${yy}`;
}

function buddhistTimeHM(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function splitBuddhist(iso?: string | null): { d: string; m: string; y: string } {
  if (!iso) return { d: '', m: '', y: '' };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { d: '', m: '', y: '' };
  return {
    d: String(date.getDate()).padStart(2, '0'),
    m: String(date.getMonth() + 1).padStart(2, '0'),
    y: String((date.getFullYear() + 543) % 100).padStart(2, '0'),
  };
}

function CB({ checked }: { checked?: boolean }) {
  return <span className={`pr-cb${checked ? ' pr-cb-x' : ''}`} aria-hidden />;
}

function RD({ checked }: { checked?: boolean }) {
  return <span className={`pr-rd${checked ? ' pr-rd-x' : ''}`} aria-hidden />;
}

function Line({ value, width }: { value?: string; width?: string }) {
  return (
    <span className="pr-line" style={width ? { minWidth: width } : undefined}>
      {value || ' '}
    </span>
  );
}

function ReportCustomerAddress(p: Petition): string {
  if (p.reportAddressType === 'other') return p.reportAddressOther || '';
  return p.requester.address || '';
}

function InvoiceCustomerAddress(p: Petition): string {
  if (p.invoiceAddressType === 'other') return p.invoiceAddressOther || '';
  return p.requester.address || '';
}

function sgValue(p: Petition, seq: number): string {
  const noteEntry = (p.reviewHistory ?? []).find(
    (e) => e.action === 'note' && (e.specificGravities?.length ?? 0) > 0,
  );
  return noteEntry?.specificGravities?.find((sg) => sg.seq === seq)?.value || '';
}

function PageOne({ p }: { p: Petition }) {
  const sa = p.serviceAgreement;
  const lar = p.labAgreementReview;
  const createdDate = splitBuddhist(p.createdAt);
  const reviewedDate = splitBuddhist(lar?.reviewedAt);

  const sd = sa?.sampleDelivery;
  const tm = sa?.testMethod;
  const td = sa?.testDuration;
  const tdDays = sa?.testDurationDays ?? '';

  return (
    <section className="pr-page1">
      <div className="pr-p1-inner">
      <div className="pr-p1-logo">
        <img src={ICP_LADDA_LOGO_URL} alt="ICP Ladda" />
      </div>
      <div className="pr-p1-title pr-center">
        <b>เรื่อง: การทบทวนข้อตกลงการบริการทดสอบ</b>
      </div>
      <div className="pr-p1-meta-row">
        <b>อ้างอิงใบขอรับบริการเลขที่</b>{' '}
        <span className="pr-line pr-line-md">{p.petitionNo}</span>
      </div>
      <div className="pr-p1-meta-row">
        <b>รหัสลูกค้า</b>{' '}
        <span className="pr-line pr-line-sm">{p.requester.department || ''}</span>
        <span> / </span>
        <span className="pr-line pr-line-xs">{createdDate.y}</span>
      </div>

      <table className="pr-p1-table">
        <thead>
          <tr>
            <th className="pr-p1-head-l">
              <div className="pr-center"><b>สำหรับลูกค้ากรอก</b></div>
              <div className="pr-tiny pr-head-desc">
                (หากลูกค้าไม่สะดวกให้เจ้าหน้าห้องปฏิบัติการกรอกแทน
                โดยสอบถามข้อมูลและให้ลงนามทั้งผู้สอบถามและลูกค้า)
              </div>
            </th>
            <th className="pr-p1-head-r">
              <div className="pr-center"><b>สำหรับหัวหน้าห้องปฏิบัติการ</b></div>
              <div className="pr-center">
                ห้องปฏิบัติการได้รับแจ้งการทบทวนข้อตกลงการบริการทดสอบ
              </div>
              <div className="pr-grid3">
                <span>ทางโทรศัพท์, อีเมล์</span>
                <span><CB checked={!!lar} />&nbsp;ใช่</span>
                <span><CB checked={false} />&nbsp;ไม่ใช่</span>
              </div>
              <div className="pr-sig-fill">
                <span>ลงชื่อ</span>
                <span className="pr-line-fill">&nbsp;</span>
                <span>ผู้แจ้ง</span>
                <span className="pr-line-fill">{lar?.reviewedBy || ' '}</span>
                <span>ผู้รับแจ้ง</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pr-p1-body-l">
              <div className="pr-cell">
              <div className="pr-cell-main">
              {/* 1. ตัวอย่างนำส่งห้องปฏิบัติการโดย */}
              <div className="pr-q"><b>1. ตัวอย่างนำส่งห้องปฏิบัติการโดย</b></div>
              <div className="pr-ind">
                <CB checked={sd === 'self'} /> 1.1 ลูกค้ามาเอง&nbsp;&nbsp;&nbsp;&nbsp;
                <CB checked={sd === 'courier'} /> 1.2 จัดส่งทางไปรษณีย์
              </div>

              {/* 2. วิธีทดสอบ */}
              <div className="pr-q"><b>2. วิธีทดสอบโปรดระบุ</b></div>
              <div className="pr-ind">
                <CB checked={tm === 'standard'} /> 2.1 วิธีปกติ (กรณีลูกค้าไม่ระบุวิธี)
              </div>
              <div className="pr-ind">
                <CB checked={tm === 'custom'} /> 2.2 วิธีเฉพาะตามเอกสารของลูกค้า
              </div>
              <div className="pr-ind2">
                <CB checked={tm === 'previous'} /> เคยทำ&nbsp;
                <Line width="2.5cm" value={sa?.testMethodDoneBefore} />
                &nbsp;&nbsp;<CB checked={tm === 'custom'} /> ไม่เคยทำ
              </div>
              <div className="pr-ind">
                (วิธีเทคนิค / เครื่องมือ / สารเคมี / ชนิดตัวอย่าง / Detection Limit)
              </div>
              {sa?.testMethodDetail && (
                <div className="pr-ind pr-italic">{sa.testMethodDetail}</div>
              )}

              {/* 3. ระยะเวลา */}
              <div className="pr-q"><b>3. ระยะเวลาดำเนินการทดสอบ</b></div>
              <div className="pr-ind">
                <CB checked={td === 'normal'} /> 3.1&nbsp;&nbsp;ปกติ
              </div>
              <div className="pr-ind">
                <CB checked={td === 'extended'} /> 3.2 ช้ากว่าปกติได้ (ภายใน{' '}
                <Line width="1.5cm" value={td === 'extended' ? String(tdDays) : ''} /> วัน)
              </div>
              <div className="pr-ind">
                <CB checked={td === 'urgent'} /> 3.3&nbsp;&nbsp;เร็วกว่าปกติได้ (ภายใน{' '}
                <Line width="1.5cm" value={td === 'urgent' ? String(tdDays) : ''} /> วัน)
              </div>

              {/* 4. Uncertainty */}
              <div className="pr-q"><b>4. ค่า Uncertainty</b></div>
              <div className="pr-ind">
                <CB checked={!!sa?.requireUncertainty} /> ต้องการ
              </div>
              <div className="pr-ind">
                <CB checked={sa ? !sa.requireUncertainty : false} /> ไม่ต้องการ
              </div>

              </div>
              <div className="pr-cond-block">
              <div className="pr-cond-header pr-center"><b>เงื่อนไขการให้บริการ</b></div>
              <ol className="pr-cond">
                <li>
                  ห้องปฏิบัติการฯให้บริการทดสอบตัวอย่างด้วยวิธีการตามเอกสาร
                  วิธีวิเคราะห์สารเคมีกำจัดศัตรูพืชของห้องปฏิบัติการฯ (FM-QP-07-01-002)
                </li>
                <li>
                  การรายงานผลทดสอบจะไม่มีบริการด้านการให้ความเห็น
                  และการแปรผลไม่ตัดสินผล
                </li>
                <li>ปริมาณตัวอย่างขั้นต่ำที่นำส่ง 500 ml, 500 g</li>
                <li>
                  ระยะเวลาในการออกผลการทดสอบ ภายใน 3 วัน
                  (กรณีหากมีข้อสงสัยในผลการวิเคราะห์ ขอขยายเวลาออกไปอีก 3 วัน)
                </li>
                <li>ส่งตัวอย่างไม่เกิน 15.00 น. ของทุกวัน</li>
                <li>
                  ห้องปฏิบัติการฯรับผิดชอบผลการทดลองเฉพาะกับตัวอย่างที่นำมาทดสอบเท่านั้น
                </li>
                <li>
                  ยินยอมให้เปิดเผยข้อมูลตัวอย่าง และผลทดสอบแก่หน่วยงานอื่น
                  (กรณีลูกค้าภายในองค์กร)
                </li>
              </ol>

              <div className="pr-mt-sm">
                &nbsp;&nbsp;&nbsp;&nbsp;ข้าพเจ้าได้รับทราบ
                และยอมรับเงื่อนไขการให้บริการของห้องปฏิบัติการ
                บริษัท ไอ ซี พี ลัดดา จำกัด ทุกประการ
              </div>
              </div>

              <div className="pr-cell-sig">
              <div className="pr-sig-row">
                <span className="pr-sig-label">ลงชื่อ </span>
                <Line width="4.5cm" value={p.requester.fullName} />
                <span className="pr-sig-date">
                  วันเดือนปี{' '}
                  <Line width="0.8cm" value={createdDate.d} />
                  <span className="pr-sl">/</span>
                  <Line width="0.8cm" value={createdDate.m} />
                  <span className="pr-sl">/</span>
                  <Line width="0.8cm" value={createdDate.y} />
                </span>
              </div>
              <div className="pr-sig-row">
                <span className="pr-sig-label pr-spacer">ลงชื่อ </span>
                <span className="pr-paren-name">( {p.requester.fullName} )</span>
              </div>
              </div>
              </div>
            </td>

            <td className="pr-p1-body-r">
              <div className="pr-cell">
              <div className="pr-cell-main">
              <div><b><u>กรณีลูกค้าระบุวิธีทดสอบตามปกติ</u></b></div>

              <div className="pr-q"><b>1. บุคลากร</b></div>
              <div className="pr-ind">
                <CB checked={lar?.capabilityOk === true} /> 1.1 ทำได้เนื่องจาก
              </div>
              <div className="pr-ind2">
                <RD checked={lar?.capabilityOk === true} /> ได้รับการฝึกอบรมแล้ว
              </div>
              <div className="pr-ind2">
                <RD checked={lar?.capabilityOk === true} /> ได้รับการมอบหมายให้ทดลอง
              </div>
              <div className="pr-ind">
                <CB checked={lar?.capabilityOk === false} /> 1.2 ไม่สามารถทำได้เนื่องจาก
              </div>
              <div className="pr-ind2">
                <RD checked={false} /> ยังไม่เคยทำการทดลอง
              </div>
              <div className="pr-ind2">
                <RD checked={false} /> ยังไม่ได้รับการฝึกอบรม
              </div>
              <div className="pr-ind2">
                <RD checked={false} /> ยังไม่ได้รับการมอบหมายให้ทำงานทดลอง
              </div>

              <div className="pr-q"><b>2. ปริมาณงาน</b></div>
              <div className="pr-ind">
                <CB checked={lar?.scheduleOk === true} /> 2.1 ยังมีความสามารถรับงานได้ตามปกติ
              </div>
              <div className="pr-ind">
                <CB checked={lar?.scheduleOk === false} /> 2.2 สามารถรับงานได้แต่อาจช้ากว่าปกติ ซึ่งลูกค้ายินยอม
              </div>
              <div className="pr-ind">
                <CB checked={false} /> 2.3 ไม่สามารถรับงานได้ เพราะมีงานสะสมมาก
              </div>

              <div className="pr-q">
                <b>3. การใช้บริการผู้รับเหมาช่วงการทดสอบ (Sub contractor)</b>
              </div>
              <div className="pr-ind">
                <CB checked={false} /> 3.1 ไม่ใช้ผู้รับเหมาช่วง
              </div>
              <div className="pr-ind">
                <CB checked={false} /> 3.2 การทดสอบนี้ใช้บริการทดสอบโดยผู้รับเหมาช่วง
              </div>
              <div className="pr-ind2 pr-fill-row">
                <span>บริษัท/หน่วยงาน</span>
                <span className="pr-line-fill">&nbsp;</span>
              </div>
              <div className="pr-tiny pr-ind">
                (เนื่องจากห้องปฏิบัติการทดสอบไม่สามารถทดสอบได้
                ซึ่งลูกค้ารับทราบ และยินยอมแล้ว)
              </div>

              <div className="pr-mt-sm"><u>สรุปความพร้อมของงานบริการ</u></div>
              <div className="pr-ind pr-fill-row">
                <span>
                  <CB checked={lar?.acceptable === true} /> พร้อมรับงาน&nbsp;&nbsp;&nbsp;
                  <CB checked={lar?.acceptable === false} /> ไม่พร้อมรับงาน&nbsp;เนื่องจาก
                </span>
                <span className="pr-line-fill">{lar?.acceptable === false ? lar.remark : ' '}</span>
              </div>

              <div className="pr-mt-sm">
                <b><u>กรณีลูกค้าระบุวิธีการทดสอบตามเอกสารของลูกค้า</u></b>
              </div>
              <div>พิจารณาแล้วว่า</div>
              <div className="pr-ind">
                <span className="pr-num">1.</span>
                <CB checked={lar?.methodOk === true} />&nbsp;เหมาะสม
              </div>
              <div className="pr-ind2 pr-fill-row">
                <span><CB checked={lar?.methodOk === false} />&nbsp;ไม่เหมาะสมเนื่องจาก</span>
                <span className="pr-line-fill">{lar?.methodOk === false ? lar.remark : ' '}</span>
              </div>
              <div className="pr-ind">
                <span className="pr-num">2.</span>เครื่องมือทดสอบ (เครื่องมือ{' '}
                <Line width="5cm" value="" />)
              </div>
              <div className="pr-ind2">
                <CB checked={false} /> 2.1 มีความพร้อม เนื่องจาก{' '}
                <RD checked={false} /> มีเครื่องมือ
              </div>
              <div className="pr-ind3">
                <RD checked={false} /> สอบเทียบแล้ว
              </div>
              <div className="pr-ind2">
                <CB checked={false} /> 2.2 ไม่มีความพร้อม เนื่องจาก{' '}
                <RD checked={false} /> ไม่มีเครื่องมือ
              </div>
              <div className="pr-ind3">
                <RD checked={false} /> ยังไม่มีการสอบเทียบ
              </div>
              <div className="pr-ind3">
                <RD checked={false} /> เครื่องมือไม่ครอบคลุมช่วงทดสอบที่ต้องการ
              </div>
              <div className="pr-ind3">
                <RD checked={false} /> เครื่องมือเสีย
              </div>
              <div className="pr-ind">
                <span className="pr-num">3.</span>บุคลากร และปริมาณงาน ทบทวน
                ตามวิธีทดสอบของ ไอ ซี พี ลัดดา จำกัด (ข้อ 1 และ 2)
              </div>
              <div>สรุปความพร้อมของงานบริการ</div>
              <div className="pr-ind pr-fill-row">
                <span>
                  <CB checked={lar?.acceptable === true} /> พร้อมรับงาน&nbsp;&nbsp;&nbsp;
                  <CB checked={lar?.acceptable === false} /> ไม่พร้อมรับงาน&nbsp;เนื่องจาก
                </span>
                <span className="pr-line-fill">{lar?.acceptable === false ? lar.remark : ' '}</span>
              </div>

              </div>

              <div className="pr-cell-sig">
              <div className="pr-sig-row">
                <span className="pr-sig-label">ลงชื่อ </span>
                <Line width="4.5cm" value={lar?.reviewedBy} />
                <span className="pr-sig-date">
                  วันเดือนปี{' '}
                  <Line width="0.8cm" value={reviewedDate.d} />
                  <span className="pr-sl">/</span>
                  <Line width="0.8cm" value={reviewedDate.m} />
                  <span className="pr-sl">/</span>
                  <Line width="0.8cm" value={reviewedDate.y} />
                </span>
              </div>
              <div className="pr-sig-row">
                <span className="pr-sig-label pr-spacer">ลงชื่อ </span>
                <span className="pr-paren-name">( {lar?.reviewedBy || ''} )</span>
              </div>
              <div className="pr-sig-row">
                <span className="pr-sig-label pr-spacer">ลงชื่อ </span>
                <span className="pr-paren-name">หัวหน้าห้องปฏิบัติการเคมี</span>
              </div>
              </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="pr-p1-footer">FM-QP-07-01-001 R02 (16/12/67) P1/1</div>
      </div>
    </section>
  );
}

const SAMPLE_DELIVERY_RETURN = { return: true, keep: false, discard: false } as const;
const STORAGE_KEYS = ['room', 'chilled'] as const;
const PACKAGE_KEYS = ['plasticBag', 'glassBottle', 'plasticBottle', 'can'] as const;

function PageTwo({ p }: { p: Petition }) {
  const total = p.items.length;
  const receivedDateTime = p.receivedAt ? new Date(p.receivedAt) : null;
  const receivedTime = receivedDateTime
    ? `${String(receivedDateTime.getHours()).padStart(2, '0')}.${String(receivedDateTime.getMinutes()).padStart(2, '0')} น.`
    : '';
  const sampleReturnReturn = p.sampleReturn
    ? SAMPLE_DELIVERY_RETURN[p.sampleReturn] === true
    : false;
  const sampleReturnNoReturn = p.sampleReturn === 'discard';
  const td = new Set(p.testDelivery ?? []);
  const yearShort = String((new Date(p.createdAt).getFullYear() + 543) % 100).padStart(2, '0');

  const minRows = 6;
  const filler = Math.max(0, minRows - total);

  return (
    <section className="pr-page2">
      <div className="pr-p2-inner">
      <div className="pr-p2-top">
        <img src={ICP_LADDA_LOGO_URL} alt="ICP Ladda" className="pr-p2-logo" />
        <div className="pr-p2-title"><b>ใบคำขอรับบริการ</b></div>
        <div className="pr-p2-top-r">
          <div className="pr-p2-sheet">
            <span>แผ่นที่</span>
            <span className="pr-line-fill pr-center">1</span>
            <span>/</span>
            <span className="pr-line-fill pr-center">{yearShort}</span>
          </div>
          <div className="pr-p2-infobox">
            <div className="pr-fill-row">
              <span>เลขที่ขอรับบริการ :</span>
              <span className="pr-line-fill">{p.petitionNo}</span>
            </div>
            <div className="pr-fill-row">
              <span>วันที่รับตัวอย่าง :</span>
              <span className="pr-line-fill">{buddhistShort(p.receivedAt)}</span>
            </div>
            <div className="pr-fill-row">
              <span>เวลา :</span>
              <span className="pr-line-fill">{receivedTime}</span>
            </div>
            <div className="pr-fill-row">
              <span>วันนัดรับผล :</span>
              <span className="pr-line-fill">&nbsp;</span>
            </div>
          </div>
        </div>
      </div>

      <table className="pr-p2-info">
        <tbody>
          <tr>
            <td className="pr-p2-info-l">
              <div>
                ชื่อบริษัทผู้ส่งตัวอย่างที่ระบุในใบรายงานผล :{' '}
                <Line width="14cm" value={p.reportCustomerName || p.requester.fullName} />
              </div>
              <div>
                ที่อยู่ที่ระบุในใบรายงานผล :{' '}
                <Line width="16cm" value={ReportCustomerAddress(p)} />
              </div>
              <div>
                ที่อยู่ในการออกใบกำกับภาษี :{' '}
                <Line width="16cm" value={InvoiceCustomerAddress(p)} />
              </div>
              <div>
                โทรศัพท์ : <Line width="4cm" value={p.requester.phone} />
                &nbsp;โทรสาร : <Line width="4cm" value={p.requester.fax} />
                &nbsp;E-mail : <Line width="6cm" value={p.requester.email} />
              </div>
              <div>
                ชื่อ-สกุลผู้ติดต่อ :{' '}
                <Line width="6cm" value={p.requester.contactName || p.requester.fullName} />
                &nbsp;ตำแหน่ง : <Line width="5cm" value={p.requester.position} />
              </div>
              <div>
                ตัวอย่างหลังการทดสอบ :{' '}
                <CB checked={sampleReturnReturn} /> ขอรับคืน{' '}
                (ภายใน 7 วันหลังจากได้รับผลทดสอบ)&nbsp;&nbsp;
                <CB checked={sampleReturnNoReturn} /> ไม่ขอรับคืน / No return
              </div>
              <div>
                รายละเอียดการทดสอบ :&nbsp;
                <CB checked={td.has('self')} /> มารับผลเอง&nbsp;&nbsp;
                <CB checked={td.has('mail')} /> ส่งทางไปรษณีย์&nbsp;&nbsp;
                <CB checked={td.has('email')} /> E-Mail :{' '}
                <Line width="6cm" value={td.has('email') ? p.requester.email : ''} />
              </div>
              <div>
                <span className="pr-spacer">รายละเอียดการทดสอบ :&nbsp;</span>
                <CB checked={td.has('report')} /> ใบรายงานผล&nbsp;&nbsp;
                <CB checked={td.has('taxInvoice')} /> ใบกำกับภาษี
              </div>
            </td>
            <td className="pr-p2-info-r">
              <div><b>การเก็บรักษาตัวอย่าง</b></div>
              <div>
                <CB checked={p.storageCondition === 'room'} /> อุณหภูมิห้อง&nbsp;&nbsp;
                <CB checked={p.storageCondition === 'chilled'} /> แช่เย็น
              </div>
              <div className="pr-mt-xs"><b>ภาชนะบรรจุ</b></div>
              <div>
                <CB checked={p.packageType === 'plasticBag'} /> ถุงพลาสติก&nbsp;
                <CB checked={p.packageType === 'glassBottle'} /> ขวดแก้ว&nbsp;
                <CB checked={p.packageType === 'plasticBottle'} /> ขวดพลาสติก&nbsp;
                <CB checked={p.packageType === 'can'} /> กระป๋อง
              </div>
              <div>
                <CB checked={p.packageType === 'other'} /> อื่นๆ ระบุ{' '}
                <Line width="6cm" value={p.packageType === 'other' ? p.packageTypeOther : ''} />
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="pr-p2-items">
        <colgroup>
          <col style={{ width: '0.9cm' }} />
          <col style={{ width: '6cm' }} />
          <col style={{ width: '3.2cm' }} />
          <col style={{ width: '2cm' }} />
          <col style={{ width: '1.7cm' }} />
          <col style={{ width: '1.5cm' }} />
          <col style={{ width: '1.2cm' }} />
          <col style={{ width: '1.5cm' }} />
          <col style={{ width: '1.5cm' }} />
          <col style={{ width: '3cm' }} />
          <col style={{ width: '1.5cm' }} />
          <col style={{ width: '1.2cm' }} />
          <col style={{ width: '1.2cm' }} />
          <col style={{ width: '1.7cm' }} />
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={3}>ลำดับ</th>
            <th rowSpan={3}>ชื่อตัวอย่าง</th>
            <th rowSpan={3}>เลขแบช</th>
            <th rowSpan={3}>วันผลิต/นำเข้า</th>
            <th rowSpan={3}>เลขที่ใบนำส่งตัวอย่าง</th>
            <th rowSpan={3}>ค่า ถ.พ.</th>
            <th rowSpan={3}>จำนวน/หน่วยบรรจุ</th>
            <th rowSpan={3}>หน่วยทดสอบ</th>
            <th rowSpan={3}>รายการทดสอบ</th>
            <th rowSpan={3}>หมายเหตุ</th>
            <th colSpan={4}>สำหรับเจ้าหน้าที่</th>
          </tr>
          <tr>
            <th rowSpan={2}>เลขที่ตัวอย่าง</th>
            <th colSpan={2}>สภาพตัวอย่าง</th>
            <th rowSpan={2}>ราคา</th>
          </tr>
          <tr>
            <th>ปกติ</th>
            <th>ไม่ปกติ</th>
          </tr>
        </thead>
        <tbody>
          {p.items.map((it) => (
            <ItemRow key={it.seq} item={it} sg={sgValue(p, it.seq)} />
          ))}
          {Array.from({ length: filler }).map((_, i) => (
            <tr key={`f-${i}`} className="pr-p2-empty">
              {Array.from({ length: 14 }).map((__, j) => (
                <td key={j}>&nbsp;</td>
              ))}
            </tr>
          ))}
          <tr>
            <td colSpan={11} className="pr-noborder">&nbsp;</td>
            <td colSpan={2} className="pr-center">ราคา</td>
            <td>&nbsp;</td>
          </tr>
          <tr>
            <td colSpan={11} className="pr-noborder">&nbsp;</td>
            <td colSpan={2} className="pr-center">Vat 7 %</td>
            <td>&nbsp;</td>
          </tr>
          <tr>
            <td colSpan={11} className="pr-noborder">&nbsp;</td>
            <td colSpan={2} className="pr-center">ราคารวม</td>
            <td>&nbsp;</td>
          </tr>
        </tbody>
      </table>

      <div className="pr-p2-sign">
        <div className="pr-fill-row">
          <span>ผู้ส่งตัวอย่าง</span>
          <span className="pr-line-fill">{p.sampleSubmittedBy || ' '}</span>
        </div>
        <div className="pr-fill-row">
          <span>ผู้รับตัวอย่าง</span>
          <span className="pr-line-fill">{p.receivedBy || ' '}</span>
        </div>
        <div className="pr-fill-row">
          <span>วันที่</span>
          <span className="pr-line-fill">{p.sampleSubmittedDate || buddhistShort(p.sampleSentAt) || ' '}</span>
        </div>
        <div className="pr-fill-row">
          <span>วันที่</span>
          <span className="pr-line-fill">{buddhistShort(p.receivedAt) || ' '}</span>
        </div>
      </div>

      <div className="pr-p2-warn">
        <b>"หากสงสัยเกี่ยวกับผลการทดสอบ กรุณาติดต่อกลับภายใน 7 วัน หลังจากรับใบรายงานผลการทดสอบ"</b>
      </div>
      <div className="pr-p2-footer">FM-QP-07-04-001-R00 (01/06/65) P1/1</div>
      </div>
    </section>
  );
}

function ItemRow({ item, sg }: { item: PetitionItem; sg: string }) {
  const normal = item.condition === 'normal';
  const defective = item.condition === 'defective';
  return (
    <tr>
      <td className="pr-center">{item.seq}</td>
      <td>{[item.sampleName, item.commonName].filter(Boolean).join(' ')}</td>
      <td>{item.batchNo || ''}</td>
      <td className="pr-center">{item.productionDate ? buddhistShort(item.productionDate) : ''}</td>
      <td>{item.submissionNo || ''}</td>
      <td className="pr-center">{sg}</td>
      <td>{item.packageUnit || ''}</td>
      <td>{item.testUnit || ''}</td>
      <td>{item.testItems || ''}</td>
      <td>{item.note || ''}</td>
      <td>{item.sampleId || ''}</td>
      <td className="pr-center">{normal ? '✓' : ''}</td>
      <td className="pr-center">{defective ? '✓' : ''}</td>
      <td>&nbsp;</td>
    </tr>
  );
}

export default function PetitionPrintTemplate({ petition }: { petition: Petition }) {
  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="pr-root">
        <PageOne p={petition} />
        <PageTwo p={petition} />
      </div>
    </>
  );
}

const PRINT_CSS = `
@page { size: A4 portrait; margin: 6mm 8mm 6mm 10mm; }
@page pageA4L { size: A4 landscape; margin: 5mm 6mm; }

.pr-root, .pr-root * {
  font-family: 'Angsana New', 'Cordia New', 'Sarabun', 'TH SarabunPSK', serif;
  color: #000;
  box-sizing: border-box;
}
.pr-root {
  font-size: 12pt;
  line-height: 1.15;
}

.pr-page2 { page: pageA4L; }

@media print {
  html, body { margin: 0; padding: 0; background: #fff; }
  .pr-p2-info, .pr-p2-top { break-inside: avoid; page-break-inside: avoid; }
  .pr-p2-items tr { break-inside: avoid; page-break-inside: avoid; }
  .pr-p2-sign, .pr-p2-warn { break-inside: avoid; page-break-inside: avoid; }
}
@media screen {
  .pr-page1 { width: 210mm; height: 297mm; margin: 0 auto 16px; padding: 6mm 8mm 6mm 10mm; background: #fff; box-shadow: 0 0 0 1px #ddd; overflow: hidden; }
  .pr-page2 { width: 297mm; min-height: 210mm; margin: 0 auto; padding: 5mm 6mm; background: #fff; box-shadow: 0 0 0 1px #ddd; }
}

/* shared elements */
.pr-cb {
  display: inline-block;
  width: 9pt;
  height: 9pt;
  border: 0.6pt solid #000;
  vertical-align: -1pt;
  margin-right: 1.5pt;
  position: relative;
}
.pr-cb-x::before {
  content: '✓';
  position: absolute;
  inset: -1pt 0 0 0;
  text-align: center;
  font-size: 9pt;
  line-height: 9pt;
  font-weight: bold;
}
.pr-rd {
  display: inline-block;
  width: 7pt;
  height: 7pt;
  border: 0.6pt solid #000;
  border-radius: 50%;
  vertical-align: -0.5pt;
  margin: 0 2pt 0 0;
  position: relative;
}
.pr-rd-x::before {
  content: '';
  position: absolute;
  inset: 1pt;
  background: #000;
  border-radius: 50%;
}
.pr-line {
  display: inline-block;
  min-width: 2.2cm;
  border-bottom: 0.4pt dotted #000;
  padding: 0 2pt;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: baseline;
}
.pr-line-xs { min-width: 0.9cm; }
.pr-line-sm { min-width: 1.8cm; }
.pr-line-md { min-width: 4.5cm; }
.pr-center { text-align: center; }
.pr-right { text-align: right; }
.pr-tiny { font-size: 12pt; line-height: 1.15; }
.pr-italic { font-style: italic; color: #333; }
.pr-mt-xs { margin-top: 1pt; }
.pr-mt-sm { margin-top: 3pt; }
.pr-mt-md { margin-top: 5pt; }
.pr-paren { margin-left: 1.2cm; }
.pr-uline { text-decoration: underline; }
.pr-num { display: inline-block; width: 1em; }
.pr-sig-row {
  display: flex;
  align-items: baseline;
  flex-wrap: nowrap;
  gap: 0;
  white-space: nowrap;
}
.pr-sig-label { display: inline-block; }
.pr-spacer { visibility: hidden; }
.pr-paren-name {
  display: inline-block;
  width: 4.5cm;
  text-align: center;
}
.pr-sig-date {
  display: inline-flex;
  align-items: baseline;
  white-space: nowrap;
  margin-left: 8pt;
}
.pr-sl { display: inline-block; padding: 0 1pt; }

/* ============ Page 1 ============ */
.pr-p1-logo { margin-bottom: 2pt; }
.pr-p1-logo img { height: 50pt; width: auto; display: block; }
.pr-p1-title { font-size: 14pt; margin: 2pt 0 3pt; }
.pr-p1-meta-row { text-align: right; font-size: 12pt; line-height: 1.3; }

.pr-p1-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  height: 240mm;
}
.pr-p1-table th, .pr-p1-table td {
  border: 0.6pt solid #000;
  padding: 2pt 4pt;
  vertical-align: top;
  font-weight: normal;
}
.pr-p1-head-l, .pr-p1-head-r { padding: 5pt 6pt; height: 20mm; }
.pr-head-desc { text-align: left; margin-top: 4pt; }
.pr-between { display: flex; justify-content: space-between; align-items: baseline; gap: 8pt; }
.pr-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); align-items: baseline; gap: 4pt; }
.pr-sig-fill { display: flex; align-items: baseline; gap: 4pt; width: 100%; }
.pr-fill-row { display: flex; align-items: baseline; gap: 4pt; width: 100%; }
.pr-line-fill {
  flex: 1 1 auto;
  border-bottom: 0.4pt dotted #000;
  padding: 0 3pt;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pr-p1-body-l, .pr-p1-body-r {
  font-size: 12pt;
  line-height: 1.15;
  vertical-align: top;
  height: 210mm;
}
.pr-cell {
  display: flex;
  flex-direction: column;
  height: 210mm;
}
.pr-cell-main > div { margin: 0.5pt 0; }
.pr-cell-sig {
  margin-top: auto;
  padding-top: 2pt;
}
.pr-cell-sig > div { margin: 0.5pt 0; }
.pr-q { margin-top: 1.5pt !important; }
.pr-ind { padding-left: 0; }
.pr-ind2 { padding-left: 0.9cm; }
.pr-ind3 { padding-left: 1.6cm; }

.pr-cond-block {
  border-top: 0.6pt solid #000;
  margin-top: 4pt;
  padding-top: 3pt;
}
.pr-cond-header { margin-bottom: 2pt; }
.pr-cond {
  margin: 0;
  padding-left: 1.2em;
  list-style: decimal outside;
}
.pr-cond li { margin: 4pt 0; line-height: 1.1; }

.pr-p1-inner, .pr-p2-inner {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
@media screen {
  .pr-p1-inner { min-height: 285mm; }
  .pr-p2-inner { min-height: 198mm; }
}
.pr-p1-footer, .pr-p2-footer {
  margin-top: auto;
  padding-top: 4pt;
  text-align: left;
  font-size: 10pt;
}

/* ============ Page 2 ============ */
.pr-p2-top {
  display: grid;
  grid-template-areas:
    "logo  .      right"
    "title title  right";
  grid-template-columns: auto 1fr auto;
  column-gap: 8pt;
  row-gap: 4pt;
  margin-bottom: 4pt;
  align-items: start;
}
.pr-p2-logo { grid-area: logo; height: 40pt; width: auto; display: block; }
.pr-p2-title { grid-area: title; font-size: 16pt; text-align: center; }
.pr-p2-top-r {
  grid-area: right;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2pt;
  font-size: 11pt;
  line-height: 1.2;
}
.pr-p2-sheet {
  display: flex;
  align-items: baseline;
  gap: 4pt;
  margin-left: auto;
  min-width: 7cm;
}
.pr-p2-infobox {
  border: 0.6pt solid #000;
  padding: 4pt 6pt;
  display: flex;
  flex-direction: column;
  gap: 2pt;
  margin-left: auto;
  min-width: 7cm;
  width: fit-content;
}

.pr-p2-info {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin-bottom: 20pt;
}
.pr-p2-info td {
  border: 0.6pt solid #000;
  padding: 3pt 5pt;
  vertical-align: top;
  font-size: 11pt;
  line-height: 1.25;
}
.pr-p2-info-l { width: 72%; }
.pr-p2-info-r { width: 28%; }
.pr-p2-info > tbody > tr > td > div { margin-bottom: 0.5pt; }

.pr-p2-items {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 10.5pt;
  margin-bottom: 20pt;
}
.pr-p2-items th, .pr-p2-items td {
  border: 0.5pt solid #000;
  padding: 1.5pt 2.5pt;
  vertical-align: top;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.1;
}
.pr-p2-items thead th { text-align: center; font-weight: bold; }
.pr-p2-items tbody tr { min-height: 20pt; }
.pr-p2-empty td { height: 18pt; }
.pr-p2-items td.pr-noborder {
  border-top: none;
  border-bottom: none;
  border-left: none;
  border-right: 0.5pt solid #000;
}

.pr-p2-sign {
  display: grid;
  grid-template-columns: 1fr 1fr;
  justify-items: center;
  row-gap: 4pt;
  margin-top: 6pt;
  font-size: 11pt;
}
.pr-p2-sign > .pr-fill-row { width: 9cm; }

.pr-p2-warn {
  text-align: center;
  margin-top: 18pt;
  font-size: 11pt;
}
`;
