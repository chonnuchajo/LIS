// ปริ้นฟอร์ม F-WAR-03-01,02 ให้เหมือนกระดาษ — A4 แนวตั้ง 2 แผ่น
// primitive CB/RD/Line + แนวคิด CSS ยกมาจาก PetitionPrintTemplate แล้วเปลี่ยน prefix เป็น .gr-
import { A4_PRINT_FONT_FAMILY, A4_PRINT_FONT_SIZE } from '@/lib/printConfig';
import FitToBox from '@/components/petition/FitToBox';
import { ICP_LADDA_LOGO_URL } from '@/lib/branding';
import type {
  Appearance, ContainerType, GoodsReceipt, GrossWeightUnit, QuantityUnit, WeightUnit,
} from '@/types/goodsReceipt.types';
import {
  APPEARANCE_LABELS, CONTAINER_CONDITION_LABELS, CONTAINER_TYPE_LABELS,
  LATE_DELIVERY_LABELS, PRESENCE_LABELS, QUANTITY_UNIT_LABELS,
  RECEIPT_REFERENCE_LABELS, TOLERANCE_RESULT_LABELS, WEIGHT_UNIT_LABELS,
} from '@/lib/goodsReceipt';

const CB = ({ checked }: { checked?: boolean }) =>
  <span className={`gr-cb${checked ? ' gr-cb-x' : ''}`} aria-hidden />;
const RD = ({ checked }: { checked?: boolean }) =>
  <span className={`gr-rd${checked ? ' gr-rd-x' : ''}`} aria-hidden />;
const Line = ({ value, width }: { value?: string | number | null; width?: string }) =>
  <span className="gr-line" style={width ? { minWidth: width } : undefined}>{value || ' '}</span>;

// วันที่แบบ พ.ศ. dd/mm/yy ตาม buddhistShort() ใน PetitionPrintTemplate
function buddhistShort(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String((d.getFullYear() + 543) % 100).padStart(2, '0');
  return `${dd}/${mm}/${yy}`;
}

// รายการหน่วยพิมพ์เต็มแบบกระดาษ ("ถัง/กส/กล่อง/กป") — ตัวที่เลือกไว้ตัวหนา+ขีดเส้นใต้แทนการวงกลมด้วยมือ
function UnitList<K extends string>({ options, map, selected }: { options: K[]; map: Record<K, string>; selected?: K }) {
  return (
    <span className="gr-units">
      {options.map((key, idx) => (
        <span key={key}>
          {idx > 0 ? '/' : ''}
          <span className={selected === key ? 'gr-unit-sel' : undefined}>{map[key]}</span>
        </span>
      ))}
    </span>
  );
}

const QUANTITY_UNIT_ORDER: QuantityUnit[] = ['drum', 'sack', 'box', 'can'];
const WEIGHT_UNIT_ORDER: WeightUnit[] = ['litre', 'kg', 'piece'];
const GROSS_WEIGHT_UNIT_ORDER: GrossWeightUnit[] = ['litre', 'kg'];
const CONTAINER_TYPE_ROWS: ContainerType[][] = [
  ['paperDrum', 'steelDrum', 'plasticDrum', 'paperSack'],
  ['plasticSack', 'paperBox', 'jar', 'other'],
];
const APPEARANCE_ROWS: Appearance[][] = [
  ['powder', 'flake', 'granule', 'lump', 'fine', 'coarse'],
  ['viscousLiquid', 'clearLiquid', 'other'],
];

