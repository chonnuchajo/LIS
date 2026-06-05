# Handoff: ใบวางแผน-ควบคุมการผลิต (Production Plan Form)

ฟอร์ม "ใบวางแผน-ควบคุมการผลิต" เป็นเอกสารหมายเลข 2 ในชุด petition ของแผนกผลิต (`dept: 'production'`)
ฝังเป็น array `productionPlans[]` ในแต่ละ petition (1 ใบต่อ 1 batch แต่กรอกครั้งเดียวใช้ได้ทุก batch ในชุด)

ฟอร์มแบ่งเป็น **4 ส่วน**:
1. การวางแผนผลิต (วันที่ / ชื่อสามัญ / จำนวน / batch / รายชื่อพนักงาน)
2. ตรวจสอบสภาพเครื่องจักร (checklist 12 หัวข้อ)
3. ตรวจสอบการทำความสะอาดเครื่องจักร
4. การควบคุมการผลิต (เริ่ม/จบ, downtime, ตรวจกายภาพ, ชั่งน้ำหนัก 30×9, ขั้นตอนการผลิต 30 แถว, ลายเซ็น)

---

## แผนผังไฟล์

| Layer | ไฟล์ | หน้าที่ |
|---|---|---|
| **Type** | `src/types/productionPlan.types.ts` | interface + ค่าคงที่ + helper (`makeBlankProductionPlan`, `isLabBatch`) |
| | `src/types/petition.types.ts` (บรรทัด 1, 202) | ฝัง `productionPlans: ProductionPlan[]` |
| **UI (กรอก)** | `src/components/petition/wizard/ProductionPlanStep.tsx` | container + tabs 4 ส่วน |
| | `src/components/petition/wizard/sections/PlanSection1.tsx` | ส่วนที่ 1 |
| | `src/components/petition/wizard/sections/PlanSection2.tsx` | ส่วนที่ 2 |
| | `src/components/petition/wizard/sections/PlanSection3.tsx` | ส่วนที่ 3 |
| | `src/components/petition/wizard/sections/PlanSection4.tsx` | ส่วนที่ 4 (ใหญ่สุด) |
| **Print** | `src/components/petition/ProductionPlanPrintTemplate.tsx` | เทมเพลตพิมพ์ A4 (มี inline CSS) |
| **Backend** | `server/models/Petition.js` (บรรทัด 60–176, 218) | Mongoose sub-schema |
| | `server/routes/petitions.js` (บรรทัด 304–314) | validation ตอนสร้าง petition |
| **ใช้งานในหน้า** | `src/pages/petitions/ProductionPetitionNewPage.tsx` | หน้าสร้าง |
| | `src/pages/PetitionEditPage.tsx`, `PetitionDetailPage.tsx` | แก้/ดู |
| **Tests** | `tests/e2e/production-plan-print.spec.ts` | E2E พิมพ์ |

UI ใช้ shadcn/ui primitives: `Input`, `Label`, `Textarea`, `Checkbox`, `Button`, `Tabs` (จาก `src/components/ui/`)
สี Tailwind ใช้ prefix `lis.*` และ palette `grey-*`, `black-*`, `primary-*`

---

## โครงสร้างข้อมูล (สำคัญสุด — เริ่มอ่านจากตรงนี้)

หมายเหตุพฤติกรรม:
- `machineChecks[i].ok` เป็น tri-state: `true` = ใช้ได้, `false` = ใช้ไม่ได้, `undefined` = ยังไม่เลือก (ทั้ง physicalChecks `pass1`/`pass2` ก็แบบเดียวกัน)
- `weighingRows` = 30 แถวคงที่ แต่ละแถวมี `amounts` 9 ช่อง
- `steps` = 30 แถวคงที่
- `isLabBatch(batchNo)` = batch ที่ลงท้าย `1` หรือ `6` (แสดงดาว ★ ใน UI)
- วันที่เก็บเป็น ISO string (`type="date"`), เวลาเป็น `HH:mm`, การพิมพ์แปลงเป็น พ.ศ. แบบสั้น `dd/mm/yy`

### `src/types/productionPlan.types.ts`

