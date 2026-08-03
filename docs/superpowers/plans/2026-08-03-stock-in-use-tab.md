# แท็บ "กำลังใช้งานอยู่" ใน /stock-deduction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มแท็บ "กำลังใช้งานอยู่" ที่ `/stock-deduction` แสดง standard ที่เบิกไปแล้วยังไม่ปิด พร้อมนาฬิกาตาม "ความถี่/1 ครั้ง" และแจ้งเตือนทุกคนเมื่อใกล้ครบ/ครบกำหนด โดยคนที่เบิกเป็นคนกดรับทราบ

**Architecture:** ไม่สร้าง model ใหม่ — 1 แถว = `StockTransaction` (`action: deduct`, `itemType: standard`) ที่ยังไม่มี `deductionResolution` ซึ่งเป็นนิยาม "ยังไม่ปิด" ที่ระบบใช้อยู่แล้ว. Backend เพิ่ม endpoint อ่านอย่างเดียวที่ join `StockStandard.frequency` แล้วคำนวณ `dueAt`; **สถานะทั้งหมดตัดสินที่ FE ที่เดียว** ผ่าน pure lib เพื่อไม่ให้เกิด logic 2 สำเนา. การปิดแถวใช้ endpoint `resolve-deduction` เดิม โดยเพิ่ม reason `expired` (= กดรับทราบ) ที่มี guard ว่าอีเมลต้องตรงกับผู้เบิก. กระดิ่งใช้ watcher ที่ push + **reconcile** (ลบอันที่หลุดจาก list) → พอคนเบิกกดรับทราบ กระดิ่งของทุกคนหายเอง

**Tech Stack:** Express 4 + Mongoose 8 (backend, CommonJS) · React 18 + TypeScript + Vite + TanStack Query + shadcn/ui (frontend) · Vitest (FE) · Jest + node:test (BE — ปนกันตาม convention เดิมของแต่ละไฟล์)

## Global Constraints

- ขอบเขต **Standard เท่านั้น** — ห้ามดึง solvent / glassware เข้าแท็บนี้
- `dueAt = เวลาที่เบิก + ช่วง frequency` เท่านั้น — **ห้าม** cap ด้วย EXP ขวด และ **ห้าม** fallback ไปใช้ EXP ขวดเมื่อไม่มี frequency
- สารที่ไม่มี/parse frequency ไม่ได้ → `dueAt = null` → สถานะ `noFrequency` → **ไม่แจ้งเตือน**
- แจ้งเตือน 2 จังหวะเท่านั้น: ล่วงหน้า 1 วัน (`dueSoon`) และตอนครบกำหนด (`expired`)
- กด "รับทราบ" (`reason: 'expired'`) ได้เฉพาะคนที่เบิก (เทียบอีเมลแบบ trim + lowercase); reason อื่นคงพฤติกรรมเดิม
- `reason: 'expired'` **ห้ามแตะสถานะขวดต้นทาง** (ห้าม empty/discard ขวด)
- ภาษา UI ทั้งหมดเป็นไทย
- **ห้ามรัน `npm run build`** — type-check ด้วย `npx tsc -p tsconfig.app.json --noEmit`
- ไฟล์ pure lib ต้องมีเทสต์คู่กันเสมอ; route ให้บางที่สุด (repo นี้ไม่มีเทสต์ระดับ route)

**คำสั่งเทสต์ที่ใช้ในแผนนี้**
```bash
# FE (จาก repo root)
npx vitest run src/lib/standardInUse.test.ts
npx tsc -p tsconfig.app.json --noEmit

# BE (จาก C:/Project/LIS/server)
node --test lib/workingLifecycle.test.js          # ไฟล์สไตล์ node:test
npx jest lib/deductionResolution.test.js lib/standardsInUse.test.js   # ไฟล์สไตล์ jest
```
> หมายเหตุ: `cd server && npm test` (jest ล้วน) จะพังที่ไฟล์สไตล์ node:test ซึ่งเป็นสภาพเดิมของ repo — ให้รันเจาะไฟล์ตามด้านบน อย่าไปแก้ runner

**Spec:** `docs/superpowers/specs/2026-08-03-stock-in-use-tab-design.md`

---

## File Structure

**Backend**
- `server/lib/workingLifecycle.js` (แก้) — เพิ่ม `dueAtFor()` ใช้ `parseFrequencyInterval` + `addInterval` ที่มีอยู่
- `server/lib/standardsInUse.js` (ใหม่) — pure: แปลง transaction + standard → item ของแท็บ, และกฎว่าใครกดรับทราบได้
- `server/lib/deductionResolution.js` (แก้) — รับ reason `expired`
- `server/models/StockTransaction.js` (แก้) — enum reason เพิ่ม `expired`
- `server/routes/stock.js` (แก้) — endpoint `GET /standards/in-use`, guard ใน `resolve-deduction`, ยกเว้นขวดเมื่อ `expired`
- `server/scripts/close-stale-standard-deductions.js` (ใหม่) — ปิดยอดค้างเก่าก่อนเปิดฟีเจอร์

**Frontend**
- `src/types/stock.ts` (แก้) — `DeductionResolutionReason` เพิ่ม `expired`, เพิ่ม `StandardInUseItem` / `StandardsInUseResponse`
- `src/lib/deductionResolution.ts` (แก้) — label ของ `expired` (ตัวเลือกใน dialog ไม่เปลี่ยน)
- `src/lib/api.ts` (แก้) — `getStandardsInUse()`
- `src/lib/standardInUse.ts` (ใหม่) — pure: สถานะ, การเรียง, สิทธิ์กดรับทราบ, ข้อความระยะเวลา, แผนการแจ้งเตือน
- `src/lib/tabRegistry.ts` (แก้) — ลงทะเบียนแท็บของ `/stock-deduction`
- `src/pages/StockDeduction.tsx` (แก้) — ครอบด้วย Tabs, ย้ายตารางเดิมไปแท็บ history
- `src/components/lis/stock/StandardsInUseTable.tsx` (ใหม่) — ตารางแท็บใหม่ + ปุ่มรับทราบ
- `src/components/lis/StandardExpiryWatcher.tsx` (ใหม่) — poll + push/reconcile กระดิ่ง
- `src/App.tsx` (แก้) — mount watcher

**Tests**
- `server/lib/workingLifecycle.test.js` (แก้), `server/lib/standardsInUse.test.js` (ใหม่), `server/lib/deductionResolution.test.js` (แก้)
- `src/lib/standardInUse.test.ts` (ใหม่), `src/pages/__tests__/StockDeduction.item-display.test.tsx` (แก้)

---

## Task 1: BE pure — คำนวณวันครบกำหนดจากความถี่

**Files:**
- Modify: `server/lib/workingLifecycle.js`
- Test: `server/lib/workingLifecycle.test.js`

**Interfaces:**
- Consumes: `parseFrequencyInterval(str)`, `addInterval(from, count, unit)` (มีอยู่แล้วในไฟล์เดียวกัน)
- Produces: `dueAtFor(withdrawnAt: Date|string, frequency: string) → Date | null`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

ต่อท้าย `server/lib/workingLifecycle.test.js` และแก้บรรทัด require บนสุดให้ดึง `dueAtFor` เพิ่ม:

```js
// บรรทัด 3 เดิม → เพิ่ม dueAtFor
const { parseFrequencyInterval, addInterval, computeWorkingLifecycle, dueAtFor } = require('./workingLifecycle');
```

