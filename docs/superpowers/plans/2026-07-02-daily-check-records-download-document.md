# โหลดเอกสารบันทึกการเช็กเครื่องมือ (รวมเข้าหน้า records) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มปุ่ม "โหลดเอกสาร" ในหน้า `daily-check/records` ที่สร้างรายงานตารางสรุป A4 จากแถวที่กรองอยู่ ผ่านระบบปริ้นกลางเดิม แล้วยุบแท็บ placeholder "โหลดเอกสาร" ทิ้ง

**Architecture:** เพิ่ม `PrintDocType` ใหม่ `daily-check-report` (A4) → สร้างคอมโพเนนต์เทมเพลตรายงาน `EquipmentCheckReport` → หน้า records เปิด `PrintPreviewDialog` เดิม (พรีวิว/ปริ้น server-side/Windows Preview = Save-as-PDF) โดย render report จาก `rows` ที่กรองแล้ว → ลบแท็บ/หน้า/route documents + redirect + แก้ access-control

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui, TanStack Query, Vitest + @testing-library/react, Express (server print.js), Puppeteer/CUPS (มีอยู่แล้ว)

## Global Constraints

- ทุก UI label เป็นภาษาไทย
- Preview ก่อนพิมพ์ **ห้ามมี horizontal scroll** (ScaledPreview จัดการ ต้องมี natural width ชัดเจน)
- ระบบปริ้นกลาง: docType ฝั่ง client (`src/lib/printConfig.ts` `PRINT_DOC_TYPES`) ต้อง **mirror** ฝั่ง server (`server/routes/print.js` `DOC_DEFAULTS`) เสมอ
- commit เฉพาะไฟล์ของงานนี้ด้วย explicit pathspec (มี committer อื่นทำงานในรีโปพร้อมกัน)
- type-check จริงใช้ `npx tsc -p tsconfig.app.json --noEmit` (root `tsc --noEmit` เป็น no-op)
- อย่ารัน `npm run build`

---

### Task 1: เพิ่ม docType `daily-check-report` (client + server)

**Files:**
- Modify: `src/lib/printConfig.ts`
- Modify: `src/lib/printConfig.test.ts`
- Modify: `server/routes/print.js:10-15` (`DOC_DEFAULTS`)

**Interfaces:**
- Produces: `PrintDocType` union เพิ่มค่า `"daily-check-report"`; `PRINT_DOC_TYPES` มี entry `{ slug: "daily-check-report", label: "รายงานเช็กเครื่องมือ (Daily Check)", defaultPaper: "A4" }`

- [ ] **Step 1: แก้ test ให้คาดหวัง docType ใหม่ (ให้ fail ก่อน)**

ใน `src/lib/printConfig.test.ts` แทนที่ describe block แรก:

```ts
describe("PRINT_DOC_TYPES", () => {
  it("has the known doc types incl. daily-check-report", () => {
    expect(PRINT_DOC_TYPES.map((d) => d.slug)).toEqual([
      "sample-label", "coa", "service-request", "stock-label", "daily-check-report",
    ]);
  });
  it("daily-check-report defaults to A4", () => {
    expect(getPrintDocType("daily-check-report")?.defaultPaper).toBe("A4");
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npx vitest run src/lib/printConfig.test.ts`
Expected: FAIL — array ไม่มี `daily-check-report` / `getPrintDocType` คืน undefined

- [ ] **Step 3: เพิ่ม docType ฝั่ง client**

ใน `src/lib/printConfig.ts`:

```ts
export type PrintDocType = "sample-label" | "coa" | "service-request" | "stock-label" | "daily-check-report";
```

และเพิ่มบรรทัดท้าย array `PRINT_DOC_TYPES`:

```ts
  { slug: "daily-check-report", label: "รายงานเช็กเครื่องมือ (Daily Check)", defaultPaper: "A4" },
```

- [ ] **Step 4: เพิ่ม docType ฝั่ง server (mirror)**

