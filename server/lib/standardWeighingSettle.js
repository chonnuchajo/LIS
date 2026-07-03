// server/lib/standardWeighingSettle.js
const StandardWeighing = require('../models/StandardWeighing');
const StockUnit = require('../models/StockUnit');
const stockRouter = require('../routes/stock'); // exposes planDeductMg / deductMgFromUnit / createWorkingFromParent

const keyOf = (x) => `${x.commonName}|${x.substance}|${x.instrument}`;

/**
 * Pure. For each required task, ensure a matching, complete, valid weighing row.
 * Returns { errors, plan } where plan lists fresh, not-yet-deducted deductions.
 */
function validateWeighings(required, rows, unitByQr) {
  const errors = [];
  const plan = [];
  const rowByKey = new Map(rows.map((r) => [keyOf(r), r]));
  for (const req of required) {
    const label = `${req.substance} (${req.instrument})`;
    if (req.times == null) { errors.push(`ยังไม่ตั้งค่าจำนวนครั้ง (Standard Config) สำหรับ ${label}`); continue; }
    const row = rowByKey.get(keyOf(req));
    if (!row) { errors.push(`ยังไม่ได้บันทึกการชั่ง standard: ${label}`); continue; }
    if (row.mode === 'working') {
      if (!row.workingQrId) errors.push(`เลือก working solution ก่อน: ${label}`);
      continue;
    }
    // fresh
    const masses = Array.isArray(row.masses) ? row.masses.filter((n) => Number(n) > 0) : [];
    if (masses.length !== Number(req.times)) { errors.push(`กรอกน้ำหนักให้ครบ ${req.times} ครั้ง: ${label}`); continue; }
    if (!row.bottleQrId) { errors.push(`สแกน QR ขวดก่อน: ${label}`); continue; }
    if (row.deductedAt) continue; // idempotent — already deducted
    const unit = unitByQr[row.bottleQrId];
    const totalMg = masses.reduce((s, n) => s + Number(n), 0);
    const p = stockRouter.planDeductMg(unit, totalMg);
    if (!p.ok) { errors.push(`${p.reason}: ${label}`); continue; }
    plan.push({ rowId: String(row._id), bottleQrId: row.bottleQrId, totalMg, sampleId: row.sampleId });
  }
  return { errors, plan };
}

/** Orchestrator: validate → deduct atomically → create working → stamp deductedAt. Throws on any error. */
async function settleLabStandards(petition, requiredKeys, req) {
  const required = Array.isArray(requiredKeys) ? requiredKeys : [];
  if (required.length === 0) return; // nothing to weigh for this petition
  const rows = await StandardWeighing.find({ petitionId: petition._id });
  const qrIds = rows.filter((r) => r.mode === 'fresh' && r.bottleQrId).map((r) => r.bottleQrId);
  const units = await StockUnit.find({ qrId: { $in: qrIds } }).lean();
  const unitByQr = Object.fromEntries(units.map((u) => [u.qrId, u]));

  const { errors, plan } = validateWeighings(required, rows, unitByQr);
  if (errors.length) { const e = new Error(errors[0]); e.details = errors; throw e; }

  const meta = {
    userEmail: req.body?._user?.email || req.headers['x-user-email'] || '',
    userName: req.body?._user?.name || req.headers['x-user-name'] || '',
  };
  for (const step of plan) {
    const { unit } = await stockRouter.deductMgFromUnit(step.bottleQrId, step.totalMg, {
      sampleId: step.sampleId, note: `ชั่ง standard · ${petition.petitionNo}`, ...meta,
    });
    const working = await stockRouter.createWorkingFromParent(unit, { note: `${petition.petitionNo}`, ...meta }, req);
    await StandardWeighing.updateOne(
      { _id: step.rowId },
      { $set: { deductedAt: new Date(), deductedBy: { email: meta.userEmail, name: meta.userName }, workingQrId: working.qrId } },
    );
  }
}

module.exports = { validateWeighings, settleLabStandards, keyOf };
