# Standards Status Multi-Select Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยน filter สถานะของแท็บ Standards (หน้า Stock) จาก Select ค่าเดียวเป็น dropdown ติ๊กถูกเลือกได้หลายสถานะ กรองแบบ OR (union)

**Architecture:** เพิ่ม pure helper `standardMatchesStatuses(sum, statuses)` ใน `src/lib/stockStatus.ts` (unit-tested) แล้วให้ `StandardsTab` ใน `src/pages/Stock.tsx` ถือ state เป็น `Set<StandardStatus>` และ render `DropdownMenu` + `DropdownMenuCheckboxItem` (shadcn primitive ที่มีอยู่แล้ว) แทน `Select` เดิม — set ว่าง = โชว์ทั้งหมด

**Tech Stack:** React 18 + TypeScript, shadcn/ui (`dropdown-menu.tsx`), Vitest

**Spec:** `docs/superpowers/specs/2026-07-10-standards-status-multi-filter-design.md`

## Global Constraints

- **ห้ามรัน `npm run build`** — type-check ด้วย `npx tsc -p tsconfig.app.json --noEmit` (`npx tsc --noEmit` เฉยๆ เป็น no-op เพราะ root tsconfig มี `files: []`)
- repo มี latent tsc error เดิมค้างอยู่ ~12 ตัว — นับเฉพาะ error **ใหม่** ที่เกิดจากไฟล์ที่แก้
- **commit ด้วย explicit pathspec เท่านั้น** (`git commit -m "..." -- <files>`) — มี process อื่น commit แทรกในรีโปนี้ได้
- ป้ายภาษาไทยต้องตรงตามนี้เป๊ะ: ปกติ / หมด / ใกล้หมด / หมดอายุ / ใกล้หมดอายุ / ทุกสถานะ / สถานะ (n)
- ไม่แตะ backend, แท็บ Solvents/Glassware/History, การ sort ตาม code, ช่องค้นหา

---

### Task 1: Pure helper `standardMatchesStatuses` + unit tests

**Files:**
- Modify: `src/lib/stockStatus.ts` (เพิ่มท้ายไฟล์ ~53 บรรทัด)
- Test: `src/lib/stockStatus.test.ts` (เพิ่ม describe block ท้ายไฟล์)

**Interfaces:**
- Consumes: `StdSummary` (`{ usable, expired, expiringSoon }`) และ `standardLevel(n)` ที่มีอยู่แล้วในไฟล์เดียวกัน
- Produces (Task 2 ใช้):
  ```ts
  export type StandardStatus = "ok" | "out" | "low" | "expired" | "soon";
  export function standardMatchesStatuses(
    sum: StdSummary,
    statuses: ReadonlySet<StandardStatus>,
  ): boolean;
  ```

- [ ] **Step 1: เขียนเทสที่ fail**

เพิ่มท้าย `src/lib/stockStatus.test.ts` (และเพิ่ม `standardMatchesStatuses`, `type StandardStatus` เข้า import บนหัวไฟล์):

```ts
describe("standardMatchesStatuses", () => {
  const S = (...xs: StandardStatus[]) => new Set(xs);
  const sum = (usable: number, expired = 0, expiringSoon = 0) => ({ usable, expired, expiringSoon });

  it("empty set matches everything", () => {
    expect(standardMatchesStatuses(sum(0), S())).toBe(true);
    expect(standardMatchesStatuses(sum(5, 2, 1), S())).toBe(true);
  });

  it("ok requires level ok AND no expiry issues", () => {
    expect(standardMatchesStatuses(sum(2), S("ok"))).toBe(true);
    expect(standardMatchesStatuses(sum(2, 1, 0), S("ok"))).toBe(false);
    expect(standardMatchesStatuses(sum(2, 0, 1), S("ok"))).toBe(false);
    expect(standardMatchesStatuses(sum(1), S("ok"))).toBe(false); // low ไม่ใช่ ok
  });

  it("out / low match by usable level", () => {
    expect(standardMatchesStatuses(sum(0), S("out"))).toBe(true);
    expect(standardMatchesStatuses(sum(1), S("out"))).toBe(false);
    expect(standardMatchesStatuses(sum(1), S("low"))).toBe(true);
    expect(standardMatchesStatuses(sum(2), S("low"))).toBe(false);
  });

  it("expired / soon match by counts", () => {
    expect(standardMatchesStatuses(sum(2, 1, 0), S("expired"))).toBe(true);
    expect(standardMatchesStatuses(sum(2, 0, 0), S("expired"))).toBe(false);
    expect(standardMatchesStatuses(sum(2, 0, 3), S("soon"))).toBe(true);
    expect(standardMatchesStatuses(sum(2, 0, 0), S("soon"))).toBe(false);
  });

  it("union: matches if ANY selected status matches", () => {
    expect(standardMatchesStatuses(sum(2, 0, 1), S("expired", "soon"))).toBe(true);
    expect(standardMatchesStatuses(sum(2, 0, 0), S("expired", "soon"))).toBe(false);
    expect(standardMatchesStatuses(sum(0), S("ok", "out"))).toBe(true);
  });

  it("expiringSoon summary fails ok but passes ok+soon union", () => {
    const s = sum(2, 0, 1);
    expect(standardMatchesStatuses(s, S("ok"))).toBe(false);
    expect(standardMatchesStatuses(s, S("ok", "soon"))).toBe(true);
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่า fail**

Run: `npx vitest run src/lib/stockStatus.test.ts`
Expected: FAIL — `standardMatchesStatuses` is not exported / not defined

- [ ] **Step 3: implement helper**

เพิ่มท้าย `src/lib/stockStatus.ts`:

```ts
export type StandardStatus = "ok" | "out" | "low" | "expired" | "soon";

