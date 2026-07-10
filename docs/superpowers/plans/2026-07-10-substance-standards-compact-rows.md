# Substance Standards Compact Rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยนลิสต์ "เกณฑ์ต่อสาร" ใน `SubstanceStandardsDialog` จากการ์ดหลายบรรทัดเป็นแถวกะทัดรัดแถวละสาร (แก้ inline) + เพิ่มช่องค้นหาเฉพาะของลิสต์ฝั่งขวา

**Architecture:** restyle ภายในไฟล์เดิมไฟล์เดียว — แถวเป็น flex row, dropdown เงื่อนไขเปลี่ยนจาก Radix `Select` เป็น `NativeSelect` (เบากว่าเมื่อมี 100+ แถว), state `listSearch` แยกจากช่องค้นหาฝั่งซ้าย, แถวที่กรองแล้วต้องพก **index เดิมของลิสต์เต็ม** เพื่อให้ `patchAt`/`removeAt`/`cloneAt` โดนตัวถูก

**Tech Stack:** React 18 + TypeScript, shadcn/ui (`NativeSelect`, `Input`, `Button`, `Label`), Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-07-10-substance-standards-compact-rows-design.md`

## Global Constraints

- UI label เป็นภาษาไทยตาม convention repo (ป้าย checkbox สั้น: `หน.QC`, tooltip เต็ม: `ให้หัวหน้า QC พิจารณาเท่านั้น`)
- **ห้ามแตะ**: ฝั่งซ้ายของ dialog (picker commonName/กลุ่ม/trade name), `SubstanceStandard` schema ใน `src/lib/api.ts`, backend, `ParameterSettings.tsx`
- **ห้ามรัน `npm run build`** (postbuild ทำ dev server พัง) — type-check ด้วย `npx tsc -p tsconfig.app.json --noEmit` (คำสั่งนี้เท่านั้นที่เช็คจริง; root tsconfig เป็น no-op) — repo มี latent error เดิมค้าง ~12 ตัว → เกณฑ์คือ **ห้ามมี error ใหม่** ในไฟล์ที่แตะ
- commit ด้วย **explicit pathspec เท่านั้น** (มี process อื่น commit แทรกในรีโปนี้): `git add <files> && git commit -m "..." -- <files>`
- รันเทสไฟล์เดียว: `npx vitest run src/components/lis/SubstanceStandardsDialog.test.tsx`

---

### Task 1: แถวกะทัดรัดแก้ inline (แทนการ์ดเดิม)

**Files:**
- Modify: `src/components/lis/SubstanceStandardsDialog.tsx` (imports บนสุด, ตัวแปร `unit` บรรทัด ~81, คอลัมน์ขวาบรรทัด ~331-392)
- Test: `src/components/lis/SubstanceStandardsDialog.test.tsx`

**Interfaces:**
- Consumes: `patchAt(i, patch)` / `removeAt(i)` / `cloneAt(i)` / `standardKey(s)` / `OPERATOR_OPTIONS` — มีอยู่แล้วในไฟล์ ไม่เปลี่ยน signature
- Produces: แถวรายสารที่มี accessible name ต่อแถว ซึ่ง Task 2 และเทสใช้อ้าง:
  - `NativeSelect` aria-label = `` `เงื่อนไข ${std.substance}` ``
  - `Input` ค่าแรก aria-label = `` `ค่า ${std.substance}` ``, ค่าที่สอง aria-label = `` `ค่าที่สอง ${std.substance}` ``
  - checkbox aria-label = `` `หน.QC ${std.substance}` ``
  - ปุ่ม clone aria-label = `` `คัดลอก ${std.substance}` ``, ปุ่มลบ aria-label = `` `ลบ ${std.substance}` ``
  - โครง map ยังเป็น `list.map((std, i) => ...)` (Task 2 จะสลับ source เป็นลิสต์ที่กรองแล้ว)

- [ ] **Step 1: เขียนเทสที่ fail ก่อน**

แก้ `renderDialog` ให้รับ `substanceStandards` เริ่มต้นได้ แล้วเพิ่มเทส 3 ตัว:

```tsx
// แก้ signature ของ renderDialog เดิม (บรรทัด ~26) เป็น:
function renderDialog(
  onSave = vi.fn<(next: SubstanceStandard[]) => void>(),
  substanceStandards: SubstanceStandard[] = [],
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <SubstanceStandardsDialog
        open
        field={{ ...field, substanceStandards }}
        onClose={() => undefined}
        onSave={onSave}
      />
    </QueryClientProvider>,
  );

  return { onSave };
}
```

```tsx
// เพิ่มใน describe("SubstanceStandardsDialog", ...) ต่อท้ายเทสเดิม:
const compactStandards: SubstanceStandard[] = [
  { substance: "ABAMECTIN", operator: "gte", value: 95, value2: null },
  { substance: "DIQUAT", operator: "between", value: 78, value2: 82 },
];

