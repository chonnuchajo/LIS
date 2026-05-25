import type { Petition } from '@/types/petition.types';
import type { ProductionPlan } from '@/types/productionPlan.types';

type Props = { plan: ProductionPlan; petition: Petition };

function buddhistShort(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String((d.getFullYear() + 543) % 100).padStart(2, '0');
  return `${dd}/${mm}/${yy}`;
}

function timeHM(value?: string | null): string {
  if (!value) return '';
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  return '';
}

function CB({ checked }: { checked?: boolean }) {
  return <span className={`pp-cb${checked ? ' pp-cb-x' : ''}`} aria-hidden />;
}

function Header({ petition }: { petition: Petition }) {
  return (
    <div className="pp-header">
      <div className="pp-header-row">
        <div className="pp-header-left">บริษัท ไอ ซี พี ลัดดา จำกัด</div>
        <div className="pp-header-right">
          เลขที่<span className="pp-line pp-line-md">{petition.petitionNo}</span>
        </div>
      </div>
      <div className="pp-header-row pp-header-title-row">
        <div className="pp-header-title">ใบวางแผน-ควบคุมการผลิต</div>
        <div className="pp-header-right">
          แผนกผลิต<span className="pp-line pp-line-sm" />
        </div>
      </div>
    </div>
  );
}

