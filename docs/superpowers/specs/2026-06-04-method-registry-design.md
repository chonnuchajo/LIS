# Method Registry — เพิ่มวิธีทดสอบนอกเหนือจาก GC/HPLC

วันที่: 2026-06-04
สถานะ: รอ review

## ปัญหา / ที่มา

ปัจจุบัน Simple Method รองรับวิธีทดสอบแค่ `GC` กับ `HPLC` ซึ่งฮาร์ดโค้ดเป็น enum
อยู่หลายที่ในโค้ด แต่เอกสาร `FM-QP-07-01-002 R0 วิธีวิเคราะห์สารเคมีกำจัดศัตรูพืชฯ`
มีวิธีทดสอบมากกว่านั้น และบางสารใช้**หลายวิธีต่อเนื่องกัน**:

- `Digest , Titration` → Fosetyl aluminium, Mancozeb, Propineb
- `Reflux , Titration` → Sulfur
- `Titration` → Copper Hydroxide, Copper Oxychloride, Ethephon
- (เอกสารระบุว่ายังมีวิธีอื่นอีกในอนาคต)

ต้องการให้วิธีใหม่พวกนี้ทำงาน**เต็มรูปแบบเหมือน GC/HPLC** (เลือกเครื่องถ้ามี,
ตั้ง Standard Config, ไหลเข้า assign → lab testing/QC)

## Decisions (สรุปจากการ brainstorm)

1. **ขอบเขต:** วิธีใหม่ทำงานเต็มเหมือน GC/HPLC (ไม่ใช่แค่ป้ายกำกับ)
2. **เครื่อง:** ผสม — บางวิธีมีเครื่อง (ต้องเลือกตอน assign) บางวิธีเป็น bench (ไม่มีเครื่อง) → ต้องมี flag ต่อวิธี
3. **การจัดการรายชื่อวิธี:** admin เพิ่ม/แก้เองได้ (registry) ไม่ฮาร์ดโค้ด
4. **หลายวิธีต่อสาร:** multi-select = **AND** (ต้องทำครบทุกวิธี) — **เลิกแนวคิด `BOTH` (either-or) ทั้งหมด**
5. **Migrate ข้อมูลเดิม 50 row ที่เป็น `BOTH`:** ล้างเป็นว่าง `[]` (ยังไม่กำหนดวิธี) →
   admin ต้องเข้ามาเลือกวิธีจริงทีหลัง ระหว่างนั้น 50 item นี้จะ assign ไม่ได้ (ตาม gotcha เดิม:
   ไม่มี simple-method entry = block assign) — ปลอดภัยสุด ไม่เดาผิด

## สถาปัตยกรรม

### องค์ประกอบ (units)

แต่ละส่วนแยกอิสระ คุยกันผ่าน interface ชัดเจน:

```
Method registry (model + route + admin UI)
        │  (code, requiresMachine, machinePrefix, defaultTimes)
        ▼
SimpleMethod (methods: [[code]] positional, AND-set ต่อสาร)
        │
        ├──► หน้า Simple Method (MasterItems.tsx) — multi-select chips ต่อสาร
        ├──► Standard Config — instrument options + default rows จาก registry
        └──► Petition Assign — machine picker (วิธีมีเครื่อง) / chip (วิธี bench)
```

### 1. Method model (ใหม่) — `server/models/Method.js`

```js
{
  code:           String,   // unique, uppercase, immutable หลังสร้าง เช่น "GC","HPLC","TITRATION"
  label:          String,   // แสดงผล เช่น "Titration"
  requiresMachine: Boolean, // true = ต้องเลือกเครื่องตอน assign
  machinePrefix:  String,   // ใช้ match เครื่องจากชื่อ (เฉพาะ requiresMachine=true) เช่น "GC","HPLC"
  defaultTimes:   Number,   // default ของ Standard Config (>=1)
  order:          Number,   // ลำดับแสดง
  active:         Boolean,  // false = ซ่อนจากตัวเลือกใหม่ (ไม่ลบ เพื่อไม่ทำข้อมูลเก่าพัง)
}
```