/**
 * filter สถานะแบบเลือกหลายค่า (OR): true ถ้า summary ตรงกับสถานะใดสถานะหนึ่ง
 * ใน statuses; set ว่าง = ผ่านเสมอ (ไม่กรอง). เงื่อนไขต่อสถานะตรงกับ badge
 * ในตาราง Standards: "ok" ต้อง usable ok และไม่มีขวดหมดอายุ/ใกล้หมดอายุเลย.
 */
export function standardMatchesStatuses(
  sum: StdSummary,
  statuses: ReadonlySet<StandardStatus>,
): boolean {
  if (statuses.size === 0) return true;
  const level = standardLevel(sum.usable);
  if (statuses.has("ok") && level === "ok" && sum.expired === 0 && sum.expiringSoon === 0) return true;
  if (statuses.has("out") && level === "out") return true;
  if (statuses.has("low") && level === "low") return true;
  if (statuses.has("expired") && sum.expired > 0) return true;
  if (statuses.has("soon") && sum.expiringSoon > 0) return true;
  return false;
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `npx vitest run src/lib/stockStatus.test.ts`
Expected: PASS ทุกตัว (ของเดิม 6 describe + ใหม่ 1)

- [ ] **Step 5: Commit**

```bash
git add src/lib/stockStatus.ts src/lib/stockStatus.test.ts
git commit -m "feat(stock): add standardMatchesStatuses multi-status predicate" -- src/lib/stockStatus.ts src/lib/stockStatus.test.ts
```

---

### Task 2: เปลี่ยน filter UI ใน StandardsTab เป็น dropdown ติ๊กถูก

**Files:**
- Modify: `src/pages/Stock.tsx` (ประมาณบรรทัด 3, 18-20, 23, 40-48, 78, 104-119, 194-201 — เลขบรรทัดของไฟล์ก่อนแก้)

**Interfaces:**
- Consumes (จาก Task 1): `standardMatchesStatuses(sum: StdSummary, statuses: ReadonlySet<StandardStatus>): boolean` และ `type StandardStatus` จาก `@/lib/stockStatus`
- Produces: — (จบ feature)

- [ ] **Step 1: แก้ imports**

ใน `src/pages/Stock.tsx`:

1. เพิ่ม `ChevronDown` เข้า import lucide-react เดิม (บรรทัด 3):

```ts
import { Package, AlertTriangle, Clock, Plus, Pencil, ArrowDownToLine, History, Search, ScanLine, Trash2, ChevronDown } from "lucide-react";
```

2. เพิ่ม import dropdown-menu (ใต้ import Select เดิม — **คง import Select ไว้** เพราะ HistoryTab/FrequencyField ยังใช้):

```ts
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
```

3. แก้ import จาก `@/lib/stockStatus` (บรรทัด 23) เป็น:

```ts
import {
  summarizeStandard, standardLevel, solventLevel, glasswareLevel, isUsableBottle,
  standardMatchesStatuses, type StandardStatus,
} from "@/lib/stockStatus";
```

- [ ] **Step 2: แทนที่ type + options (บรรทัด 40-48 เดิม)**

ลบ `type StandardStatusFilter` และ options เดิม แทนด้วย (ไม่มีตัวเลือก "all" แล้ว):

```ts
const STANDARD_STATUS_OPTIONS: { value: StandardStatus; label: string }[] = [
  { value: "ok", label: "ปกติ" },
  { value: "out", label: "หมด" },
  { value: "low", label: "ใกล้หมด" },
  { value: "expired", label: "หมดอายุ" },
  { value: "soon", label: "ใกล้หมดอายุ" },
];
```

- [ ] **Step 3: แก้ state + filter logic ใน StandardsTab**

แทนบรรทัด 78 เดิม (`const [statusFilter, setStatusFilter] = ...`) ด้วย:

```ts
const [statusFilters, setStatusFilters] = useState<Set<StandardStatus>>(new Set());
const toggleStatus = (value: StandardStatus) => {
  setStatusFilters(prev => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  });
};
```

แทน `useMemo` ของ `filtered` (บรรทัด 104-119 เดิม) ด้วย:

```ts
const filtered = useMemo(() => {
  const q = search.trim().toLowerCase();
  return data.filter(s => {
    if (q && !s.name.toLowerCase().includes(q) && !s.code.toLowerCase().includes(q)) return false;
    if (statusFilters.size === 0) return true;
    const sum = summarizeStandard(unitsByCode.get(s.code) ?? [], new Date(now));
    return standardMatchesStatuses(sum, statusFilters);
  }).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}, [data, search, statusFilters, now, unitsByCode]);
```

(หมายเหตุ: `standardLevel` ยังถูกใช้ที่ `lowList` บรรทัด 121 — import ต้องคงไว้)

- [ ] **Step 4: แทนที่ Select JSX ด้วย DropdownMenu (บรรทัด 194-201 เดิม)**

เพิ่มตัวแปร label เหนือ `return` ของ `StandardsTab` (ถัดจาก `expiringList`):

```ts
const statusLabel =
  statusFilters.size === 0 ? "ทุกสถานะ"
  : statusFilters.size === 1 ? STANDARD_STATUS_OPTIONS.find(o => statusFilters.has(o.value))!.label
  : `สถานะ (${statusFilters.size})`;
```

แทน block `<Select ...>...</Select>` เดิมด้วย:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" className="h-9 w-full sm:w-40 justify-between font-normal">
      {statusLabel}
      <ChevronDown className="w-4 h-4 opacity-50" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-40">
    {STANDARD_STATUS_OPTIONS.map(o => (
      <DropdownMenuCheckboxItem
        key={o.value}
        checked={statusFilters.has(o.value)}
        onCheckedChange={() => toggleStatus(o.value)}
        onSelect={e => e.preventDefault()}
      >
        {o.label}
      </DropdownMenuCheckboxItem>
    ))}
  </DropdownMenuContent>
</DropdownMenu>
```

(`onSelect={e => e.preventDefault()}` = ติ๊กแล้วเมนูไม่ปิด ติ๊กหลายค่าได้รวดเดียว)

- [ ] **Step 5: type-check + รันเทสทั้งชุด**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จาก `src/pages/Stock.tsx` / `src/lib/stockStatus.ts` (latent error เดิม ~12 ตัวไม่นับ)

Run: `npm run test`
Expected: PASS ทั้งหมด (รวม `src/pages/__tests__/Stock.delete.test.tsx` เดิม)

- [ ] **Step 6: Commit**

```bash
git add src/pages/Stock.tsx
git commit -m "feat(stock): multi-select status filter on standards tab" -- src/pages/Stock.tsx
```

---

## Manual E2E (หลังจบทุก task — ทำโดย user หรือ browser MCP)

1. เปิด `/stock` แท็บ Standards → ปุ่ม filter โชว์ "ทุกสถานะ" และเห็นรายการครบ
2. ติ๊ก "หมดอายุ" → เห็นเฉพาะรายการที่มีขวดหมดอายุ, ปุ่มโชว์ "หมดอายุ"
3. ติ๊ก "ใกล้หมดอายุ" เพิ่ม (เมนูต้องไม่ปิดตอนติ๊ก) → เห็น union ทั้งสองแบบ, ปุ่มโชว์ "สถานะ (2)"
4. ติ๊กออกทั้งหมด → กลับมาเห็นทุกรายการ, ปุ่มโชว์ "ทุกสถานะ"
5. พิมพ์ค้นหาร่วมกับติ๊กสถานะ → กรองแบบ AND ร่วมกันเหมือนเดิม