ใน `server/routes/print.js` เพิ่มบรรทัดท้าย array `DOC_DEFAULTS` (`ALLOWED_SLUGS` เดริฟจาก array นี้อัตโนมัติ):

```js
  { slug: 'daily-check-report', printerName: '', cupsPrinterUrl: '', copies: 1, paperSize: 'A4' },
```

- [ ] **Step 5: รัน test ให้ผ่าน**

Run: `npx vitest run src/lib/printConfig.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/printConfig.ts src/lib/printConfig.test.ts server/routes/print.js
git commit -m "feat(print): add daily-check-report A4 docType (client+server)"
```

---

### Task 2: helper จัดรูปแบบร่วม `dailyCheckFormat.ts`

**Files:**
- Create: `src/lib/dailyCheckFormat.ts`
- Test: `src/lib/dailyCheckFormat.test.ts`

**Interfaces:**
- Consumes: `getRoomBySlug` จาก `@/lib/dailyCheckRooms`, `getRoomCatalog` จาก `@/lib/roomEquipment`
- Produces: `fmtTime(iso: string): string`, `fmtDate(s: string): string`, `roomLabel(slug: string): string`, `roomFilterLabel(room: string): string`, `statusFilterLabel(status: string): string`, `instrumentFilterLabel(room: string, instrumentId: string): string`, `dateFilterLabel(date: string): string`

- [ ] **Step 1: เขียน failing test**

สร้าง `src/lib/dailyCheckFormat.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  fmtDate,
  roomFilterLabel,
  statusFilterLabel,
  dateFilterLabel,
} from "./dailyCheckFormat";

describe("dailyCheckFormat", () => {
  it("fmtDate: YYYY-MM-DD → DD/MM/YYYY", () => {
    expect(fmtDate("2026-07-02")).toBe("02/07/2026");
  });
  it("fmtDate: empty → em dash", () => {
    expect(fmtDate("")).toBe("—");
  });
  it("roomFilterLabel: all → ทุกห้อง", () => {
    expect(roomFilterLabel("all")).toBe("ทุกห้อง");
  });
  it("statusFilterLabel maps all/normal/abnormal", () => {
    expect(statusFilterLabel("all")).toBe("ทั้งหมด");
    expect(statusFilterLabel("normal")).toBe("ปกติ");
    expect(statusFilterLabel("abnormal")).toBe("ผิดปกติ");
  });
  it("dateFilterLabel: empty → ทุกวัน, else formatted", () => {
    expect(dateFilterLabel("")).toBe("ทุกวัน");
    expect(dateFilterLabel("2026-07-02")).toBe("02/07/2026");
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npx vitest run src/lib/dailyCheckFormat.test.ts`
Expected: FAIL — module ยังไม่มี

- [ ] **Step 3: สร้าง module**

สร้าง `src/lib/dailyCheckFormat.ts`:

```ts
import { getRoomBySlug } from "@/lib/dailyCheckRooms";
import { getRoomCatalog } from "@/lib/roomEquipment";

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

export const fmtDate = (s: string) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

export const roomLabel = (slug: string) => getRoomBySlug(slug)?.label ?? slug;

export const roomFilterLabel = (room: string) =>
  room === "all" ? "ทุกห้อง" : roomLabel(room);

export const statusFilterLabel = (status: string) =>
  status === "normal" ? "ปกติ" : status === "abnormal" ? "ผิดปกติ" : "ทั้งหมด";

export const instrumentFilterLabel = (room: string, instrumentId: string) => {
  if (instrumentId === "all") return "ทั้งหมด";
  const inst = getRoomCatalog(room)?.instruments.find((i) => i.id === instrumentId);
  return inst ? `${inst.name} (${inst.id})` : instrumentId;
};

export const dateFilterLabel = (date: string) => (date ? fmtDate(date) : "ทุกวัน");
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run src/lib/dailyCheckFormat.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/dailyCheckFormat.ts src/lib/dailyCheckFormat.test.ts
git commit -m "feat(daily-check): shared format helpers for records + report"
```

---

### Task 3: คอมโพเนนต์รายงาน `EquipmentCheckReport`

