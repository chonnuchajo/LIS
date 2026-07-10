# Stock Standard Detail Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หน้า `/stock` แท็บ Standards — คลิกทั้งแถวเปิด Drawer รายละเอียดสาร (Sheet ฝั่งขวา) ที่มีปุ่ม [✎ แก้ไข] ข้าง [+ เพิ่มขวด (รับเข้า)]; คอลัมน์ Actions เหลือแค่ปุ่มลบ

**Architecture:** สร้าง `StandardDetailDrawer` (shadcn Sheet, pattern เดียวกับ Detail Drawer หน้า Master Item) แทน `UnitsDrawer` เดิม; reuse `StandardUnitsPanel` โดยเพิ่ม prop `onEdit?` เพื่อวางปุ่มแก้ไขคู่ปุ่มเพิ่มขวด; state ใน `StandardsTab` เก็บเป็น `drawerId` แล้ว lookup ตัวจริงจาก query ทุก render กัน snapshot ค้างหลังแก้ไข

**Tech Stack:** React 18 + TypeScript, shadcn/ui (Sheet/Dialog/Table/Badge), TanStack React Query, Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-07-10-stock-standard-detail-drawer-design.md`

## Global Constraints

- ❌ ห้ามรัน `npm run build` (postbuild ทับไฟล์ root — ใช้ tsc เช็คแทน)
- type-check ที่ได้ผลจริง: `npx tsc -p tsconfig.app.json --noEmit` (คำสั่ง `npx tsc --noEmit` เฉยๆ เป็น no-op เพราะ root tsconfig `files:[]`)
- ⚠️ repo มี latent tsc error เดิมค้างอยู่ ~12 จุดในไฟล์อื่น — เกณฑ์ผ่านคือ **ไม่มี error ใหม่ในไฟล์ที่แตะ** (กรองด้วย grep ตามคำสั่งในแต่ละ task)
- commit ด้วย **explicit pathspec เท่านั้น** (มี process อื่น commit แทรกในรีโปนี้): `git commit -m "..." -- <ไฟล์>` และ `git add <ไฟล์>` ระบุไฟล์ตรงๆ ห้าม `git add -A`/`git add .`
- UI ภาษาไทยตามข้อความที่กำหนดในแผนเป๊ะๆ; ไม่แตะ backend/schema; ไม่แตะแท็บ สารเคมี/เครื่องแก้ว/รับเข้า/ประวัติ

---

### Task 1: เพิ่ม prop `onEdit` ให้ StandardUnitsPanel (ปุ่มแก้ไขข้างปุ่มเพิ่มขวด)

**Files:**
- Modify: `src/components/lis/stock/StandardUnitsPanel.tsx` (บรรทัด ~26-65: doc comment, signature, toolbar)

**Interfaces:**
- Consumes: ของเดิมทั้งหมด (ไม่มี dependency)
- Produces: `export default function StandardUnitsPanel({ standard, onEdit }: { standard: StockStandardItem; onEdit?: () => void })` — เมื่อส่ง `onEdit` จะ render ปุ่ม "แก้ไข" (มี `<Pencil>` icon) ข้างซ้ายของปุ่ม "เพิ่มขวด (รับเข้า)"; ไม่ส่ง = หน้าตาเดิมเป๊ะ (จุดใช้เดิมใน `StandardDialog` ของ Stock.tsx ไม่ต้องแก้)

- [ ] **Step 1: แก้ doc comment + signature**

ในไฟล์ `src/components/lis/stock/StandardUnitsPanel.tsx` แทนที่:

```tsx
/** ตารางจัดการขวดรายตัวของสารมาตรฐาน (เพิ่ม/แก้/แบ่ง/ปริ้นซ้ำ/ทิ้ง) — ใช้ทั้งใน
 *  UnitsDrawer และฝังในฟอร์มแก้ไข Standard. ปุ่มทุกอันเป็น type="button"
 *  เพื่อไม่ให้ submit ฟอร์มที่ครอบอยู่ (ตอนฝังในฟอร์มแก้ไข Standard) */
