# แถบ "รับเข้า" รวมศูนย์ใน Stock Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มแถบ "รับเข้า" รวมศูนย์ในหน้า Stock Management — เลือกหมวด → เลือกรายการ (มี badge สถานะ + กรองใกล้หมด) → เปิด dialog รับเข้าเดิม

**Architecture:** แถบใหม่เป็น selector ห่อ dialog เดิม (`ReceiveBottlesDialog` / `SimpleMoveDialog`) ไม่แตะ backend/API/logic รับเข้า. การจัดระดับสถานะ stock ใช้ helper canonical เดิม `qtyStatus` จาก `src/lib/stockStatus.ts` (มี unit test อยู่แล้ว) + `summarizeUnits` จาก `src/lib/stockUnit.ts` — ไม่สร้าง helper ซ้ำ

**Tech Stack:** React 18 + TypeScript, TanStack React Query, shadcn/ui, Vitest, Tailwind (`lis.*`)

---

## File Structure

- **Modify** `src/pages/Stock.tsx` — เพิ่ม component `ReceiveTab` + tab trigger/content; reuse `qtyStatus`/`QtyStatus`, `summarizeUnits`, ค่าคงที่ `LOW_STD_QTY/LOW_SOL_QTY/LOW_GLASS_QTY` ที่ประกาศอยู่แล้วในไฟล์

helper ที่ reuse:
- `qtyStatus(total, lowThreshold): "out" | "low" | "ok"` (`src/lib/stockStatus.ts`) — `total<=0`→out, `total<=threshold`→low, else ok. ตรงกับ convention ของ Standards เดิม (`<= LOW_STD_QTY`)
- `summarizeUnits(units, now?)` (`src/lib/stockUnit.ts`) คืน `{ sealed, working, expiringSoon, expired }`

> **หมายเหตุประวัติ:** เดิมแพลนมี Task 1 สร้าง `src/lib/stockReceive.ts` แต่ code review พบว่าซ้ำกับ `qtyStatus` ที่มีอยู่แล้ว จึง revert ทิ้ง (commit `0d3977c`) และใช้ `qtyStatus` แทน เหลือ implementation task เดียว

---

### Task 1: เพิ่ม ReceiveTab + tab ในหน้า Stock

**Files:**
- Modify: `src/pages/Stock.tsx`

- [ ] **Step 1: เพิ่ม import helper**

ใน `src/pages/Stock.tsx` เพิ่ม import (วางใกล้ `import { summarizeUnits } from "@/lib/stockUnit";`):

```ts
import { qtyStatus } from "@/lib/stockStatus";
import type { QtyStatus } from "@/lib/stockStatus";
```

ค่าคงที่ `LOW_STD_QTY/LOW_SOL_QTY/LOW_GLASS_QTY` ประกาศอยู่ต้นไฟล์แล้ว — ใช้ได้เลย ไม่ต้องย้าย

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

function LevelBadge({ level }: { level: QtyStatus }) {
  if (level === "out") return <Badge className="bg-destructive/15 text-destructive text-xs">หมด</Badge>;
  if (level === "low") return <Badge className="bg-amber-100 text-amber-700 text-xs">ใกล้หมด</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-700 text-xs">ปกติ</Badge>;
}

interface ReceiveRow {
  id: string;
  code: string;
  name: string;
  level: QtyStatus;
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
        const level = qtyStatus(sum.sealed + sum.working, LOW_STD_QTY);
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
        const level = qtyStatus(s.qty, LOW_SOL_QTY);
        return { id: s._id, code: "", name: s.name, level, extraBadges: [], needsRestock: level !== "ok", onReceive: () => setMovingSolvent(s) };
      });
    }
    return glassware.map((g) => {
      const level = qtyStatus(g.qty, LOW_GLASS_QTY);
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
Expected: ไม่มี error ใหม่จาก `Stock.tsx` (repo มี latent error ~12 ตัวเดิม — ต้องไม่เพิ่ม)

- [ ] **Step 5: lint**

Run: `npm run lint`
Expected: ไม่มี error ใหม่จากไฟล์ที่แก้

- [ ] **Step 6: Commit**

```bash
git add src/pages/Stock.tsx
git commit -m "feat(stock): add centralized receive tab" -- src/pages/Stock.tsx
```

---

### Task 2: ตรวจ manual บน localhost

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
Expected: ผ่านทั้งหมด

---

## Self-Review Notes

- **Spec coverage:** แถบที่ 5 ก่อนประวัติ (Task 1 Step 3) ✓ · default Standards (Task 1 ReceiveTab) ✓ · selector หมวด+ค้นหา+กรองใกล้หมด (Task 1) ✓ · badge เต็มชุดรวม expired/soon (Task 1 rows) ✓ · reuse ReceiveBottlesDialog/SimpleMoveDialog/API + invalidate ตามเดิม (Task 1 dialogs) ✓ · ไม่แตะ backend ✓ · จัดระดับใช้ qtyStatus canonical (ไม่สร้าง helper ซ้ำ) ✓
- **Type consistency:** `QtyStatus` ("out"|"low"|"ok") จาก stockStatus ใช้ตรงกันทั้ง `LevelBadge`/`ReceiveRow.level` · props ของ `ReceiveBottlesDialog` (`standard/onClose/onSaved`) และ `SimpleMoveDialog` (`title/mode/itemName/currentQty/unit/onClose/onSubmit`) ตรงกับนิยามใน `Stock.tsx`/`ReceiveBottlesDialog.tsx` เดิม
- **Placeholder scan:** ไม่มี TBD/TODO — โค้ดครบทุก step