**กฎ:**
- `code` ห้ามแก้/ลบถ้ายังมี SimpleMethod อ้างอิงอยู่ (กันข้อมูลกำพร้า) — ปิด `active` แทนการลบ
- ลบได้เฉพาะวิธีที่ไม่มี SimpleMethod และไม่มี StandardConfig อ้างอิง

**Route** `server/routes/methods.js`: GET (list, เรียง `order`), POST, PUT, DELETE
(พร้อมเช็ค reference ก่อนลบ) — mount ผ่าน `mountApi()` ตามแพทเทิร์นเดิม

**Seed เริ่มต้น** (ผ่าน `ensureDefaults()` ตอน boot คล้าย standardConfigs):

| code | label | requiresMachine | machinePrefix | defaultTimes |
|---|---|---|---|---|
| GC | GC | true | GC | 3 |
| HPLC | HPLC | true | HPLC | 1 |
| TITRATION | Titration | false | — | 1 |
| DIGEST | Digest | false | — | 1 |
| REFLUX | Reflux | false | — | 1 |

> GC/HPLC ค่า defaultTimes = 3/1 ตามของเดิม. ตัวใหม่ตั้ง 1 ไว้ก่อน admin มาปรับ.
> GC/HPLC ถือเป็น built-in: ห้ามลบ, แก้ defaultTimes/label ได้ แต่ห้ามแก้ requiresMachine/machinePrefix
> (เพื่อไม่ให้ machine matching เดิมพัง)

### 2. SimpleMethod model — เปลี่ยนเป็นชุดวิธีต่อสาร

`server/models/SimpleMethod.js`

- เดิม: `instruments: [String]` (1 ค่า/ตำแหน่งสาร, ค่าได้ `"GC"|"HPLC"|"BOTH"|""`)
- ใหม่: `methods: [[String]]` (positional เหมือนเดิม index = `parseSubstances()[i]`,
  แต่ละตำแหน่ง = **array ของ method code ที่ต้องทำครบทุกอัน (AND)**)

ตัวอย่าง:
- สารเดี่ยว GC → `[["GC"]]`
- สาร 2 ตัว GC+HPLC → `[["GC"],["HPLC"]]`
- Mancozeb (Digest+Titration) → `[["DIGEST","TITRATION"]]`
- ยังไม่กำหนด → `[[]]`

> คง positional contract เดิม (ดู memory: simple-method instruments เก็บแบบ positional) —
> ห้าม flatten, ต้อง align กับ `parseSubstances` ทุกจุดที่อ่าน

**Backward compatibility ระหว่างเปลี่ยน:**
- เพิ่ม field `methods` ใหม่ ไม่ลบ `instruments` ทันที
- ฝั่งอ่าน: helper `readSlotMethods(entry)` — ถ้ามี `methods` ใช้เลย,
  ถ้าไม่มีให้ map จาก `instruments` (string → `[string]`, `"BOTH"` → `[]`, `""` → `[]`)
- ฝั่งเขียน: เขียน `methods` เป็นหลัก
- หลัง migration เสถียรแล้วค่อยลบ `instruments` ใน cleanup รอบถัดไป (นอก scope spec นี้)

### 3. Migration — `server/scripts/migrate-simplemethod-to-methods.js`

แปลงทุก doc: `instruments[i]` → `methods[i]`:

| ค่าเดิม | ค่าใหม่ |
|---|---|
| `"GC"` | `["GC"]` |
| `"HPLC"` | `["HPLC"]` |
| `""` | `[]` |
| `"BOTH"` | `[]` (ล้างเป็นว่าง ตาม decision #5) |

- รูปแบบเดียวกับ scripts เดิมใน `server/scripts/` (มี dry-run + commit mode)
- หลังรัน: log จำนวน BOTH ที่ถูกล้าง (คาด 50 row) เพื่อให้ admin ตามไปกรอกวิธีจริง
- รัน `npm run seed:export` + commit หลัง migrate (ตามกฎ seed-data ต้องตรงกับ DB)

### 4. หน้า Simple Method (`src/pages/MasterItems.tsx`)

จุดที่แก้ (อ้างอิงโค้ดปัจจุบัน):

- ลบ `type SimpleInstrument = "GC"|"HPLC"`, `AssignmentSlot` (`|"BOTH"|""`),
  `INSTRUMENT_ORDER`, `toggleInstrument`, `normalizeAssignment` (BOTH logic)
- โหลด method registry ผ่าน React Query → ใช้ `active` methods เป็นตัวเลือก
- แต่ละตำแหน่งสาร = **multi-select chips** (toggle หลายอันได้, ความหมาย AND);
  ไม่มีปุ่ม BOTH อีกต่อไป
- `detectInstruments` (regex auto-เดาจาก method string ของ ERP): ขยายให้ detect
  keyword ของทุกวิธีใน registry (GC/HPLC/Titration/Digest/Reflux/…) เป็น **คำแนะนำเริ่มต้น**
  เท่านั้น — admin ยังเลือกเอง (registry-driven keyword list)
- ตัวกรอง (`SimpleMethodFilter`): เดิม `all|gc-only|hplc-only|both|unassigned` →
  ปรับเป็น `all` + filter ต่อวิธี (เลือกวิธีจาก registry) + `unassigned` (slot ว่าง);
  เอา `both` ออก
- Bulk-apply (`applyBulk`): apply วิธีที่เลือกให้ทุก slot ของแถว

### 5. Standard Config

`src/lib/standardConfig.ts`:
- `type Instrument = "GC"|"HPLC"` → `type MethodCode = string` (รับ code จาก registry)
- `validateStandardConfigInput`: เดิมเช็ค `!== "GC" && !== "HPLC"` →
  เช็คว่า code อยู่ใน registry (active) — รับ list ของ valid codes เข้ามา หรือ validate ฝั่ง server

`server/routes/standardConfigs.js`:
- `ensureDefaults()`: เดิม fix `[{GC,3},{HPLC,1}]` → สร้าง default row ต่อ **ทุก method ใน registry**
  จาก `defaultTimes` (default row = `scope:'all'`, `isDefault:true`)
- validation `instrument === 'GC' || 'HPLC'` → เช็คกับ registry
- default row ของวิธีที่ถูกปิด `active`: คงไว้ (ไม่ลบ) แต่ซ่อนจาก UI เลือกใหม่

`src/pages/StandardConfig.tsx`:
- dropdown `["GC","HPLC"]` → ดึงจาก registry (`active` methods)
- default rows แสดงครบทุกวิธี

### 6. Petition Assign (`src/pages/PetitionAssignPage.tsx`)

- `type Instrument='GC'|'HPLC'`, `SlotRequirement` (BOTH) → ใช้ method code + registry
- `machineInstrument(machine)`: เดิม match จากชื่อขึ้นต้น HPLC/GC →
  generalize เป็น match `machinePrefix` ของทุกวิธีที่ `requiresMachine` (เรียงตรวจ prefix ยาวก่อนสั้น
  กัน GC/HPLC ชนกัน เหมือน logic เดิม)
- ต่อสาร: อ่านชุดวิธี (AND) จาก SimpleMethod
  - วิธีที่ `requiresMachine=true` → แสดง machine picker filter ด้วย `machinePrefix` (ต้องเลือกครบทุกวิธีที่มีเครื่อง)
  - วิธีที่ `requiresMachine=false` (bench) → แสดง chip "ทำที่โต๊ะ (ไม่ต้องเลือกเครื่อง)" auto-ผ่าน
- เอา BOTH/either-or logic (`machineMatchesSlot` รับ BOTH) ออก
- กฎเดิมคงไว้: สารที่ slot ว่าง (`[]`) / ไม่มี simple-method entry → lock + block ปุ่ม Assign
  (ดู memory: PetitionAssign no method → block Assign)

### 7. จุดอื่นที่อ้าง GC/HPLC (ปรับให้ไม่พัง)

- `src/lib/api.ts`: เพิ่ม endpoint methods registry (`getMethods` ฯลฯ)
- `src/pages/Report.tsx`, `src/pages/AdminData.tsx`: ตรวจการอ้าง GC/HPLC แล้วปรับให้ดึงจาก registry
  หรือแสดง code ตรงๆ
- `src/data/mockData.ts`: อัปเดต mock ให้สอดคล้อง (ถ้ามีใช้ในเทสต์)

## Data flow

1. Admin ตั้งวิธีใน Method registry (admin UI ใหม่)
2. Admin map วิธีต่อสารในหน้า Simple Method → `SimpleMethod.methods[[…]]`
3. ตอนสร้าง petition → Assign: ระบบอ่านชุดวิธีต่อสาร
   - วิธีมีเครื่อง → เลือกเครื่อง (filter ด้วย machinePrefix)
   - วิธี bench → ผ่านอัตโนมัติ
4. Standard Config: ดึง default times ต่อวิธีจาก registry; admin override ต่อสารได้
5. ผลไหลเข้า lab testing/QC ตามเครื่อง/วิธีที่ assign

## Error handling

- ลบวิธีที่ยังถูกอ้างอิง → 409 + ข้อความไทย แนะนำให้ปิด `active` แทน
- assign สารที่ slot ว่าง → block ปุ่ม + ข้อความไทย (ตามเดิม)
- StandardConfig: validate code กับ registry, times เป็น int 1–100000 (กฎเดิม)
- migration: dry-run ก่อน, log ทุก BOTH ที่ล้าง

## Testing

- **Vitest (unit):**
  - `standardConfig.test.ts`: validate code จาก registry, default rows ครบทุกวิธี
  - helper `readSlotMethods` (backward-compat instruments→methods, BOTH→[])
  - `machineInstrument` generalize (match machinePrefix, prefix ยาวก่อน)
  - migration mapping (GC→[GC], BOTH→[], ""→[])
- **Vitest (component):** MasterItems multi-select chips (toggle หลายวิธี = AND, ไม่มี BOTH)
- **Playwright (e2e):** เพิ่มวิธีใหม่ใน registry → map ให้สาร → assign (วิธี bench ผ่านไม่ต้องเลือกเครื่อง)
- รัน `npx tsc --noEmit` (ไม่ใช้ `npm run build` — ตาม CLAUDE.md)

## ของที่ "ไม่ทำ" (YAGNI / นอก scope)

- ไม่ทำ OR/either-or per slot (เลิก BOTH ถาวร)
- ไม่ลบ field `instruments` ในรอบนี้ (เก็บไว้ backward-compat, ลบรอบ cleanup ทีหลัง)
- ไม่เดา/เติมวิธีให้ 50 row BOTH อัตโนมัติ (ล้างเป็นว่าง ให้ admin กรอกเอง)
- ไม่ทำ ordering ระหว่างวิธีใน AND-set (Digest "ก่อน" Titration) — เก็บเป็น set, ลำดับการทำจริงเป็น SOP นอกระบบ

## ลำดับการ implement (จะลงรายละเอียดใน plan)

1. Method model + route + ensureDefaults + seed → `npm run seed:export`
2. SimpleMethod `methods` field + `readSlotMethods` helper + backward-compat read
3. Migration script (dry-run + commit) → รัน → seed:export + commit
4. หน้า Simple Method multi-select chips
5. Standard Config generalize (lib + route + page)
6. Petition Assign generalize (machine picker / bench chip)
7. Admin UI สำหรับ Method registry
8. จุดอื่น (api.ts, Report, AdminData, mockData) + tsc + tests