it("renders selected standards as compact single rows with inline controls", async () => {
  renderDialog(undefined, compactStandards);

  await screen.findByText("ABAMECTIN");

  expect(screen.getByLabelText("เงื่อนไข ABAMECTIN")).toHaveValue("gte");
  expect(screen.getByLabelText("ค่า ABAMECTIN")).toHaveValue(95);
  expect(screen.queryByLabelText("ค่าที่สอง ABAMECTIN")).not.toBeInTheDocument();

  expect(screen.getByLabelText("เงื่อนไข DIQUAT")).toHaveValue("between");
  expect(screen.getByLabelText("ค่าที่สอง DIQUAT")).toHaveValue(82);
  expect(screen.getByLabelText("หน.QC DIQUAT")).not.toBeChecked();

  // หน่วยขึ้นหัวลิสต์ครั้งเดียว และไม่มีข้อความสรุปสีเขียวรายแถวแล้ว
  expect(screen.getByText(/หน่วย: %/)).toBeInTheDocument();
  expect(screen.queryByText("≥ 95%")).not.toBeInTheDocument();
});

it("reveals the second value input when operator becomes tolerance", async () => {
  renderDialog(undefined, compactStandards);

  const op = await screen.findByLabelText("เงื่อนไข ABAMECTIN");
  fireEvent.change(op, { target: { value: "tolerance" } });

  expect(screen.getByLabelText("ค่าที่สอง ABAMECTIN")).toBeInTheDocument();
});

