# Product density (ถพ) reference ranges — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a hand-authored reference data file mapping every in-scope product (English `commonName`) to an empty specific-gravity (ถพ) `min`–`max` range, plus a validator.

**Architecture:** One plain-JSON array at `server/data/product-density-ranges.json` (matching the `machines-seed.json` precedent). A standalone Node validator at `server/scripts/validate-product-density-ranges.js` exposes a pure `validateEntries(arr)` and a CLI. No DB model, route, UI, or QC wiring this phase.

**Tech Stack:** Node.js (CommonJS, matching `server/`), `node:test` for the validator test (matches `server/lib/densitySyncTrigger.test.js` precedent).

## Global Constraints

- `commonName`: canonical English, **UPPERCASE**, **unique** (case-insensitive) across the whole file, contains **no Thai characters**. Form: `<ACTIVE(S)> <conc>% [W/V] <FORMCODE> [(QUALIFIERS)]`; multiple actives joined with ` + ` in written order. Add `W/V` **only** for %-w/v liquid forms (EC/SC/SL/EW/ME). **Omit** `W/V` for `ZC`, for non-% strengths (e.g. `IU/MG`), and for `TECH`/solvents — matching the system's existing canonical (e.g. `THIAMETHOXAM 14.1% + LAMBDA-CYHALOTHRIN 10.6% ZC`).
- `thaiName`: original Thai copied **verbatim** from the source list.
- `sgMin` / `sgMax`: **always `null`** in this phase (user fills later).
- `category`: one of `insecticide` | `herbicide` | `fertilizer` | `solvent` | `imported`.
- `note`: `""`, or a flag such as `ยืนยันชื่อ` (uncertain brand/transliteration) / `ยืนยันของเหลว` (list-3 form unknown — delete if solid/powder) / free text.
- Dedup rule: identical resulting `commonName` across any list ⇒ **one** entry (first occurrence wins; do not re-add). Different `commonName` (e.g. domestic vs `(IMPORTED)`) ⇒ separate entries.
- Formulation-code map: อีซี→EC, เอสซี→SC, เอสแอล→SL, อีดับเบิ้ลยู/อีดับเบิลยู→EW, เอ็มอี→ME, ZC→ZC, AC→AC, เทค→TECH.
- Qualifier map: (อย.)→(FDA), ปศุสัตว์→(LIVESTOCK), ไบโอ→(BIO), (นำเข้า)→(IMPORTED), สูตรน้ำ→(WATER-BASED), (หนัก)/(เบา)→(HEAVY)/(LIGHT), (ผสมเอง)→(SELF-MIXED), (บีพีเอ็มซี)→(BPMC). Multiple qualifiers combine inside one paren, comma-separated: `(BIO, FDA)`.

---

### Task 1: Validator script + test

**Files:**
- Create: `server/scripts/validate-product-density-ranges.js`
- Test: `server/scripts/validate-product-density-ranges.test.js`

**Interfaces:**
- Produces: `validateEntries(entries: object[]) => { ok: boolean, errors: string[] }` (pure). CLI: `node server/scripts/validate-product-density-ranges.js` reads `server/data/product-density-ranges.json`, prints errors, exits `1` on failure / `0` on success.

- [ ] **Step 1: Write the failing test**

```js
// server/scripts/validate-product-density-ranges.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { validateEntries } = require('./validate-product-density-ranges');

const good = [
  { commonName: 'CYPERMETHRIN 10% W/V EC', thaiName: 'ไซเปอร์เมทธิน 10% อีซี', category: 'insecticide', sgMin: null, sgMax: null, note: '' },
];

test('accepts a valid array', () => {
  const r = validateEntries(good);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.errors, []);
});

test('rejects duplicate commonName (case-insensitive)', () => {
  const r = validateEntries([good[0], { ...good[0], thaiName: 'x', commonName: 'cypermethrin 10% w/v ec' }]);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => /duplicate/i.test(e)));
});

test('rejects Thai characters in commonName', () => {
  const r = validateEntries([{ ...good[0], commonName: 'ไซเปอร์ EC' }]);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => /thai|uppercase/i.test(e)));
});

test('rejects lowercase commonName', () => {
  const r = validateEntries([{ ...good[0], commonName: 'cypermethrin 10% w/v ec' }]);
  assert.strictEqual(r.ok, false);
});

test('rejects sgMin > sgMax when both set', () => {
  const r = validateEntries([{ ...good[0], sgMin: 1.2, sgMax: 1.0 }]);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => /sgMin/i.test(e)));
});

test('rejects bad category', () => {
  const r = validateEntries([{ ...good[0], category: 'weedkiller' }]);
  assert.strictEqual(r.ok, false);
});

test('allows both ranges null', () => {
  assert.strictEqual(validateEntries([{ ...good[0], sgMin: null, sgMax: null }]).ok, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/scripts/validate-product-density-ranges.test.js`
