# Product density (ถพ) reference ranges — data file

**Date:** 2026-07-02
**Status:** Approved (approach), pending spec review
**Scope:** One hand-authored data file under `server/data/` + a small Node validation script under `server/scripts/`. **No** DB model, route, UI, or abnormal-detection wiring in this phase.

## Problem

The product list (สาร/ผลิตภัณฑ์) was given in Thai across 4 category lists (~200 rows).
The user wants a **structured data file** that, per product, holds an expected
**specific-gravity (ถพ) range** (`min`–`max`). The values will be filled in by
the user later; this phase produces the *structure* + the *English product names*
+ empty range slots.

Key facts discovered during brainstorming:

- In the LIS system, a product is identified by its **`commonName`, which is
  already English**, UPPERCASE, in the form
  `ACTIVE 10% W/V EC` / `A 5% + B 25% W/V SC` (see `CommonNameOverride` seed and
  real `Petition.commonName` values, e.g. `CHLOROTHALONIL 50% W/V SC`,
  `THIAMETHOXAM 14.1% + LAMBDA-CYHALOTHRIN 10.6% ZC`,
  `GLUFOSINATE-AMMONIUM 15% W/V SL-HI`). So "เปลี่ยนชื่อเป็น eng" means:
  render each Thai product name in this canonical English `commonName` form.
- ถพ itself is a QC parameter value field (`formSpecificGravity.ts`,
  `SG_FIELD_LABEL = 'ค่าถพ.'`). Today a range can only be expressed once at the
  parameter level (`standardOperator: 'between'` + `standardValue`/`standardValue2`),
  shared by all products. There is **no per-product range** yet. This file is the
  seed for that future capability.

## Goal / Non-goals

**Goal:** produce `server/data/product-density-ranges.json` — every in-scope
product as one entry with a canonical English `commonName`, its original Thai
name, source category, and empty `sgMin`/`sgMax` for the user to fill. Plus a
validation script.

**Non-goals (explicitly out of scope this phase):**

- No `ProductDensityRange` Mongoose model, no route, no Settings UI.
- No wiring into ถพ abnormal detection / QC flow.
- No importer into MongoDB (the file is standalone reference data the user edits).
  An import step is a later phase, decided after values are filled.

## Decisions (from brainstorming)

1. **Key granularity = full product** (with `%` and formulation code), not just the
   active ingredient — ถพ depends on the full formulation (10% vs 35% EC differ).
2. **English name** follows the system `commonName` convention (UPPERCASE, `W/V`
   for liquids, form code, ` + ` between substances). Original Thai kept as a
   secondary field.
3. **Variant qualifiers** (อย./ปศุสัตว์/ไบโอ/นำเข้า/สูตรน้ำ/หนัก-เบา…) are kept
   as distinct entries (distinct `commonName`), since density may differ.
4. **List 4 (นำเข้า / re-labeled imports)** that duplicate lists 1–2 are kept as
   **separate entries** (suffix/`note` = imported), not merged.
5. **List 3 (fertilizers/additives/brand codes): include liquids only** — items
   where ถพ is meaningful. Solids/powders/technical-grade are excluded.
6. Uncertain translations (brand names, code-A items) are transliterated and
   **flagged in `note`** for the user to confirm the canonical name.

## File

**Location:** `server/data/product-density-ranges.json` — a hand-maintained plain
JSON array, matching the existing `server/data/machines-seed.json` precedent.
`server/data/` is **not** touched by `export-data.js`/auto-sync (which only writes
`server/seed-data/`), so hand edits are safe.

**Entry schema:**

```json
{
  "commonName": "CYPERMETHRIN 10% W/V EC",
  "thaiName": "ไซเปอร์เมทธิน 10% อีซี",
  "category": "insecticide",
  "sgMin": null,
  "sgMax": null,
  "note": ""
}
```

| field        | type            | rule |
|--------------|-----------------|------|
| `commonName` | string          | Canonical English, UPPERCASE, unique across the file. The key. |
| `thaiName`   | string          | Original Thai as given (verbatim). |
| `category`   | string enum     | `insecticide` \| `herbicide` \| `fertilizer` \| `solvent` \| `imported` (source list; list4 → `imported`; pure solvents in list1 → `solvent`). |
| `sgMin`      | number \| null  | Range start; `null` until the user fills it. |
| `sgMax`      | number \| null  | Range end; `null` until the user fills it. |
| `note`       | string          | Empty, or a flag: `"ยืนยันชื่อ"` (brand/uncertain), `"pairs with <thai>"` for import duplicates, etc. |

Range is two nullable numbers (not a string) so a later importer can consume it
directly and map to `standardValue`/`standardValue2` (`between`).

## Naming convention (Thai → canonical English `commonName`)

Applied deterministically; the dictionaries below drive the translation.