```js
test('dueAtFor: วันเบิก + ช่วงความถี่', () => {
  assert.deepStrictEqual(dueAtFor(new Date('2026-01-01'), '1/1 week'), new Date('2026-01-08'));
  assert.deepStrictEqual(dueAtFor(new Date('2026-01-01'), '1/2 month'), new Date('2026-03-01'));
});

test('dueAtFor: รองรับข้อมูลเดิมที่เป็นตัวใหญ่', () => {
  assert.deepStrictEqual(dueAtFor(new Date('2026-01-01'), '1/1 Week'), new Date('2026-01-08'));
  assert.deepStrictEqual(dueAtFor(new Date('2026-01-01'), '1/1 Day'), new Date('2026-01-02'));
});

test('dueAtFor: รับ ISO string ได้', () => {
  assert.deepStrictEqual(dueAtFor('2026-01-01T00:00:00.000Z', '1/1 day'), new Date('2026-01-02'));
});

test('dueAtFor: ไม่มี/parse ไม่ได้/วันเบิกเสีย → null', () => {
  assert.strictEqual(dueAtFor(new Date('2026-01-01'), ''), null);
  assert.strictEqual(dueAtFor(new Date('2026-01-01'), 'weekly'), null);
  assert.strictEqual(dueAtFor(null, '1/1 week'), null);
  assert.strictEqual(dueAtFor('ไม่ใช่วันที่', '1/1 week'), null);
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `cd server && node --test lib/workingLifecycle.test.js`
Expected: FAIL — `TypeError: dueAtFor is not a function`

- [ ] **Step 3: เขียน implementation**

ใน `server/lib/workingLifecycle.js` เพิ่มก่อน `module.exports`:

```js
/**
 * วันครบกำหนดของสารละลายที่เตรียมจากการเบิก 1 ครั้ง = วันเบิก + ช่วง "ความถี่/1 ครั้ง"
 * ไม่ cap ด้วย EXP ขวด (ต่างจาก computeWorkingLifecycle) — แท็บ "กำลังใช้งานอยู่" คุมด้วยความถี่ล้วน
 * ไม่มีความถี่ / parse ไม่ได้ / วันเบิกไม่ถูกต้อง → null (= ไม่มีวันครบกำหนด)
 */
function dueAtFor(withdrawnAt, frequency) {
  const fi = parseFrequencyInterval(frequency);
  if (!fi || !withdrawnAt) return null;
  const from = new Date(withdrawnAt);
  if (Number.isNaN(from.getTime())) return null;
  return addInterval(from, fi.count, fi.unit);
}
```

แล้วแก้บรรทัดสุดท้าย:

```js
module.exports = { parseFrequencyInterval, addInterval, computeWorkingLifecycle, dueAtFor };
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `cd server && node --test lib/workingLifecycle.test.js`
Expected: PASS ทั้ง 11 เทสต์ (เดิม 7 + ใหม่ 4)

- [ ] **Step 5: Commit**

```bash
git add server/lib/workingLifecycle.js server/lib/workingLifecycle.test.js
git commit -m "feat(stock): dueAtFor คำนวณวันครบกำหนดจากความถี่"
```

---

## Task 2: BE — reason `expired` ("รับทราบหมดอายุ")

**Files:**
- Modify: `server/lib/deductionResolution.js`
- Modify: `server/models/StockTransaction.js:9`
- Test: `server/lib/deductionResolution.test.js`

**Interfaces:**
- Consumes: —
- Produces: `normalizeDeductionResolutionInput({ reason: 'expired' })` → `{ value: { reason: 'expired', note: '' } }` (ไม่บังคับโน้ต)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

ต่อท้ายใน `describe` ของ `server/lib/deductionResolution.test.js`:

```js
  test('accepts expired without a note (acknowledge flow)', () => {
    expect(normalizeDeductionResolutionInput({ reason: 'expired' })).toEqual({
      value: { reason: 'expired', note: '' },
    });
  });

  test('still rejects an unknown reason', () => {
    expect(normalizeDeductionResolutionInput({ reason: 'expire' })).toEqual({
      error: 'กรุณาเลือกเหตุผล',
    });
  });
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `cd server && npx jest lib/deductionResolution.test.js`
Expected: FAIL — เทสต์ `accepts expired without a note` ได้ `{ error: 'กรุณาเลือกเหตุผล' }`

- [ ] **Step 3: เขียน implementation**

`server/lib/deductionResolution.js` บรรทัด 2:

```js
const VALID_REASONS = new Set(['empty', 'ineffective', 'other', 'expired']);
```

`server/models/StockTransaction.js` บรรทัด 9:

```js
  reason: { type: String, enum: ['empty', 'ineffective', 'other', 'expired'] },
```

> `normalizeDeductionResolutionInput` บังคับโน้ตเฉพาะ `ineffective`/`other` อยู่แล้ว จึงไม่ต้องแก้เงื่อนไขนั้น

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `cd server && npx jest lib/deductionResolution.test.js`
Expected: PASS 8 เทสต์

- [ ] **Step 5: Commit**

```bash
git add server/lib/deductionResolution.js server/lib/deductionResolution.test.js server/models/StockTransaction.js
git commit -m "feat(stock): เพิ่ม resolution reason expired สำหรับกดรับทราบ"
```

---

## Task 3: BE pure — สร้างรายการ "กำลังใช้งานอยู่" + กฎสิทธิ์รับทราบ

**Files:**
- Create: `server/lib/standardsInUse.js`
- Test: `server/lib/standardsInUse.test.js`

**Interfaces:**
- Consumes: `dueAtFor(withdrawnAt, frequency)` (Task 1), `sumWeights(weights)` จาก `server/lib/requisitionWeights`
- Produces:
  - `buildInUseItems(txs, standards) → item[]` โดย item = `{ _id, itemCode, itemName, qrId, weights, totalMg, instrumentGroup, note, withdrawnAt, frequency, dueAt, userEmail, userName }` (`withdrawnAt`/`dueAt` เป็น ISO string หรือ `''`/`null`)
  - `canAcknowledgeDeduction(tx, actorEmail) → boolean`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `server/lib/standardsInUse.test.js`:

```js
const { buildInUseItems, canAcknowledgeDeduction } = require('./standardsInUse');

const tx = {
  _id: 'tx1',
  itemCode: 'STD-001',
  itemName: 'ABAMECTIN',
  qrId: 'u_abc',
  weights: [10, 20.5],
  volumeDelta: -30.5,
  instrumentGroup: 'gc',
  note: 'P-2606-0018',
  createdAt: new Date('2026-01-01T03:00:00.000Z'),
  userEmail: 'Someone@ICPLadda.com',
  userName: 'สมชาย',
};

describe('buildInUseItems', () => {
  test('เติม dueAt จากความถี่ของสารที่ตรง code', () => {
    const [item] = buildInUseItems([tx], [{ code: 'STD-001', frequency: '1/1 Week' }]);
    expect(item.dueAt).toBe(new Date('2026-01-08T03:00:00.000Z').toISOString());
    expect(item.withdrawnAt).toBe('2026-01-01T03:00:00.000Z');
    expect(item.frequency).toBe('1/1 Week');
    expect(item._id).toBe('tx1');
    expect(item.totalMg).toBe(30.5);
    expect(item.instrumentGroup).toBe('gc');
    expect(item.userEmail).toBe('Someone@ICPLadda.com');
  });

  test('สารไม่มีความถี่ / หาสารไม่เจอ → dueAt null', () => {
    expect(buildInUseItems([tx], [{ code: 'STD-001', frequency: '' }])[0].dueAt).toBeNull();
    expect(buildInUseItems([tx], [])[0].dueAt).toBeNull();
    expect(buildInUseItems([tx], [])[0].frequency).toBe('');
  });

  test('ไม่มี weights → totalMg มาจาก volumeDelta (ค่าสัมบูรณ์)', () => {
    const [item] = buildInUseItems([{ ...tx, weights: undefined }], []);
    expect(item.totalMg).toBe(30.5);
    expect(item.weights).toEqual([]);
  });

  test('ฟิลด์ที่ขาดกลายเป็นค่าว่าง ไม่ throw', () => {
    const [item] = buildInUseItems([{ _id: 'tx2' }], []);
    expect(item).toEqual({
      _id: 'tx2',
      itemCode: '',
      itemName: '',
      qrId: '',
      weights: [],
      totalMg: 0,
      instrumentGroup: null,
      note: '',
      withdrawnAt: '',
      frequency: '',
      dueAt: null,
      userEmail: '',
      userName: '',
    });
  });
});