it("toggles head-only on the right row and saves it", async () => {
  const { onSave } = renderDialog(undefined, compactStandards);

  fireEvent.click(await screen.findByLabelText("หน.QC DIQUAT"));
  fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  const saved = onSave.mock.calls[0][0];
  expect(saved.find((s) => s.substance === "DIQUAT")).toMatchObject({ headOnly: true });
  expect(saved.find((s) => s.substance === "ABAMECTIN")).not.toMatchObject({ headOnly: true });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่า fail**

Run: `npx vitest run src/components/lis/SubstanceStandardsDialog.test.tsx`
Expected: เทสใหม่ 3 ตัว FAIL (หา `getByLabelText("เงื่อนไข ABAMECTIN")` ไม่เจอ — UI เดิมเป็น Radix Select ไม่มี aria-label), เทสเดิม 2 ตัวยังผ่าน

- [ ] **Step 3: แก้ component**

3a. **Imports** (บรรทัด 1-18): ตัดของที่เลิกใช้

```tsx
// เดิม
import { api, type ParameterValueField, type StandardOperator, type SubstanceStandard } from "@/lib/api";
import { tradeNameKeys } from "@/lib/masterItemFields";
import { describeSubstanceStandard, OPERATOR_OPTIONS } from "@/lib/standardOperators";
// ...
import {
  NativeSelect, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ใหม่
import { api, type ParameterValueField, type StandardOperator, type SubstanceStandard } from "@/lib/api";
import { tradeNameKeys } from "@/lib/masterItemFields";
import { OPERATOR_OPTIONS } from "@/lib/standardOperators";
// ...
import { NativeSelect } from "@/components/ui/select";
```

3b. **ลบตัวแปร `unit`** (บรรทัด ~81: `const unit = field.unit ? \` ${field.unit}\` : "";`) — ไม่ใช้แล้ว (สรุปสีเขียวถูกตัด หน่วยใช้ `field.unit` ตรงๆ ที่หัวลิสต์)

3c. **แทนคอลัมน์ขวาทั้งบล็อก** (เดิมบรรทัด ~331-392, `<div>` ที่ครอบ `<Label>เกณฑ์ต่อสาร...` ถึงจบลิสต์) ด้วย:

```tsx
<div className="min-w-0">
  <Label className="text-sm mb-1.5 block">
    เกณฑ์ต่อสาร ({list.length})
    {field.unit ? (
      <span className="font-normal text-muted-foreground"> · หน่วย: {field.unit}</span>
    ) : null}
  </Label>
  <div className="max-h-[34rem] space-y-1 overflow-y-auto pr-1">
    {list.length === 0 ? (
      <p className="text-xs text-muted-foreground">ยังไม่ได้เลือกสาร</p>
    ) : (
      list.map((std, i) => (
        <div
          key={`${standardKey(std.substance)}-${i}`}
          className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border px-2 py-1.5"
        >
          <span
            className="min-w-0 flex-1 basis-40 truncate text-sm font-medium"
            title={std.substance}
          >
            {std.substance}
          </span>
          <NativeSelect
            aria-label={`เงื่อนไข ${std.substance}`}
            value={std.operator}
            onChange={(e) => patchAt(i, { operator: e.target.value as StandardOperator })}
            className="h-8 w-44 px-2 py-1"
          >
            {OPERATOR_OPTIONS.filter((o) => o.value !== "none").map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </NativeSelect>
          <Input
            type="number"
            aria-label={`ค่า ${std.substance}`}
            value={std.value ?? ""}
            onChange={(e) => patchAt(i, { value: e.target.value === "" || !Number.isFinite(Number(e.target.value)) ? null : Number(e.target.value) })}
            placeholder={std.operator === "tolerance" ? "ค่ามาตรฐาน" : std.operator === "between" ? "ตั้งแต่" : "ค่า"}
            className="h-8 w-24"
          />
          {(std.operator === "between" || std.operator === "tolerance") && (
            <Input
              type="number"
              aria-label={`ค่าที่สอง ${std.substance}`}
              value={std.value2 ?? ""}
              onChange={(e) => patchAt(i, { value2: e.target.value === "" || !Number.isFinite(Number(e.target.value)) ? null : Number(e.target.value) })}
              placeholder={std.operator === "tolerance" ? "+/- %" : "ถึง"}
              className="h-8 w-24"
            />
          )}
          <label
            className="flex items-center gap-1 text-xs text-amber-700"
            title="ให้หัวหน้า QC พิจารณาเท่านั้น"
          >
            <input
              type="checkbox"
              aria-label={`หน.QC ${std.substance}`}
              checked={std.headOnly === true}
              onChange={(e) => patchAt(i, { headOnly: e.target.checked })}
            />
            หน.QC
          </label>
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => cloneAt(i)}
              title="คัดลอกกฎนี้"
              aria-label={`คัดลอก ${std.substance}`}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => removeAt(i)}
              title="ลบ"
              aria-label={`ลบ ${std.substance}`}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      ))
    )}
  </div>
</div>
```

สิ่งที่หายไปโดยตั้งใจ: ข้อความสรุปสีเขียว (`describeSubstanceStandard`), Radix `Select` รายการ์ด, label เต็ม "ให้หัวหน้า QC พิจารณาเท่านั้น" (ย้ายไป `title`)

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `npx vitest run src/components/lis/SubstanceStandardsDialog.test.tsx`
Expected: PASS ทั้ง 5 (เดิม 2 + ใหม่ 3)

- [ ] **Step 5: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ที่อ้างถึง `SubstanceStandardsDialog` (error เดิมของ repo ~12 ตัวไม่นับ)

- [ ] **Step 6: Commit (explicit pathspec)**

```bash
git add src/components/lis/SubstanceStandardsDialog.tsx src/components/lis/SubstanceStandardsDialog.test.tsx
git commit -m "refactor(parameter-settings): compact inline rows for substance standards" -- src/components/lis/SubstanceStandardsDialog.tsx src/components/lis/SubstanceStandardsDialog.test.tsx
```

---

### Task 2: ช่องค้นหาของลิสต์ฝั่งขวา (กรองแล้ว index ต้องไม่เพี้ยน)

**Files:**
- Modify: `src/components/lis/SubstanceStandardsDialog.tsx` (state, useMemo ใหม่, หัวลิสต์+ช่องค้นหา, บรรทัด map)
- Test: `src/components/lis/SubstanceStandardsDialog.test.tsx`

**Interfaces:**
- Consumes: แถวรายสารจาก Task 1 (aria-label `ค่า/ลบ/คัดลอก ${substance}`), `standardKey`, `list`
- Produces: `visibleStandards: { std: EditableSubstanceStandard; index: number }[]` (index = ตำแหน่งใน `list` เต็ม), ช่องค้นหา placeholder `"ค้นหาสารที่เลือก..."`, ตัวนับ `แสดง x/y`, empty state `"ไม่พบสารที่ค้นหา"`

- [ ] **Step 1: เขียนเทสที่ fail ก่อน**

```tsx
// เพิ่มต่อท้ายใน describe เดิม:
it("filters the selected list with its own search box", async () => {
  renderDialog(undefined, [
    { substance: "ABAMECTIN", operator: "gte", value: 95, value2: null },
    { substance: "ACETAMIPRID", operator: "gte", value: 97, value2: null },
    { substance: "DIQUAT", operator: "between", value: 78, value2: 82 },
  ]);

  const listSearch = await screen.findByPlaceholderText("ค้นหาสารที่เลือก...");
  fireEvent.change(listSearch, { target: { value: "diquat" } }); // case-insensitive

  expect(screen.getByLabelText("ค่า DIQUAT")).toBeInTheDocument();
  expect(screen.queryByLabelText("ค่า ABAMECTIN")).not.toBeInTheDocument();
  expect(screen.getByText("แสดง 1/3")).toBeInTheDocument();

  fireEvent.change(listSearch, { target: { value: "ไม่มีสารนี้" } });
  expect(screen.getByText("ไม่พบสารที่ค้นหา")).toBeInTheDocument();
});

it("edits and removes the correct item while the list is filtered", async () => {
  const { onSave } = renderDialog(undefined, [
    { substance: "ABAMECTIN", operator: "gte", value: 95, value2: null },
    { substance: "DIQUAT", operator: "gte", value: 40, value2: null },
  ]);

  const listSearch = await screen.findByPlaceholderText("ค้นหาสารที่เลือก...");
  fireEvent.change(listSearch, { target: { value: "DIQUAT" } });
  fireEvent.change(screen.getByLabelText("ค่า DIQUAT"), { target: { value: "50" } });

  fireEvent.change(listSearch, { target: { value: "ABAMECTIN" } });
  fireEvent.click(screen.getByLabelText("ลบ ABAMECTIN"));

  fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave).toHaveBeenCalledWith([
    expect.objectContaining({ substance: "DIQUAT", value: 50 }),
  ]);
});

it("clones the correct item while the list is filtered", async () => {
  renderDialog(undefined, [
    { substance: "ABAMECTIN", operator: "gte", value: 95, value2: null },
    { substance: "DIQUAT", operator: "gte", value: 40, value2: null },
  ]);

  const listSearch = await screen.findByPlaceholderText("ค้นหาสารที่เลือก...");
  fireEvent.change(listSearch, { target: { value: "DIQUAT" } });
  fireEvent.click(screen.getByLabelText("คัดลอก DIQUAT"));

  // clone แทรกถัดจากตัวเดิมในลิสต์เต็ม และชื่อเดียวกันย่อม match filter → เห็น 2 แถว
  expect(screen.getAllByLabelText(/^ค่า DIQUAT$/)).toHaveLength(2);
  expect(screen.getByText("แสดง 2/3")).toBeInTheDocument();
});
```

- [ ] **Step 2: รันเทสให้เห็นว่า fail**

Run: `npx vitest run src/components/lis/SubstanceStandardsDialog.test.tsx`
Expected: เทสใหม่ 3 ตัว FAIL (`findByPlaceholderText("ค้นหาสารที่เลือก...")` ไม่เจอ), เทสเดิม 5 ตัวผ่าน

- [ ] **Step 3: แก้ component**

3a. **เพิ่ม state** (ใต้ `const [search, setSearch] = useState("");` บรรทัด ~84):

```tsx
const [listSearch, setListSearch] = useState("");
```

3b. **reset ตอนเปิด dialog** — ใน `useEffect` เดิม (บรรทัด ~86-93) เพิ่มบรรทัดเดียว:

```tsx
useEffect(() => {
  if (open) {
    setList((field.substanceStandards ?? []) as EditableSubstanceStandard[]);
    setPickerCategory("all");
    setSearch("");
    setListSearch("");
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open]);
```

3c. **derive แถวที่แสดง พร้อม index เดิม** (ใต้ `selectedKeys` useMemo บรรทัด ~165):

```tsx
const visibleStandards = useMemo(() => {
  const q = standardKey(listSearch);
  const all = list.map((std, index) => ({ std, index }));
  if (!q) return all;
  return all.filter(({ std }) => standardKey(std.substance).includes(q));
}, [list, listSearch]);
```

(`standardKey` lowercase + ยุบช่องว่างอยู่แล้ว → ค้นหาแบบ case-insensitive ฟรี)

3d. **หัวลิสต์ + ช่องค้นหา** — แทน `<Label>` หัวลิสต์จาก Task 1 ด้วย:

```tsx
<div className="mb-1.5 flex items-baseline justify-between gap-2">
  <Label className="text-sm">
    เกณฑ์ต่อสาร ({list.length})
    {field.unit ? (
      <span className="font-normal text-muted-foreground"> · หน่วย: {field.unit}</span>
    ) : null}
  </Label>
  {listSearch.trim() !== "" && (
    <span className="text-xs text-muted-foreground">
      แสดง {visibleStandards.length}/{list.length}
    </span>
  )}
</div>
<div className="relative mb-2">
  <Label htmlFor="substance-list-search" className="sr-only">ค้นหาสารที่เลือก</Label>
  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  <Input
    id="substance-list-search"
    type="search"
    value={listSearch}
    onChange={(e) => setListSearch(e.target.value)}
    placeholder="ค้นหาสารที่เลือก..."
    autoComplete="off"
    className="h-9 pl-8"
  />
</div>
```

3e. **สลับ source ของ map + เพิ่ม empty state ตอนกรอง** — กล่องลิสต์เปลี่ยน `max-h-[34rem]` → `max-h-[31rem]` (ชดเชยความสูงช่องค้นหา ให้ dialog ไม่ล้น) แล้วเปลี่ยนหัว map:

```tsx
<div className="max-h-[31rem] space-y-1 overflow-y-auto pr-1">
  {list.length === 0 ? (
    <p className="text-xs text-muted-foreground">ยังไม่ได้เลือกสาร</p>
  ) : visibleStandards.length === 0 ? (
    <p className="text-xs text-muted-foreground">ไม่พบสารที่ค้นหา</p>
  ) : (
    visibleStandards.map(({ std, index: i }) => (
      /* ...ตัวแถวจาก Task 1 ทั้งก้อน ไม่ต้องแก้ข้างใน — destructure เป็นชื่อ i เดิม
         ทำให้ key/patchAt(i)/cloneAt(i)/removeAt(i) ใช้ index ของลิสต์เต็มอัตโนมัติ... */
    ))
  )}
</div>
```

(แก้จริงคือเปลี่ยนบรรทัด `list.map((std, i) => (` เป็น `visibleStandards.map(({ std, index: i }) => (` + เพิ่ม ternary empty state — ตัวแถวข้างในไม่แตะ)

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `npx vitest run src/components/lis/SubstanceStandardsDialog.test.tsx`
Expected: PASS ทั้ง 8

- [ ] **Step 5: รัน suite เต็ม + type-check**

Run: `npm run test`
Expected: เขียวทั้งหมด (ไฟล์อื่นไม่กระทบ — เปลี่ยนแค่ component เดียว)

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ที่อ้างถึง `SubstanceStandardsDialog`

- [ ] **Step 6: Commit (explicit pathspec)**

```bash
git add src/components/lis/SubstanceStandardsDialog.tsx src/components/lis/SubstanceStandardsDialog.test.tsx
git commit -m "feat(parameter-settings): search box for selected substance standards list" -- src/components/lis/SubstanceStandardsDialog.tsx src/components/lis/SubstanceStandardsDialog.test.tsx
```

---

## Manual E2E (หลังจบทั้ง 2 tasks — ทำโดย user)

1. `npm run dev` + `cd server && npm run dev`
2. หน้า ตั้งค่าพารามิเตอร์ → parameter ที่เป็นโหมด "แยกตามสาร" ที่มีสารเยอะ → เปิด "ตั้งเงื่อนไขรายสาร"
3. เช็ค: แถวกะทัดรัด / hover ชื่อยาวเห็นเต็ม / เปลี่ยนเงื่อนไขเป็น "อยู่ในช่วง" แล้วช่องที่ 2 โผล่ / ค้นหาฝั่งขวา → แก้ค่า → ล้างคำค้น → ค่าอยู่ตัวเดิม / บันทึกแล้วเปิดใหม่ค่าคงอยู่ / จอแคบแถว wrap ไม่ล้นแนวนอน