Expected: FAIL — `Cannot find module './validate-product-density-ranges'`.

- [ ] **Step 3: Write minimal implementation**

```js
// server/scripts/validate-product-density-ranges.js
const CATEGORIES = new Set(['insecticide', 'herbicide', 'fertilizer', 'solvent', 'imported']);
const THAI = /[฀-๿]/;

function validateEntries(entries) {
  const errors = [];
  if (!Array.isArray(entries)) return { ok: false, errors: ['top-level value must be an array'] };
  const seen = new Map();
  entries.forEach((e, i) => {
    const at = `#${i}`;
    if (!e || typeof e !== 'object') { errors.push(`${at}: entry must be an object`); return; }
    const { commonName, thaiName, category, sgMin, sgMax, note } = e;
    if (typeof commonName !== 'string' || !commonName.trim()) errors.push(`${at}: commonName must be a non-empty string`);
    else {
      if (THAI.test(commonName)) errors.push(`${at}: commonName contains Thai characters: "${commonName}"`);
      if (commonName !== commonName.toUpperCase()) errors.push(`${at}: commonName must be uppercase: "${commonName}"`);
      const key = commonName.trim().toLowerCase();
      if (seen.has(key)) errors.push(`${at}: duplicate commonName "${commonName}" (also ${seen.get(key)})`);
      else seen.set(key, at);
    }
    if (typeof thaiName !== 'string' || !thaiName.trim()) errors.push(`${at}: thaiName must be a non-empty string`);
    if (!CATEGORIES.has(category)) errors.push(`${at}: category "${category}" not in ${[...CATEGORIES].join('/')}`);
    if (sgMin !== null && typeof sgMin !== 'number') errors.push(`${at}: sgMin must be a number or null`);
    if (sgMax !== null && typeof sgMax !== 'number') errors.push(`${at}: sgMax must be a number or null`);
    if (typeof sgMin === 'number' && typeof sgMax === 'number' && sgMin > sgMax) errors.push(`${at}: sgMin (${sgMin}) > sgMax (${sgMax})`);
    if (note !== undefined && typeof note !== 'string') errors.push(`${at}: note must be a string`);
  });
  return { ok: errors.length === 0, errors };
}

if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const file = path.join(__dirname, '..', 'data', 'product-density-ranges.json');
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (err) { console.error(`❌ cannot read/parse ${file}: ${err.message}`); process.exit(1); }
  const { ok, errors } = validateEntries(data);
  if (!ok) { console.error(`❌ ${errors.length} error(s):`); errors.forEach((e) => console.error('  - ' + e)); process.exit(1); }
  console.log(`✅ ${data.length} entries valid.`);
}

