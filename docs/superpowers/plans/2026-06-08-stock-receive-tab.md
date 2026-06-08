# แถบ "รับเข้า" รวมศูนย์ใน Stock Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มแถบ "รับเข้า" รวมศูนย์ในหน้า Stock Management — เลือกหมวด → เลือกรายการ (มี badge สถานะ + กรองใกล้หมด) → เปิด dialog รับเข้าเดิม

**Architecture:** แถบใหม่เป็น selector ห่อ dialog เดิม (`ReceiveBottlesDialog` / `SimpleMoveDialog`) ไม่แตะ backend/API/logic รับเข้า. logic จัดระดับสถานะ stock ("ปกติ/ใกล้หมด/หมด") แยกเป็น pure helper ใน lib พร้อม unit test

**Tech Stack:** React 18 + TypeScript, TanStack React Query, shadcn/ui, Vitest, Tailwind (`lis.*`)

---

## File Structure

- **Create** `src/lib/stockReceive.ts` — ค่าคงที่ low-stock threshold + pure helper จัดระดับสถานะ (`StockLevel`, `levelFromQty`, `levelFromUnits`)
- **Create** `src/lib/stockReceive.test.ts` — unit test ของ helper
- **Modify** `src/pages/Stock.tsx` — ย้าย threshold มา import จาก helper, เพิ่ม component `ReceiveTab` + tab trigger/content

หมายเหตุ: `summarizeUnits` (`src/lib/stockUnit.ts`) คืน `{ sealed, working, expiringSoon, expired }` — helper ใช้ค่านี้

---

### Task 1: Pure helper จัดระดับสถานะ stock + test

**Files:**
- Create: `src/lib/stockReceive.ts`
- Test: `src/lib/stockReceive.test.ts`

- [ ] **Step 1: เขียน test ที่จะ fail**

สร้าง `src/lib/stockReceive.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  levelFromQty,
  levelFromUnits,
  LOW_STD_QTY,
  LOW_SOL_QTY,
  LOW_GLASS_QTY,
} from "./stockReceive";

describe("levelFromQty", () => {
  it("คืน out เมื่อ qty <= 0", () => {
    expect(levelFromQty(0, LOW_SOL_QTY)).toBe("out");
    expect(levelFromQty(-1, LOW_SOL_QTY)).toBe("out");
  });
  it("คืน low เมื่อ 0 < qty < threshold", () => {
    expect(levelFromQty(1, LOW_SOL_QTY)).toBe("low"); // threshold 3
    expect(levelFromQty(2, LOW_SOL_QTY)).toBe("low");
  });
  it("คืน ok เมื่อ qty >= threshold", () => {
    expect(levelFromQty(3, LOW_SOL_QTY)).toBe("ok");
    expect(levelFromQty(10, LOW_GLASS_QTY)).toBe("ok");
  });
});

describe("levelFromUnits", () => {
  it("คืน out เมื่อ sealed+working === 0", () => {
    expect(levelFromUnits({ sealed: 0, working: 0, expiringSoon: 0, expired: 2 }, LOW_STD_QTY)).toBe("out");
  });
  it("คืน low เมื่อ active <= threshold", () => {
    expect(levelFromUnits({ sealed: 1, working: 0, expiringSoon: 0, expired: 0 }, LOW_STD_QTY)).toBe("low");
  });
  it("คืน ok เมื่อ active > threshold", () => {
    expect(levelFromUnits({ sealed: 2, working: 1, expiringSoon: 0, expired: 0 }, LOW_STD_QTY)).toBe("ok");
  });
});

describe("constants", () => {
  it("คงค่าเดิมตาม Stock.tsx", () => {
    expect(LOW_STD_QTY).toBe(1);
    expect(LOW_SOL_QTY).toBe(3);
    expect(LOW_GLASS_QTY).toBe(5);
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npm run test -- src/lib/stockReceive.test.ts`
Expected: FAIL — `Failed to resolve import "./stockReceive"` (ไฟล์ยังไม่มี)

- [ ] **Step 3: เขียน implementation ขั้นต่ำ**

สร้าง `src/lib/stockReceive.ts`:

```ts
import type { UnitsSummary } from "./stockUnit";

/** เกณฑ์ low-stock ต่อหมวด (ค่าเดิมจาก Stock.tsx) */
export const LOW_STD_QTY = 1;
export const LOW_SOL_QTY = 3;
export const LOW_GLASS_QTY = 5;

export type StockLevel = "ok" | "low" | "out";

/** ระดับสถานะจากจำนวนคงเหลือตรง ๆ (สารเคมี/เครื่องแก้ว) */
export function levelFromQty(qty: number, lowThreshold: number): StockLevel {
  if (qty <= 0) return "out";
  if (qty < lowThreshold) return "low";
  return "ok";
}

/** ระดับสถานะจากสรุปรายขวด (Standards) — นับ sealed+working ที่ใช้งานได้ */
export function levelFromUnits(sum: UnitsSummary, lowThreshold: number): StockLevel {
  const active = sum.sealed + sum.working;
  if (active === 0) return "out";
  if (active <= lowThreshold) return "low";
  return "ok";
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npm run test -- src/lib/stockReceive.test.ts`
Expected: PASS ทุกเคส

- [ ] **Step 5: Commit**

```bash
git add src/lib/stockReceive.ts src/lib/stockReceive.test.ts
git commit -m "feat(stock): add stockReceive level helpers + tests"
```

---

### Task 2: เพิ่ม ReceiveTab + tab ในหน้า Stock

**Files:**
- Modify: `src/pages/Stock.tsx`

- [ ] **Step 1: ย้าย threshold มา import จาก helper**

ใน `src/pages/Stock.tsx` ลบบล็อกประกาศค่าคงที่เดิม (3 บรรทัด):

```ts
const LOW_STD_QTY = 1;
const LOW_SOL_QTY = 3;
const LOW_GLASS_QTY = 5;
```

แล้วเพิ่ม import (วางใกล้ import lib อื่น เช่นหลังบรรทัด `import { summarizeUnits } from "@/lib/stockUnit";`):

```ts
import { LOW_STD_QTY, LOW_SOL_QTY, LOW_GLASS_QTY, levelFromQty, levelFromUnits } from "@/lib/stockReceive";
import type { StockLevel } from "@/lib/stockReceive";
```

หมายเหตุ: ค่าคงที่ชื่อเดิมทุกตัว — โค้ดในแท็บ Standards/Solvents/Glassware ที่อ้าง `LOW_*` ยังทำงานเหมือนเดิม

- [ ] **Step 2: เพิ่ม component `ReceiveTab` + `LevelBadge`**

แทรกบล็อกนี้ก่อน comment `// ====... History Tab` (คือก่อน `function HistoryTab()`):