```ts
export interface MachineCheck {
  name: string;
  ok?: boolean;
  dateOk?: string;
}

export interface PhysicalCheck {
  name: string;
  result1?: string;
  pass1?: boolean;
  inspector1?: string;
  result2?: string;
  pass2?: boolean;
}

export interface WeighingRow {
  seq: number;
  rawMaterial?: string;
  amounts: (number | null)[];
}

export interface ProductionStep {
  description?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
}

export interface DowntimeEntry {
  fromTime?: string;
  toTime?: string;
  reason?: string;
}

export interface CleaningRecord {
  continuous: boolean;
  solvent?: number;
  water?: number;
  kaolin?: number;
  sand?: number;
  inspectedBy?: string;
  inspectedAt?: string;
}

export interface ProductionPlan {
  batchNo: string;
  batchNos?: string[];

  // ส่วนที่ 1
  planDate?: string;
  productionDate?: string;
  commonName?: string;
  quantity?: string;
  staffNames?: string;

  // ส่วนที่ 2
  machineChecks: MachineCheck[];
  machineInspectedBy?: string;
  machineInspectedAt?: string;
  machineDefectNote?: string;

  // ส่วนที่ 3
  cleaning: CleaningRecord;

  // ส่วนที่ 4
  actualStart?: { date?: string; time?: string };
  actualEnd?: { date?: string; time?: string };
  actualQty?: string;
  downtimes: DowntimeEntry[];
  physicalChecks: PhysicalCheck[];
  sendToLab?: boolean;
  followUpFail1?: string;
  followUpFail2?: string;
  weighingRef?: { docNo?: string; docDate?: string };
  weighingRows: WeighingRow[];
  weigher?: string;
  weigherTime?: string;
  weighSupervisor?: string;
  weighSupervisorTime?: string;
  mixer?: string;
  mixerTime?: string;
  mixSupervisor?: string;
  mixSupervisorTime?: string;
  steps: ProductionStep[];
  approver?: string;
  approvedAt?: string;
}

export const MACHINE_CHECK_NAMES = [
  '1.   สวิตซ์ไฟเมน',
  '2.   แผงควบคุมเครื่องผสม',
  '3.   แผงควบคุมเครื่องชั่งทราย',
  '4.   แผงควบคุมถังอบแห้ง',
  '5.   เครื่องบดละเอียด',
  '6.   เครื่องป้อนสาร',
  '7.   เครื่องบดเหลว',
  '8.   เครื่องกรอง',
  '9.   เครื่องชั่งน้ำหนัก',
  '10. เครื่องดักฝุ่น',
  '11.ระบบบำบัดอากาศ',
  '12.',
] as const;

export const PHYSICAL_CHECK_NAMES = [
  '1. การละลาย',
  '2. การเคลือบเม็ดทราย',
  '3. ค่า ถพ.',
] as const;

export function makeBlankProductionPlan(batchNo: string, batchNos?: string[]): ProductionPlan {
  return {
    batchNo,
    batchNos: batchNos ?? [batchNo],
    planDate: '',
    productionDate: '',
    commonName: '',
    quantity: '',
    staffNames: '',
    machineChecks: MACHINE_CHECK_NAMES.map((name) => ({ name })),
    cleaning: { continuous: false },
    downtimes: [],
    physicalChecks: PHYSICAL_CHECK_NAMES.map((name) => ({ name })),
    weighingRows: Array.from({ length: 30 }, (_, i) => ({
      seq: i + 1,
      amounts: Array.from({ length: 9 }, () => null),
    })),
    steps: Array.from({ length: 30 }, () => ({})),
  };
}

export function isLabBatch(batchNo: string): boolean {
  const last = batchNo.trim().slice(-1);
  return last === '1' || last === '6';
}
```

---

## Backend schema — `server/models/Petition.js` (ส่วนที่เกี่ยว)