describe('canAcknowledgeDeduction', () => {
  test('อีเมลตรงกับผู้เบิก (ไม่สนตัวพิมพ์/ช่องว่าง) → ได้', () => {
    expect(canAcknowledgeDeduction(tx, ' someone@icpladda.com ')).toBe(true);
  });

  test('คนอื่น / ไม่มีอีเมล / transaction ไม่มีผู้เบิก → ไม่ได้', () => {
    expect(canAcknowledgeDeduction(tx, 'other@icpladda.com')).toBe(false);
    expect(canAcknowledgeDeduction(tx, '')).toBe(false);
    expect(canAcknowledgeDeduction({ userEmail: '' }, 'someone@icpladda.com')).toBe(false);
    expect(canAcknowledgeDeduction(null, 'someone@icpladda.com')).toBe(false);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `cd server && npx jest lib/standardsInUse.test.js`
Expected: FAIL — `Cannot find module './standardsInUse'`

- [ ] **Step 3: เขียน implementation**

สร้าง `server/lib/standardsInUse.js`:

```js
// รายการ "กำลังใช้งานอยู่" = การเบิก standard ที่ยังไม่มี deductionResolution
// pure ล้วน (ไม่แตะ DB) — route แค่ query แล้วส่งผลลัพธ์เข้าฟังก์ชันนี้
// สถานะ (ใกล้ครบ/หมดอายุ) ไม่คำนวณที่นี่ ตั้งใจให้ FE ตัดสินที่เดียวจาก dueAt

const { dueAtFor } = require('./workingLifecycle');
const { sumWeights } = require('./requisitionWeights');

function totalMgOf(tx) {
  if (Array.isArray(tx.weights) && tx.weights.length) return sumWeights(tx.weights);
  const v = Number(tx.volumeDelta);
  return Number.isFinite(v) ? Math.abs(v) : 0;
}

function isoOrEmpty(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/**
 * txs: lean StockTransaction (deduct/standard ที่ยังไม่ปิด)
 * standards: lean StockStandard (ต้องมีอย่างน้อย { code, frequency })
 */
function buildInUseItems(txs = [], standards = []) {
  const freqByCode = new Map(standards.map((s) => [String(s.code), String(s.frequency || '')]));
  return txs.map((tx) => {
    const frequency = freqByCode.get(String(tx.itemCode || '')) || '';
    const withdrawnAt = isoOrEmpty(tx.createdAt);
    const dueAt = withdrawnAt ? dueAtFor(withdrawnAt, frequency) : null;
    return {
      _id: String(tx._id),
      itemCode: tx.itemCode || '',
      itemName: tx.itemName || '',
      qrId: tx.qrId || '',
      weights: Array.isArray(tx.weights) ? tx.weights : [],
      totalMg: totalMgOf(tx),
      instrumentGroup: tx.instrumentGroup || null,
      note: tx.note || '',
      withdrawnAt,
      frequency,
      dueAt: dueAt ? dueAt.toISOString() : null,
      userEmail: tx.userEmail || '',
      userName: tx.userName || '',
    };
  });
}

/** กดรับทราบหมดอายุได้เฉพาะคนที่เบิกรายการนั้น */
function canAcknowledgeDeduction(tx, actorEmail) {
  const owner = String((tx && tx.userEmail) || '').trim().toLowerCase();
  const me = String(actorEmail || '').trim().toLowerCase();
  return Boolean(owner) && owner === me;
}

module.exports = { buildInUseItems, canAcknowledgeDeduction };
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `cd server && npx jest lib/standardsInUse.test.js`
Expected: PASS 6 เทสต์

- [ ] **Step 5: Commit**

```bash
git add server/lib/standardsInUse.js server/lib/standardsInUse.test.js
git commit -m "feat(stock): pure lib สร้างรายการ standard ที่กำลังใช้งาน"
```

---

## Task 4: BE route — endpoint in-use + guard รับทราบ + ไม่แตะขวด

**Files:**
- Modify: `server/routes/stock.js:11-14` (imports), `:59-76` (`applyUnitResolutionFromTransaction`), `:140-148` (แทรก route ใหม่), `:745-768` (`resolve-deduction`)

**Interfaces:**
- Consumes: `buildInUseItems`, `canAcknowledgeDeduction` (Task 3), `buildPendingDeductionFilter` (มีอยู่)
- Produces: `GET /api/stock/standards/in-use` → `{ serverTime: string, items: StandardInUseItem[] }`

⚠️ **ลำดับ route สำคัญ** — ต้องแทรก `/standards/in-use` **ก่อน** `router.get('/standards/:id')` (บรรทัด 148) ไม่งั้น Express จะจับเป็น `:id = 'in-use'` แล้วตอบ 404/500

- [ ] **Step 1: เพิ่ม import**

`server/routes/stock.js` ต่อจากบรรทัด 14:

```js
const { buildInUseItems, canAcknowledgeDeduction } = require('../lib/standardsInUse');
```

- [ ] **Step 2: กัน `expired` ไปแตะขวดต้นทาง**

ใน `applyUnitResolutionFromTransaction` (บรรทัด 59) เพิ่มบรรทัดแรกสุดของ body:

```js
async function applyUnitResolutionFromTransaction(tx, resolution, req) {
  // "รับทราบหมดอายุ" = สารละลายที่เตรียมไว้ครบกำหนด ไม่ใช่ขวดต้นทางมีปัญหา → ห้ามแตะขวด
  if (resolution.reason === 'expired') return null;
  if (tx.itemType !== 'standard' || !tx.qrId) return null;
  // ...โค้ดเดิมต่อจากนี้ไม่แก้
```

- [ ] **Step 3: เพิ่ม endpoint**

แทรก **ก่อน** `router.get('/standards/:id', ...)` (บรรทัด 148):

```js
// standard ที่เบิกไปแล้วยังไม่ปิด + วันครบกำหนดตามความถี่ (แท็บ "กำลังใช้งานอยู่")
// ต้องอยู่เหนือ '/standards/:id' ไม่งั้นจะถูกจับเป็น id
router.get('/standards/in-use', async (req, res) => {
  try {
    const built = buildPendingDeductionFilter({ itemType: 'standard' });
    if (built.error) return res.status(400).json({ error: built.error });
    const txs = await StockTransaction.find(built.value)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    const codes = [...new Set(txs.map((t) => t.itemCode).filter(Boolean))];
    const standards = codes.length
      ? await StockStandard.find({ code: { $in: codes } }).select('code frequency').lean()
      : [];
    res.json({ serverTime: new Date().toISOString(), items: buildInUseItems(txs, standards) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: ใส่ guard ใน resolve-deduction**

แทนที่ท่อนกลางของ `router.post('/transactions/:id/resolve-deduction')` (บรรทัด 750-763) ด้วย:

```js
    const tx = await StockTransaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ error: 'ไม่พบรายการเบิก' });
    if (tx.action !== 'deduct' || !['standard', 'solvent'].includes(tx.itemType)) {
      return res.status(400).json({ error: 'รองรับเฉพาะรายการเบิก Standard และสารเคมี' });
    }

    const actor = await userMeta(req);
    if (norm.value.reason === 'expired' && !canAcknowledgeDeduction(tx, actor.userEmail)) {
      return res.status(403).json({ error: 'รับทราบได้เฉพาะคนที่เบิก' });
    }

    await applyUnitResolutionFromTransaction(tx, norm.value, req);
    tx.deductionResolution = {
      ...norm.value,
      resolvedAt: new Date(),
      resolvedBy: { email: actor.userEmail, name: actor.userName },
    };
    await tx.save();
    res.json(tx);
```

> `userMeta` ย้ายขึ้นมาก่อน `applyUnitResolutionFromTransaction` — ค่าถูก cache ไว้ที่ `req._stockUserMeta` อยู่แล้ว จึงไม่ query ซ้ำ

- [ ] **Step 5: ตรวจด้วยการยิงจริง**

เปิด backend (`cd server && npm run dev`) แล้ว:

```bash
curl -s http://localhost:3001/api/stock/standards/in-use | head -c 400
```
Expected: JSON `{"serverTime":"...","items":[...]}` (items อาจเป็น `[]` ถ้ายังไม่มีการเบิกค้าง — ถือว่าผ่าน)

```bash
curl -s http://localhost:3001/api/stock/standards | head -c 120
```
Expected: ยังเป็น list ของ standard ตามเดิม (พิสูจน์ว่าไม่ทับ route เดิม)

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/stock/standards/000000000000000000000000
```
Expected: `404` (route `/standards/:id` ยังทำงาน ไม่ถูก in-use กลืน)

- [ ] **Step 6: Commit**

```bash
git add server/routes/stock.js
git commit -m "feat(stock): endpoint standards/in-use + guard รับทราบเฉพาะคนเบิก"
```

---

## Task 5: FE — types, label, api client

**Files:**
- Modify: `src/types/stock.ts:56` และท้ายไฟล์
- Modify: `src/lib/deductionResolution.ts:3-7`
- Modify: `src/lib/api.ts` (ต่อจาก `resolveStockDeduction` บรรทัด 365)

**Interfaces:**
- Consumes: response ของ `GET /stock/standards/in-use` (Task 4)
- Produces: `StandardInUseItem`, `StandardsInUseResponse`, `api.getStandardsInUse()`, `DEDUCTION_RESOLUTION_LABELS.expired`

- [ ] **Step 1: เพิ่ม type**

`src/types/stock.ts` บรรทัด 56:

```ts
export type DeductionResolutionReason = "empty" | "ineffective" | "other" | "expired";
```

ต่อท้ายไฟล์:

```ts
/** 1 แถวของแท็บ "กำลังใช้งานอยู่" — การเบิก standard ที่ยังไม่ปิด (มาจาก GET /stock/standards/in-use) */
export interface StandardInUseItem {
  _id: string;
  itemCode: string;
  itemName: string;
  qrId: string;
  weights: number[];
  totalMg: number;
  instrumentGroup: "gc" | "hplc" | null;
  note: string;
  withdrawnAt: string;
  frequency: string;
  /** null = สารนี้ยังไม่ได้ตั้งความถี่ (ไม่มีวันครบกำหนด, ไม่แจ้งเตือน) */
  dueAt: string | null;
  userEmail: string;
  userName: string;
}

export interface StandardsInUseResponse {
  serverTime: string;
  items: StandardInUseItem[];
}
```

- [ ] **Step 2: เพิ่ม label**

`src/lib/deductionResolution.ts` — เพิ่มบรรทัดใน `DEDUCTION_RESOLUTION_LABELS` (TypeScript จะ error ถ้าไม่เพิ่ม เพราะเป็น `Record` ของ union):

```ts
export const DEDUCTION_RESOLUTION_LABELS: Record<DeductionResolutionReason, string> = {
  empty: "หมด",
  ineffective: "ไม่มีประสิทธิภาพ",
  other: "อื่นๆ",
  expired: "รับทราบหมดอายุ",
};
```

> **ห้าม**เพิ่ม `expired` ลง `DEDUCTION_RESOLUTION_OPTIONS` — dialog "แจ้งหมด/ปัญหา" map จาก array นั้น ถ้าเพิ่มจะมีตัวเลือกโผล่มาผิดที่

- [ ] **Step 3: เพิ่ม api client**

`src/lib/api.ts` — เพิ่ม import type ในบล็อกบรรทัด 3-11:

```ts
  StandardsInUseResponse,
```

แล้วเพิ่ม method ต่อจาก `resolveStockDeduction` (บรรทัด 365):

```ts
  getStandardsInUse: () => request<StandardsInUseResponse>("/stock/standards/in-use"),
```

- [ ] **Step 4: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จาก 3 ไฟล์นี้ (repo มี error เดิมค้างอยู่ ~12 จุด — เทียบกับผลก่อนแก้ ถ้าจำนวน/ไฟล์เท่าเดิมถือว่าผ่าน)

- [ ] **Step 5: Commit**

```bash
git add src/types/stock.ts src/lib/deductionResolution.ts src/lib/api.ts
git commit -m "feat(stock): type + api client ของรายการ standard ที่กำลังใช้งาน"
```

---

## Task 6: FE pure — สถานะ / การเรียง / สิทธิ์ / แผนแจ้งเตือน

**Files:**
- Create: `src/lib/standardInUse.ts`
- Test: `src/lib/standardInUse.test.ts`

**Interfaces:**
- Consumes: `StandardInUseItem` (Task 5)
- Produces:
  - `IN_USE_SOON_MS`, `IN_USE_NOTIFICATION_PREFIX`, `IN_USE_NOTIFICATION_GROUP`
  - `InUseStatus = "expired" | "dueSoon" | "active" | "noFrequency"`
  - `inUseStatus(row, now, soonMs?) → InUseStatus`
  - `sortInUse(rows, now) → rows` (คืน array ใหม่)
  - `canAcknowledge(row, user, now) → boolean`
  - `dueDistanceLabel(dueAt, now) → string`
  - `planInUseNotifications(items, now, existingIds) → { push: InUseNotification[], dismiss: string[] }`
  - `InUseNotification = { id, title, message, level: "warning"|"error" }`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/lib/standardInUse.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  IN_USE_SOON_MS,
  canAcknowledge,
  dueDistanceLabel,
  inUseStatus,
  planInUseNotifications,
  sortInUse,
} from "./standardInUse";
import type { StandardInUseItem } from "@/types/stock";

const NOW = new Date("2026-08-03T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const row = (over: Partial<StandardInUseItem>): StandardInUseItem => ({
  _id: "tx1",
  itemCode: "STD-001",
  itemName: "ABAMECTIN",
  qrId: "u_abc",
  weights: [10],
  totalMg: 10,
  instrumentGroup: "gc",
  note: "",
  withdrawnAt: "2026-08-01T00:00:00.000Z",
  frequency: "1/1 week",
  dueAt: null,
  userEmail: "owner@icpladda.com",
  userName: "สมชาย",
  ...over,
});

describe("inUseStatus", () => {
  it("ไม่มี dueAt → noFrequency", () => {
    expect(inUseStatus(row({ dueAt: null }), NOW)).toBe("noFrequency");
    expect(inUseStatus(row({ dueAt: "ไม่ใช่วันที่" }), NOW)).toBe("noFrequency");
  });

  it("ถึง/เลยกำหนดแล้ว → expired (เท่ากันเป๊ะก็นับว่าหมดอายุ)", () => {
    expect(inUseStatus(row({ dueAt: NOW.toISOString() }), NOW)).toBe("expired");
    expect(inUseStatus(row({ dueAt: new Date(+NOW - 1).toISOString() }), NOW)).toBe("expired");
  });

  it("เหลือ ≤ 1 วัน → dueSoon (เส้นแบ่ง 24 ชม.เป๊ะยังเป็น dueSoon)", () => {
    expect(inUseStatus(row({ dueAt: new Date(+NOW + IN_USE_SOON_MS).toISOString() }), NOW)).toBe("dueSoon");
    expect(inUseStatus(row({ dueAt: new Date(+NOW + 1).toISOString() }), NOW)).toBe("dueSoon");
  });

  it("เหลือเกิน 1 วัน → active", () => {
    expect(inUseStatus(row({ dueAt: new Date(+NOW + IN_USE_SOON_MS + 1).toISOString() }), NOW)).toBe("active");
  });
});

describe("sortInUse", () => {
  it("หมดอายุ(เกินนานสุดก่อน) → ใกล้ครบ → ปกติ → ไม่มีความถี่", () => {
    const rows = [
      row({ _id: "active", dueAt: new Date(+NOW + 5 * DAY).toISOString() }),
      row({ _id: "none", dueAt: null }),
      row({ _id: "expired-2", dueAt: new Date(+NOW - 1 * DAY).toISOString() }),
      row({ _id: "soon", dueAt: new Date(+NOW + 2 * 60 * 60 * 1000).toISOString() }),
      row({ _id: "expired-1", dueAt: new Date(+NOW - 9 * DAY).toISOString() }),
    ];
    expect(sortInUse(rows, NOW).map((r) => r._id)).toEqual([
      "expired-1", "expired-2", "soon", "active", "none",
    ]);
  });

  it("ไม่แก้ array ต้นฉบับ", () => {
    const rows = [row({ _id: "a", dueAt: null }), row({ _id: "b", dueAt: new Date(+NOW - DAY).toISOString() })];
    sortInUse(rows, NOW);
    expect(rows.map((r) => r._id)).toEqual(["a", "b"]);
  });
});

describe("canAcknowledge", () => {
  const expired = row({ dueAt: new Date(+NOW - DAY).toISOString() });

  it("เจ้าของ + หมดอายุแล้ว → กดได้ (ไม่สนตัวพิมพ์/ช่องว่าง)", () => {
    expect(canAcknowledge(expired, { email: " Owner@ICPLadda.com " }, NOW)).toBe(true);
  });

  it("คนอื่น / ยังไม่หมดอายุ / ไม่มี user / รายการไม่มีผู้เบิก → กดไม่ได้", () => {
    expect(canAcknowledge(expired, { email: "other@icpladda.com" }, NOW)).toBe(false);
    expect(canAcknowledge(row({ dueAt: new Date(+NOW + DAY).toISOString() }), { email: "owner@icpladda.com" }, NOW)).toBe(false);
    expect(canAcknowledge(expired, null, NOW)).toBe(false);
    expect(canAcknowledge(row({ dueAt: expired.dueAt, userEmail: "" }), { email: "owner@icpladda.com" }, NOW)).toBe(false);
  });
});

describe("dueDistanceLabel", () => {
  it("อธิบายระยะเวลาแบบไทย", () => {
    expect(dueDistanceLabel(new Date(+NOW + 2 * DAY).toISOString(), NOW)).toBe("อีก 2 วัน");
    expect(dueDistanceLabel(new Date(+NOW + 3 * 60 * 60 * 1000).toISOString(), NOW)).toBe("ภายในวันนี้");
    expect(dueDistanceLabel(new Date(+NOW - 3 * 60 * 60 * 1000).toISOString(), NOW)).toBe("เกินกำหนดวันนี้");
    expect(dueDistanceLabel(new Date(+NOW - 3 * DAY).toISOString(), NOW)).toBe("เกิน 3 วัน");
    expect(dueDistanceLabel(null, NOW)).toBe("-");
  });
});

describe("planInUseNotifications", () => {
  const expired = row({ _id: "tx-exp", itemName: "ATRAZINE", dueAt: new Date(+NOW - DAY).toISOString() });
  const soon = row({ _id: "tx-soon", itemName: "DIURON", dueAt: new Date(+NOW + 2 * 60 * 60 * 1000).toISOString() });
  const calm = row({ _id: "tx-ok", dueAt: new Date(+NOW + 9 * DAY).toISOString() });
  const none = row({ _id: "tx-none", dueAt: null });

  it("push เฉพาะ dueSoon/expired พร้อม id, level และข้อความ", () => {
    const plan = planInUseNotifications([expired, soon, calm, none], NOW, []);
    expect(plan.push.map((n) => n.id)).toEqual(["std-inuse:tx-exp:expired", "std-inuse:tx-soon:soon"]);
    expect(plan.push[0].level).toBe("error");
    expect(plan.push[0].title).toBe("หมดอายุแล้ว: ATRAZINE");
    expect(plan.push[1].level).toBe("warning");
    expect(plan.push[1].title).toBe("ใกล้ครบกำหนด: DIURON");
    expect(plan.push[0].message).toContain("สมชาย");
    expect(plan.dismiss).toEqual([]);
  });

  it("ลบ id ของแท็บนี้ที่ไม่อยู่ในรอบนี้แล้ว (เช่นถูกกดรับทราบ) แต่ไม่แตะกลุ่มอื่น", () => {
    const plan = planInUseNotifications([expired], NOW, [
      "std-inuse:tx-gone:expired",
      "std-inuse:tx-exp:expired",
      "petition:abc",
    ]);
    expect(plan.dismiss).toEqual(["std-inuse:tx-gone:expired"]);
  });

  it("แถวเดิมที่เลื่อนจาก soon เป็น expired → ลบ id soon ทิ้ง", () => {
    const plan = planInUseNotifications([expired], NOW, ["std-inuse:tx-exp:soon"]);
    expect(plan.push.map((n) => n.id)).toEqual(["std-inuse:tx-exp:expired"]);
    expect(plan.dismiss).toEqual(["std-inuse:tx-exp:soon"]);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run src/lib/standardInUse.test.ts`
Expected: FAIL — `Failed to resolve import "./standardInUse"`

- [ ] **Step 3: เขียน implementation**

สร้าง `src/lib/standardInUse.ts`:

```ts
// สถานะของ standard ที่ "กำลังใช้งานอยู่" — ตัดสินจาก dueAt ที่ server คำนวณมาให้เท่านั้น
// ฝั่ง server ตั้งใจไม่ส่งสถานะมา เพื่อให้กติกาอยู่ที่เดียว (กันสองสำเนาที่ต้องคอย sync กัน)
import type { StandardInUseItem } from "@/types/stock";

export const IN_USE_SOON_MS = 24 * 60 * 60 * 1000;
export const IN_USE_NOTIFICATION_PREFIX = "std-inuse:";
export const IN_USE_NOTIFICATION_GROUP = "standard-expiry";

const DAY_MS = 24 * 60 * 60 * 1000;

export type InUseStatus = "expired" | "dueSoon" | "active" | "noFrequency";

type DueRow = Pick<StandardInUseItem, "dueAt">;

const dueMs = (dueAt: string | null | undefined): number => {
  const v = dueAt ? Date.parse(dueAt) : NaN;
  return Number.isNaN(v) ? NaN : v;
};

export function inUseStatus(row: DueRow, now: Date, soonMs: number = IN_USE_SOON_MS): InUseStatus {
  const due = dueMs(row.dueAt);
  if (Number.isNaN(due)) return "noFrequency";
  const diff = due - now.getTime();
  if (diff <= 0) return "expired";
  if (diff <= soonMs) return "dueSoon";
  return "active";
}

const RANK: Record<InUseStatus, number> = { expired: 0, dueSoon: 1, active: 2, noFrequency: 3 };

/** เรียง: หมดอายุ (เกินกำหนดนานสุดก่อน) → ใกล้ครบ → ปกติ → ไม่มีความถี่ (ท้ายสุด) */
export function sortInUse<T extends DueRow & Pick<StandardInUseItem, "withdrawnAt">>(
  rows: T[],
  now: Date,
): T[] {
  const safe = (v: number) => (Number.isNaN(v) ? 0 : v);
  return [...rows].sort((a, b) => {
    const ra = RANK[inUseStatus(a, now)];
    const rb = RANK[inUseStatus(b, now)];
    if (ra !== rb) return ra - rb;
    const da = safe(dueMs(a.dueAt));
    const db = safe(dueMs(b.dueAt));
    if (da !== db) return da - db;
    return safe(Date.parse(b.withdrawnAt || "")) - safe(Date.parse(a.withdrawnAt || ""));
  });
}

const normEmail = (v: string | null | undefined) => String(v || "").trim().toLowerCase();

/** กดรับทราบได้เมื่อหมดอายุแล้ว และคนที่กดคือคนที่เบิกรายการนั้น */
export function canAcknowledge(
  row: DueRow & Pick<StandardInUseItem, "userEmail">,
  user: { email?: string } | null | undefined,
  now: Date,
): boolean {
  if (inUseStatus(row, now) !== "expired") return false;
  const owner = normEmail(row.userEmail);
  return Boolean(owner) && owner === normEmail(user?.email);
}

/** "อีก 2 วัน" / "ภายในวันนี้" / "เกินกำหนดวันนี้" / "เกิน 3 วัน" / "-" */
export function dueDistanceLabel(dueAt: string | null | undefined, now: Date): string {
  const due = dueMs(dueAt);
  if (Number.isNaN(due)) return "-";
  const diff = due - now.getTime();
  if (diff <= 0) {
    const days = Math.floor(-diff / DAY_MS);
    return days === 0 ? "เกินกำหนดวันนี้" : `เกิน ${days} วัน`;
  }
  const days = Math.floor(diff / DAY_MS);
  return days === 0 ? "ภายในวันนี้" : `อีก ${days} วัน`;
}

export interface InUseNotification {
  id: string;
  title: string;
  message: string;
  level: "warning" | "error";
}

export interface InUseNotificationPlan {
  push: InUseNotification[];
  dismiss: string[];
}

const thaiDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("th-TH") : "-";

/**
 * เทียบรายการที่ยังกำลังใช้งาน กับ id ที่ค้างอยู่ในกระดิ่ง แล้วบอกว่าต้อง push อะไร / ลบอะไร
 * การลบคือหัวใจของ "กดรับทราบแล้วหายทุกคน" — แถวที่ถูกปิดจะหลุดจาก items รอบถัดไปเอง
 */
export function planInUseNotifications(
  items: StandardInUseItem[],
  now: Date,
  existingIds: string[],
): InUseNotificationPlan {
  const push: InUseNotification[] = [];
  const live = new Set<string>();

  for (const item of items) {
    const status = inUseStatus(item, now);
    if (status !== "expired" && status !== "dueSoon") continue;
    const id = `${IN_USE_NOTIFICATION_PREFIX}${item._id}:${status === "expired" ? "expired" : "soon"}`;
    live.add(id);
    push.push({
      id,
      title: `${status === "expired" ? "หมดอายุแล้ว" : "ใกล้ครบกำหนด"}: ${item.itemName || item.itemCode}`,
      message: `เบิกโดย ${item.userName || item.userEmail || "-"} · ครบกำหนด ${thaiDateTime(item.dueAt)}`,
      level: status === "expired" ? "error" : "warning",
    });
  }

  const dismiss = existingIds.filter(
    (id) => id.startsWith(IN_USE_NOTIFICATION_PREFIX) && !live.has(id),
  );
  return { push, dismiss };
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/standardInUse.test.ts`
Expected: PASS 12 เทสต์

- [ ] **Step 5: Commit**

```bash
git add src/lib/standardInUse.ts src/lib/standardInUse.test.ts
git commit -m "feat(stock): pure lib สถานะ/การเรียง/แผนแจ้งเตือนของ standard ที่กำลังใช้งาน"
```

---

## Task 7: FE — แยกหน้า /stock-deduction เป็น 2 แท็บ

**Files:**
- Modify: `src/lib/tabRegistry.ts:22-29`
- Modify: `src/pages/StockDeduction.tsx:1-152`
- Modify: `src/pages/__tests__/StockDeduction.item-display.test.tsx`

**Interfaces:**
- Consumes: `useAccessibleTabs("/stock-deduction")`
- Produces: หน้าเดิมกลายเป็น 2 แท็บ — `in-use` (ว่างไว้ก่อน เติมตารางใน Task 8) และ `history` (ตารางเดิมทั้งดุ้น)

- [ ] **Step 1: ลงทะเบียนแท็บ**

`src/lib/tabRegistry.ts` — เพิ่ม entry ต่อจากบล็อก `"/stock"`:

```ts
  "/stock-deduction": [
    { key: "in-use", label: "กำลังใช้งานอยู่" },
    { key: "history", label: "ประวัติการตัด stock" },
  ],
```

- [ ] **Step 2: แก้เทสต์หน้าเดิมให้ชี้แท็บ history**

`src/pages/__tests__/StockDeduction.item-display.test.tsx` — เพิ่ม mock (หน้านี้เรียก `useAccessibleTabs` ซึ่งลากไปถึง `useAuth` ที่ไม่มี provider ในเทสต์) และคลิกแท็บ history ก่อนตรวจ

เพิ่มถัดจาก mock ตัวอื่น (บรรทัด ~29):

```tsx
vi.mock("@/hooks/useAccessibleTabs", () => ({
  useAccessibleTabs: () => ({
    tabs: [
      { key: "in-use", label: "กำลังใช้งานอยู่" },
      { key: "history", label: "ประวัติการตัด stock" },
    ],
    isVisible: () => true,
    visibleKeys: ["in-use", "history"],
    defaultKey: "in-use",
  }),
}));

vi.mock("@/components/lis/stock/StandardsInUseTable", () => ({
  default: () => <div>in-use-table</div>,
}));
```

แล้วในแต่ละ `it(...)` ให้คลิกแท็บก่อน — แทรกเป็นบรรทัดแรกหลัง `renderPage()`:

```tsx
    fireEvent.click(await screen.findByRole("tab", { name: "ประวัติการตัด stock" }));
```

- [ ] **Step 3: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run src/pages/__tests__/StockDeduction.item-display.test.tsx`
Expected: FAIL — หา `role="tab"` ไม่เจอ (หน้ายังไม่มีแท็บ)

- [ ] **Step 4: เขียน implementation**

ก่อนอื่นสร้างไฟล์ placeholder ให้ import ใหม่ resolve ได้ (Task 8 จะเขียนทับด้วยของจริง — ถ้าไม่มีไฟล์นี้ Vite จะ resolve import ไม่ผ่าน แม้เทสต์จะ `vi.mock` ไว้แล้วก็ตาม):

```tsx
// src/components/lis/stock/StandardsInUseTable.tsx (placeholder — Task 8 เขียนทับ)
export default function StandardsInUseTable() {
  return null;
}
```

`src/pages/StockDeduction.tsx` — แก้เฉพาะส่วน component `StockDeduction` (บรรทัด 1-152) ตามนี้; `DeductionDetailSheet` และ `DetailItem` ท้ายไฟล์ **ไม่ต้องแก้**

เพิ่ม import:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccessibleTabs } from "@/hooks/useAccessibleTabs";
import StandardsInUseTable from "@/components/lis/stock/StandardsInUseTable";
```

ใน body ของ component เพิ่มบรรทัดถัดจาก `const queryClient = useQueryClient();`:

```tsx
  const { tabs, defaultKey } = useAccessibleTabs("/stock-deduction");
```

แล้วแทนที่ JSX ตั้งแต่ `<div className="mb-3 flex items-center justify-end gap-2">` จนถึง `</DataTable>` (บรรทัด 114-136) ด้วย:

```tsx
      <Tabs key={defaultKey} defaultValue={defaultKey}>
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <TabsList className="mb-4 w-max">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="in-use">
          <StandardsInUseTable />
        </TabsContent>

        <TabsContent value="history">
          <div className="mb-3 flex items-center justify-end gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={type || "all"} onValueChange={(v) => setType(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-full sm:w-44">
                <SelectValue placeholder="ทุกหมวด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกหมวด</SelectItem>
                <SelectItem value="standard">Standards</SelectItem>
                <SelectItem value="solvent">สารเคมี</SelectItem>
                <SelectItem value="glassware">เครื่องแก้ว</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DataTable
            columns={columns}
            data={data}
            rowKey={(t) => t._id}
            isLoading={isLoading}
            onRowClick={(row) => setSelected(row)}
            emptyTitle="ยังไม่มีรายการตัด stock"
            tableClassName="min-w-[860px]"
          />
        </TabsContent>
      </Tabs>
```

> `DeductionDetailSheet` + `DeductionResolutionDialog` ที่อยู่ถัดลงไปให้คงไว้นอก `<Tabs>` ตามเดิม — ทั้งสองแท็บใช้ร่วมกัน

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/pages/__tests__/StockDeduction.item-display.test.tsx`
Expected: PASS 2 เทสต์ — แท็บ "ประวัติการตัด stock" แสดงตารางเดิมครบ และคลิกแถวยังเปิด drawer ได้เหมือนเดิม

- [ ] **Step 6: Commit**

```bash
git add src/lib/tabRegistry.ts src/pages/StockDeduction.tsx src/pages/__tests__/StockDeduction.item-display.test.tsx src/components/lis/stock/StandardsInUseTable.tsx
git commit -m "feat(stock): แยก /stock-deduction เป็นแท็บกำลังใช้งานอยู่ + ประวัติ"
```

---

## Task 8: FE — ตาราง "กำลังใช้งานอยู่" + ปุ่มรับทราบ

**Files:**
- Modify (เขียนทับ placeholder): `src/components/lis/stock/StandardsInUseTable.tsx`
- Test: `src/components/lis/stock/__tests__/StandardsInUseTable.test.tsx`

**Interfaces:**
- Consumes: `api.getStandardsInUse()` (Task 5), `inUseStatus` / `sortInUse` / `canAcknowledge` / `dueDistanceLabel` (Task 6), `api.resolveStockDeduction(id, { reason: "expired", _user })`
- Produces: คอมโพเนนต์ default export ที่ไม่รับ prop

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/components/lis/stock/__tests__/StandardsInUseTable.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StandardsInUseTable from "../StandardsInUseTable";

const apiMock = vi.hoisted(() => ({
  getStandardsInUse: vi.fn(),
  resolveStockDeduction: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { email: "owner@icpladda.com", name: "สมชาย" } }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const NOW = "2026-08-03T00:00:00.000Z";
const DAY = 24 * 60 * 60 * 1000;

const item = (over: Record<string, unknown>) => ({
  _id: "tx1",
  itemCode: "STD-001",
  itemName: "ABAMECTIN",
  qrId: "u_abc",
  weights: [10],
  totalMg: 10,
  instrumentGroup: "gc",
  note: "",
  withdrawnAt: "2026-08-01T00:00:00.000Z",
  frequency: "1/1 week",
  dueAt: null,
  userEmail: "owner@icpladda.com",
  userName: "สมชาย",
  ...over,
});

function renderTable() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StandardsInUseTable />
    </QueryClientProvider>,
  );
}

describe("StandardsInUseTable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("แสดงสถานะตามความถี่ และขึ้น 'ยังไม่ได้ตั้งความถี่' เมื่อไม่มี dueAt", async () => {
    apiMock.getStandardsInUse.mockResolvedValue({
      serverTime: NOW,
      items: [
        item({ _id: "a", itemName: "ATRAZINE", dueAt: new Date(Date.parse(NOW) - DAY).toISOString() }),
        item({ _id: "b", itemName: "DIURON", dueAt: null, frequency: "" }),
      ],
    });
    renderTable();

    expect(await screen.findByText("ATRAZINE")).toBeInTheDocument();
    expect(screen.getByText("หมดอายุ")).toBeInTheDocument();
    expect(screen.getByText("ยังไม่ได้ตั้งความถี่")).toBeInTheDocument();
  });

  it("เจ้าของกดรับทราบได้ → ยิง resolve ด้วย reason expired", async () => {
    apiMock.getStandardsInUse.mockResolvedValue({
      serverTime: NOW,
      items: [item({ _id: "a", dueAt: new Date(Date.parse(NOW) - DAY).toISOString() })],
    });
    apiMock.resolveStockDeduction.mockResolvedValue({});
    renderTable();

    fireEvent.click(await screen.findByRole("button", { name: "รับทราบ" }));

    await waitFor(() =>
      expect(apiMock.resolveStockDeduction).toHaveBeenCalledWith("a", expect.objectContaining({ reason: "expired" })),
    );
  });

  it("คนที่ไม่ได้เบิกไม่เห็นปุ่ม แต่เห็นว่ารอใครรับทราบ", async () => {
    apiMock.getStandardsInUse.mockResolvedValue({
      serverTime: NOW,
      items: [item({
        _id: "a",
        dueAt: new Date(Date.parse(NOW) - DAY).toISOString(),
        userEmail: "other@icpladda.com",
        userName: "สมหญิง",
      })],
    });
    renderTable();

    expect(await screen.findByText("รอ สมหญิง รับทราบ")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "รับทราบ" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run src/components/lis/stock/__tests__/StandardsInUseTable.test.tsx`
Expected: FAIL — หา "ATRAZINE" ไม่เจอ (คอมโพเนนต์ยัง return null)

- [ ] **Step 3: เขียน implementation**

เขียนทับ `src/components/lis/stock/StandardsInUseTable.tsx`:

```tsx
// ตาราง "กำลังใช้งานอยู่" — standard ที่เบิกไปแล้วยังไม่ปิด พร้อมนาฬิกาตามความถี่/1 ครั้ง
// ปิดแถวได้ 2 ทาง: กดรับทราบตอนหมดอายุ (เฉพาะคนเบิก) หรือปุ่ม "แจ้งหมด/ปัญหา" ใน drawer ของหน้าแม่
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/lis/DataTable";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  canAcknowledge,
  dueDistanceLabel,
  inUseStatus,
  sortInUse,
  type InUseStatus,
} from "@/lib/standardInUse";
import type { StandardInUseItem } from "@/types/stock";

const STATUS_LABEL: Record<InUseStatus, string> = {
  expired: "หมดอายุ",
  dueSoon: "ใกล้ครบกำหนด",
  active: "กำลังใช้งาน",
  noFrequency: "ยังไม่ได้ตั้งความถี่",
};

const STATUS_CLASS: Record<InUseStatus, string> = {
  expired: "border-destructive/40 bg-destructive/10 text-destructive",
  dueSoon: "border-amber-400/50 bg-amber-50 text-amber-700",
  active: "",
  noFrequency: "text-muted-foreground",
};

export default function StandardsInUseTable() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["stock", "in-use"],
    queryFn: api.getStandardsInUse,
    refetchInterval: 60_000,
  });

  const ack = useMutation({
    mutationFn: (row: StandardInUseItem) =>
      api.resolveStockDeduction(row._id, {
        reason: "expired",
        _user: { email: user?.email, name: user?.name },
      }),
    onMutate: (row: StandardInUseItem) => setPendingId(row._id),
    onSettled: () => setPendingId(null),
    onSuccess: () => {
      toast.success("รับทราบแล้ว");
      qc.invalidateQueries({ queryKey: ["stock", "in-use"] });
      qc.invalidateQueries({ queryKey: ["stock-deductions"] });
      qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const now = new Date(data?.serverTime || Date.now());
  const rows = sortInUse(data?.items ?? [], now);

  const columns: DataTableColumn<StandardInUseItem>[] = [
    {
      key: "item",
      header: "สาร",
      cell: (r) => (
        <>
          <div className="font-medium">{r.itemName || r.itemCode}</div>
          <div className="text-xs text-muted-foreground">{r.totalMg} mg · {r.weights.length} น้ำหนัก</div>
        </>
      ),
    },
    {
      key: "instrument",
      header: "เครื่อง",
      className: "text-xs",
      cell: (r) => (r.instrumentGroup ? r.instrumentGroup.toUpperCase() : "-"),
    },
    {
      key: "withdrawn",
      header: "เบิกเมื่อ",
      className: "text-xs whitespace-nowrap",
      cell: (r) => (r.withdrawnAt ? new Date(r.withdrawnAt).toLocaleString("th-TH") : "-"),
    },
    {
      key: "due",
      header: "ครบกำหนด",
      className: "text-xs whitespace-nowrap",
      cell: (r) => (
        <>
          <div>{r.dueAt ? new Date(r.dueAt).toLocaleDateString("th-TH") : "-"}</div>
          <div className="text-muted-foreground">{dueDistanceLabel(r.dueAt, now)}</div>
        </>
      ),
    },
    {
      key: "status",
      header: "สถานะ",
      cell: (r) => {
        const status = inUseStatus(r, now);
        return <Badge variant="outline" className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</Badge>;
      },
    },
    {
      key: "user",
      header: "ผู้เบิก",
      className: "text-xs",
      cell: (r) => r.userName || r.userEmail || "-",
    },
    {
      key: "action",
      header: "",
      className: "text-right",
      cell: (r) => {
        if (canAcknowledge(r, user, now)) {
          return (
            <Button
              size="sm"
              disabled={pendingId === r._id}
              onClick={(e) => { e.stopPropagation(); ack.mutate(r); }}
            >
              {pendingId === r._id ? "กำลังบันทึก..." : "รับทราบ"}
            </Button>
          );
        }
        if (inUseStatus(r, now) === "expired") {
          return (
            <span className="text-xs text-muted-foreground">
              รอ {r.userName || r.userEmail || "ผู้เบิก"} รับทราบ
            </span>
          );
        }
        return null;
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      rowKey={(r) => r._id}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => refetch()}
      emptyTitle="ยังไม่มี standard ที่กำลังใช้งาน"
      emptyDescription="รายการที่เบิกแล้วยังไม่ปิดจะมาอยู่ที่นี่"
      tableClassName="min-w-[880px]"
    />
  );
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/components/lis/stock/__tests__/StandardsInUseTable.test.tsx`
Expected: PASS 3 เทสต์

- [ ] **Step 5: type-check + เทสต์รวม**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx vitest run`
Expected: ไม่มี error ใหม่ · เทสต์ทั้งชุดผ่าน

- [ ] **Step 6: Commit**

```bash
git add src/components/lis/stock/StandardsInUseTable.tsx src/components/lis/stock/__tests__/StandardsInUseTable.test.tsx
git commit -m "feat(stock): ตารางกำลังใช้งานอยู่ + ปุ่มรับทราบของคนเบิก"
```

---

## Task 9: FE — กระดิ่งแจ้งเตือนใกล้ครบ/หมดอายุ

**Files:**
- Create: `src/components/lis/StandardExpiryWatcher.tsx`
- Modify: `src/App.tsx:11-12` (import), `:97-98` (mount)

**Interfaces:**
- Consumes: `planInUseNotifications`, `IN_USE_NOTIFICATION_GROUP` (Task 6), `api.getStandardsInUse()` (Task 5), `useNotifications()` (`notifications`, `push`, `dismiss`)
- Produces: คอมโพเนนต์ที่ render `null` (side-effect ล้วน)

- [ ] **Step 1: เขียน watcher**

สร้าง `src/components/lis/StandardExpiryWatcher.tsx`:

```tsx
// Poll standard ที่กำลังใช้งานทุกนาที แล้ว sync เข้ากระดิ่ง:
// - ใกล้ครบกำหนด/หมดอายุ → push (id เดิมซ้ำไม่ถูก push ซ้ำ)
// - id ของกลุ่มนี้ที่ไม่อยู่ในรอบล่าสุดแล้ว → dismiss
// การ dismiss คือกลไก "คนเบิกกดรับทราบแล้วหายจากกระดิ่งของทุกคน" — แถวที่ปิดแล้ว
// จะหลุดจาก endpoint เอง ไม่ต้องเก็บสถานะอ่านแล้วรายคนที่ server
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { api } from "@/lib/api";
import { IN_USE_NOTIFICATION_GROUP, planInUseNotifications } from "@/lib/standardInUse";

const StandardExpiryWatcher = () => {
  const { user } = useAuth();
  const { notifications, push, dismiss } = useNotifications();

  const { data } = useQuery({
    queryKey: ["stock", "in-use"],
    queryFn: api.getStandardsInUse,
    refetchInterval: 60_000,
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (!data) return;
    const now = new Date(data.serverTime || Date.now());
    const plan = planInUseNotifications(data.items, now, notifications.map((n) => n.id));
    for (const n of plan.push) {
      push({
        id: n.id,
        title: n.title,
        message: n.message,
        level: n.level,
        link: "/stock-deduction",
        persistent: true,
        group: IN_USE_NOTIFICATION_GROUP,
      });
    }
    for (const id of plan.dismiss) dismiss(id);
  }, [data, notifications, push, dismiss]);

  return null;
};

export default StandardExpiryWatcher;
```

- [ ] **Step 2: mount ใน App**

`src/App.tsx` — เพิ่ม import ถัดจากบรรทัด 12:

```tsx
import StandardExpiryWatcher from "@/components/lis/StandardExpiryWatcher";
```

และเพิ่มถัดจาก `<PetitionFlowWatcher />` (บรรทัด 98):

```tsx
            <StandardExpiryWatcher />
```

- [ ] **Step 3: type-check + เทสต์ทั้งชุด**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx vitest run`
Expected: ไม่มี error ใหม่ · เทสต์ผ่านทั้งหมด (ตรรกะ push/dismiss ถูกครอบด้วยเทสต์ของ `planInUseNotifications` ใน Task 6 แล้ว)

- [ ] **Step 4: ตรวจด้วยตาในเบราว์เซอร์**

เปิด backend + `npm run dev` → เข้า `/stock-deduction` → เบิก standard ที่มีความถี่ `1/1 day` 1 รายการ
ใช้ mongosh ดันวันเบิกให้ย้อนหลัง 2 วันเพื่อจำลองหมดอายุ:

```bash
mongosh "mongodb://localhost:27017/LIS-DB" --eval 'db.stocktransactions.updateOne({action:"deduct",itemType:"standard",deductionResolution:{$exists:false}},{$set:{createdAt:new Date(Date.now()-2*86400000)}})'
```
Expected: ภายใน 1 นาที กระดิ่งขึ้น "หมดอายุแล้ว: <ชื่อสาร>" · แถวในแท็บขึ้น badge แดง · กด "รับทราบ" แล้วแถวหาย และกระดิ่งหายในรอบ poll ถัดไป

- [ ] **Step 5: Commit**

```bash
git add src/components/lis/StandardExpiryWatcher.tsx src/App.tsx
git commit -m "feat(stock): กระดิ่งแจ้งเตือน standard ใกล้ครบกำหนด/หมดอายุ"
```

---

## Task 10: script ปิดยอดค้างเก่า

**Files:**
- Create: `server/scripts/close-stale-standard-deductions.js`

**Interfaces:**
- Consumes: collection `stocktransactions`
- Produces: CLI — dry-run เป็นค่าเริ่มต้น, เขียนจริงเมื่อใส่ `--commit`

- [ ] **Step 1: เขียน script**

สร้าง `server/scripts/close-stale-standard-deductions.js`:

```js
// ปิดยอด "การเบิก standard ที่ค้างไม่ปิด" ซึ่งเกิดก่อนเปิดแท็บ "กำลังใช้งานอยู่"
// ถ้าไม่ปิด รายการเก่าเหล่านี้จะโผล่ในแท็บเป็นสีแดงทั้งหมด และกระดิ่งจะเด้งรัวในรอบแรก
// idempotent — แตะเฉพาะรายการที่ยังไม่มี deductionResolution และเก่ากว่าวันที่กำหนด
//
// Usage:
//   node scripts/close-stale-standard-deductions.js                       # dry-run (นับอย่างเดียว)
//   node scripts/close-stale-standard-deductions.js --before=2026-08-03   # กำหนดวันตัด (ดีฟอลต์ = วันนี้)
//   node scripts/close-stale-standard-deductions.js --commit              # เขียนจริง
'use strict';

const mongoose = require('mongoose');
require('../models/StockTransaction');

const COMMIT = process.argv.includes('--commit');
const beforeArg = (process.argv.find((a) => a.startsWith('--before=')) || '').split('=')[1];
const BEFORE = beforeArg ? new Date(beforeArg) : new Date();
const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';

async function main() {
  if (Number.isNaN(BEFORE.getTime())) {
    console.error('--before ไม่ใช่วันที่ที่ถูกต้อง (ใช้รูปแบบ YYYY-MM-DD)');
    process.exit(1);
  }
  await mongoose.connect(URI);
  const col = mongoose.connection.collection('stocktransactions');

  const filter = {
    action: 'deduct',
    itemType: 'standard',
    'deductionResolution.reason': { $exists: false },
    createdAt: { $lt: BEFORE },
  };
  const affected = await col.countDocuments(filter);
  console.log(`การเบิก standard ที่ค้างและเก่ากว่า ${BEFORE.toISOString()}: ${affected}`);

  if (!COMMIT) {
    console.log('DRY-RUN — ยังไม่เขียน. รันซ้ำด้วย --commit เพื่อปิดยอดจริง');
  } else {
    const res = await col.updateMany(filter, {
      $set: {
        deductionResolution: {
          reason: 'other',
          note: 'ปิดยอดค้างก่อนเปิดแท็บกำลังใช้งาน',
          resolvedAt: new Date(),
          resolvedBy: { email: '', name: 'system' },
        },
      },
    });
    console.log(`ปิดยอดเรียบร้อย: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
    console.log('รัน `npm run seed:export` เพื่อ backup ลง git');
  }
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
```

> เขียนผ่าน native collection ตรงๆ (แบบเดียวกับ `remove-production-plans.js`) จึงไม่ไปเรียก
> `applyUnitResolutionFromTransaction` — **ขวดต้นทางไม่ถูกแตะ** ซึ่งเป็นสิ่งที่ต้องการสำหรับการปิดยอดย้อนหลัง

- [ ] **Step 2: ตรวจ dry-run**

Run: `cd server && node scripts/close-stale-standard-deductions.js`
Expected: พิมพ์จำนวนรายการค้าง + บรรทัด `DRY-RUN` · ไม่มีข้อมูลเปลี่ยน (รันซ้ำได้ตัวเลขเท่าเดิม)

- [ ] **Step 3: Commit**

```bash
git add server/scripts/close-stale-standard-deductions.js
git commit -m "chore(stock): script ปิดยอดการเบิก standard ที่ค้างก่อนเปิดแท็บใหม่"
```

---

## หลังจบทุก Task

- [ ] รันรวม: `npx vitest run` · `npx tsc -p tsconfig.app.json --noEmit` · `cd server && npx jest lib/ ; node --test lib/workingLifecycle.test.js`
- [ ] แจ้งผู้ใช้ว่ามี 2 อย่างที่ต้องทำเองบน prod:
  1. รัน `node scripts/close-stale-standard-deductions.js` (ดูตัวเลขก่อน) แล้ว `--commit` ถ้ายอมรับได้ → ตามด้วย `npm run seed:export`
  2. กรอก "ความถี่/1 ครั้ง" ให้สาร 43 ตัวที่ยังว่าง มิฉะนั้นแถวของสารเหล่านั้นจะขึ้น "ยังไม่ได้ตั้งความถี่" ตลอด
- [ ] ถ้าต้องการจำกัดสิทธิ์การเห็นแท็บ ตั้งที่ Access Matrix (token `deny:/stock-deduction/in-use` หรือ `deny:/stock-deduction/history`)
