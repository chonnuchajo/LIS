// ย้าย stock เดิมของ "สารมาตรฐาน" (จำนวนใน tier primary/supplier/working ที่เก็บบน
// StockStandard) ให้กลายเป็นขวดราย unit ในระบบใหม่ (StockUnit) — ของเก่าจะไม่หาย
// แต่ลงมาเป็นขวดที่มี QR ให้ lab ไปเติม EXP/lot/ปริมาณรายขวดตาม requirement ใหม่ทีหลัง
//
// Mapping:
//   primary.qty  → ขวด sealed (คงคลัง)
//   supplier.qty → ขวด sealed (คงคลัง)
//   working.qty  → ขวด working
//   volume.initial/remaining = sizeMg ของ tier นั้น (หน่วย mg), exp = exp เดิมของ tier
//
// Idempotent: สารตัวไหนมี StockUnit อยู่แล้ว (เคย migrate หรือ lab รับเข้าเองแล้ว) จะข้าม
//
// Usage:
//   node scripts/migrate-standard-tiers-to-units.js          # dry-run (ไม่เขียน)
//   node scripts/migrate-standard-tiers-to-units.js --commit # เขียนจริง
'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');
const { StockStandard } = require('../models/Stock');
const StockUnit = require('../models/StockUnit');

const COMMIT = process.argv.includes('--commit');
const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';

async function genUniqueQrId() {
  for (let i = 0; i < 5; i++) {
    const id = 'u_' + crypto.randomBytes(6).toString('hex');
    if (!(await StockUnit.exists({ qrId: id }))) return id;
  }
  throw new Error('สร้าง qrId ไม่ซ้ำไม่สำเร็จ');
}

function parseExp(exp) {
  if (!exp) return null;
  const d = new Date(exp);
  return Number.isNaN(d.getTime()) ? null : d;
}

// แตก tier เดิมเป็นรายขวด
function tierBottles(std) {
  const out = [];
  const push = (tier, kind) => {
    if (!tier) return;
    const count = Math.max(0, Math.floor(Number(tier.qty) || 0));
    const size = Number(tier.sizeMg) || 0;
    const exp = parseExp(tier.exp);
    for (let i = 0; i < count; i++) out.push({ kind, size, exp });
  };
  push(std.primary, 'sealed');
  push(std.supplier, 'sealed');
  push(std.working, 'working');
  return out;
}

async function main() {
  await mongoose.connect(URI);
  const stds = await StockStandard.find().lean();

  let stdsToMigrate = 0;
  let stdsSkipped = 0;
  let bottlesTotal = 0;
  const now = new Date();
  const createdBy = { email: 'migration', name: 'ย้ายข้อมูล stock เดิม' };

  for (const std of stds) {
    const existing = await StockUnit.countDocuments({ itemCode: std.code });
    if (existing > 0) {
      stdsSkipped += 1;
      continue;
    }
    const bottles = tierBottles(std);
    if (bottles.length === 0) continue;

    stdsToMigrate += 1;
    bottlesTotal += bottles.length;
    const sealed = bottles.filter((b) => b.kind === 'sealed').length;
    const working = bottles.length - sealed;
    console.log(`  ${std.code} ${std.name} → ${bottles.length} ขวด (คงคลัง ${sealed}, working ${working})`);

    if (COMMIT) {
      for (const b of bottles) {
        const qrId = await genUniqueQrId();
        await StockUnit.create({
          qrId,
          itemCode: std.code,
          itemName: std.name,
          kind: b.kind,
          lotNo: '',
          exp: b.exp,
          volume: { initial: b.size, remaining: b.size, unit: 'mg' },
          status: 'active',
          receivedDate: now,
          createdBy,
        });
      }
    }
  }

  console.log(`\nสารที่ย้าย: ${stdsToMigrate} | ข้าม (มีขวดอยู่แล้ว): ${stdsSkipped} | รวมขวดที่สร้าง: ${bottlesTotal}`);
  if (!COMMIT) {
    console.log('DRY-RUN — ยังไม่เขียน. รันซ้ำด้วย --commit เพื่อเขียนจริง');
    console.log('หลัง --commit แล้ว อย่าลืม `npm run seed:export` เพื่อ backup ลง git');
  } else {
    console.log('เขียนเรียบร้อย. รัน `npm run seed:export` เพื่อ backup ลง git');
  }
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
