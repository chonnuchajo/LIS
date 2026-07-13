# Executive Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยน `admin` dashboard จากมุมมองผู้ดูแลระบบ เป็นหน้าผู้บริหารสำหรับหัวหน้า Lab/QC ที่บอกได้ว่างานไหนเกินเวลา ใครโหลดเกิน คุณภาพเป็นยังไง

**Architecture:** endpoint เดียว `GET /petitions/exec-summary?days=` คำนวณฝั่ง server ใน pure JS lib (`execSummary.js`, `qcParamBaseline.js`) ที่ Jest ทดสอบได้ตรง ๆ · Mongo ทำแค่ query + project · หน้าเว็บมี `<ExecDashboard/>` ที่ `RoleDashboard` เรียกเมื่อ profile เป็น `admin` (profile อื่นไม่แตะ) · ทุกการ์ด drill-down ไป `/petitions?highlight=<ids>`

**Tech Stack:** Express 4, Mongoose 8, Jest (server) · React 18, TypeScript, TanStack Query, recharts, shadcn/ui, Vitest + Testing Library (frontend)

**Spec:** `docs/superpowers/specs/2026-07-13-exec-dashboard-design.md`

## Global Constraints

- **ห้ามรัน `npm run build`** หรือคำสั่งใดที่ trigger `postbuild` — มันเขียนทับไฟล์ root และทำ dev server พัง
- Type-check ที่ใช้จริงคือ `npx tsc -p tsconfig.app.json --noEmit` (`npx tsc --noEmit` เฉย ๆ เป็น no-op เพราะ root tsconfig มี `files: []`) · repo มี latent error อยู่ก่อนแล้วประมาณ 12 รายการ — เทียบกับ baseline ก่อนแก้ ไม่ใช่คาดหวังศูนย์
- **ห้ามแตะ dashboard profile อื่น** (`lab-head`, `qc-head`, `qc-staff`, `lab-analyze`, `lab-config`, `lab-inventory`, `viewer`) — งานนี้เปลี่ยนเฉพาะเส้นทางของ `admin`
- **ห้ามเพิ่ม npm dependency ใหม่** ทั้ง server และ frontend
- worktree นี้มีงานค้างของ user อยู่หลายไฟล์ — **commit ด้วย explicit pathspec เฉพาะไฟล์ของ task นั้น** ห้าม `git add -A` / `git add .`
- ป้ายทุกอันในหน้าเว็บเป็นภาษาไทย (ตามที่ระบุในแต่ละ task)
- เวลาที่ผ่านไปนับเป็น **wall clock 24 ชม.** ไม่หักวันหยุด/นอกเวลาทำการ
- ห้ามพอร์ต `matchParametersForItem` (frontend) มาไว้ที่ server — QC parameter set เดาจากประวัติ `QCTestResult` เท่านั้น (ดูเหตุผลในสเปก)

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `server/lib/abnormalFlags.js` (สร้าง) | ย้ายตรรกะ abnormal-flag ที่ฝังอยู่ใน route ออกมาเป็น pure lib เพื่อให้ทั้ง `/qc-results/abnormal-flags` และ exec-summary ใช้สูตรเดียวกัน |
| `server/routes/qcResults.js` (แก้) | route เรียก lib ใหม่แทนโค้ดในตัว |
| `server/lib/qcParamBaseline.js` (สร้าง) | ค่าเฉลี่ยเวลา QC ต่อ parameter + เดา parameter set ของใบที่ยังทำอยู่จาก `commonName` |
| `server/lib/execSummary.js` (สร้าง) | หัวใจ: open work unit ต่อราง, ด่าน, elapsed, baseline, overdue/at-risk, คอขวด, turnaround, throughput, คุณภาพ, ภาระงาน |
| `server/routes/petitions.js` (แก้) | `GET /petitions/exec-summary?days=` (cache 60 วิ) + filter `?ids=` ใน `GET /petitions` |
| `src/lib/execSummary.ts` (สร้าง) | type ของ response + `formatMinutes()` |
| `src/hooks/useExecSummary.ts` (สร้าง) | React Query + state ช่วงเวลา |
| `src/components/dashboard/exec/*` (สร้าง) | `AlertStrip`, `BottleneckBars`, `ActionQueue`, `TurnaroundChart`, `ThroughputChart`, `QualityPanel`, `TeamWorkloadPanel`, `ExecDashboard` |
| `src/lib/dashboardProfiles.ts` (แก้) | `admin` profile ได้ `layout: "exec"` |
| `src/pages/RoleDashboard.tsx` (แก้) | `admin` → `<ExecDashboard/>` |
| `src/pages/PetitionListPage.tsx` (แก้) | รองรับ `?highlight=` (ปักหมุดบนสุด + พื้นเหลือง) |

---

### Task 1: Extract abnormal-flag computation into a shared lib

ตอนนี้ตรรกะ abnormal-flag ฝังอยู่ใน `server/routes/qcResults.js` (helper ~170 บรรทัด + loop ใน route) exec-summary ต้องใช้สูตรเดียวกันเป๊ะ ไม่งั้นตัวเลข "ผลผิดปกติ" ในแดชบอร์ดจะไม่ตรงกับ badge ที่ผู้ใช้เห็นในหน้ารายการ

**Files:**
- Create: `server/lib/abnormalFlags.js`
- Create: `server/lib/abnormalFlags.test.js`
- Modify: `server/routes/qcResults.js:12-183` (ย้าย helper ออก), `server/routes/qcResults.js:274-374` (route เรียก lib)

**Interfaces:**
- Consumes: `server/lib/abnormal.js` (`isFieldAbnormal`, `isEnumAbnormal`, `isNumericAbnormal`, `isLabelToleranceAbnormal`)
- Produces: `computeAbnormalFlags({ docs, params, petitions, includeRestricted }) → Record<petitionId, boolean>` และ helper ที่ export ไว้ให้ route เดิมใช้ต่อ: `getEntryValuesJS`, `categoryFromDeptJS`, `productTypeFromSpecJS`

- [ ] **Step 1: ย้ายโค้ดเป็นไฟล์ lib ใหม่ (ยังไม่แก้ route)**

สร้าง `server/lib/abnormalFlags.js` โดย **ย้าย** (ไม่ใช่ก๊อบ) helper ทั้งหมดจาก `server/routes/qcResults.js` บรรทัด 12–183 — คือ `getEntryValuesJS`, `fieldValueListJS`, `matchSubstanceKeyJS`, `parseLabelPercentJS`, `CLASSIFICATION_CODES`, `productTypeFromSpecJS`, `normalizeCategoryJS`, `categoryFromDeptJS`, `rawSpecForSubKey`, `visibleSubstanceStandardJS`, `isSubstanceAbnormalJS`, `findLabelToleranceStandardJS`, `resolveFieldStandardJS`, `resolveConditionalOutputJS` (ชื่อจริงให้ยึดตามไฟล์ ณ ตอนแก้ — ย้ายทุกตัวที่อยู่เหนือ `router.get("/testers"` )

จากนั้นเพิ่มฟังก์ชันรวมที่ท้ายไฟล์ ซึ่งคือ loop ที่ยกมาจาก route บรรทัด 305–368 แบบไม่เปลี่ยน logic:

```js
/**
 * docs:      QCTestResult[]  (lean; ต้องมี petitionId, parameterId, itemSeq, commonName, values, entries)
 * params:    Parameter[]     (lean; ต้องมี _id, valueFields, multiEntry)
 * petitions: Petition[]      (lean; ต้องมี _id, dept, items[].seq)
 * คืน map petitionId → boolean (true = มีอย่างน้อยหนึ่ง field ผิดปกติ)
 */
function computeAbnormalFlags({ docs, params, petitions, includeRestricted = false }) {
  const paramById = new Map((params || []).map((p) => [String(p._id), p]));

  const categoryByItem = {};
  for (const petition of petitions || []) {
    const category = categoryFromDeptJS(petition.dept);
    for (const item of petition.items || []) {
      categoryByItem[`${String(petition._id)}__${item.seq}`] = category;
    }
  }

  const valuesByItem = {};
  for (const d of docs || []) {
    const key = `${d.petitionId}__${d.itemSeq}`;
    if (!valuesByItem[key]) valuesByItem[key] = {};
    const param = paramById.get(String(d.parameterId));
    valuesByItem[key][String(d.parameterId)] = getEntryValuesJS(d, param || {})[0] || {};
  }

  const map = {};
  for (const petition of petitions || []) map[String(petition._id)] = false;

  for (const d of docs || []) {
    if (map[d.petitionId]) continue;
    const param = paramById.get(String(d.parameterId));
    if (!param?.valueFields?.length) continue;
    const ctxBucket = valuesByItem[`${d.petitionId}__${d.itemSeq}`] || {};
    let flagged = false;
    for (const values of getEntryValuesJS(d, param)) {
      for (const field of param.valueFields) {
        const isNumeric = field.type === 'number' || field.type === 'float';
        if (field.substanceMode && isNumeric) {
          const prefix = `${field.label}::`;
          for (const [vkey, vval] of Object.entries(values)) {
            if (!vkey.startsWith(prefix)) continue;
            const subKey = vkey.slice(prefix.length);
            const raw = rawSpecForSubKey(d.commonName, subKey) || subKey;
            const productType = productTypeFromSpecJS(raw) || productTypeFromSpecJS(d.commonName);
            const category = categoryByItem[`${d.petitionId}__${d.itemSeq}`] || '';
            const std = visibleSubstanceStandardJS(field, raw, includeRestricted, productType, category);
            if (isSubstanceAbnormalJS(field, std, vval)) { flagged = true; break; }
          }
          if (flagged) break;
          continue;
        }
        if (field.labelToleranceMode && isNumeric) {
          const prefix = `${field.label}::`;
          for (const [vkey, vval] of Object.entries(values)) {
            if (!vkey.startsWith(prefix)) continue;
            const subKey = vkey.slice(prefix.length);
            const raw = rawSpecForSubKey(d.commonName, subKey);
            const productType = productTypeFromSpecJS(raw) || productTypeFromSpecJS(d.commonName);
            const std = findLabelToleranceStandardJS(field, raw, productType);
            if (isLabelToleranceAbnormal(std, raw, vval)) { flagged = true; break; }
          }
          if (flagged) break;
          continue;
        }
        if (field.conditionalMode && field.conditionalResult === 'output' && isNumeric) {
          const out = resolveConditionalOutputJS(field, { sameParam: values, otherParams: ctxBucket });
          if (out && out.kind === 'abnormal') { flagged = true; break; }
          continue;
        }
        const vf = field.conditionalMode && isNumeric
          ? resolveFieldStandardJS(field, { sameParam: values, otherParams: ctxBucket })
          : field;
        for (const v of fieldValueListJS(values, field)) {
          if (isFieldAbnormal(vf, v)) { flagged = true; break; }
        }
        if (flagged) break;
      }
      if (flagged) break;
    }
    if (flagged) map[d.petitionId] = true;
  }

  return map;
}

module.exports = {
  computeAbnormalFlags,
  getEntryValuesJS,
  fieldValueListJS,
  categoryFromDeptJS,
  productTypeFromSpecJS,
  rawSpecForSubKey,
  visibleSubstanceStandardJS,
  isSubstanceAbnormalJS,
  findLabelToleranceStandardJS,
  resolveFieldStandardJS,
  resolveConditionalOutputJS,
};
```

**หมายเหตุสำคัญ:** route `/progress` และ `/last-values` ในไฟล์เดิมก็ใช้ `getEntryValuesJS` อยู่ — จึงต้อง `require` กลับเข้าไปใน `qcResults.js` (Step 3) ไม่ใช่ลบทิ้งเฉย ๆ

- [ ] **Step 2: เขียนเทสต์ของ lib ใหม่**

สร้าง `server/lib/abnormalFlags.test.js`:

```js
const { computeAbnormalFlags } = require('./abnormalFlags');

const petition = { _id: 'p1', dept: 'fg', items: [{ seq: 1 }] };
const numberParam = {
  _id: 'par1',
  valueFields: [{ label: 'ค่า', type: 'number', standardOperator: '<=', standardValue: 10 }],
};

describe('computeAbnormalFlags', () => {
  it('flags a petition whose numeric value breaks the standard', () => {
    const docs = [{ petitionId: 'p1', parameterId: 'par1', itemSeq: 1, values: { 'ค่า': 12 } }];
    expect(computeAbnormalFlags({ docs, params: [numberParam], petitions: [petition] }))
      .toEqual({ p1: true });
  });

  it('leaves a petition normal when every value is within the standard', () => {
    const docs = [{ petitionId: 'p1', parameterId: 'par1', itemSeq: 1, values: { 'ค่า': 5 } }];
    expect(computeAbnormalFlags({ docs, params: [numberParam], petitions: [petition] }))
      .toEqual({ p1: false });
  });

  it('reports false for a petition that has no results yet', () => {
    expect(computeAbnormalFlags({ docs: [], params: [], petitions: [petition] }))
      .toEqual({ p1: false });
  });

  it('ignores results whose parameter has no valueFields', () => {
    const docs = [{ petitionId: 'p1', parameterId: 'ghost', itemSeq: 1, values: { 'ค่า': 999 } }];
    expect(computeAbnormalFlags({ docs, params: [], petitions: [petition] }))
      .toEqual({ p1: false });
  });
});
```

- [ ] **Step 3: ให้ route เดิมเรียก lib (พฤติกรรมต้องไม่เปลี่ยน)**

ใน `server/routes/qcResults.js` ลบ helper ที่ย้ายไปแล้ว และเพิ่ม require ด้านบน:

```js
const {
  computeAbnormalFlags,
  getEntryValuesJS,
} = require('../lib/abnormalFlags');
```

แล้วเปลี่ยนตัว route `/abnormal-flags` ให้เหลือแค่ query + เรียก lib:

```js
router.get("/abnormal-flags", async (req, res) => {
  try {
    const includeRestricted = String(req.query.includeRestricted || "").trim() === "1";
    const raw = String(req.query.petitionIds || "").trim();
    if (!raw) return res.json({});
    const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return res.json({});

    const docs = await QCTestResult.find(
      { petitionId: { $in: ids } },
      { petitionId: 1, parameterId: 1, itemSeq: 1, commonName: 1, values: 1, entries: 1 }
    ).lean();
    const paramIds = Array.from(new Set(docs.map((d) => String(d.parameterId))));
    const params = paramIds.length
      ? await Parameter.find({ _id: { $in: paramIds } }, { valueFields: 1, multiEntry: 1 }).lean()
      : [];
    const petitions = await Petition.find({ _id: { $in: ids } }, { dept: 1, items: 1 }).lean();

    const map = computeAbnormalFlags({ docs, params, petitions, includeRestricted });
    for (const id of ids) if (!(id in map)) map[id] = false;
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

(`for (const id of ids) if (!(id in map)) map[id] = false;` จำเป็นเพราะ route เดิมการันตีว่า **ทุก id ที่ถามมา** มีคีย์ในคำตอบ แม้ petition นั้นจะไม่มีอยู่จริง)

- [ ] **Step 4: รันเทสต์**

Run: `cd server && npx jest lib/abnormalFlags.test.js`
Expected: PASS ทั้ง 4 เคส

- [ ] **Step 5: รันเทสต์ server ทั้งชุด (กัน regression จากการย้ายโค้ด)**

Run: `cd server && npx jest`
Expected: PASS ทั้งหมด (ไม่มีเทสต์ไหนพังจากการย้าย helper)

- [ ] **Step 6: Commit**

```bash
git add server/lib/abnormalFlags.js server/lib/abnormalFlags.test.js server/routes/qcResults.js
git commit -m "refactor: extract abnormal-flag computation into shared lib"
```

---

### Task 2: QC parameter baseline

**Files:**
- Create: `server/lib/qcParamBaseline.js`
- Create: `server/lib/qcParamBaseline.test.js`

**Interfaces:**
- Consumes: petition lean docs (`_id`, `items[].commonName`, `qcReceivedAt`, `qcCompletedAt`, `receivedAt`) และ QCTestResult lean docs (`petitionId`, `parameterId`, `parameterName`, `commonName`)
- Produces:
  - `qcReceivedAtOf(petition) → Date | null` (มี legacy fallback ไป `receivedAt`)
  - `buildQcParamBaseline(closedPetitions, qcResults, { minSamples = 3 }) → { avgMinutesByParam, paramNameById, paramIdsByCommonName }`
  - `qcBaselineMinutes(petition, baseline) → number | null`

- [ ] **Step 1: เขียนเทสต์ก่อน**

สร้าง `server/lib/qcParamBaseline.test.js`:

```js
const { buildQcParamBaseline, qcBaselineMinutes, qcReceivedAtOf } = require('./qcParamBaseline');

// ใบที่ปิดแล้ว: ใช้เวลา QC 60 / 120 / 180 นาที ทุกใบเป็นสินค้า "ยาเขียว"
const closed = [
  { _id: 'c1', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: '2026-07-01T00:00:00.000Z', qcCompletedAt: '2026-07-01T01:00:00.000Z' },
  { _id: 'c2', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: '2026-07-02T00:00:00.000Z', qcCompletedAt: '2026-07-02T02:00:00.000Z' },
  { _id: 'c3', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: '2026-07-03T00:00:00.000Z', qcCompletedAt: '2026-07-03T03:00:00.000Z' },
];
const results = [
  { petitionId: 'c1', parameterId: 'pH', parameterName: 'ความเป็นกรด', commonName: 'ยาเขียว' },
  { petitionId: 'c2', parameterId: 'pH', parameterName: 'ความเป็นกรด', commonName: 'ยาเขียว' },
  { petitionId: 'c3', parameterId: 'pH', parameterName: 'ความเป็นกรด', commonName: 'ยาเขียว' },
  // parameter ที่มีประวัติแค่ใบเดียว → ต้องถูกตัดทิ้งด้วยกฎ minSamples
  { petitionId: 'c1', parameterId: 'rare', parameterName: 'หายาก', commonName: 'ยาเขียว' },
];

describe('buildQcParamBaseline', () => {
  it('averages QC duration per parameter over the petitions that recorded it', () => {
    const b = buildQcParamBaseline(closed, results);
    expect(b.avgMinutesByParam.pH).toBe(120); // (60+120+180)/3
  });

  it('drops parameters with fewer than minSamples petitions', () => {
    const b = buildQcParamBaseline(closed, results);
    expect(b.avgMinutesByParam.rare).toBeUndefined();
  });

  it('maps each product to the parameters historically recorded for it', () => {
    const b = buildQcParamBaseline(closed, results);
    expect(b.paramIdsByCommonName['ยาเขียว']).toEqual(expect.arrayContaining(['pH', 'rare']));
  });

  it('skips petitions with missing or inverted QC timestamps', () => {
    const broken = [{ _id: 'x', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: null, qcCompletedAt: '2026-07-01T01:00:00.000Z' }];
    const b = buildQcParamBaseline([...closed, ...broken], [...results, { petitionId: 'x', parameterId: 'pH', commonName: 'ยาเขียว' }]);
    expect(b.avgMinutesByParam.pH).toBe(120); // ใบ x ไม่ถูกนับ ค่าเฉลี่ยไม่เปลี่ยน
  });
});

describe('qcBaselineMinutes', () => {
  const baseline = buildQcParamBaseline(closed, results);

  it('takes the slowest parameter historically seen for the products in the petition', () => {
    const open = { _id: 'o1', items: [{ commonName: 'ยาเขียว' }] };
    expect(qcBaselineMinutes(open, baseline)).toBe(120); // มีแต่ pH ที่ผ่านกฎ minSamples
  });

  it('returns null when the product has no usable history', () => {
    const open = { _id: 'o2', items: [{ commonName: 'สินค้าใหม่' }] };
    expect(qcBaselineMinutes(open, baseline)).toBeNull();
  });

  it('returns null when the item carries no commonName', () => {
    expect(qcBaselineMinutes({ _id: 'o3', items: [{ commonName: '' }] }, baseline)).toBeNull();
  });
});