```tsx
// ============================================================
// Receive Tab (รับเข้ารวมศูนย์)
// ============================================================
type ReceiveCategory = "standard" | "solvent" | "glassware";

const RECEIVE_CATEGORIES: { value: ReceiveCategory; label: string }[] = [
  { value: "standard", label: "Standards" },
  { value: "solvent", label: "สารเคมี" },
  { value: "glassware", label: "เครื่องแก้ว" },
];

function LevelBadge({ level }: { level: StockLevel }) {
  if (level === "out") return <Badge className="bg-destructive/15 text-destructive text-xs">หมด</Badge>;
  if (level === "low") return <Badge className="bg-amber-100 text-amber-700 text-xs">ใกล้หมด</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-700 text-xs">ปกติ</Badge>;
}

interface ReceiveRow {
  id: string;
  code: string;
  name: string;
  level: StockLevel;
  extraBadges: { label: string; tone: "destructive" | "amber" }[];
  needsRestock: boolean;
  onReceive: () => void;
}

function ReceiveTab() {
  const qc = useQueryClient();
  const [category, setCategory] = useState<ReceiveCategory>("standard");
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const { data: standards = [] } = useQuery({ queryKey: ["stock", "standards"], queryFn: api.getStandards });
  const { data: solvents = [] } = useQuery({ queryKey: ["stock", "solvents"], queryFn: api.getSolvents });
  const { data: glassware = [] } = useQuery({ queryKey: ["stock", "glassware"], queryFn: api.getGlassware });
  const { data: allUnits = [] } = useQuery({ queryKey: ["stock", "units"], queryFn: () => api.getStockUnits() });

  const unitsByCode = useMemo(() => {
    const m = new Map<string, StockUnitItem[]>();
    for (const u of allUnits) {
      const arr = m.get(u.itemCode) ?? [];
      arr.push(u);
      m.set(u.itemCode, arr);
    }
    return m;
  }, [allUnits]);

  const [receivingStandard, setReceivingStandard] = useState<StockStandardItem | null>(null);
  const [movingSolvent, setMovingSolvent] = useState<StockSolventItem | null>(null);
  const [movingGlass, setMovingGlass] = useState<StockGlasswareItem | null>(null);

  const rows: ReceiveRow[] = useMemo(() => {
    if (category === "standard") {
      return standards.map((s) => {
        const sum = summarizeUnits(unitsByCode.get(s.code) ?? []);
        const level = levelFromUnits(sum, LOW_STD_QTY);
        const extraBadges: ReceiveRow["extraBadges"] = [];
        if (sum.expired > 0) extraBadges.push({ label: `หมดอายุ ${sum.expired}`, tone: "destructive" });
        if (sum.expiringSoon > 0) extraBadges.push({ label: `ใกล้หมดอายุ ${sum.expiringSoon}`, tone: "amber" });
        return {
          id: s._id,
          code: s.code,
          name: s.name,
          level,
          extraBadges,
          needsRestock: level !== "ok" || sum.expired > 0 || sum.expiringSoon > 0,
          onReceive: () => setReceivingStandard(s),
        };
      });
    }
    if (category === "solvent") {
      return solvents.map((s) => {
        const level = levelFromQty(s.qty, LOW_SOL_QTY);
        return { id: s._id, code: "", name: s.name, level, extraBadges: [], needsRestock: level !== "ok", onReceive: () => setMovingSolvent(s) };
      });
    }
    return glassware.map((g) => {
      const level = levelFromQty(g.qty, LOW_GLASS_QTY);
      return { id: g._id, code: "", name: g.name, level, extraBadges: [], needsRestock: level !== "ok", onReceive: () => setMovingGlass(g) };
    });
  }, [category, standards, solvents, glassware, unitsByCode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.code.toLowerCase().includes(q)) return false;
      if (lowOnly && !r.needsRestock) return false;
      return true;
    });
  }, [rows, search, lowOnly]);

  const restockCount = rows.filter((r) => r.needsRestock).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:space-y-0 space-y-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5" /> รับเข้า stock
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา code หรือชื่อ" className="pl-8 h-9 w-full sm:w-64" />
            </div>
            <Button size="sm" variant={lowOnly ? "default" : "outline"} onClick={() => setLowOnly((v) => !v)}>
              <AlertTriangle className="w-4 h-4 mr-1" /> เฉพาะใกล้หมด/หมด ({restockCount})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {RECEIVE_CATEGORIES.map((c) => (
              <Button key={c.value} size="sm" variant={category === c.value ? "default" : "outline"} onClick={() => setCategory(c.value)}>
                {c.label}
              </Button>
            ))}
          </div>
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  {category === "standard" && <TableHead className="w-16">Code</TableHead>}
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="w-28 text-right">รับเข้า</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={category === "standard" ? 4 : 3} className="text-center text-muted-foreground py-6">ไม่มีข้อมูล</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      {category === "standard" && <TableCell className="font-semibold text-primary">{r.code}</TableCell>}
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <LevelBadge level={r.level} />
                          {r.extraBadges.map((b, i) => (
                            <Badge key={i} className={`text-xs ${b.tone === "destructive" ? "bg-destructive/15 text-destructive" : "bg-amber-100 text-amber-700"}`}>{b.label}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={r.onReceive}>
                          <ArrowDownToLine className="w-4 h-4 mr-1" /> รับเข้า
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {receivingStandard && (
        <ReceiveBottlesDialog
          standard={receivingStandard}
          onClose={() => setReceivingStandard(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["stock", "units"] }); }}
        />
      )}
      {movingSolvent && (
        <SimpleMoveDialog
          title="รับเข้าสารเคมี"
          mode="receive"
          itemName={movingSolvent.name}
          currentQty={movingSolvent.qty}
          unit="ขวด"
          onClose={() => setMovingSolvent(null)}
          onSubmit={async (qty, note) => {
            await api.receiveSolvent(movingSolvent._id, { qty, note });
            qc.invalidateQueries({ queryKey: ["stock", "solvents"] });
            qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
          }}
        />
      )}
      {movingGlass && (
        <SimpleMoveDialog
          title="รับเข้าเครื่องแก้ว"
          mode="receive"
          itemName={movingGlass.name}
          currentQty={movingGlass.qty}
          unit="ชิ้น"
          onClose={() => setMovingGlass(null)}
          onSubmit={async (qty, note) => {
            await api.receiveGlassware(movingGlass._id, { qty, note });
            qc.invalidateQueries({ queryKey: ["stock", "glassware"] });
            qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: เพิ่ม tab trigger + content**

ในฟังก์ชัน `StockPage` แก้ `<TabsList>` และเพิ่ม `<TabsContent>` — วาง "รับเข้า" ก่อน "ประวัติ":

```tsx
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="standard">Standards</TabsTrigger>
          <TabsTrigger value="solvent">สารเคมี</TabsTrigger>
          <TabsTrigger value="glassware">เครื่องแก้ว</TabsTrigger>
          <TabsTrigger value="receive">รับเข้า</TabsTrigger>
          <TabsTrigger value="history">ประวัติ</TabsTrigger>
        </TabsList>
        <TabsContent value="standard"><StandardsTab /></TabsContent>
        <TabsContent value="solvent"><SolventsTab /></TabsContent>
        <TabsContent value="glassware"><GlasswareTab /></TabsContent>
        <TabsContent value="receive"><ReceiveTab /></TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
