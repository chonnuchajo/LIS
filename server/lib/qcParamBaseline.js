/**
 * QC baseline = ค่าเฉลี่ยเวลาที่งาน QC ใช้จริง แยกตาม parameter
 *
 * server ไม่รู้ว่าใบหนึ่งต้องทดสอบ parameter อะไรบ้าง (ตรรกะจับคู่อยู่ฝั่งหน้าเว็บ
 * ที่ src/lib/petitionTestItems.ts และต้องใช้ item-group membership ประกอบ) จึง
 * เดา parameter set ของใบที่ยังทำอยู่ จาก parameter ที่เคยถูกบันทึกจริงกับสินค้า
 * (commonName) เดียวกัน — พึ่งพาเฉพาะข้อมูลที่ server มีเอง ไม่ต้องมีโค้ดสำเนาที่สอง
 */

const MS_PER_MIN = 60000;

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ใบเก่าที่รับก่อนมีฟีเจอร์แยก Lab/QC มีแต่ receivedAt รวม — ถือเป็นเวลารับของ QC ด้วย */
function qcReceivedAtOf(petition) {
  const p = petition || {};
  const side = toDate(p.qcReceivedAt);
  if (side) return side;
  if (p.labReceivedAt || p.qcReceivedAt) return null;
  return toDate(p.receivedAt);
}

function qcDurationMinutes(petition) {
  const start = qcReceivedAtOf(petition);
  const end = toDate((petition || {}).qcCompletedAt);
  if (!start || !end) return null;
  const minutes = (end.getTime() - start.getTime()) / MS_PER_MIN;
  return minutes > 0 ? minutes : null;
}

/**
 * closedPetitions: ใบที่ QC เสร็จแล้วในช่วงย้อนหลังที่ผู้เรียกกำหนด
 * qcResults:       QCTestResult ของใบเหล่านั้น (ต้องมี petitionId, parameterId, commonName)
 */
function buildQcParamBaseline(closedPetitions, qcResults, options = {}) {
  const minSamples = options.minSamples ?? 3;

  const durationByPetition = new Map();
  for (const petition of closedPetitions || []) {
    const minutes = qcDurationMinutes(petition);
    if (minutes != null) durationByPetition.set(String(petition._id), minutes);
  }

  const samples = new Map();          // parameterId → number[]
  const paramNameById = {};
  const paramIdsByCommonName = {};    // commonName → Set<parameterId>
  const seenPair = new Set();         // กัน parameter เดียวถูกนับซ้ำจากหลาย item ในใบเดียว

  for (const row of qcResults || []) {
    const parameterId = String(row.parameterId || '');
    if (!parameterId) continue;
    if (row.parameterName) paramNameById[parameterId] = row.parameterName;

    const commonName = String(row.commonName || '').trim();
    if (commonName) {
      if (!paramIdsByCommonName[commonName]) paramIdsByCommonName[commonName] = new Set();
      paramIdsByCommonName[commonName].add(parameterId);
    }

    const petitionId = String(row.petitionId || '');
    const minutes = durationByPetition.get(petitionId);
    if (minutes == null) continue;
    const pairKey = `${petitionId}__${parameterId}`;
    if (seenPair.has(pairKey)) continue;
    seenPair.add(pairKey);
    if (!samples.has(parameterId)) samples.set(parameterId, []);
    samples.get(parameterId).push(minutes);
  }

  const avgMinutesByParam = {};
  for (const [parameterId, list] of samples) {
    if (list.length < minSamples) continue;
    avgMinutesByParam[parameterId] = list.reduce((a, b) => a + b, 0) / list.length;
  }

  const byCommonName = {};
  for (const [commonName, set] of Object.entries(paramIdsByCommonName)) {
    byCommonName[commonName] = Array.from(set);
  }

  return { avgMinutesByParam, paramNameById, paramIdsByCommonName: byCommonName };
}

/** baseline ของใบ = parameter ที่ช้าที่สุดในบรรดา parameter ที่สินค้าในใบนี้เคยถูกทดสอบ */
function qcBaselineMinutes(petition, baseline) {
  const { avgMinutesByParam = {}, paramIdsByCommonName = {} } = baseline || {};
  let max = null;
  for (const item of (petition || {}).items || []) {
    const commonName = String(item.commonName || '').trim();
    if (!commonName) continue;
    for (const parameterId of paramIdsByCommonName[commonName] || []) {
      const avg = avgMinutesByParam[parameterId];
      if (avg == null) continue;
      if (max == null || avg > max) max = avg;
    }
  }
  return max;
}

module.exports = { buildQcParamBaseline, qcBaselineMinutes, qcReceivedAtOf, qcDurationMinutes };