**Assembly:** `<ACTIVE(S)> <conc>% [W/V] <FORMCODE> [(QUALIFIER)]`; multiple actives
joined ` + ` in the order written; add `W/V` for liquid concentrations (matches
system convention). All UPPERCASE.

**Formulation codes (Thai → code):**

| Thai | Code | phase |
|------|------|-------|
| อีซี | EC | liquid |
| เอสซี / SC | SC | liquid |
| เอสแอล / SL | SL | liquid |
| อีดับเบิ้ลยู / อีดับเบิลยู / EW | EW | liquid |
| เอ็มอี / ME | ME | liquid |
| ZC | ZC | liquid |
| AC | AC | liquid |
| เทค / TECH | TECH | usually solid → likely **excluded** |
| WP / WG / GR | WP/WG/GR | solid → **excluded** |

**Qualifier map (Thai → English, parenthetical suffix):**

| Thai | English |
|------|---------|
| (อย.) | (FDA) |
| (ปศุสัตว์) / ปศุสัตว์ | (LIVESTOCK) |
| ไบโอ | (BIO) |
| (นำเข้า) | (IMPORTED) |
| สูตรน้ำ | (WATER-BASED) |
| (หนัก) / (เบา) | (HEAVY) / (LIGHT) |
| (ผสมเอง) | (SELF-MIXED) |
| (50 ซีพี) | (50 CP) |
| (สูตรสีน้ำตาล ไม่เหนียว) / (สูตรสีเหลือง ไม่เหนียว) | (BROWN, NON-STICKY) / (YELLOW, NON-STICKY) |
| (ใช้ NMP) / (ใช้ DMF, DMSO) | (NMP) / (DMF, DMSO) |
| (Premium) / (Low-price) | (PREMIUM) / (LOW-PRICE) |
| No SFN / + เซฟเฟอร์เนอร์ (SFN) / + เฟนโคริม | (NO SAFENER) / (+ SAFENER) / (+ FENCLORIM) |

Regulatory-authority abbreviations (`FDA`/`LIVESTOCK`) are a reasonable default;
user may override during review.

**Active-ingredient dictionary (Thai → ISO English):**

Insecticides/PGR/fungicides: คลอฟีนาเพอร์=CHLORFENAPYR · จิบเบอเรลลิก แอซิด=GIBBERELLIC ACID ·
ไซเปอร์เมทธิน/ไซเปอร์เมทริน=CYPERMETHRIN · เดลทราเมทริน=DELTAMETHRIN · ไดฟีโนโคนาโซล=DIFENOCONAZOLE ·
อะซอกซีสโตรบิน=AZOXYSTROBIN · โพรพิโคนาโซล/โพรพิโคนาซอล=PROPICONAZOLE · โพรคลอราซ=PROCHLORAZ ·
ไทอะมีทอกแซม=THIAMETHOXAM · แลมป์ด้า-ไซฮาโลทริน/แลมด้า=LAMBDA-CYHALOTHRIN · บาซิลลัส=BACILLUS THURINGIENSIS ·
บูโพฟีซิน=BUPROFEZIN · ไบเฟนทริน=BIFENTHRIN · โปรฟีโนฟอส=PROFENOFOS · พิริมิฟอส-เมทิล=PIRIMIPHOS-METHYL ·
โพรพาโมคาร์บ=PROPAMOCARB · เพอร์เมทริน=PERMETHRIN · ฟิโปรนิล=FIPRONIL · ฟีโนบูคาร์บ=FENOBUCARB (BPMC) ·
ลูฟีนูรอน=LUFENURON · ไบเพอร์โรนิล=PIPERONYL BUTOXIDE · เตตระเมทริน=TETRAMETHRIN · สไปโรดิโคลเฟน=SPIRODICLOFEN ·
อะเซทามิปริด=ACETAMIPRID · อะบาเมคติน/อะบาแม็คติน=ABAMECTIN · อามีทราซ=AMITRAZ · อิมิดาคลอปริด=IMIDACLOPRID ·
อินด็อกซาคาร์บ=INDOXACARB · อีเทฟอน=ETHEPHON · อีโทเฟนฟร็อกซ์=ETOFENPROX · อีมาเม็คติน=EMAMECTIN BENZOATE ·
โอเมทโธเอท=OMETHOATE · เฮ็กซาโคนาโซล=HEXACONAZOLE