```

- [ ] **Step 4: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จาก `Stock.tsx` / `stockReceive.ts` (repo มี latent error ~12 ตัวเดิม — ต้องไม่เพิ่มจากไฟล์ที่แก้)

- [ ] **Step 5: lint**

Run: `npm run lint`
Expected: ไม่มี error ใหม่จากไฟล์ที่แก้

- [ ] **Step 6: Commit**

```bash
git add src/pages/Stock.tsx
git commit -m "feat(stock): add centralized receive tab"
```

---

### Task 3: ตรวจ manual บน localhost

**Files:** (ไม่แก้โค้ด — verification เท่านั้น)

- [ ] **Step 1: รัน dev (ถ้ายังไม่รัน)**

Frontend: `npm run dev` (port 8000) + Backend: `cd server && npm run dev` (port 3001)

- [ ] **Step 2: ตรวจพฤติกรรมตาม checklist**

เปิด Stock Management → แถบ "รับเข้า":
- แถบ "รับเข้า" โผล่ระหว่าง "เครื่องแก้ว" กับ "ประวัติ"
- เปิดมา default หมวด **Standards**, มีคอลัมน์ Code
- สลับหมวด สารเคมี/เครื่องแก้ว → ลิสต์เปลี่ยน, คอลัมน์ Code หาย
- ช่องค้นหากรองตามชื่อ/code ได้
- ปุ่ม "เฉพาะใกล้หมด/หมด" toggle แล้วเหลือเฉพาะรายการที่ต้องเติม + ตัวเลขนับตรง
- badge สถานะ: ปกติ/ใกล้หมด/หมด ถูกต้อง; Standards มี หมดอายุ/ใกล้หมดอายุ เพิ่มเมื่อมี
- กด "รับเข้า" หมวด Standards → `ReceiveBottlesDialog` เปิด, รับเข้าได้, badge/ลิสต์อัปเดตหลังปิด
- กด "รับเข้า" หมวดสารเคมี/เครื่องแก้ว → `SimpleMoveDialog` (รับเข้า) เปิด, qty เพิ่มหลังยืนยัน
- เปิดแถบ "ประวัติ" → เห็น transaction `receive` ของรายการที่เพิ่งรับเข้า

- [ ] **Step 3: รัน test ทั้งชุดกันถดถอย**

Run: `npm run test`
Expected: ผ่านทั้งหมด (รวม `stockReceive.test.ts` ใหม่)

---

## Self-Review Notes

- **Spec coverage:** แถบที่ 5 ก่อนประวัติ (Task 2 Step 3) ✓ · default Standards (Task 2 ReceiveTab) ✓ · selector หมวด+ค้นหา+กรองใกล้หมด (Task 2) ✓ · badge เต็มชุดรวม expired/soon (Task 2 rows) ✓ · reuse ReceiveBottlesDialog/SimpleMoveDialog/API + invalidate ตามเดิม (Task 2 dialogs) ✓ · ไม่แตะ backend ✓ · เกณฑ์ LOW_* คงค่าเดิม (Task 1) ✓
- **Type consistency:** `StockLevel`, `levelFromQty`, `levelFromUnits`, `UnitsSummary` ชื่อตรงกันทุก task · props ของ `ReceiveBottlesDialog` (`standard/onClose/onSaved`) และ `SimpleMoveDialog` (`title/mode/itemName/currentQty/unit/onClose/onSubmit`) ตรงกับนิยามใน `Stock.tsx`/`ReceiveBottlesDialog.tsx` เดิม
- **Placeholder scan:** ไม่มี TBD/TODO — โค้ดครบทุก step