**Files:**
- Create: `src/components/lis/EquipmentCheckReport.tsx`
- Test: `src/components/lis/EquipmentCheckReport.test.tsx`

**Interfaces:**
- Consumes: helpers จาก Task 2 (`fmtDate`, `fmtTime`, `roomLabel`, `roomFilterLabel`, `statusFilterLabel`, `instrumentFilterLabel`, `dateFilterLabel`); `EquipmentCheckRecord` จาก `@/lib/api`; `ICP_LADDA_LOGO_URL` จาก `@/lib/branding`
- Produces:
  - default export `EquipmentCheckReport(props: EquipmentCheckReportProps)`
  - `export const EQUIPMENT_REPORT_CSS: string`
  - `export interface EquipmentCheckReportFilters { date: string; room: string; instrument: string; status: string }`
  - `export interface EquipmentCheckReportProps { rows: EquipmentCheckRecord[]; filters: EquipmentCheckReportFilters; printedBy: string; printedAt: string }`

- [ ] **Step 1: เขียน failing test**

สร้าง `src/components/lis/EquipmentCheckReport.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EquipmentCheckReport, {
  type EquipmentCheckReportFilters,
} from "./EquipmentCheckReport";
import type { EquipmentCheckRecord } from "@/lib/api";

const rec = (over: Partial<EquipmentCheckRecord> = {}): EquipmentCheckRecord => ({
  _id: "id-" + (over._id ?? "x"),
  roomSlug: "balance",
  instrumentId: "BAL-01",
  instrumentName: "เครื่องชั่ง",
  status: "normal",
  readings: [],
  recorder: "สมชาย",
  date: "2026-07-02",
  checkedAt: "2026-07-02T03:00:00.000Z",
  ...over,
});

const filters: EquipmentCheckReportFilters = {
  date: "2026-07-02", room: "all", instrument: "all", status: "all",
};

describe("EquipmentCheckReport", () => {
  it("shows title and printed-by", () => {
    render(<EquipmentCheckReport rows={[rec()]} filters={filters} printedBy="อลิส" printedAt="2026-07-02T04:00:00.000Z" />);
    expect(screen.getByText("บันทึกการเช็กเครื่องมือประจำวัน")).toBeInTheDocument();
    expect(screen.getByText(/ผู้พิมพ์: อลิส/)).toBeInTheDocument();
  });

  it("summarizes total and abnormal counts", () => {
    const rows = [rec({ _id: "a" }), rec({ _id: "b", status: "abnormal" })];
    render(<EquipmentCheckReport rows={rows} filters={filters} printedBy="x" printedAt="2026-07-02T04:00:00.000Z" />);
    expect(screen.getByText(/รวม\s*2\s*รายการ/)).toBeInTheDocument();
    expect(screen.getByText(/ผิดปกติ\s*1\s*รายการ/)).toBeInTheDocument();
  });

  it("joins readings, em dash when none", () => {
    const rows = [
      rec({ _id: "a", readings: [{ key: "temp", label: "อุณหภูมิ", value: 25, unit: "°C" }] }),
      rec({ _id: "b", readings: [] }),
    ];
    render(<EquipmentCheckReport rows={rows} filters={filters} printedBy="x" printedAt="2026-07-02T04:00:00.000Z" />);
    expect(screen.getByText("อุณหภูมิ 25 °C")).toBeInTheDocument();
  });

  it("translates filter context to Thai", () => {
    render(<EquipmentCheckReport rows={[rec()]} filters={filters} printedBy="x" printedAt="2026-07-02T04:00:00.000Z" />);
    expect(screen.getByText(/ห้อง: ทุกห้อง/)).toBeInTheDocument();
    expect(screen.getByText(/สถานะ: ทั้งหมด/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npx vitest run src/components/lis/EquipmentCheckReport.test.tsx`
Expected: FAIL — component ยังไม่มี

- [ ] **Step 3: สร้างคอมโพเนนต์**

สร้าง `src/components/lis/EquipmentCheckReport.tsx`:

```tsx
import type { EquipmentCheckRecord } from "@/lib/api";
import { ICP_LADDA_LOGO_URL } from "@/lib/branding";
import {
  fmtDate,
  fmtTime,
  roomLabel,
  roomFilterLabel,
  statusFilterLabel,
  instrumentFilterLabel,
  dateFilterLabel,
} from "@/lib/dailyCheckFormat";

export interface EquipmentCheckReportFilters {
  date: string;
  room: string;
  instrument: string;
  status: string;
}

export interface EquipmentCheckReportProps {
  rows: EquipmentCheckRecord[];
  filters: EquipmentCheckReportFilters;
  printedBy: string;
  printedAt: string; // ISO
}

// A4 landscape — ตาราง 8 คอลัมน์กว้าง; ScaledPreview ย่อพอดีจอด้วย width คงที่
export const EQUIPMENT_REPORT_CSS = `
@page { size: A4 landscape; margin: 12mm; }
body{font-family:'Kanit',sans-serif;margin:0;color:#000;font-size:12px;}
.eqr table{border-collapse:collapse;width:100%;}
.eqr th,.eqr td{border:1px solid #000;padding:5px 8px;vertical-align:top;}
.eqr thead th{background:#f3f4f6;font-weight:600;}
.eqr .sig-line{border-bottom:1px dotted #000;display:inline-block;min-width:200px;}
`;

const renderReadings = (r: EquipmentCheckRecord) =>
  r.readings.length
    ? r.readings.map((x) => `${x.label} ${x.value} ${x.unit}`).join(", ")
    : "—";

export default function EquipmentCheckReport({
  rows,
  filters,
  printedBy,
  printedAt,
}: EquipmentCheckReportProps) {
  const abnormalCount = rows.filter((r) => r.status === "abnormal").length;
  const printedAtLabel = `${fmtDate(printedAt.slice(0, 10))} ${fmtTime(printedAt)}`;

  return (
    <div className="eqr bg-white text-black p-6 font-[Kanit]" style={{ fontSize: 12, width: "1040px" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <img src={ICP_LADDA_LOGO_URL} alt="ICP Ladda" className="h-12" />
        <div>
          <div className="font-bold text-[15px]">บันทึกการเช็กเครื่องมือประจำวัน</div>
          <div className="text-[12px]">ห้องปฏิบัติการ บริษัท ไอ ซี พี ลัดดา จำกัด</div>
        </div>
      </div>

      {/* Filter context */}
      <div className="mb-3 grid grid-cols-2 gap-x-8 gap-y-1 text-[12px]">
        <div>วันที่: {dateFilterLabel(filters.date)}</div>
        <div>ห้อง: {roomFilterLabel(filters.room)}</div>
        <div>เครื่อง: {instrumentFilterLabel(filters.room, filters.instrument)}</div>
        <div>สถานะ: {statusFilterLabel(filters.status)}</div>
      </div>

      {/* Table */}
      <table>
        <thead>
          <tr>
            <th>วันที่</th>
            <th>เวลา</th>
            <th>ห้อง</th>
            <th>เครื่อง</th>
            <th className="text-center">สถานะ</th>
            <th className="text-center">ค่าที่วัด</th>
            <th>หมายเหตุ</th>
            <th>ผู้บันทึก</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h._id}>
              <td className="whitespace-nowrap">{fmtDate(h.date)}</td>
              <td className="whitespace-nowrap">{fmtTime(h.checkedAt)}</td>
              <td className="whitespace-nowrap">{roomLabel(h.roomSlug)}</td>
              <td className="whitespace-nowrap">{h.instrumentName} ({h.instrumentId})</td>
              <td className="text-center whitespace-nowrap">{h.status === "normal" ? "ปกติ" : "ผิดปกติ"}</td>
              <td className="text-center">{renderReadings(h)}</td>
              <td>{h.note || "—"}</td>
              <td className="whitespace-nowrap">{h.recorder}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <div className="mt-3 text-[12px]">รวม {rows.length} รายการ — ผิดปกติ {abnormalCount} รายการ</div>

      {/* Signatures + print meta */}
      <div className="mt-10 flex justify-between text-[12px]">
        <div className="text-center">
          <div>ผู้บันทึก <span className="sig-line"></span></div>
          <div className="mt-6">ผู้ตรวจสอบ <span className="sig-line"></span></div>
        </div>
        <div className="self-end text-right text-[11px] text-gray-600">
          <div>พิมพ์เมื่อ: {printedAtLabel}</div>
          <div>ผู้พิมพ์: {printedBy || "—"}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run src/components/lis/EquipmentCheckReport.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/lis/EquipmentCheckReport.tsx src/components/lis/EquipmentCheckReport.test.tsx
git commit -m "feat(daily-check): EquipmentCheckReport A4 print template"
```

---

### Task 4: ปุ่ม "โหลดเอกสาร" ในหน้า records + ใช้ helper ร่วม

**Files:**
- Modify: `src/pages/daily-check/DailyCheckRecordsPage.tsx`

**Interfaces:**
- Consumes: `EquipmentCheckReport` + `EQUIPMENT_REPORT_CSS` (Task 3), helpers `fmtDate`/`fmtTime`/`roomLabel` (Task 2), `PrintPreviewDialog`, `useAuth`, docType `"daily-check-report"` (Task 1)

- [ ] **Step 1: แทน helper ในไฟล์ด้วย import ร่วม (DRY)**

ในหัวไฟล์ `src/pages/daily-check/DailyCheckRecordsPage.tsx` ลบการประกาศ local `fmtTime`, `fmtDate`, `roomLabel` (บรรทัด 21-29) และ import `getRoomBySlug` ที่บรรทัด 13 ออก จากนั้นเพิ่ม import:

```ts
import { fmtDate, fmtTime, roomLabel } from "@/lib/dailyCheckFormat";
```

(คง `todayStr` local ไว้ตามเดิม — ใช้ default filterDate)

- [ ] **Step 2: เพิ่ม import ของ dialog/report/auth/icon**

เพิ่มใน import ของไอคอน lucide (บรรทัด 3) ให้มี `FileDown`:

```ts
import { List, Filter, Sparkles, Loader2, FileDown } from "lucide-react";
```

และเพิ่ม imports:

```ts
import { useAuth } from "@/context/AuthContext";
import PrintPreviewDialog from "@/components/lis/PrintPreviewDialog";
import EquipmentCheckReport, { EQUIPMENT_REPORT_CSS } from "@/components/lis/EquipmentCheckReport";
```

- [ ] **Step 3: เพิ่ม state + user**

ใต้บรรทัด `const [summaryText, setSummaryText] = useState('');` เพิ่ม:

```ts
  const { user } = useAuth();
  const [printOpen, setPrintOpen] = useState(false);
  const [printedAt, setPrintedAt] = useState("");
```

- [ ] **Step 4: เพิ่มปุ่มในแถวตัวกรอง**

ในแถวตัวกรอง แทนบรรทัดปุ่มรีเซ็ต (บรรทัด 186-188) ด้วย:

```tsx
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
              รีเซ็ตตัวกรอง
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={isLoading || rows.length === 0}
              onClick={() => {
                setPrintedAt(new Date().toISOString());
                setPrintOpen(true);
              }}
            >
              <FileDown className="h-3.5 w-3.5" />
              โหลดเอกสาร
            </Button>
```

- [ ] **Step 5: เพิ่ม PrintPreviewDialog ก่อนปิด fragment**

ก่อน `</>` ปิดท้าย component (บรรทัด 243) เพิ่ม:

```tsx
      <PrintPreviewDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        docType="daily-check-report"
        css={EQUIPMENT_REPORT_CSS}
      >
        <EquipmentCheckReport
          rows={rows}
          filters={{ date: filterDate, room: filterRoom, instrument: filterInstrument, status: filterStatus }}
          printedBy={user?.name ?? user?.email ?? ""}
          printedAt={printedAt || new Date().toISOString()}
        />
      </PrintPreviewDialog>
```

- [ ] **Step 6: Type-check + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จากไฟล์นี้ (repo มี latent error เดิม ~12 ตัว — ตรวจว่าไม่มีตัวใหม่ที่ path นี้)

Run: `npm run lint`
Expected: ไม่มี error ใหม่

- [ ] **Step 7: รัน unit test ทั้งชุดที่เกี่ยว**

Run: `npx vitest run src/lib/dailyCheckFormat.test.ts src/components/lis/EquipmentCheckReport.test.tsx src/lib/printConfig.test.ts`
Expected: PASS ทั้งหมด

- [ ] **Step 8: Commit**

```bash
git add src/pages/daily-check/DailyCheckRecordsPage.tsx
git commit -m "feat(daily-check): โหลดเอกสาร button on records page"
```

---

### Task 5: ลบแท็บ/หน้า/route documents + redirect + access-control

**Files:**
- Modify: `src/lib/dailyCheckRooms.ts`
- Modify: `src/App.tsx:48,128`
- Modify: `src/lib/accessControl.ts:35`
- Modify: `src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx`
- Modify: `src/lib/accessControl.test.ts`
- Delete: `src/pages/daily-check/DocumentsPage.tsx`

**Interfaces:**
- Consumes: หน้า records (Task 4) เป็นปลายทาง redirect

- [ ] **Step 1: แก้ test DailyCheckLayout ให้คาดหวังไม่มีแท็บ "โหลดเอกสาร" (fail ก่อน)**

ใน `src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx` แก้ชื่อ test บรรทัด 56 เป็น `"renders the env + four-room + records tab strip"` และลบ `"โหลดเอกสาร",` ออกจาก array `toEqual` (บรรทัด 67) ให้เหลือ:

```ts
    expect(tabs.map((t) => t.textContent?.trim())).toEqual([
      "อุณหภูมิ/ความชื้น",
      "ห้องเครื่องชั่ง",
      "ห้องเตรียมตัวอย่าง",
      "ห้องวิเคราะห์",
      "ห้องสกัด",
      "รายการบันทึก",
    ]);
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npx vitest run src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx`
Expected: FAIL — ยังมีแท็บ "โหลดเอกสาร" อยู่ 7 ตัว

- [ ] **Step 3: ลบ tab documents ออกจาก `DAILY_CHECK_TABS`**

ใน `src/lib/dailyCheckRooms.ts` ลบบรรทัด (95):

```ts
  { route: `${DAILY_CHECK_BASE}/documents`, label: "โหลดเอกสาร", icon: FileDown },
```

จากนั้นลบ `FileDown` ออกจาก import ของ `lucide-react` ในไฟล์นี้ (ไม่ถูกใช้แล้ว) — ตรวจด้วย `grep -n FileDown src/lib/dailyCheckRooms.ts` ต้องไม่เหลือการอ้างอิง

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx`
Expected: PASS

- [ ] **Step 5: เปลี่ยน route documents เป็น redirect + ลบ lazy import**

ใน `src/App.tsx`:
- ลบบรรทัด 48: `const DocumentsPage = lazy(() => import("./pages/daily-check/DocumentsPage"));`
- แก้บรรทัด 128 จาก `<Route path="documents" element={<DocumentsPage />} />` เป็น:

```tsx
                <Route path="documents" element={<Navigate to="/daily-check/records" replace />} />
```

(`Navigate` ถูก import อยู่แล้วในไฟล์นี้)

- [ ] **Step 6: ลบไฟล์ DocumentsPage**

```bash
git rm src/pages/daily-check/DocumentsPage.tsx
```

- [ ] **Step 7: แก้ access-control path**

ใน `src/lib/accessControl.ts` (บรรทัด 35) เปลี่ยน `"/daily-check/documents",` เป็น `"/daily-check/records",`

- [ ] **Step 8: เพิ่ม assertion records ใน accessControl.test.ts**

ใน `src/lib/accessControl.test.ts` ใน test `"grants every room sub-page when /daily-check is granted"` (บรรทัด 147-153) เพิ่มบรรทัดหลัง extraction assertion:

```ts
      expect(userCanAccessPath(user, "/daily-check/records", navGroups)).toBe(true);
```

- [ ] **Step 9: Type-check + test ที่เกี่ยว + build-safe check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ (โดยเฉพาะไม่มี "DocumentsPage" ตกค้าง)

Run: `npx vitest run src/lib/accessControl.test.ts src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx`
Expected: PASS

Run: `grep -rn "DocumentsPage" src` → ต้องไม่เหลือผลลัพธ์

- [ ] **Step 10: Commit**

```bash
git add src/lib/dailyCheckRooms.ts src/App.tsx src/lib/accessControl.ts src/lib/accessControl.test.ts src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx
git commit -m "refactor(daily-check): remove documents tab, redirect to records"
```

---

### Task 6: ตรวจรวม + Manual E2E (ค้างให้ user รันบนเครื่องจริง)

**Files:** —

- [ ] **Step 1: รัน test suite ทั้งหมดที่เกี่ยว**

Run: `npx vitest run src/lib/dailyCheckFormat.test.ts src/components/lis/EquipmentCheckReport.test.tsx src/lib/printConfig.test.ts src/lib/accessControl.test.ts src/pages/daily-check/__tests__/DailyCheckLayout.test.tsx`
Expected: PASS ทั้งหมด

- [ ] **Step 2: Type-check เต็ม**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จากไฟล์ที่แตะในงานนี้

- [ ] **Step 3: Manual E2E (บนเครื่อง user — ต้องรันทั้ง frontend + backend)**

1. เปิด `/daily-check/records` → เลือกวันที่/ห้องที่มีข้อมูล → กด **"โหลดเอกสาร"**
2. ตรวจพรีวิว: หัวเอกสาร + บริบทตัวกรองถูก, ตารางครบคอลัมน์, **ไม่มี horizontal scroll**
3. กด **Windows Preview** → บันทึกเป็น PDF ได้
4. ที่หน้า **ตั้งค่าระบบ** ตั้งเครื่องพิมพ์ให้ docType "รายงานเช็กเครื่องมือ (Daily Check)" → กลับมากด **พิมพ์** → ปริ้น server-side สำเร็จ
5. กรณีไม่มีข้อมูลในวันที่เลือก → ปุ่ม "โหลดเอกสาร" disabled
6. เปิดลิงก์เก่า `/daily-check/documents` → redirect มา `/daily-check/records`
7. แท็บบนสุดของ Daily Check ไม่มี "โหลดเอกสาร" แล้ว

- [ ] **Step 4: (หลัง user ยืนยัน E2E) push develop**

```bash
git push origin develop
```

---

## Self-Review (ผู้เขียนแผนตรวจเอง)

**1. Spec coverage:**
- docType daily-check-report (client+server) → Task 1 ✓
- รูปแบบเอกสารรายงานตารางสรุป A4 (หัว/บริบท/ตาราง/สรุป/ลงชื่อ) → Task 3 ✓
- ปุ่มโหลดเอกสารบน records + WYSIWYG ตามตัวกรอง + disabled เมื่อไม่มีแถว → Task 4 ✓
- ใช้ PrintPreviewDialog เดิม (พรีวิว/ปริ้น/Windows Preview) → Task 4 ✓
- ลบแท็บ+หน้า documents + redirect + accessControl (documents→records, แก้บั๊ก records หาย) → Task 5 ✓
- helper ร่วม (DRY กับหน้า records) → Task 2 + Task 4 Step 1 ✓
- Manual E2E + edge (ไม่มีแถว/ไม่ตั้งเครื่องพิมพ์/ตารางหลายหน้า) → Task 6 ✓

**2. Placeholder scan:** ไม่มี TBD/TODO — ทุก step มีโค้ด/คำสั่งจริง ✓

**3. Type consistency:** `EquipmentCheckReportProps`/`EquipmentCheckReportFilters` และ helper signatures ใช้ชื่อตรงกันทุก task; docType string `"daily-check-report"` ตรงกัน client/server/หน้า records ✓