module.exports = { validateEntries };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/scripts/validate-product-density-ranges.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add server/scripts/validate-product-density-ranges.js server/scripts/validate-product-density-ranges.test.js
git commit -m "feat(density): add product-density-ranges validator + tests" -- server/scripts/validate-product-density-ranges.js server/scripts/validate-product-density-ranges.test.js
```

---

### Task 2: Author List 1 (insecticides + solvents) — 71 entries

**Files:**
- Create: `server/data/product-density-ranges.json`

**Interfaces:**
- Consumes: `validateEntries` (Task 1) via CLI.
- Produces: the JSON array file with List-1 entries (later tasks append to it).

- [ ] **Step 1: Create the file as `[` … `]` with these 71 entries.** Each entry: `{ "commonName": <col2>, "thaiName": <col1 verbatim>, "category": <col3>, "sgMin": null, "sgMax": null, "note": <col4> }`.

| thaiName (verbatim) | commonName | category | note |
|---|---|---|---|
| คลอฟีนาเพอร์ 10% เอสซี | CHLORFENAPYR 10% W/V SC | insecticide | |
| จิบเบอเรลลิก แอซิด 5% เอสแอล | GIBBERELLIC ACID 5% W/V SL | insecticide | |
| โซลเวสโซ่-100 | SOLVESSO-100 | solvent | |
| โซลเวสโซ่-150 | SOLVESSO-150 | solvent | |
| ไซเปอร์เมทธิน 10% อีซี (อย.) | CYPERMETHRIN 10% W/V EC (FDA) | insecticide | |
| ไซเปอร์เมทธิน 10% อีซี ไบโอ (อย.) | CYPERMETHRIN 10% W/V EC (BIO, FDA) | insecticide | |
| ไซเปอร์เมทธิน 10% อีซี ปศุสัตว์ | CYPERMETHRIN 10% W/V EC (LIVESTOCK) | insecticide | |
| ไซเปอร์เมทธิน 25% อีซี (ปศุสัตว์) | CYPERMETHRIN 25% W/V EC (LIVESTOCK) | insecticide | |
| ไซเปอร์เมทธิน 25% อีซี (อย.) | CYPERMETHRIN 25% W/V EC (FDA) | insecticide | |
| ไซเปอร์เมทธิน 25% อีซี ไบโอ (อย.) | CYPERMETHRIN 25% W/V EC (BIO, FDA) | insecticide | |
| ไซเปอร์เมทธิน 25% อีซี ปศุสัตว์ (ไบโอ) | CYPERMETHRIN 25% W/V EC (LIVESTOCK, BIO) | insecticide | |
| ไซเปอร์เมทธิน 25% อีซี สูตรน้ำ | CYPERMETHRIN 25% W/V EC (WATER-BASED) | insecticide | |
| ไซเปอร์เมทธิน 35% อีซี | CYPERMETHRIN 35% W/V EC | insecticide | |
| ไซเปอร์เมทธิน 35% อีซี (ปศุสัตว์) | CYPERMETHRIN 35% W/V EC (LIVESTOCK) | insecticide | |
| ไซลีน | XYLENE | solvent | |
| เดลทราเมทริน 0.5% อีซี (อย.) | DELTAMETHRIN 0.5% W/V EC (FDA) | insecticide | |
| เดลทราเมทริน 1% อีซี (อย.) | DELTAMETHRIN 1% W/V EC (FDA) | insecticide | |
| เดลทราเมทริน 1.5% อีซี (อย.) | DELTAMETHRIN 1.5% W/V EC (FDA) | insecticide | |
| เดลทราเมทริน 1.5% อีซี ไบโอ (อย.) | DELTAMETHRIN 1.5% W/V EC (BIO, FDA) | insecticide | |
| เดลทราเมทริน 2% อีซี (อย.) | DELTAMETHRIN 2% W/V EC (FDA) | insecticide | |
| เดลทราเมทริน 2.5% อีซี (อย.) | DELTAMETHRIN 2.5% W/V EC (FDA) | insecticide | |
| ไดฟีโนโคนาโซล 12.5%+อะซอกซีสโตรบิน 20% เอสซี | DIFENOCONAZOLE 12.5% + AZOXYSTROBIN 20% W/V SC | insecticide | |
| ไดเอชเทอลีน ไกลคอล | DIETHYLENE GLYCOL | solvent | |
| ไดฟีโนโคนาโซล 25% อีซี (นำเข้า) | DIFENOCONAZOLE 25% W/V EC (IMPORTED) | insecticide | |
| ไดฟีโนโคนาโซล 15%+โพรพิโคนาโซล 15% อีซี | DIFENOCONAZOLE 15% + PROPICONAZOLE 15% W/V EC | insecticide | |
| ไทอะมีทอกแซม 14.1% + แลมป์ด้า-ไซฮาโลทริน 10.6% ZC | THIAMETHOXAM 14.1% + LAMBDA-CYHALOTHRIN 10.6% ZC | insecticide | |
| บาซิลลัส 16000 IU/mg เอสซี (นำเข้า) | BACILLUS THURINGIENSIS 16000 IU/MG SC (IMPORTED) | insecticide | non-% strength → no W/V |
| บูโพฟีซิน 40% SC | BUPROFEZIN 40% W/V SC | insecticide | |
| ไบเฟนทริน 2.5% อีซี (อย.) | BIFENTHRIN 2.5% W/V EC (FDA) | insecticide | |
| ไบเฟนทริน 10% อีซี (ปศุสัตว์) | BIFENTHRIN 10% W/V EC (LIVESTOCK) | insecticide | |
| ไบเฟนทริน 10% อีซี (อย.) | BIFENTHRIN 10% W/V EC (FDA) | insecticide | |
| โปรฟีโนฟอส 50% อีซี | PROFENOFOS 50% W/V EC | insecticide | |
| โปรฟีโนฟอส 50% อีซี (นำเข้า) | PROFENOFOS 50% W/V EC (IMPORTED) | insecticide | |
| พิริมิฟอส-เมทิล 50% อีซี (นำเข้า) | PIRIMIPHOS-METHYL 50% W/V EC (IMPORTED) | insecticide | |
| โพรคลอราซ 45% อีซี | PROCHLORAZ 45% W/V EC | insecticide | |
| โพรคลอราซ 45% อีดับเบิ้ลยู (นำเข้า) | PROCHLORAZ 45% W/V EW (IMPORTED) | insecticide | |
| โพรพาโมคาร์บ 72.2% เอสแอล (นำเข้า) | PROPAMOCARB 72.2% W/V SL (IMPORTED) | insecticide | |
| โพรพิโคนาซอล 25% อีซี (นำเข้า) | PROPICONAZOLE 25% W/V EC (IMPORTED) | insecticide | |
| โพรพิโคนาซอล 9%+โพรคลอราซ 40% อีซี | PROPICONAZOLE 9% + PROCHLORAZ 40% W/V EC | insecticide | |
| เพอร์เมทริน 10% อีซี (อย.) | PERMETHRIN 10% W/V EC (FDA) | insecticide | |
| ฟิโปรนิล 2.5% อีซี | FIPRONIL 2.5% W/V EC | insecticide | |
| ฟิโปรนิล  5% เอสซี (อย.) | FIPRONIL 5% W/V SC (FDA) | insecticide | |
| ฟิโปรนิล  5% เอสซี | FIPRONIL 5% W/V SC | insecticide | |
| ฟิโปรนิล  5% เอสซี (นำเข้า) | FIPRONIL 5% W/V SC (IMPORTED) | insecticide | |
| ฟีโนบูคาร์บ 50% อีซี (บีพีเอ็มซี) | FENOBUCARB 50% W/V EC (BPMC) | insecticide | |
| เมทานอล | METHANOL | solvent | |
| เมทิล เอสเทอร์ | METHYL ESTER | solvent | |
| ลูฟีนูรอน 5% อีซี (นำเข้า) | LUFENURON 5% W/V EC (IMPORTED) | insecticide | |
| แลมด้า1%+ไบเพอร์โรนิล5%+เตตระเมทริน4% อีซี (นำเข้า) | LAMBDA-CYHALOTHRIN 1% + PIPERONYL BUTOXIDE 5% + TETRAMETHRIN 4% W/V EC (IMPORTED) | insecticide | 3 actives |
| สไปโรดิโคลเฟน 24% เอสซี | SPIRODICLOFEN 24% W/V SC | insecticide | |
| อะซีโตน | ACETONE | solvent | |
| อะเซทามิปริด 2.85% อีซี (นำเข้า) | ACETAMIPRID 2.85% W/V EC (IMPORTED) | insecticide | |
| อะบาเมคติน 1.8% อีซี (หนัก) | ABAMECTIN 1.8% W/V EC (HEAVY) | insecticide | |
| อะบาเมคติน 1.8% อีซี (เบา) | ABAMECTIN 1.8% W/V EC (LIGHT) | insecticide | |
| อะบาเมคติน 1.8% อีซี (ผสมเอง) | ABAMECTIN 1.8% W/V EC (SELF-MIXED) | insecticide | |
| อะบาเมคติน 1.8% อีซี (50 ซีพี) | ABAMECTIN 1.8% W/V EC (50 CP) | insecticide | |
| อะบาเมคติน 1.8 % อีซี (นำเข้า) | ABAMECTIN 1.8% W/V EC (IMPORTED) | insecticide | |
| อะบาแม็คติน 1.8% อีซี (สูตรสีน้ำตาล ไม่เหนียว, นำเข้า) | ABAMECTIN 1.8% W/V EC (BROWN, NON-STICKY, IMPORTED) | insecticide | |
| อะบาแม็คติน 1.8% อีซี (สูตรสีเหลือง ไม่เหนียว, นำเข้า) | ABAMECTIN 1.8% W/V EC (YELLOW, NON-STICKY, IMPORTED) | insecticide | |
| อามีทราซ 20% อีซี (นำเข้า) | AMITRAZ 20% W/V EC (IMPORTED) | insecticide | |
| อิมิดาคลอปริด 10% เอสแอล (นำเข้า) | IMIDACLOPRID 10% W/V SL (IMPORTED) | insecticide | |
| อิมิดาคลอปริด 10% เอสแอล (อย.) | IMIDACLOPRID 10% W/V SL (FDA) | insecticide | |
| อิมิดาคลอปริด 10% เอสแอล อย. (ใช้ NMP) | IMIDACLOPRID 10% W/V SL (FDA, NMP) | insecticide | |
| อิมิดาคลอปริด 10% เอสแอล อย. (ใช้ DMF, DMSO) | IMIDACLOPRID 10% W/V SL (FDA, DMF, DMSO) | insecticide | |
| อินด็อกซาคาร์บ 15% SC (นำเข้า) | INDOXACARB 15% W/V SC (IMPORTED) | insecticide | |
| อีเทฟอน 48% เอสแอล | ETHEPHON 48% W/V SL | insecticide | |
| อีเทฟอน 48% เอสแอล (นำเข้า) | ETHEPHON 48% W/V SL (IMPORTED) | insecticide | |
| อีโทเฟนฟร็อกซ์ 5% อีซี (อย.) | ETOFENPROX 5% W/V EC (FDA) | insecticide | |
| อีมาเม็คติน 2.0% เอ็มอี (นำเข้า) | EMAMECTIN BENZOATE 2.0% W/V ME (IMPORTED) | insecticide | |
| โอเมทโธเอท 50% เอสแอล | OMETHOATE 50% W/V SL | insecticide | |
| เฮ็กซาโคนาโซล 5% เอสซี (นำเข้า) | HEXACONAZOLE 5% W/V SC (IMPORTED) | insecticide | |

- [ ] **Step 2: Validate.** Run: `node server/scripts/validate-product-density-ranges.js`
Expected: `✅ 71 entries valid.`

- [ ] **Step 3: Commit**

```bash
git add server/data/product-density-ranges.json
git commit -m "feat(density): seed product ถพ ranges — list 1 (insecticides/solvents)" -- server/data/product-density-ranges.json
```

---

### Task 3: Append List 2 (herbicides/fungicides) — 45 entries

**Files:**
- Modify: `server/data/product-density-ranges.json` (append inside the array)

**Interfaces:**
- Consumes: existing array (Task 2).

- [ ] **Step 1: Append these 45 entries** (`category: "herbicide"`, `sgMin/sgMax: null`).

| thaiName (verbatim) | commonName | note |
|---|---|---|
| 2,4-ดี ไดเมทิล แอมโมเนียม 84% เอสแอล | 2,4-D DIMETHYLAMMONIUM 84% W/V SL | |
| 2,4-ดี ไตรไอโซโพรพาโนลามีน ซอลท์45.2%+                      พิโคแรม11.6%SL | 2,4-D-TRIISOPROPANOLAMINE SALT 45.2% + PICLORAM 11.6% W/V SL | |
| กลูโฟซิเนต-แอมโมเนียม 15% เอสแอล (นำเข้า) | GLUFOSINATE-AMMONIUM 15% W/V SL (IMPORTED) | |
| กลูโฟซิเนต-แอมโมเนียม 15% เอสแอล (Premium) | GLUFOSINATE-AMMONIUM 15% W/V SL (PREMIUM) | |
| กลูโฟซิเนต-แอมโมเนียม 15% เอสแอล (Low-price) | GLUFOSINATE-AMMONIUM 15% W/V SL (LOW-PRICE) | |
| ไกลโฟเสท 48% เอสแอล (นำเข้า)  (เอเอ็ม) | GLYPHOSATE 48% W/V SL (IMPORTED, AM) | |
| ไกลโฟเสท 48% เอสแอล (นำเข้า)  (IPA) | GLYPHOSATE 48% W/V SL (IMPORTED, IPA) | |
| ไกลโฟเสท 48% เอสแอล | GLYPHOSATE 48% W/V SL | |
| ไกลโฟเสท 48% เอสแอล พิเศษ | GLYPHOSATE 48% W/V SL (SPECIAL) | |
| ไกลโฟเสท 77% เทค | GLYPHOSATE 77% TECH | technical |
| คลอโลทาโลนิล 50% เอสซี (นำเข้า) | CHLOROTHALONIL 50% W/V SC (IMPORTED) | |
| ครีซอกซิม เมทิล 50% เอสซี | KRESOXIM-METHYL 50% W/V SC | |
| ควิซาโลฟอบ-พี-เอทิล 5% EC (นำเข้า) | QUIZALOFOP-P-ETHYL 5% W/V EC (IMPORTED) | |
| คาร์เบนดาซิม 50% เอสซี | CARBENDAZIM 50% W/V SC | |
| คาร์เบนดาซิม 50% เอสซี (นำเข้า) | CARBENDAZIM 50% W/V SC (IMPORTED) | |
| โคลมาโซน  48% อีซี | CLOMAZONE 48% W/V EC | |
| โคลมาโซน  48% อีซี (นำเข้า) | CLOMAZONE 48% W/V EC (IMPORTED) | |
| โคลมาโซน 12% + โพรพานิล 27% EC | CLOMAZONE 12% + PROPANIL 27% W/V EC | |
| ซันโมริน-ยาจับใบ | SUNMORIN (STICKER) | ยืนยันชื่อ |
| ไซฮาโลฟอบ-บิวทิล 10% อีซี (นำเข้า) | CYHALOFOP-BUTYL 10% W/V EC (IMPORTED) | |
| ฟลูอะซิฟอบ-พี-บิวทิล 15% อีซี (นำเข้า) | FLUAZIFOP-P-BUTYL 15% W/V EC (IMPORTED) | |
| โฟมีซาเฟน 25% เอสแอล (นำเข้า) | FOMESAFEN 25% W/V SL (IMPORTED) | |
| ไดยูรอน 80% เอสซี | DIURON 80% W/V SC | |
| ไดควอต ไดโบรไมด์ 37.3% SL | DIQUAT DIBROMIDE 37.3% W/V SL | |
| ไตรโคลเพอร์ บิวท็อกซี่เอทิล เอสเทอร์ 66.8% CE | TRICLOPYR BUTOXYETHYL ESTER 66.8% W/V EC | source wrote "CE"→EC |
| ทีบูโคนาโซล 43% เอสซี (นำเข้า) | TEBUCONAZOLE 43% W/V SC (IMPORTED) | |
| บิวตาคลอร์ 60% อีซี | BUTACHLOR 60% W/V EC | |
| บิวตาคลอร์ 60% อีซี (นำเข้า) (No SFN) | BUTACHLOR 60% W/V EC (IMPORTED, NO SAFENER) | |
| บิวตาคลอร์ 60%  อีซี+เซฟเฟอร์เนอร์ (SFN) | BUTACHLOR 60% W/V EC (+ SAFENER) | |
| บิวตาคลอร์ 60% อีซี + เฟนโคริม | BUTACHLOR 60% W/V EC (+ FENCLORIM) | |
| บิวตาคลอร์ 60% อีดับเบิลยู (นำเข้า) | BUTACHLOR 60% W/V EW (IMPORTED) | |
| บิวตาคลอร์ 35% +โพรพานิล 35% อีซี | BUTACHLOR 35% + PROPANIL 35% W/V EC | |
| บีสไพรีแบค - โซเดียม 10% เอสซี | BISPYRIBAC-SODIUM 10% W/V SC | |
| เพนดิเมทาลิน 33% อีซี (นำเข้า) | PENDIMETHALIN 33% W/V EC (IMPORTED) | |
| เพรตติลาคลอร์ 30% EC (นำเข้า) | PRETILACHLOR 30% W/V EC (IMPORTED) | |
| แพคโคบิวทราโซล 10% เอสซี | PACLOBUTRAZOL 10% W/V SC | |
| แพคโคบิวทราโซล 25% เอสซี | PACLOBUTRAZOL 25% W/V SC | |
| โพรพานิล 36% อีซี | PROPANIL 36% W/V EC | |
| เมโทลาคลอร์ 72% อีซี (นำเข้า) | METOLACHLOR 72% W/V EC (IMPORTED) | |
| ออกซาไดอะซอน 25% อีซี | OXADIAZON 25% W/V EC | |
| อะเซโตคลอร์ 50% อีซี | ACETOCHLOR 50% W/V EC | |
| อะนิโลฟอส 30% อีซี | ANILOFOS 30% W/V EC | |
| อะนิโลฟอส 18% +  โพรพานิล 36% อีซี | ANILOFOS 18% + PROPANIL 36% W/V EC | |
| อะมีทรีน 50% เอสซี (นำเข้า) | AMETRYN 50% W/V SC (IMPORTED) | |
| ฮาลอกซิฟอบ-พี-เมทิล 10.8% อีซี (นำเข้า) | HALOXYFOP-P-METHYL 10.8% W/V EC (IMPORTED) | |

- [ ] **Step 2: Validate.** Run: `node server/scripts/validate-product-density-ranges.js`
Expected: `✅ 116 entries valid.`

- [ ] **Step 3: Commit**

```bash
git add server/data/product-density-ranges.json
git commit -m "feat(density): seed product ถพ ranges — list 2 (herbicides)" -- server/data/product-density-ranges.json
```

---

### Task 4: Append List 3 (fertilizers/additives) — liquids only (46 entries) + document 4 exclusions

**Files:**
- Modify: `server/data/product-density-ranges.json` (append)

**Rule applied:** clear technical/solid rows are **excluded** (documented below, no silent drop). Brand/code-A rows whose physical form is unknown are **included** with `note: "ยืนยันของเหลว"` so the user deletes any that are actually powder/solid.

- [ ] **Step 1: Append these 46 entries** (`category: "fertilizer"`, `sgMin/sgMax: null`).

| thaiName (verbatim) | commonName | note |
|---|---|---|
| ซุปเปอร์ฟิฟตี้ | SUPER FIFTY | ยืนยันชื่อ, ยืนยันของเหลว |
| ซุปเปอร์ซีวีด 12% เอสแอล | SUPER SEAWEED 12% W/V SL | ยืนยันชื่อ |
| ซุปเปอร์ซีวีด 15% เอสแอล | SUPER SEAWEED 15% W/V SL | ยืนยันชื่อ |
| ซิมิโน | SIMINO | ยืนยันชื่อ, ยืนยันของเหลว |
| ซีโฟว์ | SEAFOW | ยืนยันชื่อ, ยืนยันของเหลว |
| โซเดียมฮิวเมท 12% AC | SODIUM HUMATE 12% W/V AC | |
| น้ำยาทำความสะอาด (น้ำยาล้างผักและผลไม้) | CLEANING SOLUTION (VEGETABLE & FRUIT WASH) | ยืนยันชื่อ |
| สารปรับสภาพน้ำ (ซุปเปอร์บัฟเฟอร์) | WATER CONDITIONER (SUPER BUFFER) | |
| บิงโกไวท์ (แคลเซียมโบรอน) | BINGO WHITE (CALCIUM-BORON) | ยืนยันชื่อ |
| โปรตีนไฮโดรไลเซส 40% | PROTEIN HYDROLYSATE 40% | |
| ไบโอซิน | BIOZIN | ยืนยันชื่อ, ยืนยันของเหลว |
| บอมส์ บูสเตอร์ | BOMB'S BOOSTER | ยืนยันชื่อ, ยืนยันของเหลว |
| ฟลูวิก้า 6% | FULVICA 6% | ยืนยันชื่อ |
| ฟลูวิก้า 3% | FULVICA 3% | ยืนยันชื่อ |
| สารที่ใช้ในระบบน้ำ (อะควาบัพเฟอร์) | AQUA BUFFER (WATER SYSTEM) | ยืนยันชื่อ |
| อะมิโนแอซิด 20% | AMINO ACID 20% | |
| อะมิโนแอซิด 40% (Biolife40) (นำเข้า) | AMINO ACID 40% (BIOLIFE40, IMPORTED) | |
| ฮันนี่เจล | HONEY GEL | ยืนยันชื่อ, ยืนยันของเหลว |
| ฮิวเมท 120 | HUMATE 120 | ยืนยันชื่อ, ยืนยันของเหลว |
| Carbor | CARBOR | ยืนยันชื่อ, ยืนยันของเหลว |
| code A11 (ซิงค์ 13% ) | CODE A11 (ZINC 13%) | ยืนยันของเหลว |
| code A14 (อินเตอร์โบรอน 500) | CODE A14 (INTER BORON 500) | ยืนยันของเหลว |
| code A16 (แอลดี แมงกานีส 1) | CODE A16 (LD MANGANESE 1) | ยืนยันของเหลว |
| code A 17 (แอลดี แมงกานีส 2) | CODE A17 (LD MANGANESE 2) | ยืนยันของเหลว |
| code A 18 (แอลดี แมกนีเซียม) | CODE A18 (LD MAGNESIUM) | ยืนยันของเหลว |
| code A20 (พาซแมก, กู๊ดแม็ก) | CODE A20 (PASMAG, GOODMAG) | ยืนยันชื่อ, ยืนยันของเหลว |
| code A21 (พาซแมง) | CODE A21 (PASMANG) | ยืนยันชื่อ, ยืนยันของเหลว |
| code A22 (เอ็กซ์ตร้าบอร์) | CODE A22 (EXTRA BOR) | ยืนยันชื่อ, ยืนยันของเหลว |
| code A24 (อีเดนไอซิงค์) | CODE A24 (EDEN I-ZINC) | ยืนยันชื่อ, ยืนยันของเหลว |
| code A26 (แอลดี เฟอร์รัส) | CODE A26 (LD FERROUS) | ยืนยันของเหลว |
| code A27 ( ไดอาต้า 17 ) | CODE A27 (DIATA 17) | ยืนยันชื่อ, ยืนยันของเหลว |
| code A31 (ไดน่าพลัส,เว็ปไซด์,ซาร่าพลัส) | CODE A31 (DYNA PLUS, WEBSIDE, SARA PLUS) | ยืนยันชื่อ, ยืนยันของเหลว |
| code A40 (แอลดี แคลบอร์ No.4) | CODE A40 (LD CALBOR NO.4) | ยืนยันของเหลว |
| code A41 (แอลดี แคลบอร์ No.5) | CODE A41 (LD CALBOR NO.5) | ยืนยันของเหลว |
| code A41 - บิงโกไวท์ | CODE A41 (BINGO WHITE) | ยืนยันของเหลว |
| code A42 (แอลดี โบรอน 400) | CODE A42 (LD BORON 400) | ยืนยันของเหลว |
| code A54 (สตาร์เวียร์) | CODE A54 (STAR VEER) | ยืนยันชื่อ, ยืนยันของเหลว |
| code A55 (อินเตอร์ มิกซ์) | CODE A55 (INTER MIX) | ยืนยันของเหลว |
| code A60 (แอลดี ซิงค์แมก) | CODE A60 (LD ZINC-MAG) | ยืนยันของเหลว |
| code A63 (ซิงค์อะมิโน) | CODE A63 (ZINC-AMINO) | ยืนยันของเหลว |
| code A 69 (0-25-20) | CODE A69 (0-25-20) | ยืนยันของเหลว |
| code A70 (Zine Gold) | CODE A70 (ZINC GOLD) | ยืนยันชื่อ, ยืนยันของเหลว |
| code A 71 (แคลเซียมโบรอนไกลซีน) | CODE A71 (CALCIUM-BORON GLYCINE) | ยืนยันของเหลว |
| code A 73 (0-25-16) | CODE A73 (0-25-16) | ยืนยันของเหลว |
| NAA 4.5% | NAA 4.5% | |
| สารปรับสภาพน้ำ (PRIMIX) | WATER CONDITIONER (PRIMIX) | |

- [ ] **Step 2: Record the 4 excluded solid/technical rows** in the commit body (do NOT add to JSON):
  - `ไดฟิทิอาโลน 0.125% เทค` (DIFETHIALONE — technical solid)
  - `โบรดิฟาคุม 2.5% เทค` (BRODIFACOUM — technical solid)
  - `โบรมาดิโอโลน 2.5% เทค` (BROMADIOLONE — technical solid)
  - `อะลูมิเนียมเรอเลตซัลเฟต 35%` (aluminium chelate sulfate — likely solid salt; re-add if liquid)

- [ ] **Step 3: Validate.** Run: `node server/scripts/validate-product-density-ranges.js`
Expected: `✅ 162 entries valid.`

- [ ] **Step 4: Commit**

```bash
git add server/data/product-density-ranges.json
git commit -m "feat(density): seed product ถพ ranges — list 3 (fertilizers, liquids only)

