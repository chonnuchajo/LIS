# StockUnit Tree Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แสดงตารางขวด StockUnit แบบ tree — ขวด ref (sealed) เป็นแถวหลักกดกางได้ ลูก working โผล่เป็น 1.1, 1.2 ใต้มัน แทนที่จะเป็นแถวแบนเลขรันนิ่ง

**Architecture:** เพิ่ม pure helper `buildUnitTree()` ใน `src/lib/stockUnit.ts` ที่จัด `StockUnitItem[]` เป็น flat render-list (root → children DFS) พร้อม label/depth/hasChildren/rootId แล้ว refactor `StandardUnitsPanel` ให้เรนเดอร์จาก list นั้นพร้อม expand/collapse state. ไม่แตะ backend — `parentId` มีอยู่แล้ว

**Tech Stack:** React 18 + TypeScript + Vitest + shadcn Table + lucide-react icons

---

### Task 1: `buildUnitTree` helper + tests

**Files:**
- Modify: `src/lib/stockUnit.ts` (เพิ่ม type + function ต่อท้ายไฟล์)
- Test: `src/lib/stockUnit.test.ts` (ถ้ายังไม่มีให้สร้าง; ถ้ามีให้ append)

- [ ] **Step 1: เขียน test ที่ fail ก่อน**

ถ้า `src/lib/stockUnit.test.ts` ยังไม่มี ให้สร้างพร้อม import header:

```ts
import { describe, it, expect } from "vitest";
import { buildUnitTree } from "./stockUnit";
import type { StockUnitItem } from "@/types/stock";

function mk(p: Partial<StockUnitItem> & { _id: string }): StockUnitItem {
  return {
    qrId: "qr_" + p._id,
    itemCode: "C1",
    itemName: "Std",
    kind: "sealed",
    volume: { initial: 50, remaining: 50, unit: "ml" },
    status: "active",
    ...p,
  };
}

describe("buildUnitTree", () => {
  it("sealed ล้วน → root เลข 1,2,3 ไม่มีลูก", () => {
    const rows = buildUnitTree([
      mk({ _id: "a" }),
      mk({ _id: "b" }),
      mk({ _id: "c" }),
    ]);
    expect(rows.map((r) => r.label)).toEqual(["1", "2", "3"]);
    expect(rows.every((r) => r.depth === 0 && !r.hasChildren)).toBe(true);
  });

  it("working ลูกซ้อนใต้ ref เป็น 1.1/1.2 เรียงตามเวลาแบ่ง", () => {
    const rows = buildUnitTree([
      mk({ _id: "p1" }),
      mk({ _id: "w2", kind: "working", parentId: "p1", withdrawnDate: "2026-06-02" }),
      mk({ _id: "w1", kind: "working", parentId: "p1", withdrawnDate: "2026-06-01" }),
      mk({ _id: "p2" }),
    ]);
    expect(rows.map((r) => r.label)).toEqual(["1", "1.1", "1.2", "2"]);
    expect(rows.map((r) => r._id ?? r.unit._id)).toEqual(["p1", "w1", "w2", "p2"]);
    const root = rows.find((r) => r.label === "1")!;
    expect(root.hasChildren).toBe(true);
    const child = rows.find((r) => r.label === "1.1")!;
    expect(child.depth).toBe(1);
    expect(child.rootId).toBe("p1");
  });

  it("กรอง discarded ออก และ working ที่พ่อหายกลายเป็น orphan root ต่อท้าย", () => {
    const rows = buildUnitTree([
      mk({ _id: "p1" }),
      mk({ _id: "pd", status: "discarded" }),
      mk({ _id: "worphan", kind: "working", parentId: "pd" }),
    ]);
    // pd ถูกกรองออก, p1 = root "1", worphan ไม่มีพ่อที่เห็น → root "2"
    expect(rows.map((r) => r.label)).toEqual(["1", "2"]);
    const orphan = rows.find((r) => r.unit._id === "worphan")!;
    expect(orphan.depth).toBe(0);
    expect(orphan.hasChildren).toBe(false);
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npx vitest run src/lib/stockUnit.test.ts`
Expected: FAIL — `buildUnitTree is not a function` / ไม่มี export

- [ ] **Step 3: เขียน implementation ต่อท้าย `src/lib/stockUnit.ts`**