```js
const PhysicalCheckSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    result1: String,
    pass1: Boolean,
    inspector1: String,
    result2: String,
    pass2: Boolean,
  },
  { _id: false },
);

const WeighingRowSchema = new mongoose.Schema(
  {
    seq: { type: Number, required: true },
    rawMaterial: String,
    amounts: { type: [Number], default: [] },
  },
  { _id: false },
);

const ProductionStepSchema = new mongoose.Schema(
  {
    description: String,
    startDate: String,
    startTime: String,
    endDate: String,
    endTime: String,
  },
  { _id: false },
);

const DowntimeSchema = new mongoose.Schema(
  {
    fromTime: String,
    toTime: String,
    reason: String,
  },
  { _id: false },
);

// (MachineCheckSchema มี: name, ok:Boolean, dateOk:String)

const ProductionPlanSchema = new mongoose.Schema(
  {
    batchNo: { type: String, required: true },
    batchNos: { type: [String], default: undefined },

    // ส่วนที่ 1
    planDate: String,
    productionDate: String,
    commonName: String,
    quantity: String,
    staffNames: String,

    // ส่วนที่ 2
    machineChecks: { type: [MachineCheckSchema], default: [] },
    machineInspectedBy: String,
    machineInspectedAt: String,
    machineDefectNote: String,

    // ส่วนที่ 3
    cleaning: {
      continuous: { type: Boolean, default: false },
      solvent: Number,
      water: Number,
      kaolin: Number,
      sand: Number,
      inspectedBy: String,
      inspectedAt: String,
    },

    // ส่วนที่ 4
    actualStart: { date: String, time: String },
    actualEnd: { date: String, time: String },
    actualQty: String,
    downtimes: { type: [DowntimeSchema], default: [] },
    physicalChecks: { type: [PhysicalCheckSchema], default: [] },
    sendToLab: Boolean,
    followUpFail1: String,
    followUpFail2: String,
    weighingRef: { docNo: String, docDate: String },
    weighingRows: { type: [WeighingRowSchema], default: [] },
    weigher: String,
    weigherTime: String,
    weighSupervisor: String,
    weighSupervisorTime: String,
    mixer: String,
    mixerTime: String,
    mixSupervisor: String,
    mixSupervisorTime: String,
    steps: { type: [ProductionStepSchema], default: [] },
    approver: String,
    approvedAt: String,
  },
  { _id: false },
);

// ฝังใน PetitionSchema:  productionPlans: { type: [ProductionPlanSchema], default: [] },
```

### Validation — `server/routes/petitions.js` (~บรรทัด 304)

```js
if (body.dept === 'production') {
  if (!Array.isArray(body.productionPlans) || body.productionPlans.length === 0) {
    return badRequest(res, 'แผนกผลิตต้องมีใบวางแผนอย่างน้อย 1 รายการ');
  }
  const itemBatches = new Set(body.items.map((it) => String(it.batchNo).trim()));
  for (const plan of body.productionPlans) {
    if (!plan.batchNo || !itemBatches.has(String(plan.batchNo).trim())) {
      return badRequest(res, `ใบวางแผนอ้างถึง batchNo ที่ไม่อยู่ในรายการตัวอย่าง: ${plan.batchNo}`);
    }
  }
}
```

---

## โค้ด UI เต็ม

โค้ดเต็มของ component ทั้ง 5 ตัวอยู่ในไฟล์จริง (อ้างอิงตามตาราง path ด้านบน):

- `ProductionPlanStep.tsx` — container ที่ render `<Tabs>` 4 ส่วน, รับ props `{ items, plan, onChange }`, กรองหา `batchNos` จาก items
- `PlanSection1.tsx` — input วันที่/ชื่อสามัญ/จำนวน, แสดง batchNos (read-only), helper `set()` ที่ merge `batchNos` กลับเสมอ
- `PlanSection2.tsx` — ตาราง machineChecks (checkbox tri-state ใช้ได้/ใช้ไม่ได้ + วันที่)
- `PlanSection3.tsx` — checkbox "งานต่อเนื่อง" (disable ช่องสารทำความสะอาดเมื่อ continuous=true)
- `PlanSection4.tsx` — ใหญ่สุด: actual start/end, downtime (เพิ่ม/ลบแถวได้), ตารางตรวจกายภาพ, ตารางชั่ง 30×9, ตารางขั้นตอน 30 แถว, บล็อกลายเซ็น

> เนื่องจากไฟล์ยาว ให้เปิดอ่านโดยตรงในโปรเจกต์ ไม่ได้ paste ซ้ำในเอกสารนี้เพื่อกันโค้ดเก่า/ใหม่ไม่ตรงกัน

---

## วิธีรัน / ทดสอบ

```bash
npm run dev                    # frontend :8000
cd server && npm run dev       # backend :3001
npx tsc --noEmit               # type-check (อย่าใช้ npm run build ระหว่าง dev)
npx playwright test tests/e2e/production-plan-print.spec.ts
```

เข้าทดสอบฟอร์ม: สร้าง petition แผนกผลิตที่หน้า `ProductionPetitionNewPage` → ไปจนถึง step "ใบวางแผน-ควบคุมการผลิต"
ดูพรีวิวพิมพ์ผ่าน `ProductionPlanPrintTemplate` (เปิดในหน้า detail/print ของ petition)