Excluded 4 solid/technical rows (ถพ N/A): DIFETHIALONE tech, BRODIFACOUM tech,
BROMADIOLONE tech, aluminium chelate sulfate 35%. code-A/brand rows kept with
note ยืนยันของเหลว so the user prunes any that are powder/solid." -- server/data/product-density-ranges.json
```

---

### Task 5: Append List 4 (imported) — 5 new entries; 28 are duplicates (do not add)

**Files:**
- Modify: `server/data/product-density-ranges.json` (append)

**Rule applied:** by the Global-Constraints dedup rule, 28 of list-4's 33 rows resolve to a `commonName` already present from lists 1–2 → **skip** (documented). Only these 5 are new.

- [ ] **Step 1: Append these 5 entries** (`category: "imported"`, `sgMin/sgMax: null`).

| thaiName (verbatim) | commonName | note |
|---|---|---|
| 2,4-D ไดเมทิล แอมโมเนียม 84% SL (นำเข้า) | 2,4-D DIMETHYLAMMONIUM 84% W/V SL (IMPORTED) | |
| ฟิโนซาพรอป-พี-เอทิล 6.9% EW (นำเข้า) | FENOXAPROP-P-ETHYL 6.9% W/V EW (IMPORTED) | |
| สารเสริมประสิทธิภาพ (Adjuvent) (ไวท์ออย) | ADJUVANT (WHITE OIL) | ยืนยันชื่อ |
| อิมิดาคลอปริด 5% EC (นำเข้า) | IMIDACLOPRID 5% W/V EC (IMPORTED) | |
| อามีทราช 20% EC | AMITRAZ 20% W/V EC | |

- [ ] **Step 2: Confirm the 28 skipped duplicates** resolve to an already-present `commonName` (in the commit body). Examples: ไกลโฟเสท ×4 (list 2), คลอฟีนาเพอร์ 10% เอสซี (list 1), ไซเปอร์เมทริน 35%EC (list 1), สไปโรดิโคลเฟน 24% เอสซี (list 1), etc. If the validator reports a duplicate, that row was correctly a duplicate — remove it from the append.

- [ ] **Step 3: Validate.** Run: `node server/scripts/validate-product-density-ranges.js`
Expected: `✅ 167 entries valid.`

- [ ] **Step 4: Commit**

```bash
git add server/data/product-density-ranges.json
git commit -m "feat(density): seed product ถพ ranges — list 4 (5 new imports; 28 dup skipped)" -- server/data/product-density-ranges.json
```

---

### Task 6: Completeness reconciliation

**Files:** none (verification only).

- [ ] **Step 1: Re-run full validation.** Run: `node server/scripts/validate-product-density-ranges.js` → `✅ 167 entries valid.`
- [ ] **Step 2: Re-run validator unit tests.** Run: `node --test server/scripts/validate-product-density-ranges.test.js` → all pass.
- [ ] **Step 3: Reconcile counts against the source (71+45+50+33 = 199 source rows):**
  - list 1 → 71 entries
  - list 2 → 45 entries
  - list 3 → 46 entries + 4 excluded (= 50) ✓
  - list 4 → 5 entries + 28 duplicates skipped (= 33) ✓
  - Total entries = 71 + 45 + 46 + 5 = **167**. Confirm `data.length === 167`.
- [ ] **Step 4: Spot-check** that all `sgMin`/`sgMax` are `null` (e.g. `node -e "const d=require('./server/data/product-density-ranges.json'); console.log(d.every(e=>e.sgMin===null&&e.sgMax===null))"` → `true`).
- [ ] **Step 5:** No new commit needed (all data already committed). Report totals to the user.

## Self-Review

**Spec coverage:** file location (Task 2 creates `server/data/...`) ✓; entry schema (all tasks) ✓; English naming convention + dictionaries (Global Constraints + tables) ✓; decision 3 variants-separate (list-1 qualifier rows) ✓; decision 4 list-4 separate/dedup (Task 5) ✓; decision 5 list-3 liquids-only + no silent drops (Task 4 exclusions) ✓; uncertain-flagging (`note` col) ✓; validator + checks (Task 1) ✓; testing/verification + counts (Task 6) ✓.

**Placeholder scan:** none — every entry's `commonName`/`note` is given explicitly; validator code is complete.

**Type consistency:** `validateEntries` signature identical in Task 1 impl, test, and the CLI. Field names `commonName/thaiName/category/sgMin/sgMax/note` consistent across all tasks and the validator. Counts chain: 71 → 116 → 162 → 167 → 167.