Herbicides: 2,4-ดี ไดเมทิล แอมโมเนียม=2,4-D DIMETHYLAMMONIUM · 2,4-ดี ไตรไอโซโพรพาโนลามีน ซอลท์=2,4-D-TRIISOPROPANOLAMINE SALT ·
พิโคแรม=PICLORAM · กลูโฟซิเนต-แอมโมเนียม=GLUFOSINATE-AMMONIUM · ไกลโฟเสท=GLYPHOSATE ·
คลอโลทาโลนิล/คลอโรทาโลนิล/คลอโรทาโรนิล=CHLOROTHALONIL · ครีซอกซิม เมทิล=KRESOXIM-METHYL ·
ควิซาโลฟอบ-พี-เอทิล=QUIZALOFOP-P-ETHYL · คาร์เบนดาซิม=CARBENDAZIM · โคลมาโซน=CLOMAZONE · โพรพานิล=PROPANIL ·
ไซฮาโลฟอบ-บิวทิล=CYHALOFOP-BUTYL · ฟลูอะซิฟอบ-พี-บิวทิล=FLUAZIFOP-P-BUTYL · โฟมีซาเฟน=FOMESAFEN · ไดยูรอน=DIURON ·
ไดควอต ไดโบรไมด์=DIQUAT DIBROMIDE · ไตรโคลเพอร์ บิวท็อกซี่เอทิล เอสเทอร์=TRICLOPYR BUTOXYETHYL ESTER ·
ทีบูโคนาโซล=TEBUCONAZOLE · บิวตาคลอร์=BUTACHLOR · เฟนโคริม=FENCLORIM · บีสไพรีแบค-โซเดียม=BISPYRIBAC-SODIUM ·
เพนดิเมทาลิน=PENDIMETHALIN · เพรตติลาคลอร์=PRETILACHLOR · แพคโคบิวทราโซล=PACLOBUTRAZOL · เมโทลาคลอร์=METOLACHLOR ·
ออกซาไดอะซอน/ออกซ่าไดอะซอน=OXADIAZON · อะเซโตคลอร์/อะเซทโตคลอร์=ACETOCHLOR · อะนิโลฟอส=ANILOFOS · อะมีทรีน=AMETRYN ·
ฮาลอกซิฟอบ-พี-เมทิล=HALOXYFOP-P-METHYL · ฟิโนซาพรอป-พี-เอทิล=FENOXAPROP-P-ETHYL

Solvents (list1, category=`solvent`): โซลเวสโซ่-100/150=SOLVESSO-100/150 · ไซลีน=XYLENE ·
ไดเอชเทอลีน ไกลคอล=DIETHYLENE GLYCOL · เมทานอล=METHANOL · เมทิล เอสเทอร์=METHYL ESTER · อะซีโตน=ACETONE
(these have no `%`/form code — `commonName` = the substance name alone).

**Products with no standard active-`%`/form code** (pure solvents above, and list-3
brand items like SUPER FIFTY / SIMINO): `commonName` = the transliterated
name alone (UPPERCASE), no `W/V`/form suffix. Brand items also get `note="ยืนยันชื่อ"`.

List-3 liquids (best-effort, most `note="ยืนยันชื่อ"`): ซุปเปอร์ฟิฟตี้=SUPER FIFTY ·
ซุปเปอร์ซีวีด=SUPER SEAWEED · โซเดียมฮิวเมท=SODIUM HUMATE · โปรตีนไฮโดรไลเซส=PROTEIN HYDROLYSATE ·
อะมิโนแอซิด=AMINO ACID · ฟลูวิก้า=FULVICA · NAA=NAA · สารปรับสภาพน้ำ=WATER CONDITIONER · etc.
**Excluded (solid/technical):** ไดฟิทิอาโลน…เทค=DIFETHIALONE TECH, โบรดิฟาคุม…เทค=BRODIFACOUM TECH,
โบรมาดิโอโลน…เทค=BROMADIOLONE TECH, and any WP/WG/GR/powder/technical row.

## Validation script

`server/scripts/validate-product-density-ranges.js` (Node, no DB). Run manually /
in a test. Checks:

- Valid JSON, top-level array.
- Each entry has required keys with correct types.
- `commonName` non-empty and **unique** (case-insensitive).
- `commonName` is uppercase and contains no Thai characters.
- If both `sgMin` and `sgMax` are non-null → `sgMin <= sgMax`.
- `category` is one of the allowed enum values.
- Exit non-zero + list offending rows on failure.

## Testing / verification

- Run the validation script → passes on the authored file.
- Spot-check ~10 translated names against the system convention (uppercase, `W/V`,
  form code, ` + ` join) and against real `commonName` samples.
- Confirm every source row is accounted for: either present as an entry, or listed
  in an "excluded (solid)" section of the plan with reason (no silent drops).
  Source counts: list1=71, list2=45, list3=50 (liquids only; rest excluded),
  list4=33. In-scope entries ≈ 71 + 45 + (list-3 liquids) + 33; the excluded note
  must cover the remaining list-3 rows so 50 is fully reconciled.
- Confirm all `sgMin`/`sgMax` are `null` (values are the user's to fill).

## Deliverables

1. `server/data/product-density-ranges.json` — all in-scope products, empty ranges.
2. `server/scripts/validate-product-density-ranges.js` — validator.
3. A short "excluded rows" note (in the impl plan / commit) documenting which
   list-3 solids were dropped and why.