export default function StandardUnitsPanel({ standard }: { standard: StockStandardItem }) {
```

ด้วย:

```tsx
/** ตารางจัดการขวดรายตัวของสารมาตรฐาน (เพิ่ม/แก้/แบ่ง/ปริ้นซ้ำ/ทิ้ง) — ใช้ทั้งใน
 *  StandardDetailDrawer และฝังในฟอร์มแก้ไข Standard. ปุ่มทุกอันเป็น type="button"
 *  เพื่อไม่ให้ submit ฟอร์มที่ครอบอยู่ (ตอนฝังในฟอร์มแก้ไข Standard)
 *  ส่ง onEdit เมื่อต้องการปุ่มแก้ไขข้างปุ่มเพิ่มขวด (ใช้ใน drawer); ไม่ส่ง = ไม่มีปุ่ม */
export default function StandardUnitsPanel({ standard, onEdit }: { standard: StockStandardItem; onEdit?: () => void }) {
```

- [ ] **Step 2: เพิ่มปุ่มแก้ไขใน toolbar**

แทนที่:

```tsx
      <div className="flex justify-end mb-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setReceiving(true)}>
          <Plus className="w-4 h-4 mr-1" /> เพิ่มขวด (รับเข้า)
        </Button>
      </div>
```

ด้วย:

```tsx
      <div className="flex justify-end gap-2 mb-2">
        {onEdit && (
          <Button type="button" size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="w-4 h-4 mr-1" /> แก้ไข
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={() => setReceiving(true)}>
          <Plus className="w-4 h-4 mr-1" /> เพิ่มขวด (รับเข้า)
        </Button>
      </div>
```

(`Pencil` ถูก import อยู่แล้วที่หัวไฟล์ — ไม่ต้องเพิ่ม import)

- [ ] **Step 3: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "StandardUnitsPanel|StandardDetailDrawer|pages/Stock" ; echo "exit=$?"`
Expected: ไม่มีบรรทัด error ของไฟล์พวกนี้ (grep ไม่เจอ → `exit=1` คือผ่าน; error เดิมของไฟล์อื่นไม่นับ)

- [ ] **Step 4: Commit**

```bash
git add src/components/lis/stock/StandardUnitsPanel.tsx
git commit -m "feat(stock): optional edit button beside add-bottle in StandardUnitsPanel" -- src/components/lis/stock/StandardUnitsPanel.tsx
```

---

### Task 2: สร้างคอมโพเนนต์ StandardDetailDrawer

**Files:**
- Create: `src/components/lis/stock/StandardDetailDrawer.tsx`

**Interfaces:**
- Consumes: `StandardUnitsPanel` prop `onEdit?: () => void` จาก Task 1; `summarizeStandard(units: StockUnitItem[], now: Date)`, `isUsableBottle(u: StockUnitItem, now: Date)` จาก `@/lib/stockStatus` (มีอยู่แล้ว); shadcn `Sheet` จาก `@/components/ui/sheet`
- Produces: default export `StandardDetailDrawer({ standard, units, onEdit, onClose }: { standard: StockStandardItem; units: StockUnitItem[]; onEdit: () => void; onClose: () => void })` ที่ path `@/components/lis/stock/StandardDetailDrawer` — Task 3 ใช้

- [ ] **Step 1: สร้างไฟล์ทั้งไฟล์**

สร้าง `src/components/lis/stock/StandardDetailDrawer.tsx` เนื้อหาทั้งหมด:

```tsx
import { Package } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { summarizeStandard, isUsableBottle } from "@/lib/stockStatus";
import StandardUnitsPanel from "./StandardUnitsPanel";
import type { StockStandardItem, StockUnitItem } from "@/types/stock";

/** Drawer รายละเอียดสาร Standard — เปิดจากการคลิกแถวในตาราง /stock:
 *  หัว = สถานะ/คงคลัง (ชุดตรรกะเดียวกับ badge ในแถวตาราง), ข้อมูลสาร,
 *  และตารางรายขวด (StandardUnitsPanel) พร้อมปุ่มแก้ไขข้างปุ่มเพิ่มขวด */
export default function StandardDetailDrawer({
  standard, units, onEdit, onClose,
}: {
  standard: StockStandardItem;
  units: StockUnitItem[];
  onEdit: () => void;
  onClose: () => void;
}) {
  const now = new Date();
  const sum = summarizeStandard(units, now);
  const tierParts = (["primary", "working", "supplier"] as const)
    .map(t => [t, units.filter(u => isUsableBottle(u, now) && (u.type || "primary") === t).length] as const)
    .filter(([, n]) => n > 0)
    .map(([t, n]) => `${t} ${n}`);

  const info: [string, string][] = [
    ["ความถี่/1 ครั้ง", standard.frequency || "-"],
    ["อุณหภูมิที่เก็บ (°C)", standard.storageTemp || "-"],
    ["อัตราการใช้/ครั้ง (mg)", standard.usagePerUseMg != null && standard.usagePerUseMg !== "" ? String(standard.usagePerUseMg) : "-"],
    ["หมายเหตุ", standard.status || "-"],
  ];

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="space-y-2 border-b border-border p-5 pr-16 text-left">
          <SheetTitle className="text-xl font-bold">{standard.name}</SheetTitle>
          <SheetDescription className="font-semibold text-primary">{standard.code}</SheetDescription>
          <div className="flex flex-wrap items-center gap-1.5">
            {sum.usable === 0 && <Badge className="bg-destructive/15 text-destructive text-xs">หมด</Badge>}
            {sum.expired > 0 && <Badge className="bg-destructive/15 text-destructive text-xs">หมดอายุ {sum.expired}</Badge>}
            {sum.expiringSoon > 0 && <Badge className="bg-amber-100 text-amber-700 text-xs">ใกล้หมดอายุ {sum.expiringSoon}</Badge>}
            {sum.usable > 0 && sum.expired === 0 && sum.expiringSoon === 0 && <Badge className="bg-emerald-100 text-emerald-700 text-xs">ปกติ</Badge>}
            <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
              <Package className="w-3.5 h-3.5" /> คงคลัง {sum.usable} ขวด{tierParts.length > 0 ? ` (${tierParts.join(" · ")})` : ""}
            </span>
          </div>
        </SheetHeader>
        <div className="p-5 space-y-5">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {info.map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="text-muted-foreground shrink-0">{label}:</dt>
                <dd className="font-medium break-words min-w-0">{value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <div className="font-semibold mb-2">รายขวด</div>
            <StandardUnitsPanel standard={standard} onEdit={onEdit} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

หมายเหตุ: badge สถานะจงใจซ้ำกับใน `Stock.tsx` แถวตาราง (4 บรรทัด) — ไม่ต้อง extract ร่วม (แถวกับ drawer อาจ diverge ภายหลัง)

- [ ] **Step 2: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "StandardUnitsPanel|StandardDetailDrawer|pages/Stock" ; echo "exit=$?"`
Expected: ไม่มี error ของไฟล์พวกนี้ (`exit=1` คือผ่าน)

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/stock/StandardDetailDrawer.tsx
git commit -m "feat(stock): standard detail drawer component (Sheet)" -- src/components/lis/stock/StandardDetailDrawer.tsx
```

---

### Task 3: ต่อสายใน Stock.tsx — แถวคลิกได้ + Actions เหลือปุ่มลบ + ลบ UnitsDrawer (TDD)

**Files:**
- Modify: `src/pages/__tests__/Stock.delete.test.tsx`
- Modify: `src/pages/Stock.tsx` (เฉพาะส่วน `StandardsTab` + import; ห้ามแตะ `SolventsTab`/`GlasswareTab`/`HistoryTab`/dialog ท้ายไฟล์)
- Delete: `src/components/lis/stock/UnitsDrawer.tsx`

**Interfaces:**
- Consumes: `StandardDetailDrawer({ standard, units, onEdit, onClose })` จาก Task 2
- Produces: — (งานปลายทาง)

- [ ] **Step 1: อัปเดตเทสก่อน (จะ fail จนกว่าจะ implement)**

ใน `src/pages/__tests__/Stock.delete.test.tsx`:

(a) แทนที่ mock ของ UnitsDrawer:

```tsx
vi.mock("@/components/lis/stock/UnitsDrawer", () => ({
  default: () => null,
}));
```

ด้วย mock ของ drawer ใหม่ (render sentinel ให้เช็คได้):

```tsx
vi.mock("@/components/lis/stock/StandardDetailDrawer", () => ({
  default: () => <div data-testid="standard-detail-drawer" />,
}));
```

(b) ในเทสเดิม `"confirms and deletes a standard through the MongoDB-backed API"` แทนที่:

```tsx
    expect(await screen.findByRole("button", { name: "Pesticide Standard" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ลบ Standard Pesticide Standard" }));
```

ด้วย (ชื่อไม่ใช่ปุ่มแล้ว + ปุ่มลบต้องไม่เปิด drawer):

```tsx
    expect(await screen.findByText("Pesticide Standard")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ลบ Standard Pesticide Standard" }));
    expect(screen.queryByTestId("standard-detail-drawer")).not.toBeInTheDocument();
```

(c) เพิ่มเทสใหม่ต่อท้ายใน `describe` เดิม:

```tsx
  it("opens the detail drawer when clicking a standard row", async () => {
    renderStock();

    fireEvent.click(await screen.findByText("Pesticide Standard"));

    expect(await screen.findByTestId("standard-detail-drawer")).toBeInTheDocument();
  });
```

- [ ] **Step 2: รันเทสให้เห็นว่า fail**

Run: `npx vitest run src/pages/__tests__/Stock.delete.test.tsx`
Expected: เทสใหม่ `opens the detail drawer...` **FAIL** (คลิกชื่อตอนนี้เปิด UnitsDrawer จริง ไม่มี testid); เทสลบเดิมยังผ่าน

- [ ] **Step 3: แก้ Stock.tsx — import**

แทนที่ 2 บรรทัดนี้ (บรรทัด ~28, ~30):

```tsx
import UnitsDrawer from "@/components/lis/stock/UnitsDrawer";
```
```tsx
import ReceiveBottlesDialog from "@/components/lis/stock/ReceiveBottlesDialog";
```

ด้วยบรรทัดเดียว:

```tsx
import StandardDetailDrawer from "@/components/lis/stock/StandardDetailDrawer";
```

(ห้ามลบ import lucide ตัวไหน — `ArrowDownToLine`/`Pencil`/`Package` ยังใช้ในแท็บสารเคมี/เครื่องแก้ว)

- [ ] **Step 4: แก้ state ใน StandardsTab**

แทนที่:

```tsx
  const [drawer, setDrawer] = useState<StockStandardItem | null>(null);
  const [receiving, setReceiving] = useState<StockStandardItem | null>(null);
```

ด้วย (lookup จาก `data` ลิสต์เต็ม — ไม่ใช่ `filtered` — จะได้ไม่ปิดเองตอนพิมพ์ค้นหา; ถ้ารายการหายไป เช่น โดนลบ drawer จะ unmount เอง):

```tsx
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const drawerItem = drawerId ? data.find(s => s._id === drawerId) ?? null : null;
```

- [ ] **Step 5: แก้หัวคอลัมน์ Actions**

แทนที่:

```tsx
                  <TableHead className="w-40 text-right">Actions</TableHead>
```

ด้วย:

```tsx
                  <TableHead className="w-12"><span className="sr-only">ลบ</span></TableHead>
```

- [ ] **Step 6: แก้แถวตาราง — คลิกทั้งแถว + ชื่อเป็นข้อความ + เหลือปุ่มลบ**

แทนที่ (เปิดแถว + เซลล์ชื่อ):

```tsx
                    <TableRow key={item._id}>
                      <TableCell className="font-semibold text-primary">{item.code}</TableCell>
                      <TableCell className="font-medium">
                        <button type="button" className="hover:underline text-left" onClick={() => setDrawer(item)}>{item.name}</button>
                      </TableCell>
```

ด้วย:

```tsx
                    <TableRow
                      key={item._id}
                      className="cursor-pointer"
                      onClick={() => setDrawerId(item._id)}
                      title="คลิกเพื่อดูรายละเอียด"
                    >
                      <TableCell className="font-semibold text-primary">{item.code}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
```

และแทนที่เซลล์ Actions ทั้งก้อน:

```tsx
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title="รับเข้า (ขวด)" onClick={() => setReceiving(item)}><ArrowDownToLine className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" title="รายขวด" onClick={() => setDrawer(item)}><Package className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" title="แก้ไข" onClick={() => setEditing(item)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" title={`ลบ Standard ${item.name}`} aria-label={`ลบ Standard ${item.name}`} onClick={() => setDeleting(item)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
```

ด้วย (`stopPropagation` กันคลิกลบแล้วเปิด drawer):

```tsx
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            size="icon" variant="ghost"
                            title={`ลบ Standard ${item.name}`} aria-label={`ลบ Standard ${item.name}`}
                            onClick={e => { e.stopPropagation(); setDeleting(item); }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
```

- [ ] **Step 7: แก้จุด render drawer/receiving ท้าย StandardsTab**

แทนที่:

```tsx
      {drawer && <UnitsDrawer standard={drawer} onClose={() => setDrawer(null)} />}
      {receiving && (
        <ReceiveBottlesDialog
          standard={receiving}
          onClose={() => setReceiving(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["stock", "units"] }); }}
        />
      )}
```

ด้วย (`onEdit` เปิด `StandardDialog` เดิมทับ Sheet — portal ตัวหลัง mount ทีหลังอยู่บนสุด; บันทึกแล้ว `onSaved` invalidate query → `drawerItem` derive ใหม่ → หัว drawer สดเอง):

```tsx
      {drawerItem && (
        <StandardDetailDrawer
          standard={drawerItem}
          units={unitsByCode.get(drawerItem.code) ?? []}
          onEdit={() => setEditing(drawerItem)}
          onClose={() => setDrawerId(null)}
        />
      )}
```

- [ ] **Step 8: ลบไฟล์ UnitsDrawer**

ยืนยันก่อนว่าไม่เหลือใครใช้ (ต้องเหลือ 0 จุดนอกไฟล์ตัวเอง):

Run: `grep -rn "UnitsDrawer" src/ --include="*.tsx" --include="*.ts"`
Expected: เจอแค่ใน `src/components/lis/stock/UnitsDrawer.tsx` เอง (Stock.tsx/เทสแก้ไปแล้ว; comment ใน StandardUnitsPanel แก้ไปแล้วใน Task 1)

```bash
git rm src/components/lis/stock/UnitsDrawer.tsx
```

- [ ] **Step 9: รันเทสไฟล์นี้ให้ผ่าน**

Run: `npx vitest run src/pages/__tests__/Stock.delete.test.tsx`
Expected: PASS ทั้ง 2 เทส

- [ ] **Step 10: รันเทสทั้ง repo + type-check**

Run: `npm run test`
Expected: ผ่านทั้งหมด (baseline ล่าสุด ~715+ เทส) — ห้ามมีเทสอื่น fail เพิ่ม

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "StandardUnitsPanel|StandardDetailDrawer|pages/Stock" ; echo "exit=$?"`
Expected: ไม่มี error ของไฟล์พวกนี้ (`exit=1` คือผ่าน)

- [ ] **Step 11: Commit**

```bash
git add src/pages/Stock.tsx src/pages/__tests__/Stock.delete.test.tsx
git commit -m "feat(stock): clickable standard rows open detail drawer, slim row actions" -- src/pages/Stock.tsx src/pages/__tests__/Stock.delete.test.tsx src/components/lis/stock/UnitsDrawer.tsx
```

(ไฟล์ UnitsDrawer.tsx อยู่ใน index แล้วจาก `git rm` — ใส่ใน pathspec ให้ commit เก็บการลบด้วย)

---

### Task 4: Browser verification (ทำใน main session — Playwright MCP + Brave)

**Files:** ไม่แก้โค้ด — ตรวจของจริง

**Precondition:** dev servers รันอยู่ — frontend `npm run dev` (port 8000), backend `cd server && npm run dev` (port 3001); เปิด `http://localhost:8000/LIS/stock`

⚠️ DB dev เครื่องนี้เป็นข้อมูลจริงที่ sync ขึ้น git — การแก้ค่าเพื่อทดสอบให้แก้กลับเป็นค่าเดิมเสมอ และห้ามกดบันทึกใน ReceiveBottlesDialog/ยืนยันลบ

- [ ] คลิกแถว Standard ตัวไหนก็ได้ (ที่ไม่ใช่ปุ่มลบ) → Sheet เปิดจากขวา: ชื่อ + code + badge สถานะ + "คงคลัง N ขวด (primary/working/supplier ...)" ตรงกับที่แถวโชว์
- [ ] ข้อมูลสาร 4 ช่อง (ความถี่/อุณหภูมิ/อัตราการใช้/หมายเหตุ) โชว์ค่า หรือ "-" เมื่อว่าง
- [ ] ปุ่ม [✎ แก้ไข] อยู่ติดซ้ายของ [+ เพิ่มขวด (รับเข้า)] เหนือตารางรายขวด
- [ ] กด แก้ไข → ฟอร์ม "แก้ไข Standard" เปิดทับ drawer; ใน panel รายขวดที่ฝังในฟอร์มต้อง **ไม่มี** ปุ่มแก้ไขซ้อน; แก้ อุณหภูมิที่เก็บ → บันทึก → drawer ข้างหลังโชว์ค่าใหม่ทันที → แก้กลับค่าเดิม → บันทึก
- [ ] กด เพิ่มขวด (รับเข้า) → ReceiveBottlesDialog เปิดทับ drawer → ปิดโดยไม่บันทึก
- [ ] กดปุ่ม 🗑 ในแถวตาราง → เปิด confirm ลบโดย **ไม่เปิด** drawer → ยกเลิก
- [ ] ปิด drawer ด้วยปุ่ม X / คลิก overlay / ESC ได้; หลังปิดแล้ว nav ซ้ายกดได้ปกติ (ไม่ติด pointer-events lock)
- [ ] แท็บ สารเคมี/เครื่องแก้ว: ปุ่ม รับเข้า/แก้ไข/ลบ ท้ายแถวยังอยู่ครบเหมือนเดิม (ต้องไม่โดนแก้)