```ts
export interface UnitTreeRow {
  unit: StockUnitItem;
  label: string;
  depth: number;
  hasChildren: boolean;
  rootId: string;
}

/** จัด StockUnitItem[] เป็น flat render-list แบบ tree:
 *  - กรอง discarded ออก (ตาม unitDerivedStatus)
 *  - root = ขวด sealed เรียงตาม input → label "1","2",...
 *  - child = working ที่ parentId ตรง root → label "<n>.1",".2" เรียงตามเวลาแบ่ง
 *  - orphan = working ที่พ่อไม่อยู่ในชุดที่เห็น → ยกเป็น root ต่อท้าย
 *  output เรียงแบบ DFS: root → children ของมัน → root ถัดไป */
export function buildUnitTree(
  units: StockUnitItem[],
  now: Date = new Date(),
): UnitTreeRow[] {
  const visible = units.filter((u) => unitDerivedStatus(u, now) !== "discarded");
  const roots = visible.filter((u) => u.kind === "sealed");
  const rootIds = new Set(roots.map((u) => u._id));

  const childrenByParent = new Map<string, StockUnitItem[]>();
  const orphans: StockUnitItem[] = [];
  for (const u of visible) {
    if (u.kind !== "working") continue;
    if (u.parentId && rootIds.has(u.parentId)) {
      const arr = childrenByParent.get(u.parentId) ?? [];
      arr.push(u);
      childrenByParent.set(u.parentId, arr);
    } else {
      orphans.push(u);
    }
  }

  const timeOf = (u: StockUnitItem) =>
    new Date(u.withdrawnDate || u.createdAt || 0).getTime();
  for (const arr of childrenByParent.values()) arr.sort((a, b) => timeOf(a) - timeOf(b));

  const rows: UnitTreeRow[] = [];
  let n = 0;
  for (const root of roots) {
    n += 1;
    const kids = childrenByParent.get(root._id) ?? [];
    rows.push({ unit: root, label: String(n), depth: 0, hasChildren: kids.length > 0, rootId: root._id });
    kids.forEach((kid, i) => {
      rows.push({ unit: kid, label: `${n}.${i + 1}`, depth: 1, hasChildren: false, rootId: root._id });
    });
  }
  for (const orphan of orphans) {
    n += 1;
    rows.push({ unit: orphan, label: String(n), depth: 0, hasChildren: false, rootId: orphan._id });
  }
  return rows;
}
```

หมายเหตุ: test ใช้ `r._id ?? r.unit._id` ตรง assert ลำดับ — `UnitTreeRow` ไม่มี field `_id` ตรงๆ ดังนั้น fallback `r.unit._id` จะถูกใช้เสมอ (ตั้งใจ เผื่ออ่านง่าย)

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run src/lib/stockUnit.test.ts`
Expected: PASS ทั้ง 3 เคส

- [ ] **Step 5: commit**

```bash
git add src/lib/stockUnit.ts src/lib/stockUnit.test.ts
git commit -m "feat(stock): add buildUnitTree helper for ref→working tree display" -- src/lib/stockUnit.ts src/lib/stockUnit.test.ts
```

---

### Task 2: Refactor `StandardUnitsPanel` ให้เรนเดอร์ tree + expand/collapse

**Files:**
- Modify: `src/components/lis/stock/StandardUnitsPanel.tsx`

- [ ] **Step 1: เพิ่ม imports + expand state**

แก้ import icon (บรรทัด ~4) ให้มี chevron:

```tsx
import { Minus, Trash2, Printer, Pencil, Plus, ChevronRight, ChevronDown } from "lucide-react";
```

แก้ import helper (บรรทัด ~10) ให้มี `buildUnitTree`:

```tsx
import { unitDerivedStatus, buildUnitTree } from "@/lib/stockUnit";
```

เพิ่ม state ในตัว component (ใกล้ state อื่น ~บรรทัด 35):

```tsx
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (rootId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(rootId) ? next.delete(rootId) : next.add(rootId);
      return next;
    });
```

- [ ] **Step 2: แทนที่การคำนวณ `visible` ด้วย tree rows**

ลบบรรทัด (เดิม ~42-43):

```tsx
  // ซ่อนขวดที่ทิ้งแล้ว — แสดงเฉพาะขวดที่ยังมีอยู่จริง และนับเลขลำดับใหม่ตามนั้น
  const visible = data.filter((u) => unitDerivedStatus(u) !== "discarded");
```

ใส่แทน:

```tsx
  // จัดเป็น tree: ref (sealed) เป็น root, working เป็นลูก 1.1/1.2; ซ่อน discarded ใน helper
  const rows = buildUnitTree(data);