describe('qcReceivedAtOf', () => {
  it('falls back to the legacy receivedAt when no side-specific field exists', () => {
    const legacy = { receivedAt: '2026-07-01T00:00:00.000Z' };
    expect(qcReceivedAtOf(legacy).toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('ignores receivedAt once a side-specific field is present', () => {
    const modern = { labReceivedAt: '2026-07-01T00:00:00.000Z', receivedAt: '2026-06-01T00:00:00.000Z' };
    expect(qcReceivedAtOf(modern)).toBeNull();
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันแดง**

Run: `cd server && npx jest lib/qcParamBaseline.test.js`
Expected: FAIL — `Cannot find module './qcParamBaseline'`

- [ ] **Step 3: เขียน implementation**

สร้าง `server/lib/qcParamBaseline.js`:

```js
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
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `cd server && npx jest lib/qcParamBaseline.test.js`
Expected: PASS ทั้ง 9 เคส

- [ ] **Step 5: Commit**

```bash
git add server/lib/qcParamBaseline.js server/lib/qcParamBaseline.test.js
git commit -m "feat: compute QC parameter time baselines from history"
```

---

### Task 3: Live section — open work units, overdue, bottleneck

**Files:**
- Create: `server/lib/execSummary.js`
- Create: `server/lib/execSummary.test.js`

**Interfaces:**
- Consumes: `qcBaselineMinutes`, `qcReceivedAtOf` (Task 2) · `isLabBatch`, `isPetitionComplete` จาก `server/lib/petitionStatusLog.js`
- Produces:
  - `STAGE_LABELS: Record<string, string>`
  - `openWorkUnits(petitions, { now, qcBaseline }) → WorkUnit[]` โดย `WorkUnit = { petitionId, petitionNo, dept, track: 'lab'|'qc'|'final', stage, assigneeName, elapsedMin, baselineMin: number|null, overdueMin: number|null, state: 'overdue'|'atRisk'|'ok'|'unassigned'|'noBaseline' }`
  - `bottleneckCounts(units) → [{ stage, label, count }]`
  - `buildLiveSection(petitions, { now, qcBaseline, abnormalFlags }) → { counts, bottleneck, actionQueue }`

- [ ] **Step 1: เขียนเทสต์ก่อน**

สร้าง `server/lib/execSummary.test.js`:

```js
const { openWorkUnits, bottleneckCounts, buildLiveSection } = require('./execSummary');

const NOW = Date.parse('2026-07-13T10:00:00.000Z');
const hoursAgo = (h) => new Date(NOW - h * 3600000).toISOString();
const EMPTY_BASELINE = { avgMinutesByParam: {}, paramIdsByCommonName: {} };

// batch ลงท้าย '1' = lab batch (มีรางLab) · ลงท้าย '2' = QC อย่างเดียว
const labItem = { seq: 1, batchNo: 'B001', commonName: 'ยาเขียว' };
const qcItem = { seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' };

describe('openWorkUnits', () => {
  it('marks Lab testing overdue when elapsed passes the summed machine estimate', () => {
    const petition = {
      _id: 'p1', petitionNo: 'P-1', dept: 'fg', status: 'inProgress', items: [labItem],
      qcReceivedAt: hoursAgo(5), qcCompletedAt: hoursAgo(4),
      labReceivedAt: hoursAgo(5),
      assignedTo: { name: 'สมชาย', assignedAt: hoursAgo(5) },
      assignedMachines: [{ estimatedMinutes: 60 }, { estimatedMinutes: 120 }], // baseline = 180 นาที
    };
    const [unit] = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE })
      .filter((u) => u.track === 'lab');
    expect(unit.stage).toBe('labTesting');
    expect(unit.baselineMin).toBe(180);
    expect(unit.elapsedMin).toBe(300);
    expect(unit.overdueMin).toBe(120);
    expect(unit.state).toBe('overdue');
    expect(unit.assigneeName).toBe('สมชาย');
  });

  it('treats work at exactly the baseline as on time, not overdue', () => {
    const petition = {
      _id: 'p2', petitionNo: 'P-2', dept: 'fg', status: 'inProgress', items: [labItem],
      qcReceivedAt: hoursAgo(3), qcCompletedAt: hoursAgo(2),
      labReceivedAt: hoursAgo(3),
      assignedTo: { name: 'สมชาย', assignedAt: hoursAgo(3) },
      assignedMachines: [{ estimatedMinutes: 180 }],
    };
    const [unit] = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE })
      .filter((u) => u.track === 'lab');
    expect(unit.state).toBe('ok');
    expect(unit.overdueMin).toBeNull();
  });

  it('marks work at 80% of the baseline as at risk', () => {
    const petition = {
      _id: 'p3', petitionNo: 'P-3', dept: 'fg', status: 'inProgress', items: [labItem],
      qcReceivedAt: hoursAgo(4), qcCompletedAt: hoursAgo(3),
      labReceivedAt: hoursAgo(4), // 240 นาที
      assignedTo: { name: 'สมชาย', assignedAt: hoursAgo(4) },
      assignedMachines: [{ estimatedMinutes: 300 }], // 80% = 240
    };
    const [unit] = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE })
      .filter((u) => u.track === 'lab');
    expect(unit.state).toBe('atRisk');
  });

  it('reports an unassigned Lab petition older than 24h without calling it overdue', () => {
    const petition = {
      _id: 'p4', petitionNo: 'P-4', dept: 'rm', status: 'pendingReview', items: [labItem],
      qcReceivedAt: hoursAgo(30), qcCompletedAt: hoursAgo(29),
      labReceivedAt: hoursAgo(30),
    };
    const [unit] = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE })
      .filter((u) => u.track === 'lab');
    expect(unit.stage).toBe('pendingAssign');
    expect(unit.state).toBe('unassigned');
    expect(unit.baselineMin).toBeNull();
    expect(unit.overdueMin).toBeNull();
  });

  it('reports noBaseline for QC testing on a product with no history', () => {
    const petition = {
      _id: 'p5', petitionNo: 'P-5', dept: 'fg', status: 'inProgress', items: [qcItem],
      qcReceivedAt: hoursAgo(2),
    };
    const [unit] = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE });
    expect(unit.track).toBe('qc');
    expect(unit.stage).toBe('qcTesting');
    expect(unit.state).toBe('noBaseline');
  });

  it('emits a waitingFinal unit once every track the petition has is done', () => {
    const petition = {
      _id: 'p6', petitionNo: 'P-6', dept: 'fg', status: 'success', items: [qcItem],
      qcReceivedAt: hoursAgo(6), qcCompletedAt: hoursAgo(2),
    };
    const units = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE });
    expect(units).toHaveLength(1);
    expect(units[0].stage).toBe('waitingFinal');
    expect(units[0].elapsedMin).toBe(120);
  });

  it('emits waitingLabApprove while the Lab head has not released the result', () => {
    const petition = {
      _id: 'p7', petitionNo: 'P-7', dept: 'fg', status: 'inProgress', items: [labItem],
      qcReceivedAt: hoursAgo(8), qcCompletedAt: hoursAgo(7),
      labReceivedAt: hoursAgo(8), assignedTo: { name: 'ก', assignedAt: hoursAgo(8) },
      labCompletedAt: hoursAgo(3),
    };
    const stages = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE }).map((u) => u.stage);
    expect(stages).toEqual(['waitingLabApprove']);
  });

  it('ignores petitions that are already approved or rejected', () => {
    const approved = { _id: 'p8', petitionNo: 'P-8', dept: 'fg', status: 'approved', items: [qcItem], approvedAt: hoursAgo(1) };
    const rejected = { _id: 'p9', petitionNo: 'P-9', dept: 'fg', status: 'rejected', items: [qcItem] };
    expect(openWorkUnits([approved, rejected], { now: NOW, qcBaseline: EMPTY_BASELINE })).toEqual([]);
  });
});

describe('bottleneckCounts', () => {
  it('counts open units per stage in workflow order', () => {
    const units = [
      { stage: 'qcTesting' }, { stage: 'qcTesting' }, { stage: 'waitingReceive' },
    ];
    expect(bottleneckCounts(units)).toEqual([
      { stage: 'waitingReceive', label: 'รอรับตัวอย่าง', count: 1 },
      { stage: 'pendingAssign', label: 'รอ assign', count: 0 },
      { stage: 'labTesting', label: 'Lab กำลังทดสอบ', count: 0 },
      { stage: 'qcTesting', label: 'QC กำลังทดสอบ', count: 2 },
      { stage: 'waitingLabApprove', label: 'รอออกผล Lab', count: 0 },
      { stage: 'waitingFinal', label: 'รอออก Final Result', count: 0 },
    ]);
  });
});