function Section1({ plan }: { plan: ProductionPlan }) {
  return (
    <table className="pp-table pp-section">
      <colgroup>
        <col style={{ width: '17%' }} />
        <col style={{ width: '17%' }} />
        <col style={{ width: '32%' }} />
        <col style={{ width: '17%' }} />
        <col style={{ width: '17%' }} />
      </colgroup>
      <thead>
        <tr>
          <th colSpan={5} className="pp-section-title">ส่วนที่ 1 การวางแผนผลิต</th>
        </tr>
        <tr>
          <th>ว.ด.ป.ที่วางแผน</th>
          <th>ว.ด.ป.ที่จะผลิต</th>
          <th>ชื่อสามัญ, % สารและลักษณะสูตร</th>
          <th>จำนวนที่ผลิต (กก.,ลิตร)</th>
          <th>แบชนัมเบอร์</th>
        </tr>
      </thead>
      <tbody>
        {(plan.batchNos && plan.batchNos.length > 0 ? plan.batchNos : [plan.batchNo]).map((batchNo, i) => (
          <tr key={batchNo} className="pp-tall">
            <td>{i === 0 ? buddhistShort(plan.planDate) : ""}</td>
            <td>{i === 0 ? buddhistShort(plan.productionDate) : ""}</td>
            <td className="pp-text-left">{i === 0 ? (plan.commonName || ' ') : ""}</td>
            <td>{plan.quantity || ' '}</td>
            <td>{batchNo}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NameLine({ plan }: { plan: ProductionPlan }) {
  return (
    <div className="pp-namelist">
      <span>รายชื่อพนักงานผลิต</span>
      <span className="pp-line pp-line-grow">{plan.staffNames || ''}</span>
    </div>
  );
}

function Section2({ plan }: { plan: ProductionPlan }) {
  const left = plan.machineChecks.slice(0, 6);
  const right = plan.machineChecks.slice(6, 12);
  return (
    <table className="pp-table pp-section">
      <colgroup>
        <col style={{ width: '24%' }} />
        <col style={{ width: '7%' }} />
        <col style={{ width: '7%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '24%' }} />
        <col style={{ width: '7%' }} />
        <col style={{ width: '7%' }} />
        <col style={{ width: '12%' }} />
      </colgroup>
      <thead>
        <tr>
          <th colSpan={8} className="pp-section-title">ส่วนที่ 2 การตรวจสอบสภาพเครื่องจักร</th>
        </tr>
        <tr>
          <th rowSpan={2}>หัวข้อการตรวจ</th>
          <th colSpan={2}>สภาพ</th>
          <th rowSpan={2}>ว/ด/ป ที่ใช้ได้</th>
          <th rowSpan={2}>หัวข้อการตรวจ</th>
          <th colSpan={2}>สภาพ</th>
          <th rowSpan={2}>ว/ด/ป ที่ใช้ได้</th>
        </tr>
        <tr>
          <th>ใช้ได้</th>
          <th>ใช้ไม่ได้</th>
          <th>ใช้ได้</th>
          <th>ใช้ไม่ได้</th>
        </tr>
      </thead>
      <tbody>
        {left.map((lRaw, i) => {
          const l = lRaw ?? { name: '' };
          const r = right[i] ?? null;
          return (
            <tr key={i}>
              <td className="pp-text-left">{l.name}</td>
              <td>{l.ok === true ? '✓' : ''}</td>
              <td>{l.ok === false ? '✓' : ''}</td>
              <td>{buddhistShort(l.dateOk)}</td>
              <td className="pp-text-left">{r?.name ?? ''}</td>
              <td>{r?.ok === true ? '✓' : ''}</td>
              <td>{r?.ok === false ? '✓' : ''}</td>
              <td>{buddhistShort(r?.dateOk)}</td>
            </tr>
          );
        })}
        <tr>
          <td colSpan={8} className="pp-text-left pp-pad">
            กรณีใช้ไม่ได้ กรุณาระบุอาการ
            <span className="pp-line pp-line-grow">{plan.machineDefectNote || ''}</span>
          </td>
        </tr>
        <tr>
          <td colSpan={8} className="pp-text-left pp-pad">
            ตรวจสอบโดย<span className="pp-line pp-line-lg">{plan.machineInspectedBy || ''}</span>
            วันที่<span className="pp-line pp-line-md">{buddhistShort(plan.machineInspectedAt)}</span>
            เวลา<span className="pp-line pp-line-md">{timeHM(plan.machineInspectedAt)}</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Section3({ plan }: { plan: ProductionPlan }) {
  const c = plan.cleaning;
  return (
    <table className="pp-table pp-section">
      <colgroup>
        <col style={{ width: '24%' }} />
        <col style={{ width: '19%' }} />
        <col style={{ width: '19%' }} />
        <col style={{ width: '19%' }} />
        <col style={{ width: '19%' }} />
      </colgroup>
      <thead>
        <tr>
          <th colSpan={5} className="pp-section-title">
            ส่วนที่ 3 ตรวจสอบการทำความสะอาดเครื่องจักรและอุปกรณ์การผลิต
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="pp-text-left">
            <CB checked={c.continuous} /> งานต่อเนื่องไม่ล้างเครื่อง
          </td>
          <td colSpan={4}>&nbsp;</td>
        </tr>
        <tr>
          <td className="pp-text-left">
            <CB checked={!c.continuous} /> ล้างเครื่อง
          </td>
          <td className="pp-text-left">โซเวสโซ่<span className="pp-line pp-line-sm">{c.solvent ?? ''}</span> ลิตร</td>
          <td className="pp-text-left">น้ำ<span className="pp-line pp-line-sm">{c.water ?? ''}</span> ลิตร</td>
          <td className="pp-text-left">ดินขาว<span className="pp-line pp-line-sm">{c.kaolin ?? ''}</span> กก.</td>
          <td className="pp-text-left">ทราย<span className="pp-line pp-line-sm">{c.sand ?? ''}</span> กก.</td>
        </tr>
        <tr>
          <td colSpan={5} className="pp-text-left pp-pad">
            ตรวจสอบโดย<span className="pp-line pp-line-lg">{c.inspectedBy ?? ''}</span>
            วันที่<span className="pp-line pp-line-md">{buddhistShort(c.inspectedAt)}</span>
            เวลา<span className="pp-line pp-line-md">{timeHM(c.inspectedAt)}</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Section4A({ plan }: { plan: ProductionPlan }) {
  return (
    <table className="pp-table pp-section">
      <colgroup>
        <col style={{ width: '20%' }} />
        <col style={{ width: '20%' }} />
        <col style={{ width: '20%' }} />
        <col style={{ width: '20%' }} />
        <col style={{ width: '20%' }} />
      </colgroup>
      <thead>
        <tr>
          <th colSpan={5} className="pp-section-title">ส่วนที่ 4 การควบคุมการผลิต</th>
        </tr>
        <tr>
          <th colSpan={2}>เริ่มผลิตจริง</th>
          <th colSpan={2}>สิ้นสุดการผลิต</th>
          <th rowSpan={2}>จำนวนที่ผลิตได้<br />(กก., ลิตร)</th>
        </tr>
        <tr>
          <th>ว/ด/ป</th>
          <th>เวลา</th>
          <th>ว/ด/ป</th>
          <th>เวลา</th>
        </tr>
      </thead>
      <tbody>
        <tr className="pp-tall">
          <td>{buddhistShort(plan.actualStart?.date)}</td>
          <td>{timeHM(plan.actualStart?.time)}</td>
          <td>{buddhistShort(plan.actualEnd?.date)}</td>
          <td>{timeHM(plan.actualEnd?.time)}</td>
          <td>{plan.actualQty || ''}</td>
        </tr>
      </tbody>
    </table>
  );
}

function Section4Downtime({ plan }: { plan: ProductionPlan }) {
  const left = plan.downtimes[0];
  const right = plan.downtimes[1];
  return (
    <div className="pp-downtime">
      <div className="pp-downtime-title">เวลาที่เครื่องไม่สามารถทำงานได้ :</div>
      <table className="pp-table">
        <colgroup>
          <col style={{ width: '25%' }} />
          <col style={{ width: '25%' }} />
          <col style={{ width: '25%' }} />
          <col style={{ width: '25%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td className="pp-text-left">ตั้งแต่เวลา<span className="pp-line pp-line-sm">{timeHM(left?.fromTime)}</span></td>
            <td className="pp-text-left">{left?.reason ?? 'สาเหตุ (รวมไฟดับ)'}</td>
            <td className="pp-text-left">ตั้งแต่เวลา<span className="pp-line pp-line-sm">{timeHM(right?.fromTime)}</span></td>
            <td className="pp-text-left">{right?.reason ?? 'สาเหตุ (รวมไฟดับ)'}</td>
          </tr>
          <tr>
            <td className="pp-text-left">ถึงเวลา<span className="pp-line pp-line-sm">{timeHM(left?.toTime)}</span></td>
            <td>&nbsp;</td>
            <td className="pp-text-left">ถึงเวลา<span className="pp-line pp-line-sm">{timeHM(right?.toTime)}</span></td>
            <td>&nbsp;</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Section4Physical({ plan }: { plan: ProductionPlan }) {
  return (
    <div className="pp-physical">
      <div className="pp-physical-title">การตรวจสอบทางกายภาพ :</div>
      <table className="pp-table">
        <colgroup>
          <col style={{ width: '22%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '9%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>หัวข้อการตรวจสอบ</th>
            <th>ผลการตรวจสอบครั้งที่ 1</th>
            <th>ผ่าน</th>
            <th>ไม่ผ่าน</th>
            <th>ผู้ตรวจสอบ</th>
            <th>ผลการตรวจสอบครั้งที่ 2</th>
            <th>ผ่าน</th>
            <th>ไม่ผ่าน</th>
          </tr>
        </thead>
        <tbody>
          {plan.physicalChecks.map((pRaw, idx) => {
            const p = pRaw ?? { name: '' };
            return (
              <tr key={p.name || idx} className="pp-tall">
                <td className="pp-text-left">{p.name}</td>
                <td>{p.result1 ?? ''}</td>
                <td>{p.pass1 === true ? '✓' : ''}</td>
                <td>{p.pass1 === false ? '✓' : ''}</td>
                <td>{p.inspector1 ?? ''}</td>
                <td>{p.result2 ?? ''}</td>
                <td>{p.pass2 === true ? '✓' : ''}</td>
                <td>{p.pass2 === false ? '✓' : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="pp-physical-foot">
        <CB checked={plan.sendToLab === true} /> ส่งสารวิเคราะห์
        <span className="pp-gap-lg" />
        <CB checked={plan.sendToLab === false} /> ไม่ได้ส่งสารวิเคราะห์
      </div>
      <div className="pp-followup">
        การดำเนินการเมื่อผลการตรวจสอบครั้งที่ 1 ไม่ผ่าน<span className="pp-line pp-line-grow">{plan.followUpFail1 ?? ''}</span>
      </div>
      <div className="pp-followup">
        การดำเนินการเมื่อผลการตรวจสอบครั้งที่ 2 ไม่ผ่าน<span className="pp-line pp-line-grow">{plan.followUpFail2 ?? ''}</span>
      </div>
    </div>
  );
}

function Section4Weighing({ plan }: { plan: ProductionPlan }) {
  return (
    <div className="pp-weighing">
      <div className="pp-weighing-title">
        รายละเอียดการชั่งน้ำหนัก
        <span className="pp-gap-sm" />
        (อ้างถึงใบเบิกวัตถุดิบ และสารสำเร็จรูป เลขที่<span className="pp-line pp-line-md">{plan.weighingRef?.docNo ?? ''}</span>
        วันที่<span className="pp-line pp-line-md">{buddhistShort(plan.weighingRef?.docDate)}</span>)
      </div>
      <table className="pp-table pp-weighing-table">
        <colgroup>
          <col style={{ width: '6%' }} />
          <col style={{ width: '34%' }} />
          {Array.from({ length: 9 }).map((_, i) => (
            <col key={i} style={{ width: `${60 / 9}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={3}>ลำดับ</th>
            <th colSpan={10}>รายการและจำนวนวัตถุดิบที่ใช้</th>
          </tr>
          <tr>
            <th rowSpan={2}>วัตถุดิบ</th>
            <th colSpan={9}>กระสอบ/ถัง</th>
          </tr>
          <tr>
            {Array.from({ length: 9 }).map((_, i) => (
              <th key={i}>จำนวน</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plan.weighingRows.map((rowRaw, idx) => {
            const row = rowRaw ?? { seq: idx + 1, amounts: [] };
            const amounts = row.amounts ?? [];
            return (
              <tr key={row.seq ?? idx}>
                <td>{row.seq ?? idx + 1}</td>
                <td className="pp-text-left">{row.rawMaterial ?? ''}</td>
                {Array.from({ length: 9 }).map((_, j) => (
                  <td key={j}>{amounts[j] ?? ''}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SignatureBlock({ plan }: { plan: ProductionPlan }) {
  return (
    <div className="pp-signatures">
      <div className="pp-sig-row">
        <span>พนักงานชั่ง<span className="pp-line pp-line-lg">{plan.weigher ?? ''}</span></span>
        <span>เวลา<span className="pp-line pp-line-md">{timeHM(plan.weigherTime)}</span></span>
        <span>ผู้ควบคุมการชั่ง<span className="pp-line pp-line-lg">{plan.weighSupervisor ?? ''}</span></span>
        <span>เวลา<span className="pp-line pp-line-md">{timeHM(plan.weighSupervisorTime)}</span></span>
      </div>
      <div className="pp-sig-row">
        <span>พนักงานผสม<span className="pp-line pp-line-lg">{plan.mixer ?? ''}</span></span>
        <span>เวลา<span className="pp-line pp-line-md">{timeHM(plan.mixerTime)}</span></span>
        <span>ผู้ควบคุมการผสม<span className="pp-line pp-line-lg">{plan.mixSupervisor ?? ''}</span></span>
        <span>เวลา<span className="pp-line pp-line-md">{timeHM(plan.mixSupervisorTime)}</span></span>
      </div>
      <div className="pp-sig-row pp-sig-approve">
        <span>ผู้อนุมัติ<span className="pp-line pp-line-xl">{plan.approver ?? ''}</span> หัวหน้าแผนกผลิต</span>
        <span>วันที่<span className="pp-line pp-line-md">{buddhistShort(plan.approvedAt)}</span></span>
      </div>
    </div>
  );
}

function Section4Steps({ plan, petition }: { plan: ProductionPlan; petition: Petition }) {
  return (
    <div>
      <div className="pp-section-banner">ส่วนที่ 4 การควบคุมการผลิต (ขั้นตอน) — Batch {plan.batchNo} — {petition.petitionNo}</div>
      <table className="pp-table pp-section">
        <colgroup>
          <col style={{ width: '40%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '15%' }} />
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2}>ขั้นตอนการผลิต</th>
            <th colSpan={2}>เริ่มต้นผลิต</th>
            <th colSpan={2}>สิ้นสุดผลิต</th>
          </tr>
          <tr>
            <th>วัน เดือน ปี</th>
            <th>เวลา</th>
            <th>วัน เดือน ปี</th>
            <th>เวลา</th>
          </tr>
        </thead>
        <tbody>
          {plan.steps.map((s, i) => {
            const step = s ?? {};
            return (
              <tr key={i} className="pp-tall">
                <td className="pp-text-left">{step.description ?? ''}</td>
                <td>{buddhistShort(step.startDate)}</td>
                <td>{timeHM(step.startTime)}</td>
                <td>{buddhistShort(step.endDate)}</td>
                <td>{timeHM(step.endTime)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ProductionPlanPrintTemplate({ plan, petition }: Props) {
  return (
    <div className="pp-root">
      <style>{PP_CSS}</style>

      <div className="pp-page">
        <Header petition={petition} />
        <Section1 plan={plan} />
        <NameLine plan={plan} />
        <Section2 plan={plan} />
        <Section3 plan={plan} />
        <Section4A plan={plan} />
        <Section4Downtime plan={plan} />
        <Section4Physical plan={plan} />
        <Section4Weighing plan={plan} />
        <SignatureBlock plan={plan} />
      </div>

      <div className="pp-page">
        <Header petition={petition} />
        <Section4Steps plan={plan} petition={petition} />
      </div>
    </div>
  );
}

const PP_CSS = `
@page { size: A4 portrait; margin: 8mm 10mm; }
.pp-root, .pp-root * {
  font-family: 'Angsana New','Cordia New','Sarabun','TH SarabunPSK',serif;
  color: #000;
  box-sizing: border-box;
}
.pp-root { font-size: 14pt; line-height: 1.15; }

.pp-page { position: relative; }
.pp-page + .pp-page { page-break-before: always; }

.pp-header { margin-bottom: 4px; }
.pp-header-row {
  display: flex; justify-content: space-between; align-items: baseline;
  gap: 8px;
}
.pp-header-left { font-weight: bold; }
.pp-header-right { white-space: nowrap; }
.pp-header-title-row { margin-top: 2px; }
.pp-header-title {
  font-weight: bold; font-size: 18pt; text-align: center; flex: 1;
}

.pp-table {
  width: 100%; border-collapse: collapse; table-layout: fixed;
}
.pp-table th, .pp-table td {
  border: 1px solid #000;
  padding: 2px 4px;
  text-align: center;
  vertical-align: middle;
  font-size: 13pt;
  font-weight: normal;
}
.pp-table thead th { font-weight: bold; }
.pp-section { margin-top: 4px; }
.pp-section-title {
  text-align: left !important;
  font-weight: bold !important;
  background: #fff;
}
.pp-section-banner {
  font-weight: bold;
  border: 1px solid #000;
  border-bottom: none;
  padding: 2px 4px;
  margin-top: 4px;
}
.pp-text-left { text-align: left !important; }
.pp-pad { padding: 4px 6px !important; }
.pp-tall td { height: 22px; }

.pp-namelist {
  display: flex; align-items: baseline; gap: 6px;
  padding: 2px 2px; margin-bottom: 2px;
}

.pp-line {
  display: inline-block;
  border-bottom: 1px dotted #000;
  height: 0;
  vertical-align: baseline;
  margin: 0 2px;
}
.pp-line-sm { width: 60px; }
.pp-line-md { width: 110px; }
.pp-line-lg { width: 180px; }
.pp-line-xl { width: 240px; }
.pp-line-grow { flex: 1; min-width: 100px; width: auto; }

.pp-cb {
  display: inline-block;
  width: 10px; height: 10px;
  border: 1px solid #000;
  vertical-align: middle;
  margin-right: 4px;
  position: relative;
}
.pp-cb-x::before {
  content: '✓';
  position: absolute;
  inset: -3pt 0 0 0;
  text-align: center;
  font-size: 10pt;
  line-height: 10pt;
  font-weight: bold;
}
.pp-gap-sm { display: inline-block; width: 12px; }
.pp-gap-lg { display: inline-block; width: 40px; }

.pp-downtime { margin-top: 4px; }
.pp-downtime-title,
.pp-physical-title,
.pp-weighing-title { font-weight: bold; margin: 4px 0 2px; }

.pp-physical-foot {
  padding: 4px 0;
  display: flex; align-items: center;
}
.pp-followup {
  padding: 2px 0;
  display: flex; align-items: baseline; gap: 4px;
}

.pp-weighing-table th, .pp-weighing-table td { font-size: 11pt; padding: 1px 2px; }
.pp-weighing-table .pp-tall td { height: 14px; }

.pp-signatures { margin-top: 6px; }
.pp-sig-row {
  display: flex; justify-content: space-between; gap: 10px;
  margin: 4px 0;
}
.pp-sig-row > span { display: inline-flex; align-items: baseline; }
.pp-sig-approve { justify-content: flex-start; gap: 30px; }

@media screen {
  .pp-page {
    width: 210mm; min-height: 297mm;
    padding: 8mm 10mm;
    background: #fff;
    margin: 8px auto;
    box-shadow: 0 0 4px rgba(0,0,0,.15);
  }
}
@media print {
  html, body { margin: 0; padding: 0; background: #fff; }
  .pp-page { padding-right: 1px; }
  .pp-table { width: calc(100% - 1px); }
  .pp-section, .pp-downtime, .pp-physical, .pp-weighing, .pp-signatures {
    break-inside: avoid; page-break-inside: avoid;
  }
  .pp-table tr { break-inside: avoid; page-break-inside: avoid; }
}
`;