function PageOne({ doc }: { doc: GoodsReceipt }) {
  const r = doc.receipt ?? {};
  const refs = r.references ?? [];
  const lateDelivery = r.lateDelivery ?? [];
  const caBatches = r.caBatches ?? [];
  const productBatches = r.productBatches ?? [];
  const batchRows = Math.max(caBatches.length, productBatches.length, 1);

  return (
    <section className="gr-page1">
      <FitToBox className="gr-fit-outer" contentClassName="gr-fit-col">
        <div className="gr-logo">
          <img src={ICP_LADDA_LOGO_URL} alt="ICP Ladda" />
        </div>
        <div className="gr-title">ใบรับสินค้า (ลัดดา)</div>
        <p>คลังสินค้า <Line value={doc.warehouse} width="4cm" />
           {' '}เลขที่ <Line value={doc.receiptNo} width="4cm" /></p>

        <p>อ้างถึง</p>
        <p className="gr-ind2">
          <CB checked={refs.includes('foreign')} />{RECEIPT_REFERENCE_LABELS.foreign}
          {' '}ใบสั่งซื้อเลขที่ <Line value={r.purchaseOrderNo} width="3.5cm" />
          {' '}วันที่ <Line value={buddhistShort(r.purchaseOrderDate)} width="2.5cm" />
        </p>
        <p className="gr-ind2">
          <CB checked={refs.includes('domestic')} />{RECEIPT_REFERENCE_LABELS.domestic}
        </p>
        <p className="gr-ind2">
          <CB checked={refs.includes('deliveryNote')} />{RECEIPT_REFERENCE_LABELS.deliveryNote}
          {' '}<Line value={r.deliveryNoteNo} width="5cm" />
        </p>

        <div className="gr-box">
          <div className="gr-sec-title">รายการที่ตรวจรับ</div>

          <p className="gr-item">
            1. รหัสสินค้า <Line value={r.productCode} width="3.5cm" />
            {' '}ชื่อสินค้า <Line value={r.productName} width="6cm" />
            {' '}% สารออกฤทธิ์ <Line value={r.activeIngredientPercent} width="2.5cm" />
          </p>
          <p className="gr-item">
            2. ขนาดบรรจุ <Line value={r.packageSize} width="3cm" />
            {' '}จำนวน <Line value={r.quantity} width="1.6cm" />{' '}
            <UnitList options={QUANTITY_UNIT_ORDER} map={QUANTITY_UNIT_LABELS} selected={r.quantityUnit} />
            {' '}น้ำหนักรวม <Line value={r.totalWeight} width="1.8cm" />{' '}
            <UnitList options={WEIGHT_UNIT_ORDER} map={WEIGHT_UNIT_LABELS} selected={r.totalWeightUnit} />
          </p>
          <p className="gr-item">
            3. ข้อมูลจากผู้ขาย Gross Weight <Line value={r.sellerGrossWeightKg} width="2cm" /> กก.
            {' '}Net Weight <Line value={r.sellerNetWeightLitre} width="2cm" /> ลิตร
            {' '}<Line value={r.sellerNetWeightKg} width="2cm" /> กก.
          </p>

          <p className="gr-underline">กรณีมีแบชนัมเบอร์ กรุณาระบุจำนวนหน่วยในแต่ละแบช</p>
          <table className="gr-batch">
            <colgroup><col style={{ width: '9.6cm' }} /><col style={{ width: '9.6cm' }} /></colgroup>
            <thead>
              <tr>
                <th>
                  ข้อมูลจากผู้ขาย (CA){' '}
                  <RD checked={r.caBatchMode === 'has'} />มีแบชนัมเบอร์{' '}
                  <RD checked={r.caBatchMode === 'none'} />ไม่มีแบชนัมเบอร์
                </th>
                <th>
                  ข้อมูลจากสินค้า{' '}
                  <RD checked={r.productBatchMode === 'has'} />มีแบชนัมเบอร์{' '}
                  <RD checked={r.productBatchMode === 'none'} />ไม่มีแบชนัมเบอร์
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: batchRows }).map((_, idx) => {
                const ca = caBatches[idx];
                const pb = productBatches[idx];
                return (
                  <tr key={idx}>
                    <td>
                      แบชนัมเบอร์ <Line value={ca?.batchNo} width="2.4cm" /> ={' '}
                      <Line value={ca?.amount} width="1.6cm" />{' '}
                      <UnitList options={WEIGHT_UNIT_ORDER} map={WEIGHT_UNIT_LABELS} selected={ca?.unit} />
                    </td>
                    <td>
                      แบชนัมเบอร์ <Line value={pb?.batchNo} width="2.4cm" /> ={' '}
                      <Line value={pb?.amount} width="1.6cm" />{' '}
                      <UnitList options={WEIGHT_UNIT_ORDER} map={WEIGHT_UNIT_LABELS} selected={pb?.unit} />
                      {pb?.sendToLab ? ' (ส่งตรวจ)' : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="gr-item">5. ชื่อผู้ขาย <Line value={r.seller} width="6cm" /> ประเทศ <Line value={r.sellerCountry} width="3cm" /></p>
          <p className="gr-item">6. ชื่อผู้ผลิต <Line value={r.manufacturer} width="6cm" /> ประเทศ <Line value={r.manufacturerCountry} width="3cm" /></p>
          <p className="gr-item">
            7. เกณฑ์คลาดเคลื่อนมาตรฐานสารออกฤทธิ์ (สารเคมีหลัก) <Line value={r.activeIngredientTolerance} width="9cm" />
          </p>
          <p className="gr-ind2">
            <RD checked={r.toleranceResult === 'within'} />{TOLERANCE_RESULT_LABELS.within}{' '}
            <RD checked={r.toleranceResult === 'outside'} />{TOLERANCE_RESULT_LABELS.outside} คือ{' '}
            <Line value={r.toleranceOutsideReason} width="6cm" />
          </p>
          <p className="gr-item">8. การส่งมอบ (กรอกเฉพาะกรณีส่งมอบล่าช้า)</p>
          <p className="gr-ind2"><CB checked={lateDelivery.includes('vsReport')} />{LATE_DELIVERY_LABELS.vsReport}</p>
          <p className="gr-ind2"><CB checked={lateDelivery.includes('vsPurchaseOrder')} />{LATE_DELIVERY_LABELS.vsPurchaseOrder}</p>
        </div>

        <div className="gr-sig">
          <span>ผู้รับสินค้า <Line value={r.receivedByName} width="5cm" /></span>
          <span>วันที่ <Line value={buddhistShort(r.receivedAt)} width="3cm" /></span>
        </div>

        <div className="gr-footer">F-WAR-03-01 Rev:03 01/09/60</div>
      </FitToBox>
    </section>
  );
}

function PageTwo({ doc }: { doc: GoodsReceipt }) {
  const r = doc.receipt ?? {};
  const i = doc.inspection ?? {};
  const weighBatches = i.weighBatches ?? [];
  const weighRows = Math.max(weighBatches.length, 1);
  const appearance = i.appearance ?? [];

  return (
    <section className="gr-page2">
      <FitToBox className="gr-fit-outer" contentClassName="gr-fit-col">
        <p className="gr-brand">I C P Ladda Co., Ltd.</p>
        <div className="gr-title">ใบตรวจสอบวัตถุดิบ</div>
        <p>คลังสินค้า <Line value={doc.warehouse} width="4cm" />
           {' '}เลขที่ <Line value={doc.inspectionNo} width="4cm" /></p>
        <p className="gr-p2-ref">
          อ้างถึงใบรับวัตถุดิบ เลขที่ <Line value={doc.receiptNo} width="4cm" />
          {' '}วันที่ <Line value={buddhistShort(r.receivedAt)} width="2.5cm" />
        </p>

        <table className="gr-p2-tbl">
          <colgroup><col style={{ width: '22%' }} /><col style={{ width: '78%' }} /></colgroup>
          <thead>
            <tr><th>รายการ</th><th>ผลการตรวจสอบ</th></tr>
          </thead>
          <tbody>
            <tr>
              <td className="gr-p2-label">1. ลักษณะภาชนะที่ใส่</td>
              <td className="gr-p2-content">
                {CONTAINER_TYPE_ROWS.map((row, ri) => (
                  <div className="gr-row" key={ri}>
                    {row.map((key) => (
                      <span key={key} className="gr-opt">
                        <RD checked={i.containerType === key} />{CONTAINER_TYPE_LABELS[key]}
                        {key === 'other' && <>{' '}<Line value={i.containerTypeOther} width="3cm" /></>}
                      </span>
                    ))}
                  </div>
                ))}
              </td>
            </tr>
            <tr>
              <td className="gr-p2-label">2. สภาพภาชนะที่ใส่</td>
              <td className="gr-p2-content">
                <div className="gr-row">
                  <RD checked={i.containerCondition === 'normal'} />{CONTAINER_CONDITION_LABELS.normal}{' '}
                  <RD checked={i.containerCondition === 'leakOrBroken'} />{CONTAINER_CONDITION_LABELS.leakOrBroken}{' '}
                  แบชที่ <Line value={i.containerConditionBatches} width="6cm" />
                </div>
              </td>
            </tr>
            <tr>
              <td className="gr-p2-label">3. สัญลักษณ์บนภาชนะ (สำหรับสินค้าต่างประเทศ)</td>
              <td className="gr-p2-content">
                <div className="gr-row">
                  <RD checked={i.labelStatus === 'has'} />{PRESENCE_LABELS.has}ฉลากปิด{' '}
                  <RD checked={i.labelStatus === 'none'} />{PRESENCE_LABELS.none}ฉลากปิด
                </div>
                <div className="gr-row">
                  <RD checked={i.sealMarkStatus === 'has'} />{PRESENCE_LABELS.has}ซีลปิ๊งมาร์ค{' '}
                  <RD checked={i.sealMarkStatus === 'none'} />{PRESENCE_LABELS.none}ซีลปิ๊งมาร์ค
                </div>
              </td>
            </tr>
            <tr>
              <td className="gr-p2-label">4. การสุ่มตัวอย่างชั่งน้ำหนัก</td>
              <td className="gr-p2-content">
                <div className="gr-row2">
                  <div>ถพ. = <Line value={i.specificGravity} width="2.2cm" /> (กรณีวัดได้)</div>
                  <div>
                    Gross weight <Line value={i.grossWeight} width="2.2cm" />{' '}
                    <UnitList options={GROSS_WEIGHT_UNIT_ORDER} map={WEIGHT_UNIT_LABELS} selected={i.grossWeightUnit} />
                  </div>
                </div>
                <div className="gr-row2">
                  <div>Net weight <Line value={i.netWeightLitre} width="2.2cm" /> ลิตร</div>
                  <div>Net weight <Line value={i.netWeightKg} width="2.2cm" /> กก.</div>
                </div>
                <div className="gr-row">
                  ช่วงยอมรับ ต่ำกว่า Gross weight ไม่เกิน 0.2%{' '}
                  สูงกว่า Gross weight ไม่เกิน 1.5% = <Line value={i.toleranceKg} width="2cm" /> กก.
                </div>
                {Array.from({ length: weighRows }).map((_, idx) => {
                  const b = weighBatches[idx];
                  return (
                    <div className="gr-row2" key={idx}>
                      <div>
                        แบช <Line value={b?.batchNo} width="2.2cm" /> จำนวน <Line value={b?.quantity} width="1.6cm" />{' '}
                        <UnitList options={QUANTITY_UNIT_ORDER} map={QUANTITY_UNIT_LABELS} selected={b?.quantityUnit} />
                      </div>
                      <div>น้ำหนัก = <Line value={b?.weightKg} width="2.2cm" /> กก.</div>
                    </div>
                  );
                })}
              </td>
            </tr>
            <tr>
              <td className="gr-p2-label">สรุปผลการตรวจ ข้อ 1-4</td>
              <td className="gr-p2-content">
                <div className="gr-row">
                  <RD checked={i.summary14?.accepted === true} />ยอมรับได้ <Line value={i.summary14?.note} width="8cm" />
                </div>
                <div className="gr-row">
                  <RD checked={i.summary14?.accepted === false} />ยอมรับไม่ได้ เพราะ <Line value={i.summary14?.rejectReason} width="8cm" />
                </div>
                <div className="gr-sig">
                  <span>ผู้ตรวจสอบ <Line value={i.summary14?.inspectedBy} width="4cm" /></span>
                  <span>วันที่ <Line value={buddhistShort(i.summary14?.inspectedAt)} width="2.5cm" /></span>
                </div>
              </td>
            </tr>
            <tr>
              <td className="gr-p2-label">5. ลักษณะของสินค้า</td>
              <td className="gr-p2-content">
                <div className="gr-row">แบชที่ลักษณะเหมือนเดิม คือ แบชที่ <Line value={i.appearanceSameBatches} width="8cm" /></div>
                {APPEARANCE_ROWS.map((row, ri) => (
                  <div className="gr-row" key={ri}>
                    {row.map((key) => (
                      <span key={key} className="gr-opt">
                        <CB checked={appearance.includes(key)} />{APPEARANCE_LABELS[key]}
                        {key === 'other' && <>{' '}ระบุ <Line value={i.appearanceOther} width="3cm" /></>}
                      </span>
                    ))}
                  </div>
                ))}
                <div className="gr-row">แบชที่ลักษณะไม่เหมือนเดิม คือ แบชที่ <Line value={i.appearanceDiffBatches} width="8cm" /></div>
                <div className="gr-row">ระบุสิ่งที่ไม่เหมือนเดิม <Line value={i.appearanceDiffDetail} width="10cm" /></div>
              </td>
            </tr>
            <tr>
              <td className="gr-p2-label">6. สีของสินค้า</td>
              <td className="gr-p2-content">
                <div className="gr-row">แบชที่สีเหมือนเดิม คือ แบชที่ <Line value={i.colorSameBatches} width="8cm" /></div>
                <div className="gr-row">สี <Line value={i.colorSame} width="8cm" /></div>
                <div className="gr-row">แบชที่สีไม่เหมือนเดิม คือ แบชที่ <Line value={i.colorDiffBatches} width="8cm" /></div>
                <div className="gr-row">สี <Line value={i.colorDiff} width="8cm" /></div>
              </td>
            </tr>
            <tr>
              <td className="gr-p2-label">สรุปผลการตรวจสอบ ข้อ 5-6</td>
              <td className="gr-p2-content">
                <div className="gr-row">
                  <RD checked={i.summary56?.accepted === true} />ยอมรับได้ <Line value={i.summary56?.note} width="8cm" />
                </div>
                <div className="gr-row">
                  <RD checked={i.summary56?.accepted === false} />ยอมรับไม่ได้ เพราะ <Line value={i.summary56?.rejectReason} width="8cm" />
                </div>
                <div className="gr-sig">
                  <span>ผู้ตรวจสอบ <Line value={i.summary56?.inspectedBy} width="4cm" /></span>
                  <span>วันที่ <Line value={buddhistShort(i.summary56?.inspectedAt)} width="2.5cm" /></span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="gr-footer">F-WAR-03-02 Rev:03 01/09/60</div>
      </FitToBox>
    </section>
  );
}

export default function GoodsReceiptPrintTemplate({ doc }: { doc: GoodsReceipt }) {
  return (
    <div className="gr-root">
      <style>{GOODS_RECEIPT_CSS}</style>
      <PageOne doc={doc} />
      <PageTwo doc={doc} />
    </div>
  );
}

export const GOODS_RECEIPT_CSS = `
@page { size: A4; margin: 0 }
/* .gr-root ตั้งใจเป็น selector เดี่ยว ไม่ nest ลูก (ไม่ใช่ ".gr-root *") — ใช้ได้เพราะ JSX ในไฟล์นี้
   มีแต่ classNames prefix gr-* เท่านั้น และ Tailwind preflight ไม่ตั้ง typography ให้ p/span/td/div เปล่าๆ
   เลย inherit font/size ลงมาได้เนียนทั้งซับทรี แต่ collectDocumentCss() (src/lib/print.ts) inline
   stylesheet ทั้งหมดในหน้า (รวม Tailwind) ลงไปในหน้าปริ้นด้วย — ถ้าใครเพิ่ม Tailwind utility class
   (เช่น className="text-sm") หรือ reuse shared UI primitive ที่มี utility class ติดมาไว้ใน subtree นี้
   utility นั้นจะ override typography ของฟอร์มตอนปริ้นทันที (เพราะ .gr-root เป็นแค่ selector เดี่ยว
   ไม่ได้บังคับ !important ทับลูกทุกตัว) ห้ามใช้ className อื่นนอกจาก gr-* ในไฟล์นี้ */
.gr-root { font-family: ${A4_PRINT_FONT_FAMILY} !important;
           font-size: ${A4_PRINT_FONT_SIZE} !important; color: #000 !important; line-height: 1.2 }
.gr-root, .gr-root * { box-sizing: border-box }
.gr-page1, .gr-page2 { width: 210mm; height: 297mm; padding: 6mm 8mm 6mm 10mm;
                       display: flex; flex-direction: column; overflow: hidden;
                       background: #fff }
.gr-page1 { page-break-after: always }

.gr-cb { position: relative; display: inline-block; width: 9pt; height: 9pt;
         border: 0.6pt solid #000; vertical-align: -1pt; margin-right: 3pt }
.gr-cb-x::before { content: '✓'; position: absolute; inset: -2pt 0 0 0.5pt; font-size: 9pt }
.gr-rd { position: relative; display: inline-block; width: 7pt; height: 7pt;
         border: 0.6pt solid #000; border-radius: 50%; vertical-align: -1pt; margin-right: 3pt }
.gr-rd-x::before { content: ''; position: absolute; inset: 1pt; background: #000; border-radius: 50% }
.gr-line { display: inline-block; min-width: 2cm; border-bottom: 0.4pt dotted #000;
           padding: 0 2pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: baseline }

.gr-footer { margin-top: auto; font-size: 9pt; padding-top: 3pt }
.gr-logo { margin-bottom: 2mm }
.gr-logo img { height: 14mm; width: auto; display: block }
.gr-title { text-align: center; font-weight: 700; font-size: 18pt; margin-bottom: 4mm }
.gr-ind2 { margin-left: 0.5cm }

/* FitToBox: outer box ยืดเต็มพื้นที่หน้า / content เป็น flex column ให้ .gr-footer ใช้ margin-top:auto ดันลงล่างได้ */
.gr-fit-outer { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 100% }
.gr-fit-col { display: flex; flex-direction: column }

.gr-item { margin: 2pt 0 }
.gr-brand { font-size: 11pt; margin: 0 0 2pt }

.gr-box { border: 0.6pt solid #000; padding: 4pt 8pt; margin: 3mm 0 2mm }
.gr-sec-title { text-align: center; font-weight: 700; font-size: 13pt;
                border-bottom: 0.6pt solid #000; margin: -4pt -8pt 4pt; padding: 3pt 0 }
.gr-underline { text-decoration: underline; font-weight: 700; margin: 4pt 0 2pt }

.gr-units { white-space: nowrap }
.gr-unit-sel { font-weight: 700; text-decoration: underline }

.gr-batch { width: 100%; border-collapse: collapse; margin-bottom: 2mm; table-layout: fixed }
.gr-batch th, .gr-batch td { border: 0.6pt solid #000; padding: 2pt 4pt; vertical-align: top; font-weight: normal; font-size: 10.5pt }
.gr-batch thead th { font-weight: 700; text-align: left }

.gr-sig { margin-top: 6pt; display: flex; gap: 24pt; align-items: baseline }

.gr-p2-ref { margin-bottom: 3mm }
.gr-opt { margin-right: 10pt; display: inline-block }

.gr-p2-tbl { width: 100%; border-collapse: collapse; table-layout: fixed }
.gr-p2-tbl th, .gr-p2-tbl td { border: 0.6pt solid #000; padding: 3pt 5pt; vertical-align: top }
.gr-p2-tbl thead th { text-align: center; font-weight: 700 }
.gr-p2-label { font-weight: 700 }
.gr-row { margin: 1.5pt 0 }
.gr-row2 { display: flex; gap: 12pt; margin: 1.5pt 0 }
.gr-row2 > div { flex: 1 1 50% }

@media print { .gr-page1, .gr-page2 { break-inside: avoid } }
@media screen { .gr-page1, .gr-page2 { box-shadow: 0 0 0 1px #ddd; margin: 0 auto 4mm } }
`;