describe('buildLiveSection', () => {
  const overdue = {
    _id: 'a', petitionNo: 'P-A', dept: 'fg', status: 'inProgress', items: [labItem], priority: 1,
    qcReceivedAt: hoursAgo(9), qcCompletedAt: hoursAgo(8),
    labReceivedAt: hoursAgo(9), assignedTo: { name: 'ก', assignedAt: hoursAgo(9) },
    assignedMachines: [{ estimatedMinutes: 60 }],
  };
  const waitingFinal = {
    _id: 'b', petitionNo: 'P-B', dept: 'fg', status: 'success', items: [qcItem],
    qcReceivedAt: hoursAgo(6), qcCompletedAt: hoursAgo(1),
  };

  it('summarizes the counts a head needs at a glance', () => {
    const live = buildLiveSection([overdue, waitingFinal], {
      now: NOW, qcBaseline: EMPTY_BASELINE, abnormalFlags: { a: true, b: false },
    });
    expect(live.counts).toEqual({
      urgent: 1, overdue: 1, atRisk: 0, waitingHead: 1, abnormal: 1, unassigned: 0,
    });
  });

  it('puts the most overdue work at the top of the action queue', () => {
    const live = buildLiveSection([waitingFinal, overdue], {
      now: NOW, qcBaseline: EMPTY_BASELINE, abnormalFlags: {},
    });
    expect(live.actionQueue.map((u) => u.petitionNo)).toEqual(['P-A', 'P-B']);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันแดง**

Run: `cd server && npx jest lib/execSummary.test.js`
Expected: FAIL — `Cannot find module './execSummary'`

- [ ] **Step 3: เขียน implementation**

สร้าง `server/lib/execSummary.js`:

```js
const { isLabBatch, isPetitionComplete } = require('./petitionStatusLog');
const { qcBaselineMinutes, qcReceivedAtOf } = require('./qcParamBaseline');

const MS_PER_MIN = 60000;
const AT_RISK_RATIO = 0.8;
const UNASSIGNED_ALERT_MIN = 24 * 60;
const ACTION_QUEUE_LIMIT = 20;

const STAGE_ORDER = [
  'waitingReceive', 'pendingAssign', 'labTesting', 'qcTesting', 'waitingLabApprove', 'waitingFinal',
];

const STAGE_LABELS = {
  waitingReceive: 'รอรับตัวอย่าง',
  pendingAssign: 'รอ assign',
  labTesting: 'Lab กำลังทดสอบ',
  qcTesting: 'QC กำลังทดสอบ',
  waitingLabApprove: 'รอออกผล Lab',
  waitingFinal: 'รอออก Final Result',
};

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function minutesSince(value, now) {
  const d = toDate(value);
  return d ? Math.max(0, (now - d.getTime()) / MS_PER_MIN) : null;
}

function hasLabTrack(petition) {
  return ((petition || {}).items || []).some((item) => isLabBatch(item.batchNo || ''));
}

/** เวลามาตรฐานของงาน Lab = ผลรวมของทุกเครื่องที่ assign (สมมติทำเรียงกัน ไม่ใช่ขนาน) */
function labBaselineMinutes(petition) {
  const machines = (petition || {}).assignedMachines || [];
  const values = machines
    .map((m) => Number(m.estimatedMinutes))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0);
}

function classify(elapsedMin, baselineMin) {
  if (baselineMin == null) return { state: 'noBaseline', overdueMin: null };
  if (elapsedMin > baselineMin) return { state: 'overdue', overdueMin: elapsedMin - baselineMin };
  if (elapsedMin >= baselineMin * AT_RISK_RATIO) return { state: 'atRisk', overdueMin: null };
  return { state: 'ok', overdueMin: null };
}

function unit(petition, track, stage, elapsedMin, baselineMin, overrideState) {
  // ด่านที่ "ไม่มีเกณฑ์เวลา" โดยธรรมชาติ (รอรับ / รอลายเซ็นหัวหน้า) ไม่ควรถูกติดป้ายว่า
  // noBaseline — มันแค่เข้าคิวรอคน ไม่ใช่ขาดข้อมูลเกณฑ์ · noBaseline สงวนไว้ให้ด่าน
  // ทดสอบที่หาเวลามาตรฐานไม่ได้จริง ๆ เท่านั้น
  const { state, overdueMin } = overrideState
    ? { state: overrideState, overdueMin: null }
    : classify(elapsedMin, baselineMin);
  return {
    petitionId: String(petition._id),
    petitionNo: petition.petitionNo,
    dept: petition.dept,
    priority: petition.priority === 1 ? 1 : 0,
    track,
    stage,
    stageLabel: STAGE_LABELS[stage],
    assigneeName: petition.assignedTo?.name || '',
    elapsedMin: Math.round(elapsedMin),
    baselineMin: baselineMin == null ? null : Math.round(baselineMin),
    overdueMin: overdueMin == null ? null : Math.round(overdueMin),
    state,
  };
}

function isOpen(petition) {
  const p = petition || {};
  return !p.approvedAt && p.status !== 'rejected' && p.status !== 'approved';
}

/** หนึ่งใบให้ได้หลาย unit ได้ — Lab กับ QC เดินขนานกัน */
function openWorkUnits(petitions, { now, qcBaseline }) {
  const units = [];

  for (const petition of petitions || []) {
    if (!isOpen(petition)) continue;

    const labTrack = hasLabTrack(petition);
    const qcReceived = qcReceivedAtOf(petition);
    const labReceived = toDate(petition.labReceivedAt);
    const assignedAt = toDate(petition.assignedTo?.assignedAt);
    const labCompleted = toDate(petition.labCompletedAt);
    const labApproved = toDate(petition.labApprovedAt);
    const qcCompleted = toDate(petition.qcCompletedAt);

    // ── Lab track
    if (labTrack) {
      if (!labReceived) {
        const elapsed = minutesSince(petition.sampleSentAt, now);
        if (elapsed != null) units.push(unit(petition, 'lab', 'waitingReceive', elapsed, null, 'ok'));
      } else if (!assignedAt) {
        const elapsed = minutesSince(labReceived, now);
        const state = elapsed >= UNASSIGNED_ALERT_MIN ? 'unassigned' : 'ok';
        units.push(unit(petition, 'lab', 'pendingAssign', elapsed, null, state));
      } else if (!labCompleted) {
        const elapsed = minutesSince(labReceived, now);
        units.push(unit(petition, 'lab', 'labTesting', elapsed, labBaselineMinutes(petition)));
      } else if (!labApproved) {
        const elapsed = minutesSince(labCompleted, now);
        units.push(unit(petition, 'lab', 'waitingLabApprove', elapsed, null, 'ok'));
      }
    }

    // ── QC track
    if (!qcReceived) {
      const elapsed = minutesSince(petition.sampleSentAt, now);
      if (elapsed != null && !labTrack) units.push(unit(petition, 'qc', 'waitingReceive', elapsed, null, 'ok'));
    } else if (!qcCompleted) {
      const elapsed = minutesSince(qcReceived, now);
      units.push(unit(petition, 'qc', 'qcTesting', elapsed, qcBaselineMinutes(petition, qcBaseline)));
    }

    // ── รอ Final Result (ทุกรางที่ใบนี้มี ทดสอบครบแล้ว)
    if (isPetitionComplete(petition)) {
      const startedAt = Math.max(
        qcCompleted ? qcCompleted.getTime() : 0,
        labApproved ? labApproved.getTime() : 0,
      );
      if (startedAt > 0) {
        units.push(unit(petition, 'final', 'waitingFinal', (now - startedAt) / MS_PER_MIN, null, 'ok'));
      }
    }
  }

  return units;
}

function bottleneckCounts(units) {
  return STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: (units || []).filter((u) => u.stage === stage).length,
  }));
}

function buildLiveSection(petitions, { now, qcBaseline, abnormalFlags = {} }) {
  const units = openWorkUnits(petitions, { now, qcBaseline });
  const openPetitions = (petitions || []).filter(isOpen);

  const counts = {
    urgent: openPetitions.filter((p) => p.priority === 1).length,
    overdue: units.filter((u) => u.state === 'overdue').length,
    atRisk: units.filter((u) => u.state === 'atRisk').length,
    unassigned: units.filter((u) => u.state === 'unassigned').length,
    waitingHead: units.filter((u) => u.stage === 'waitingLabApprove' || u.stage === 'waitingFinal').length,
    abnormal: openPetitions.filter((p) => abnormalFlags[String(p._id)]).length,
  };

  // งานที่กำลังทดสอบและยังอยู่ในเกณฑ์ (state 'ok') ไม่ต้องรบกวนหัวหน้า — แต่ด่านที่
  // "รอคนมาทำ" ต้องโผล่เสมอ แม้จะยังไม่เกินเวลา เพราะมันคือคิวที่รอการตัดสินใจ
  const QUEUE_STAGES = new Set(['waitingReceive', 'waitingLabApprove', 'waitingFinal']);

  // เรียง: เกินเวลามากสุด → ค้างไม่มี assign → เสี่ยงเลท → ที่เหลือตามอายุ
  const rank = { overdue: 0, unassigned: 1, atRisk: 2, noBaseline: 3, ok: 4 };
  const actionQueue = [...units]
    .filter((u) => u.state !== 'ok' || QUEUE_STAGES.has(u.stage))
    .sort((a, b) => {
      const byState = rank[a.state] - rank[b.state];
      if (byState !== 0) return byState;
      if (a.overdueMin != null && b.overdueMin != null) return b.overdueMin - a.overdueMin;
      return b.elapsedMin - a.elapsedMin;
    })
    .slice(0, ACTION_QUEUE_LIMIT);

  return { counts, bottleneck: bottleneckCounts(units), actionQueue };
}

module.exports = {
  STAGE_ORDER,
  STAGE_LABELS,
  ACTION_QUEUE_LIMIT,
  hasLabTrack,
  labBaselineMinutes,
  openWorkUnits,
  bottleneckCounts,
  buildLiveSection,
};
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `cd server && npx jest lib/execSummary.test.js`
Expected: PASS ทั้ง 10 เคส

- [ ] **Step 5: Commit**

```bash
git add server/lib/execSummary.js server/lib/execSummary.test.js
git commit -m "feat: compute live overdue and bottleneck work units"
```

---

### Task 4: Stats section — turnaround, throughput, quality, workload

**Files:**
- Modify: `server/lib/execSummary.js` (เพิ่มฟังก์ชัน + export)
- Modify: `server/lib/execSummary.test.js` (เพิ่ม describe block)

**Interfaces:**
- Consumes: `qcReceivedAtOf`, `qcDurationMinutes` (Task 2) · `hasLabTrack` (Task 3)
- Produces: `buildStatsSection(closedPetitions, { now, days, abnormalFlags, qcTesterNames }) → { turnaround, throughput, quality, workload }`
  - `turnaround: [{ stage, label, avgMin, p90Min, count }]`
  - `throughput: [{ date: 'YYYY-MM-DD', created, completed }]`
  - `quality: { closed, abnormal, abnormalRate, reworked, reworkRate }`
  - `workload: { lab: [{ name, active, completed, avgMinutes }], qc: [...] }`

- [ ] **Step 1: เขียนเทสต์ก่อน**

เพิ่มท้าย `server/lib/execSummary.test.js`:

```js
const { buildStatsSection, percentile } = require('./execSummary');

describe('percentile', () => {
  it('takes the nearest-rank value so p90 of ten samples is the ninth', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);
  });

  it('returns null for an empty sample set', () => {
    expect(percentile([], 0.9)).toBeNull();
  });
});

describe('buildStatsSection', () => {
  const closed = [
    {
      _id: 'd1', petitionNo: 'P-D1', dept: 'fg', status: 'approved',
      items: [{ seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' }],
      createdAt: '2026-07-11T00:00:00.000Z',
      sampleSentAt: '2026-07-11T00:00:00.000Z',
      qcReceivedAt: '2026-07-11T01:00:00.000Z',   // รอรับ 60 นาที
      qcCompletedAt: '2026-07-11T03:00:00.000Z',  // ทดสอบ 120 นาที
      approvedAt: '2026-07-11T04:00:00.000Z',     // รอ final 60 นาที
      assignedTo: { name: 'สมชาย', assignedAt: '2026-07-11T01:00:00.000Z' },
    },
    {
      _id: 'd2', petitionNo: 'P-D2', dept: 'fg', status: 'approved',
      items: [{ seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' }],
      createdAt: '2026-07-12T00:00:00.000Z',
      sampleSentAt: '2026-07-12T00:00:00.000Z',
      qcReceivedAt: '2026-07-12T03:00:00.000Z',   // รอรับ 180 นาที
      qcCompletedAt: '2026-07-12T04:00:00.000Z',  // ทดสอบ 60 นาที
      approvedAt: '2026-07-12T05:00:00.000Z',
      revisionOf: 'old-one',                      // ใบนี้เป็นงานทำใหม่
    },
  ];

  const opts = {
    now: Date.parse('2026-07-13T10:00:00.000Z'),
    days: 7,
    abnormalFlags: { d1: true, d2: false },
    qcTesterNames: { d1: ['สมหญิง'], d2: ['สมหญิง'] },
  };

  it('averages each stage across the closed petitions', () => {
    const { turnaround } = buildStatsSection(closed, opts);
    const receive = turnaround.find((t) => t.stage === 'waitingReceive');
    expect(receive.avgMin).toBe(120); // (60 + 180) / 2
    expect(receive.count).toBe(2);
    const qcTesting = turnaround.find((t) => t.stage === 'qcTesting');
    expect(qcTesting.avgMin).toBe(90); // (120 + 60) / 2
  });

  it('reports one throughput row per day in the window, newest last', () => {
    const { throughput } = buildStatsSection(closed, opts);
    expect(throughput).toHaveLength(7);
    expect(throughput.at(-1).date).toBe('2026-07-13');
    expect(throughput.find((d) => d.date === '2026-07-11')).toEqual({ date: '2026-07-11', created: 1, completed: 1 });
  });

  it('derives abnormal and rework rates from the closed set', () => {
    const { quality } = buildStatsSection(closed, opts);
    expect(quality).toEqual({ closed: 2, abnormal: 1, abnormalRate: 0.5, reworked: 1, reworkRate: 0.5 });
  });

  it('splits workload between the Lab assignee and the QC testers', () => {
    const { workload } = buildStatsSection(closed, opts);
    expect(workload.lab).toEqual([{ name: 'สมชาย', completed: 1, avgMinutes: 240 }]);
    expect(workload.qc).toEqual([{ name: 'สมหญิง', completed: 2, avgMinutes: 90 }]);
  });

  it('returns empty structures when nothing closed in the window', () => {
    const { turnaround, quality, workload } = buildStatsSection([], opts);
    expect(turnaround.every((t) => t.count === 0 && t.avgMin === null)).toBe(true);
    expect(quality).toEqual({ closed: 0, abnormal: 0, abnormalRate: 0, reworked: 0, reworkRate: 0 });
    expect(workload).toEqual({ lab: [], qc: [] });
  });
});
```

หมายเหตุค่าที่คาดหวัง: `workload.lab[0].avgMinutes = 240` คือเวลารวมของใบ d1 (`createdAt` → `approvedAt` = 4 ชม.) · `workload.qc[0].avgMinutes = 90` คือค่าเฉลี่ยเวลา QC ของ d1 (120) กับ d2 (60)

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันแดง**

Run: `cd server && npx jest lib/execSummary.test.js`
Expected: FAIL — `buildStatsSection is not a function`

- [ ] **Step 3: เขียน implementation**

เพิ่มใน `server/lib/execSummary.js` (ก่อน `module.exports`) — และเพิ่ม `qcDurationMinutes` เข้าไปใน require บรรทัดบนสุดของไฟล์:

```js
const { qcBaselineMinutes, qcReceivedAtOf, qcDurationMinutes } = require('./qcParamBaseline');
```

```js
function diffMinutes(from, to) {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return null;
  const minutes = (b.getTime() - a.getTime()) / MS_PER_MIN;
  return minutes >= 0 ? minutes : null;
}

/** nearest-rank percentile — p90 ของ 10 ตัวอย่าง = ตัวที่ 9 (เรียงน้อยไปมาก) */
function percentile(values, ratio) {
  const list = (values || []).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!list.length) return null;
  const rank = Math.max(1, Math.ceil(ratio * list.length));
  return list[rank - 1];
}

function localDateKey(ms) {
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** เวลาที่แต่ละใบใช้ในแต่ละด่าน — ใบที่ timestamp ไม่ครบจะไม่ถูกนับในด่านนั้น (ไม่ทำให้ค่าเฉลี่ยเป็น NaN) */
function stageDurations(petition) {
  const qcReceived = qcReceivedAtOf(petition);
  const labTrack = hasLabTrack(petition);
  return {
    waitingReceive: diffMinutes(petition.sampleSentAt, labTrack ? petition.labReceivedAt : qcReceived),
    pendingAssign: labTrack ? diffMinutes(petition.labReceivedAt, petition.assignedTo?.assignedAt) : null,
    labTesting: labTrack ? diffMinutes(petition.labReceivedAt, petition.labCompletedAt) : null,
    qcTesting: qcDurationMinutes(petition),
    waitingLabApprove: labTrack ? diffMinutes(petition.labCompletedAt, petition.labApprovedAt) : null,
    waitingFinal: diffMinutes(
      labTrack ? petition.labApprovedAt : petition.qcCompletedAt,
      petition.approvedAt,
    ),
  };
}

function totalMinutes(petition) {
  return diffMinutes(petition.createdAt, petition.approvedAt);
}

function averageOf(values) {
  const list = (values || []).filter((n) => Number.isFinite(n));
  if (!list.length) return null;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

function round(value) {
  return value == null ? null : Math.round(value);
}

function buildStatsSection(closedPetitions, { now, days, abnormalFlags = {}, qcTesterNames = {} }) {
  const petitions = closedPetitions || [];

  // ── turnaround ต่อด่าน
  const samplesByStage = Object.fromEntries(STAGE_ORDER.map((stage) => [stage, []]));
  for (const petition of petitions) {
    const durations = stageDurations(petition);
    for (const stage of STAGE_ORDER) {
      const value = durations[stage];
      if (value != null) samplesByStage[stage].push(value);
    }
  }
  const turnaround = STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    avgMin: round(averageOf(samplesByStage[stage])),
    p90Min: round(percentile(samplesByStage[stage], 0.9)),
    count: samplesByStage[stage].length,
  }));

  // ── throughput รายวัน (วันนี้อยู่ท้ายสุด)
  const buckets = new Map();
  for (let i = days - 1; i >= 0; i -= 1) {
    buckets.set(localDateKey(now - i * 86400000), { created: 0, completed: 0 });
  }
  for (const petition of petitions) {
    const createdKey = petition.createdAt ? localDateKey(new Date(petition.createdAt).getTime()) : null;
    if (createdKey && buckets.has(createdKey)) buckets.get(createdKey).created += 1;
    const doneKey = petition.approvedAt ? localDateKey(new Date(petition.approvedAt).getTime()) : null;
    if (doneKey && buckets.has(doneKey)) buckets.get(doneKey).completed += 1;
  }
  const throughput = Array.from(buckets, ([date, value]) => ({ date, ...value }));

  // ── คุณภาพ
  const closed = petitions.length;
  const abnormal = petitions.filter((p) => abnormalFlags[String(p._id)]).length;
  const reworked = petitions.filter((p) => !!p.revisionOf).length;
  const quality = {
    closed,
    abnormal,
    abnormalRate: closed ? abnormal / closed : 0,
    reworked,
    reworkRate: closed ? reworked / closed : 0,
  };

  // ── ภาระงานต่อคน
  const labByName = new Map();
  const qcByName = new Map();
  const push = (map, name, minutes) => {
    if (!name) return;
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(minutes);
  };
  for (const petition of petitions) {
    push(labByName, petition.assignedTo?.name, totalMinutes(petition));
    for (const name of qcTesterNames[String(petition._id)] || []) {
      push(qcByName, name, qcDurationMinutes(petition));
    }
  }
  const toWorkloadRows = (map) => Array.from(map, ([name, samples]) => ({
    name,
    completed: samples.length,
    avgMinutes: round(averageOf(samples)),
  })).sort((a, b) => b.completed - a.completed);

  return {
    turnaround,
    throughput,
    quality,
    workload: { lab: toWorkloadRows(labByName), qc: toWorkloadRows(qcByName) },
  };
}
```

เพิ่มใน `module.exports`: `buildStatsSection`, `percentile`, `stageDurations`

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `cd server && npx jest lib/execSummary.test.js`
Expected: PASS ทุกเคส (ทั้งของ Task 3 และของ Task 4)

- [ ] **Step 5: Commit**

```bash
git add server/lib/execSummary.js server/lib/execSummary.test.js
git commit -m "feat: compute exec turnaround, throughput, quality and workload stats"
```

---

### Task 5: `GET /petitions/exec-summary` + `?ids=` filter

**Files:**
- Modify: `server/routes/petitions.js:76-127` (เพิ่ม `?ids=` ใน list route), `server/routes/petitions.js:128` (แทรก route ใหม่ก่อน `/:id`)

**Interfaces:**
- Consumes: `buildLiveSection`, `buildStatsSection` (Task 3–4) · `buildQcParamBaseline` (Task 2) · `computeAbnormalFlags` (Task 1)
- Produces: `GET /petitions/exec-summary?days=7|30|90` → `{ generatedAt, days, live, stats }` · `GET /petitions?ids=a,b,c` → เฉพาะใบที่ระบุ (ข้าม pagination)

**หมายเหตุลำดับ route:** Express จับคู่ตามลำดับที่ประกาศ — `/exec-summary` **ต้องอยู่เหนือ** `router.get('/:id')` ไม่งั้นจะถูกอ่านเป็น id

- [ ] **Step 1: เพิ่ม `?ids=` ใน list route**

ใน `server/routes/petitions.js` ภายใน `router.get('/')` ใส่ต่อจากบล็อก `if (search) {...}`:

```js
    // ?ids=a,b,c → ดึงเฉพาะใบที่ระบุ (ใช้โดยการไฮไลท์จากแดชบอร์ด) — ไม่แบ่งหน้า
    const idsRaw = String(req.query.ids || '').trim();
    if (idsRaw) {
      const ids = idsRaw.split(',').map((s) => s.trim()).filter((s) => mongoose.isValidObjectId(s));
      if (ids.length === 0) return res.json({ items: [], total: 0, page: 1, limit: 0 });
      const docs = await Petition.find({ _id: { $in: ids } }).sort({ createdAt: -1 });
      const items = docs.map((doc) => doc.toObject());
      return res.json({ items, total: items.length, page: 1, limit: items.length });
    }
```

- [ ] **Step 2: เพิ่ม route exec-summary**

แทรก **ก่อน** `router.get('/submitted-orders', ...)` (บรรทัด 128) ใน `server/routes/petitions.js`:

```js
const { buildLiveSection, buildStatsSection } = require('../lib/execSummary');
const { buildQcParamBaseline } = require('../lib/qcParamBaseline');
const { computeAbnormalFlags } = require('../lib/abnormalFlags');

const EXEC_DAYS_ALLOWED = [7, 30, 90];
const EXEC_CACHE_MS = 60 * 1000;
const QC_BASELINE_CACHE_MS = 10 * 60 * 1000;
const QC_BASELINE_LOOKBACK_DAYS = 180;
const execCache = new Map();   // days → { at, payload }
let qcBaselineCache = null;    // { at, value } — ค่าเฉลี่ยย้อนหลัง 180 วัน ไม่ต้อง real-time

// ค่าเฉลี่ยเวลา QC ต่อ parameter สแกนงานย้อนหลัง 180 วัน จึงแพงเกินกว่าจะคิดใหม่ทุกนาที
async function loadQcBaseline(now) {
  if (qcBaselineCache && now - qcBaselineCache.at < QC_BASELINE_CACHE_MS) return qcBaselineCache.value;

  const baselineStart = new Date(now - QC_BASELINE_LOOKBACK_DAYS * 86400000);
  const baselineDocs = await Petition.find({ qcCompletedAt: { $gte: baselineStart } }, {
    items: 1, qcReceivedAt: 1, qcCompletedAt: 1, receivedAt: 1, labReceivedAt: 1,
  }).lean();

  const baselineIds = baselineDocs.map((p) => String(p._id));
  const baselineResults = baselineIds.length
    ? await QCTestResult.find(
      { petitionId: { $in: baselineIds } },
      { petitionId: 1, parameterId: 1, parameterName: 1, commonName: 1 },
    ).lean()
    : [];

  const value = buildQcParamBaseline(baselineDocs, baselineResults);
  qcBaselineCache = { at: now, value };
  return value;
}

// GET /api/petitions/exec-summary?days=7|30|90 — ตัวเลขสำหรับแดชบอร์ดผู้บริหาร
router.get('/exec-summary', async (req, res) => {
  try {
    const requested = Number(req.query.days);
    const days = EXEC_DAYS_ALLOWED.includes(requested) ? requested : 30;

    const cached = execCache.get(days);
    const now = Date.now();
    if (cached && now - cached.at < EXEC_CACHE_MS) return res.json(cached.payload);

    const windowStart = new Date(now - days * 86400000);

    const [openDocs, closedDocs, qcBaseline] = await Promise.all([
      // งานที่ยังไม่ปิด — ไม่จำกัดช่วงเวลา เพราะงานค้างเก่าคือสิ่งที่หัวหน้าต้องเห็นที่สุด
      Petition.find({ approvedAt: null, status: { $nin: ['approved', 'rejected'] } }).lean(),
      Petition.find({ approvedAt: { $gte: windowStart } }).lean(),
      loadQcBaseline(now),
    ]);

    // abnormal flags ใช้สูตรเดียวกับ badge ในหน้ารายการ (lib เดียวกัน)
    const flagIds = [...openDocs, ...closedDocs].map((p) => String(p._id));
    const flagResults = flagIds.length
      ? await QCTestResult.find(
        { petitionId: { $in: flagIds } },
        { petitionId: 1, parameterId: 1, itemSeq: 1, commonName: 1, values: 1, entries: 1 },
      ).lean()
      : [];
    const paramIds = Array.from(new Set(flagResults.map((d) => String(d.parameterId))));
    const params = paramIds.length
      ? await Parameter.find({ _id: { $in: paramIds } }, { valueFields: 1, multiEntry: 1 }).lean()
      : [];
    const abnormalFlags = computeAbnormalFlags({
      docs: flagResults,
      params,
      petitions: [...openDocs, ...closedDocs],
    });

    // ผู้บันทึกผล QC ต่อใบ — ตรรกะเดียวกับ /qc-results/testers (ผู้แก้ล่าสุดคือเจ้าของ)
    const qcTesterNames = {};
    for (const row of flagResults) qcTesterNames[row.petitionId] ??= [];
    const testerDocs = flagIds.length
      ? await QCTestResult.find(
        { petitionId: { $in: closedDocs.map((p) => String(p._id)) } },
        { petitionId: 1, enteredBy: 1, updatedBy: 1 },
      ).lean()
      : [];
    for (const row of testerDocs) {
      const name = row.updatedBy?.name || row.enteredBy?.name;
      if (!name) continue;
      qcTesterNames[row.petitionId] ??= [];
      if (!qcTesterNames[row.petitionId].includes(name)) qcTesterNames[row.petitionId].push(name);
    }

    const payload = {
      generatedAt: new Date(now).toISOString(),
      days,
      live: buildLiveSection(openDocs, { now, qcBaseline, abnormalFlags }),
      stats: buildStatsSection(closedDocs, { now, days, abnormalFlags, qcTesterNames }),
    };

    execCache.set(days, { at: now, payload });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});
```

- [ ] **Step 3: ตรวจว่า route ตอบจริง (server ต้องรันอยู่)**

Run: `curl -s "http://localhost:3001/api/petitions/exec-summary?days=7" | head -c 400`
Expected: JSON ที่ขึ้นต้นด้วย `{"generatedAt":"...","days":7,"live":{"counts":{...`

ถ้า server ยังไม่รัน: `cd server && npm run dev` ในอีกเทอร์มินัลก่อน

- [ ] **Step 4: ตรวจว่า `days` แปลก ๆ ถูกปัดเป็น 30 และ `?ids=` ทำงาน**

Run: `curl -s "http://localhost:3001/api/petitions/exec-summary?days=999" | head -c 60`
Expected: `{"generatedAt":"...","days":30,...` — ไม่ error

Run: `curl -s "http://localhost:3001/api/petitions?ids=000000000000000000000000" | head -c 80`
Expected: `{"items":[],"total":0,...}` — ไม่ error

- [ ] **Step 5: รันเทสต์ server ทั้งชุด**

Run: `cd server && npx jest`
Expected: PASS ทั้งหมด

- [ ] **Step 6: Commit**

```bash
git add server/routes/petitions.js
git commit -m "feat: serve exec-summary endpoint and petition ids filter"
```

---

### Task 6: Frontend data layer

**Files:**
- Create: `src/lib/execSummary.ts`
- Create: `src/lib/execSummary.test.ts`
- Create: `src/hooks/useExecSummary.ts`

**Interfaces:**
- Consumes: response ของ `GET /petitions/exec-summary` (Task 5)
- Produces:
  - types: `ExecSummary`, `ExecWorkUnit`, `ExecPeriod = 7 | 30 | 90`
  - `formatMinutes(min: number): string` → `"6 ชม. 20 น."` / `"45 น."` / `"2 วัน 3 ชม."`
  - `highlightPath(ids: string[]): string` → `/petitions?highlight=a,b`
  - `useExecSummary(): { data, isLoading, isError, period, setPeriod }`

- [ ] **Step 1: เขียนเทสต์ก่อน**

สร้าง `src/lib/execSummary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatMinutes, highlightPath } from "./execSummary";

describe("formatMinutes", () => {
  it("shows minutes only under an hour", () => {
    expect(formatMinutes(45)).toBe("45 น.");
  });

  it("shows hours and minutes under a day", () => {
    expect(formatMinutes(380)).toBe("6 ชม. 20 น.");
  });

  it("drops the minute part when it lands on a whole hour", () => {
    expect(formatMinutes(120)).toBe("2 ชม.");
  });

  it("switches to days once past 24 hours", () => {
    expect(formatMinutes(3060)).toBe("2 วัน 3 ชม.");
  });

  it("floors anything under a minute to zero", () => {
    expect(formatMinutes(0.4)).toBe("0 น.");
  });
});

describe("highlightPath", () => {
  it("builds a petition-list link carrying every id", () => {
    expect(highlightPath(["a", "b"])).toBe("/petitions?highlight=a,b");
  });

  it("returns the plain list when there is nothing to highlight", () => {
    expect(highlightPath([])).toBe("/petitions");
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันแดง**

Run: `npx vitest run src/lib/execSummary.test.ts`
Expected: FAIL — ไม่มีไฟล์ `./execSummary`

- [ ] **Step 3: เขียน implementation**

สร้าง `src/lib/execSummary.ts`:

```ts
export type ExecPeriod = 7 | 30 | 90;

export type ExecStage =
  | "waitingReceive" | "pendingAssign" | "labTesting"
  | "qcTesting" | "waitingLabApprove" | "waitingFinal";

export type ExecWorkState = "overdue" | "atRisk" | "ok" | "unassigned" | "noBaseline";

export interface ExecWorkUnit {
  petitionId: string;
  petitionNo: string;
  dept: string;
  priority: 0 | 1;
  track: "lab" | "qc" | "final";
  stage: ExecStage;
  stageLabel: string;
  assigneeName: string;
  elapsedMin: number;
  baselineMin: number | null;
  overdueMin: number | null;
  state: ExecWorkState;
}

export interface ExecSummary {
  generatedAt: string;
  days: ExecPeriod;
  live: {
    counts: {
      urgent: number; overdue: number; atRisk: number;
      unassigned: number; waitingHead: number; abnormal: number;
    };
    bottleneck: { stage: ExecStage; label: string; count: number }[];
    actionQueue: ExecWorkUnit[];
  };
  stats: {
    turnaround: { stage: ExecStage; label: string; avgMin: number | null; p90Min: number | null; count: number }[];
    throughput: { date: string; created: number; completed: number }[];
    quality: { closed: number; abnormal: number; abnormalRate: number; reworked: number; reworkRate: number };
    workload: {
      lab: { name: string; completed: number; avgMinutes: number | null }[];
      qc: { name: string; completed: number; avgMinutes: number | null }[];
    };
  };
}

export function formatMinutes(minutes: number): string {
  const total = Math.floor(Math.max(0, minutes));
  if (total < 60) return `${total} น.`;
  if (total < 1440) {
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return rest === 0 ? `${hours} ชม.` : `${hours} ชม. ${rest} น.`;
  }
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  return hours === 0 ? `${days} วัน` : `${days} วัน ${hours} ชม.`;
}

export function highlightPath(ids: string[]): string {
  return ids.length ? `/petitions?highlight=${ids.join(",")}` : "/petitions";
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/execSummary.test.ts`
Expected: PASS ทั้ง 7 เคส

- [ ] **Step 5: เขียน hook**

สร้าง `src/hooks/useExecSummary.ts`:

```ts
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ExecPeriod, ExecSummary } from "@/lib/execSummary";

const API_BASE = import.meta.env.BASE_URL + "api";

export function useExecSummary() {
  const [period, setPeriod] = useState<ExecPeriod>(30);

  const query = useQuery<ExecSummary>({
    queryKey: ["exec-summary", period],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/petitions/exec-summary?days=${period}`, { cache: "no-store" });
      if (!res.ok) throw new Error("exec-summary failed");
      return (await res.json()) as ExecSummary;
    },
    staleTime: 60_000,
  });

  return { ...query, period, setPeriod };
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ในไฟล์ที่เพิ่งสร้าง (repo มี latent error เดิมอยู่ — เทียบกับ baseline ก่อนเริ่ม task)

- [ ] **Step 7: Commit**

```bash
git add src/lib/execSummary.ts src/lib/execSummary.test.ts src/hooks/useExecSummary.ts
git commit -m "feat: add exec summary types, formatter and query hook"
```

---

### Task 7: Exec dashboard — alert strip, action queue, bottleneck

**Files:**
- Create: `src/components/dashboard/exec/AlertStrip.tsx`
- Create: `src/components/dashboard/exec/BottleneckBars.tsx`
- Create: `src/components/dashboard/exec/ActionQueue.tsx`
- Create: `src/components/dashboard/exec/ExecDashboard.tsx`
- Create: `src/components/dashboard/exec/ActionQueue.test.tsx`
- Create: `src/components/dashboard/exec/AlertStrip.test.tsx`
- Modify: `src/pages/RoleDashboard.tsx` (แตกไป `<ExecDashboard/>` เมื่อ `profileId === "admin"`)
- Modify: `src/lib/dashboardProfiles.ts` (แก้ `admin` profile: `titleEn`/`subtitleTh`, ตัด KPI ผู้ใช้/role ออก)
- Modify: `src/lib/dashboardProfiles.test.ts` (ยืนยันว่า admin ไม่มี KPI ผู้ใช้แล้ว)

**Interfaces:**
- Consumes: `useExecSummary` (Task 6), `formatMinutes`, `highlightPath`, `ExecSummary`
- Produces: `<ExecDashboard/>` (default export) — พร้อมให้ Task 8 เติมบล็อกล่าง

- [ ] **Step 1: เขียนเทสต์ก่อน**

สร้าง `src/components/dashboard/exec/AlertStrip.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import AlertStrip from "./AlertStrip";

const counts = { urgent: 3, overdue: 7, atRisk: 5, unassigned: 2, waitingHead: 4, abnormal: 1 };

describe("AlertStrip", () => {
  it("shows every headline count", () => {
    render(<MemoryRouter><AlertStrip counts={counts} overdueIds={[]} /></MemoryRouter>);
    expect(screen.getByText("เกินเวลา").closest("a")).toHaveTextContent("7");
    expect(screen.getByText("รอมือหัวหน้า").closest("a")).toHaveTextContent("4");
  });

  it("links the overdue tile to the petition list with those ids highlighted", () => {
    render(<MemoryRouter><AlertStrip counts={counts} overdueIds={["a", "b"]} /></MemoryRouter>);
    expect(screen.getByText("เกินเวลา").closest("a")).toHaveAttribute("href", "/petitions?highlight=a,b");
  });
});
```

สร้าง `src/components/dashboard/exec/ActionQueue.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ActionQueue from "./ActionQueue";
import type { ExecWorkUnit } from "@/lib/execSummary";

const unit = (over: Partial<ExecWorkUnit>): ExecWorkUnit => ({
  petitionId: "id", petitionNo: "P-1", dept: "fg", priority: 0, track: "lab",
  stage: "labTesting", stageLabel: "Lab กำลังทดสอบ", assigneeName: "สมชาย",
  elapsedMin: 300, baselineMin: 180, overdueMin: 120, state: "overdue", ...over,
});

describe("ActionQueue", () => {
  it("renders the overdue amount in Thai duration form", () => {
    render(<MemoryRouter><ActionQueue units={[unit({})]} /></MemoryRouter>);
    expect(screen.getByText("เกิน 2 ชม.")).toBeInTheDocument();
  });

  it("explains why work with no baseline is listed instead of showing an overdue figure", () => {
    render(<MemoryRouter><ActionQueue units={[unit({
      petitionNo: "P-2", state: "unassigned", stage: "pendingAssign", stageLabel: "รอ assign",
      baselineMin: null, overdueMin: null, assigneeName: "", elapsedMin: 1860,
    })]} /></MemoryRouter>);
    expect(screen.getByText("ยังไม่ assign 1 วัน 7 ชม.")).toBeInTheDocument();
  });

  it("links each row to the petition list highlighting that petition", () => {
    render(<MemoryRouter><ActionQueue units={[unit({ petitionId: "x1" })]} /></MemoryRouter>);
    const row = screen.getByText("P-1").closest("tr")!;
    expect(within(row).getByRole("link")).toHaveAttribute("href", "/petitions?highlight=x1");
  });

  it("shows an empty state when nothing needs attention", () => {
    render(<MemoryRouter><ActionQueue units={[]} /></MemoryRouter>);
    expect(screen.getByText("ไม่มีงานค้างที่ต้องจัดการ")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันแดง**

Run: `npx vitest run src/components/dashboard/exec`
Expected: FAIL — import ไม่เจอไฟล์

- [ ] **Step 3: เขียน AlertStrip**

สร้าง `src/components/dashboard/exec/AlertStrip.tsx`:

```tsx
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, Flame, ShieldCheck, UserX, Activity } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { highlightPath, type ExecSummary } from "@/lib/execSummary";

type Counts = ExecSummary["live"]["counts"];

interface Props {
  counts: Counts;
  overdueIds: string[];
  atRiskIds?: string[];
  waitingHeadIds?: string[];
  urgentIds?: string[];
  abnormalIds?: string[];
  unassignedIds?: string[];
}

const TONE: Record<string, string> = {
  red: "border-red-200 bg-red-50 text-red-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
};

function Tile({ label, value, icon: Icon, tone, to }: {
  label: string; value: number; icon: LucideIcon; tone: keyof typeof TONE; to: string;
}) {
  return (
    <Link to={to} className="flex-1 min-w-[140px]">
      <Card className={cn("flex items-center gap-3 border p-3 transition hover:shadow-md", TONE[tone])}>
        <Icon className="h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="truncate text-xs">{label}</div>
        </div>
      </Card>
    </Link>
  );
}

export default function AlertStrip({
  counts, overdueIds, atRiskIds = [], waitingHeadIds = [],
  urgentIds = [], abnormalIds = [], unassignedIds = [],
}: Props) {
  return (
    <div className="mb-4 flex flex-wrap gap-3">
      <Tile label="งานด่วน" value={counts.urgent} icon={Flame} tone="red" to={highlightPath(urgentIds)} />
      <Tile label="เกินเวลา" value={counts.overdue} icon={Clock} tone="red" to={highlightPath(overdueIds)} />
      <Tile label="เสี่ยงเลท" value={counts.atRisk} icon={Activity} tone="amber" to={highlightPath(atRiskIds)} />
      <Tile label="ยังไม่ assign" value={counts.unassigned} icon={UserX} tone="amber" to={highlightPath(unassignedIds)} />
      <Tile label="รอมือหัวหน้า" value={counts.waitingHead} icon={ShieldCheck} tone="blue" to={highlightPath(waitingHeadIds)} />
      <Tile label="ผลผิดปกติ" value={counts.abnormal} icon={AlertTriangle} tone="red" to={highlightPath(abnormalIds)} />
    </div>
  );
}
```

- [ ] **Step 4: เขียน ActionQueue**

สร้าง `src/components/dashboard/exec/ActionQueue.tsx`:

```tsx
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PETITION_DEPT_LABELS, type PetitionDept } from "@/types/petition.types";
import { formatMinutes, highlightPath, type ExecWorkUnit } from "@/lib/execSummary";

const REASON: Record<ExecWorkUnit["state"], (u: ExecWorkUnit) => string> = {
  overdue: (u) => `เกิน ${formatMinutes(u.overdueMin ?? 0)}`,
  atRisk: (u) => `ใกล้ครบเกณฑ์ (${formatMinutes(u.elapsedMin)} จาก ${formatMinutes(u.baselineMin ?? 0)})`,
  unassigned: (u) => `ยังไม่ assign ${formatMinutes(u.elapsedMin)}`,
  noBaseline: (u) => `ยังไม่มีเกณฑ์เวลา · ค้าง ${formatMinutes(u.elapsedMin)}`,
  ok: (u) => `ค้าง ${formatMinutes(u.elapsedMin)}`,
};

const REASON_TONE: Record<ExecWorkUnit["state"], string> = {
  overdue: "text-red-600 font-medium",
  atRisk: "text-amber-600",
  unassigned: "text-amber-600",
  noBaseline: "text-muted-foreground",
  ok: "text-muted-foreground",
};

export default function ActionQueue({ units }: { units: ExecWorkUnit[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">งานที่ต้องจัดการ</CardTitle>
      </CardHeader>
      <CardContent>
        {units.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีงานค้างที่ต้องจัดการ</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2">เลขคำขอ</th>
                <th>แผนก</th>
                <th>ด่านที่ติด</th>
                <th>ผู้รับผิดชอบ</th>
                <th>สถานะเวลา</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={`${u.petitionId}-${u.track}`} className="border-b last:border-0">
                  <td className="py-2 font-medium">
                    {u.petitionNo}
                    {u.priority === 1 ? <Badge variant="destructive" className="ml-2">ด่วน</Badge> : null}
                  </td>
                  <td>{PETITION_DEPT_LABELS[u.dept as PetitionDept] ?? u.dept}</td>
                  <td>{u.stageLabel}</td>
                  <td>{u.assigneeName || "—"}</td>
                  <td className={REASON_TONE[u.state]}>{REASON[u.state](u)}</td>
                  <td className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link to={highlightPath([u.petitionId])}>ดู</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: เขียน BottleneckBars**

สร้าง `src/components/dashboard/exec/BottleneckBars.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExecSummary } from "@/lib/execSummary";

export default function BottleneckBars({ rows }: { rows: ExecSummary["live"]["bottleneck"] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">คอขวดตอนนี้</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={row.stage}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium">{row.count}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: เขียน ExecDashboard (ครึ่งบน — ครึ่งล่างมาใน Task 8)**

สร้าง `src/components/dashboard/exec/ExecDashboard.tsx`:

```tsx
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useExecSummary } from "@/hooks/useExecSummary";
import type { ExecPeriod, ExecWorkUnit } from "@/lib/execSummary";
import AlertStrip from "./AlertStrip";
import ActionQueue from "./ActionQueue";
import BottleneckBars from "./BottleneckBars";

const PERIODS: ExecPeriod[] = [7, 30, 90];

const idsWhere = (units: ExecWorkUnit[], match: (u: ExecWorkUnit) => boolean) =>
  Array.from(new Set(units.filter(match).map((u) => u.petitionId)));

export default function ExecDashboard() {
  const { data, isLoading, isError, period, setPeriod } = useExecSummary();

  if (isError) {
    return (
      <>
        <DashboardHeader titleEn="Executive Dashboard" subtitleTh="ภาพรวม Lab + QC" />
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          โหลดข้อมูลไม่สำเร็จ · ลองรีเฟรชหน้าอีกครั้ง
        </CardContent></Card>
      </>
    );
  }

  const queue = data?.live.actionQueue ?? [];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <DashboardHeader titleEn="Executive Dashboard" subtitleTh="ภาพรวม Lab + QC" />
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={p === period ? "default" : "outline"}
              onClick={() => setPeriod(p)}
            >
              {p} วัน
            </Button>
          ))}
        </div>
      </div>

      {isLoading || !data ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          กำลังโหลด…
        </CardContent></Card>
      ) : (
        <>
          <AlertStrip
            counts={data.live.counts}
            overdueIds={idsWhere(queue, (u) => u.state === "overdue")}
            atRiskIds={idsWhere(queue, (u) => u.state === "atRisk")}
            unassignedIds={idsWhere(queue, (u) => u.state === "unassigned")}
            waitingHeadIds={idsWhere(queue, (u) => u.stage === "waitingLabApprove" || u.stage === "waitingFinal")}
            urgentIds={idsWhere(queue, (u) => u.priority === 1)}
          />
          <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,65fr)_35fr]">
            <ActionQueue units={queue} />
            <BottleneckBars rows={data.live.bottleneck} />
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 7: ต่อเข้ากับ RoleDashboard**

ใน `src/pages/RoleDashboard.tsx` เพิ่ม import:

```tsx
import ExecDashboard from "@/components/dashboard/exec/ExecDashboard";
```

แล้ววาง early-return **ต่อจากบล็อก `if (!profileId || !profile)`** (บรรทัด ~330 — หลัง hooks ทั้งหมด เพื่อไม่ให้ผิดกฎ hooks):

```tsx
  if (profileId === "admin") {
    return (
      <AppLayout>
        <ExecDashboard />
      </AppLayout>
    );
  }
```

- [ ] **Step 8: ปรับ admin profile ใน registry**

ใน `src/lib/dashboardProfiles.ts` เปลี่ยน entry `admin` เป็น:

```ts
  admin: {
    id: "admin", titleEn: "Executive Dashboard", subtitleTh: "ภาพรวม Lab + QC",
    kpis: [],
    workflow: null,
    analytics: [],
    activity: "audit",
  },
```

(`ExecDashboard` ไม่อ่าน field เหล่านี้ — ทำให้ว่างเพื่อไม่ให้ `useDashboardData` ยิง query ที่ไม่ได้ใช้ · ถ้างาน urgent-priority ลง `urgentTotal` ไว้ที่ตำแหน่งแรกของทุก profile ให้คงไว้เป็น `kpis: ["urgentTotal"]` และปล่อยที่เหลือว่าง)

เพิ่มเทสต์ใน `src/lib/dashboardProfiles.test.ts`:

```ts
it("keeps user-admin KPIs off the exec dashboard", () => {
  expect(DASHBOARD_PROFILES.admin.kpis).not.toContain("usersTotal");
  expect(DASHBOARD_PROFILES.admin.kpis).not.toContain("rolesTotal");
  expect(DASHBOARD_PROFILES.admin.titleEn).toBe("Executive Dashboard");
});
```

- [ ] **Step 9: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/components/dashboard/exec src/lib/dashboardProfiles.test.ts src/pages/RoleDashboard.test.tsx`
Expected: PASS ทั้งหมด — RoleDashboard เดิมต้องไม่พัง (profile อื่นเดินเส้นทางเดิม)

- [ ] **Step 10: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จากไฟล์ที่แตะใน task นี้

- [ ] **Step 11: Commit**

```bash
git add src/components/dashboard/exec src/pages/RoleDashboard.tsx src/lib/dashboardProfiles.ts src/lib/dashboardProfiles.test.ts
git commit -m "feat: render exec dashboard alert strip, action queue and bottlenecks"
```

---

### Task 8: Exec dashboard — turnaround, throughput, quality, workload, stock

**Files:**
- Create: `src/components/dashboard/exec/TurnaroundChart.tsx`
- Create: `src/components/dashboard/exec/ThroughputChart.tsx`
- Create: `src/components/dashboard/exec/QualityPanel.tsx`
- Create: `src/components/dashboard/exec/TeamWorkloadPanel.tsx`
- Create: `src/components/dashboard/exec/QualityPanel.test.tsx`
- Modify: `src/components/dashboard/exec/ExecDashboard.tsx` (ต่อบล็อกล่าง + การ์ดสต๊อก)

**Interfaces:**
- Consumes: `data.stats` จาก `useExecSummary` · `LabInventorySummaryCard` + `useDashboardData` ที่มีอยู่แล้ว
- Produces: บล็อก ④⑤⑥⑦⑧ ตามสเปก

- [ ] **Step 1: เขียนเทสต์ก่อน**

สร้าง `src/components/dashboard/exec/QualityPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import QualityPanel from "./QualityPanel";

describe("QualityPanel", () => {
  it("shows abnormal and rework as whole-number percentages", () => {
    render(<QualityPanel quality={{ closed: 40, abnormal: 5, abnormalRate: 0.125, reworked: 2, reworkRate: 0.05 }} />);
    expect(screen.getByText("13%")).toBeInTheDocument(); // 12.5 ปัดเป็น 13
    expect(screen.getByText("5%")).toBeInTheDocument();
  });

  it("says so plainly when nothing closed in the window", () => {
    render(<QualityPanel quality={{ closed: 0, abnormal: 0, abnormalRate: 0, reworked: 0, reworkRate: 0 }} />);
    expect(screen.getByText("ไม่มีข้อมูลในช่วงนี้")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันแดง**

Run: `npx vitest run src/components/dashboard/exec/QualityPanel.test.tsx`
Expected: FAIL — import ไม่เจอ `./QualityPanel`

- [ ] **Step 3: เขียน QualityPanel**

สร้าง `src/components/dashboard/exec/QualityPanel.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExecSummary } from "@/lib/execSummary";

const pct = (rate: number) => `${Math.round(rate * 100)}%`;

export default function QualityPanel({ quality }: { quality: ExecSummary["stats"]["quality"] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">คุณภาพ</CardTitle>
      </CardHeader>
      <CardContent>
        {quality.closed === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีข้อมูลในช่วงนี้</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-3xl font-semibold text-red-600">{pct(quality.abnormalRate)}</div>
              <div className="text-xs text-muted-foreground">
                ผลผิดปกติ · {quality.abnormal} จาก {quality.closed} ใบ
              </div>
            </div>
            <div>
              <div className="text-3xl font-semibold text-amber-600">{pct(quality.reworkRate)}</div>
              <div className="text-xs text-muted-foreground">
                งานตีกลับ/ทำใหม่ · {quality.reworked} จาก {quality.closed} ใบ
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: เขียน TurnaroundChart**

สร้าง `src/components/dashboard/exec/TurnaroundChart.tsx`:

```tsx
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExecSummary } from "@/lib/execSummary";

const CONFIG = {
  avgHours: { label: "เฉลี่ย", color: "hsl(217,91%,55%)" },
  p90Hours: { label: "p90 (ช้าสุด 10%)", color: "hsl(38,92%,50%)" },
};

export default function TurnaroundChart({ rows }: { rows: ExecSummary["stats"]["turnaround"] }) {
  const data = rows
    .filter((r) => r.count > 0)
    .map((r) => ({
      label: r.label,
      avgHours: Math.round(((r.avgMin ?? 0) / 60) * 10) / 10,
      p90Hours: Math.round(((r.p90Min ?? 0) / 60) * 10) / 10,
    }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">เวลาที่ใช้ต่อด่าน (ชั่วโมง)</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีข้อมูลในช่วงนี้</p>
        ) : (
          <ChartContainer config={CONFIG} className="h-[240px] w-full">
            <ResponsiveContainer>
              <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="label" width={110} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="avgHours" fill="var(--color-avgHours)" radius={3} />
                <Bar dataKey="p90Hours" fill="var(--color-p90Hours)" radius={3} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: เขียน ThroughputChart**

สร้าง `src/components/dashboard/exec/ThroughputChart.tsx`:

```tsx
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExecSummary } from "@/lib/execSummary";

const CONFIG = {
  created: { label: "งานเข้า", color: "hsl(217,91%,55%)" },
  completed: { label: "งานปิด", color: "hsl(142,71%,45%)" },
};

export default function ThroughputChart({ rows }: { rows: ExecSummary["stats"]["throughput"] }) {
  const data = rows.map((r) => ({ ...r, day: r.date.slice(5) })); // MM-DD

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">งานเข้า vs งานปิด</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={CONFIG} className="h-[240px] w-full">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="created" stroke="var(--color-created)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="completed" stroke="var(--color-completed)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: เขียน TeamWorkloadPanel**

สร้าง `src/components/dashboard/exec/TeamWorkloadPanel.tsx`:

```tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMinutes, type ExecSummary } from "@/lib/execSummary";

type Side = "lab" | "qc";

export default function TeamWorkloadPanel({ workload }: { workload: ExecSummary["stats"]["workload"] }) {
  const [side, setSide] = useState<Side>("lab");
  const rows = workload[side];
  const max = Math.max(1, ...rows.map((r) => r.completed));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">ภาระงานทีม</CardTitle>
        <div className="flex gap-1">
          {(["lab", "qc"] as Side[]).map((s) => (
            <Button key={s} size="sm" variant={s === side ? "default" : "outline"} onClick={() => setSide(s)}>
              {s === "lab" ? "Lab" : "QC"}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีข้อมูลในช่วงนี้</p>
        ) : rows.map((row) => (
          <div key={row.name}>
            <div className="mb-1 flex justify-between text-xs">
              <span>{row.name}</span>
              <span className="text-muted-foreground">
                ปิด {row.completed} ใบ · เฉลี่ย {row.avgMinutes == null ? "—" : formatMinutes(row.avgMinutes)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-blue-500" style={{ width: `${(row.completed / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7: ต่อบล็อกล่างเข้า ExecDashboard**

ใน `src/components/dashboard/exec/ExecDashboard.tsx` เพิ่ม import:

```tsx
import LabInventorySummaryCard from "@/components/dashboard/LabInventorySummary";
import { useDashboardData } from "@/hooks/useDashboardData";
import { DASHBOARD_PROFILES } from "@/lib/dashboardProfiles";
import TurnaroundChart from "./TurnaroundChart";
import ThroughputChart from "./ThroughputChart";
import QualityPanel from "./QualityPanel";
import TeamWorkloadPanel from "./TeamWorkloadPanel";
```

เพิ่ม hook สต๊อกไว้บนสุดของ component (ก่อน early-return ทุกอัน เพื่อไม่ผิดกฎ hooks) — ใช้ profile `lab-inventory` เพราะเป็นตัวเดียวที่เปิด query สต๊อกใน `useDashboardData`:

```tsx
  const { ctx } = useDashboardData(DASHBOARD_PROFILES["lab-inventory"]);
```

แล้วต่อท้าย fragment (หลัง `<div>` ที่มี ActionQueue/BottleneckBars):

```tsx
          <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <TurnaroundChart rows={data.stats.turnaround} />
            <ThroughputChart rows={data.stats.throughput} />
          </div>
          <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <QualityPanel quality={data.stats.quality} />
            <TeamWorkloadPanel workload={data.stats.workload} />
          </div>
          <LabInventorySummaryCard
            summary={ctx.labInventorySummary}
            loading={ctx.labInventoryLoading}
          />
```

- [ ] **Step 8: รันเทสต์**

Run: `npx vitest run src/components/dashboard/exec`
Expected: PASS ทั้งหมด

- [ ] **Step 9: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จากไฟล์ที่แตะใน task นี้

- [ ] **Step 10: Commit**

```bash
git add src/components/dashboard/exec
git commit -m "feat: add exec turnaround, throughput, quality and workload panels"
```

---

### Task 9: `/petitions?highlight=` — ปักหมุด + พื้นเหลือง

**Files:**
- Modify: `src/pages/PetitionListPage.tsx:109-210` (อ่าน `highlight`, query ใบที่ไฮไลท์, เรนเดอร์กลุ่มปักหมุด)
- Create: `src/pages/PetitionListPage.highlight.test.tsx`

**Interfaces:**
- Consumes: `GET /petitions?ids=` (Task 5) · `highlightPath` (Task 6)
- Produces: หน้ารายการที่ปักหมุดใบซึ่งถูกไฮไลท์ไว้บนสุด พร้อม chip "ล้าง"

**หมายเหตุ:** `PetitionListPage` เป็น server-paginated — ถ้าไฮไลท์เฉย ๆ ใบที่คลิกมาอาจอยู่คนละหน้าและผู้ใช้จะไม่เห็นอะไรเลย จึงต้องดึงใบเหล่านั้นมาแสดงแยกบนสุด

- [ ] **Step 1: เขียนเทสต์ก่อน**

สร้าง `src/pages/PetitionListPage.highlight.test.tsx` — mock `usePetitionList` และ fetch ของ `?ids=` ตามแพทเทิร์นที่ `src/pages/RoleDashboard.test.tsx` ใช้ (ดูไฟล์นั้นเป็นตัวอย่างการ mock hook + AuthContext):

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// mock ตาม pattern ใน RoleDashboard.test.tsx — ปรับ path ให้ตรงกับ hook ที่ PetitionListPage ใช้จริง
vi.mock("@/hooks/usePetition", () => ({
  usePetitionList: () => ({ data: { items: [], total: 0 }, loading: false, refresh: vi.fn() }),
}));

import PetitionListPage from "./PetitionListPage";

describe("PetitionListPage highlight", () => {
  it("pins the highlighted petitions above the paginated list", async () => {
    // stub /petitions?ids= ให้คืนใบเดียว
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ _id: "x1", petitionNo: "P-HL", dept: "fg", status: "inProgress", items: [], submittedBy: { name: "ก" }, createdAt: "2026-07-13T00:00:00.000Z", updatedAt: "2026-07-13T00:00:00.000Z" }], total: 1 }),
    }));

    render(
      <MemoryRouter initialEntries={["/petitions?highlight=x1"]}>
        <PetitionListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("P-HL")).toBeInTheDocument();
    expect(screen.getByText(/ไฮไลท์ 1 รายการจากแดชบอร์ด/)).toBeInTheDocument();
  });

  it("shows no highlight banner when the param is absent", () => {
    render(
      <MemoryRouter initialEntries={["/petitions"]}>
        <PetitionListPage />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/ไฮไลท์/)).not.toBeInTheDocument();
  });
});
```

**สำคัญ:** เปิด `src/pages/PetitionListPage.tsx` แล้วดูว่ามัน mock อะไรบ้างถึงจะ render ได้ (AuthContext, React Query provider ฯลฯ) — เติม provider/mocks ที่ขาดตามที่ error บอก อย่าเดา

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันแดง**

Run: `npx vitest run src/pages/PetitionListPage.highlight.test.tsx`
Expected: FAIL — ไม่มี banner "ไฮไลท์"

- [ ] **Step 3: implement ใน PetitionListPage**

อ่านพารามิเตอร์ (วางใกล้ ๆ `const status = searchParams.get('status') ?? '';` บรรทัด 120):

```tsx
  const highlightIds = (searchParams.get('highlight') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const highlightKey = highlightIds.join(',');
  const highlightSet = new Set(highlightIds);
```

ดึงใบที่ไฮไลท์ (วางใกล้ query อื่น ๆ):

```tsx
  const { data: highlighted = [] } = useQuery({
    queryKey: ['petitions', 'highlight', highlightKey],
    enabled: highlightIds.length > 0,
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/petitions?ids=${encodeURIComponent(highlightKey)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return [];
      const body = await res.json();
      return (body.items ?? []) as Petition[];
    },
  });
```

**หน้านี้ไม่ได้เรนเดอร์เป็น `<table>` แต่เป็น `<Card>` ต่อหนึ่งคำขอ** (ดู `visibleItems.map((petition) => {...})` ที่บรรทัด ~403) ดังนั้นให้ **แยกตัวเรนเดอร์การ์ดออกเป็นฟังก์ชันในไฟล์เดียวกัน** แล้วใช้ซ้ำทั้งกลุ่มปักหมุดและลิสต์หลัก — ห้ามก๊อบ JSX ของการ์ดไปวางสองที่

ย้ายเนื้อใน `visibleItems.map(...)` ทั้งก้อน (ตั้งแต่ `const statusBadge = ...` ถึง `</Card>`) มาเป็นฟังก์ชันภายใน component:

```tsx
  const renderPetitionCard = (petition: Petition, highlighted = false) => {
    const statusBadge = petitionStatusBadge(petition);
    const sampleNames = petition.items
      .map((item) => item.sampleName)
      .filter((item): item is string => Boolean(item));
    const primarySample = sampleNames[0] ?? '-';
    const extraSamples = Math.max(0, sampleNames.length - 1);
    const testItems = canSeeTestItems ? parameterNamesForPetition(petition, displayParameters) : [];

    return (
      <Card
        key={petition._id}
        onOpen={() => navigate(`/petitions/${petition._id}`)}
        className={cn(
          'w-full rounded-2xl border-black-50 p-4 text-left transition hover:border-primary-200 hover:bg-grey-50/40',
          highlighted && 'border-amber-300 bg-amber-50 hover:bg-amber-50',
        )}
      >
        {/* ...เนื้อในของการ์ดเดิมทั้งหมด ไม่เปลี่ยน... */}
      </Card>
    );
  };
```

แล้วให้ลิสต์หลักเรียกใช้:

```tsx
  visibleItems.map((petition) => renderPetitionCard(petition, highlightSet.has(petition._id)))
```

เพิ่มกลุ่มปักหมุด **เหนือ** `<Card>` ที่ครอบลิสต์หลัก:

```tsx
  {highlightIds.length > 0 && (
    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50/50 p-3">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-medium text-amber-800">
          ไฮไลท์ {highlighted.length} รายการจากแดชบอร์ด
        </span>
        <Button size="sm" variant="ghost" onClick={() => updateParams({ highlight: undefined })}>
          ล้างไฮไลท์
        </Button>
      </div>
      <div className="space-y-3">
        {highlighted.map((petition) => renderPetitionCard(petition, true))}
      </div>
    </div>
  )}
```

`updateParams` มีอยู่แล้วในไฟล์ (บรรทัด ~205) และรับ object ของ param ที่จะตั้ง/ลบ (`undefined` = ลบ) · `cn` import จาก `@/lib/utils` — ตรวจว่าไฟล์ import แล้วหรือยัง

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/pages/PetitionListPage.highlight.test.tsx`
Expected: PASS ทั้ง 2 เคส

- [ ] **Step 5: ตรวจของจริงในเบราว์เซอร์**

เปิด `http://localhost:8000/LIS/petitions?highlight=<id ที่มีจริง>` แล้วยืนยันว่า:
- มีแถบเหลือง "ไฮไลท์ N รายการจากแดชบอร์ด" อยู่บนสุด พร้อมใบที่ระบุ
- ลิสต์เต็มด้านล่างยัง paginate ได้ปกติ
- กด "ล้างไฮไลท์" แล้วแถบหาย และ URL ไม่มี `highlight` แล้ว

- [ ] **Step 6: Commit**

```bash
git add src/pages/PetitionListPage.tsx src/pages/PetitionListPage.highlight.test.tsx
git commit -m "feat: pin and highlight dashboard-selected petitions in the list"
```

---

### Task 10: Validate the whole feature

**Files:** ไม่มีไฟล์ production ใหม่

- [ ] **Step 1: รันเทสต์ server ทั้งชุด**

Run: `cd server && npx jest`
Expected: PASS ทั้งหมด

- [ ] **Step 2: รันเทสต์ frontend ทั้งชุด**

Run: `npx vitest run`
Expected: PASS ทั้งหมด — ถ้ามีเทสต์เดิมพัง แปลว่าไปแตะ profile อื่นเข้า ให้ย้อนดู

- [ ] **Step 3: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: จำนวน error เท่ากับ baseline ก่อนเริ่มงาน (repo มี latent error อยู่แล้ว ~12) — ต้องไม่มี error จากไฟล์ใหม่

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: ไม่มี error ใหม่จากไฟล์ที่สร้าง/แก้

- [ ] **Step 5: เดินหน้าจริง**

เปิด `http://localhost:8000/LIS/` ด้วย role `admin` (DevRoleSwitcher) แล้วยืนยัน:
- แถบ ALERT ขึ้นตัวเลข และกดแล้วเด้งไป `/petitions?highlight=…` ที่ปักหมุดถูกใบ
- ตาราง "งานที่ต้องจัดการ" เรียงงานเกินเวลามากสุดไว้บน
- สลับ 7/30/90 วัน แล้วกราฟเปลี่ยน แต่แถบ ALERT/คอขวด **ไม่เปลี่ยน** (เพราะเป็น live)
- สลับ role เป็น `lab-head` / `qc-head` แล้วแดชบอร์ดเดิมยังทำงานเหมือนเดิมทุกอย่าง

- [ ] **Step 6: ตรวจ diff ก่อนปิดงาน**

Run: `git status --short` และ `git diff --check`
Expected: ไม่มีไฟล์ของ user ที่ถูก stage ติดไปโดยไม่ตั้งใจ · ไม่มี whitespace error