```

- [ ] **Step 3: แทนที่ tbody ให้เรนเดอร์จาก `rows` พร้อมพับ/กาง**

แทนที่ทั้งบล็อก `<TableBody>...</TableBody>` (เดิม ~82-113) ด้วย:

```tsx
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6">กำลังโหลด...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">ยังไม่มีขวด — กดเพิ่มขวด</TableCell></TableRow>
            ) : rows.map((row) => {
              const u = row.unit;
              if (row.depth === 1 && !expanded.has(row.rootId)) return null;
              const st = unitDerivedStatus(u);
              const canWithdraw = u.kind === "sealed" && st === "active";
              const canDiscard = st !== "discarded";
              const isChild = row.depth === 1;
              return (
                <TableRow key={u._id} className={isChild ? "bg-muted/30" : undefined}>
                  <TableCell className="text-center text-muted-foreground">
                    <div className={`flex items-center gap-1 ${isChild ? "pl-5" : ""}`}>
                      {row.depth === 0 && row.hasChildren ? (
                        <button type="button" onClick={() => toggle(row.rootId)} className="text-muted-foreground hover:text-foreground" title={expanded.has(row.rootId) ? "พับ" : "กาง"}>
                          {expanded.has(row.rootId) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      ) : row.depth === 0 ? (
                        <span className="inline-block w-4" />
                      ) : null}
                      <span>{row.label}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{u.kind === "working" ? "working" : "คงคลัง"}</Badge></TableCell>
                  <TableCell className="text-xs">
                    {u.source === "primary" ? "primary" : u.source === "supply" ? "supply" : "-"}
                  </TableCell>
                  <TableCell className="text-xs">{u.lotNo || "-"}</TableCell>
                  <TableCell className="text-right">{u.volume?.remaining ?? "-"} {u.volume?.unit}</TableCell>
                  <TableCell className="text-xs">{u.exp ? new Date(u.exp).toLocaleDateString("th-TH") : "-"}</TableCell>
                  <TableCell><Badge className={`text-xs ${STATUS_BADGE[st]}`}>{STATUS_LABEL[st]}</Badge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {canWithdraw && <Button type="button" size="icon" variant="ghost" title="แบ่ง working" onClick={() => setWithdrawQr(u.qrId)}><Minus className="w-4 h-4" /></Button>}
                      {st !== "discarded" && <Button type="button" size="icon" variant="ghost" title="แก้ไขข้อมูล" onClick={() => setEditUnit(u)}><Pencil className="w-4 h-4" /></Button>}
                      <Button type="button" size="icon" variant="ghost" title="ปริ้นซ้ำ" onClick={() => reprint(u)}><Printer className="w-4 h-4" /></Button>
                      {canDiscard && <Button type="button" size="icon" variant="ghost" title="ทิ้ง" onClick={() => setDiscardQr(u.qrId)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
```

- [ ] **Step 4: type-check ผ่าน**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จาก `StandardUnitsPanel.tsx` หรือ `stockUnit.ts` (repo มี latent error เดิม ~12 ตัว — ตรวจว่าไม่มีอันใหม่จาก 2 ไฟล์นี้)

- [ ] **Step 5: commit**

```bash
git add src/components/lis/stock/StandardUnitsPanel.tsx
git commit -m "feat(stock): render unit table as collapsible ref→working tree" -- src/components/lis/stock/StandardUnitsPanel.tsx
```

---

### Task 3: Manual verify ใน dev (localhost)

**Files:** ไม่มี (verify อย่างเดียว)

- [ ] **Step 1: รัน frontend + backend**

Run (สองเทอร์มินัล): `npm run dev` (root) และ `cd server && npm run dev`

- [ ] **Step 2: ตรวจพฤติกรรม**

เปิด Stock → กดดูขวดของสารที่มี working ลูก แล้วยืนยัน:
- ขวด ref เป็นแถวเลข 1,2,3 มี chevron `▶` ถ้ามีลูก, **เริ่มต้นพับ**
- กด chevron → เห็นลูก working เลข 1.1, 1.2 เยื้องเข้า
- แบ่ง working ใหม่จาก ref ใบ 1 → กลับมาเป็นลูก 1.x ใต้ใบ 1 (ไม่ใช่แถวใหม่แยก) และ ref ใบ 1 คงเหลือลดลงตามที่แบ่ง
- ทิ้ง ref ที่มีลูก → ref หาย ลูกที่เหลือโผล่เป็น root ต่อท้าย ไม่หาย

- [ ] **Step 3: ไม่ต้อง commit** (verify task)

---

## Self-Review

- **Spec coverage:** Task 1 = helper + edge cases (orphan, discarded, ordering); Task 2 = tree render + collapse-default + chevron + indent + ref-remaining; Task 3 = manual verify ครบ scenario ใน spec. ✓
- **No backend change:** ตรงตาม spec ✓
- **Type consistency:** `buildUnitTree(units)` คืน `UnitTreeRow[]` ใช้เหมือนกันทั้ง 2 task; field `_id`/`parentId`/`withdrawnDate`/`createdAt`/`kind` ตรงกับ `StockUnitItem` ใน `src/types/stock.ts` ✓
- **Placeholder scan:** ไม่มี TODO/TBD; ทุก step มีโค้ดจริง ✓
