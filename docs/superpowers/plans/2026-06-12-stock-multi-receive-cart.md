# Stock Multi-Receive Cart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แทนตารางในแท็บ "รับเข้า" (หน้า Stock) ด้วยฟอร์มตะกร้าที่รับเข้าได้หลายรายการรวดเดียว ครอบทั้ง Standards / สารเคมี / เครื่องแก้ว

**Architecture:** แนวทาง A — loop ฝั่ง client เรียก API per-item ที่มีอยู่ (`receiveStockUnits`, `receiveSolvent`, `receiveGlassware`) ไม่แตะ backend. Logic บริสุทธิ์ (validate / สร้าง bottles / compose note) แยกเป็น helper module ที่ test ได้. ลาเบลสารเคมีเป็นฟังก์ชันใหม่ใน `stockLabel.ts`. ตัว component เป็น state-only form ที่บาง.

**Tech Stack:** React 18 + TS + TanStack Query + shadcn/ui (Popover + Command combobox) + Vitest + `qrcode`

อ้างอิงสเปก: `docs/superpowers/specs/2026-06-12-stock-multi-receive-cart-design.md`

---

## File Structure

- **Create** `src/lib/stockLabel.ts` → เพิ่ม export `buildSolventLabelHtml` (แก้ไฟล์เดิม)
- **Create** `src/lib/stockLabel.test.ts` → test ลาเบลสารเคมี (ไฟล์ใหม่)
- **Create** `src/components/lis/stock/receiveCart.helpers.ts` → types + pure helpers
- **Create** `src/components/lis/stock/receiveCart.helpers.test.ts` → test helpers
- **Create** `src/components/lis/stock/ReceiveCart.tsx` → ฟอร์มตะกร้า
- **Modify** `src/pages/Stock.tsx` → แท็บ receive ใช้ `<ReceiveCart/>`, ลบ `ReceiveTab` + helper ที่ใช้เฉพาะมัน + import ที่ตายแล้ว

หมายเหตุ: type-check จริงต้องใช้ `npx tsc -p tsconfig.app.json --noEmit` (root `npx tsc --noEmit` เป็น no-op — ดู memory `project_real_typecheck_command`).

---

## Task 1: ลาเบลสารเคมี `buildSolventLabelHtml`

**Files:**
- Create: `src/lib/stockLabel.test.ts`
- Modify: `src/lib/stockLabel.ts`

- [ ] **Step 1: เขียน failing test**

สร้าง `src/lib/stockLabel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSolventLabelHtml } from "./stockLabel";

describe("buildSolventLabelHtml", () => {
  it("ใส่ชื่อ/lot/ขนาด และฝัง QR เป็น data URL", async () => {
    const html = await buildSolventLabelHtml({
      name: "Methanol",
      idForQr: "sol_123",
      lotNo: "L1",
      exp: "2027-01-01",
      sizeLabel: "2.5 L",
    });
    expect(html).toContain("Methanol");
    expect(html).toContain("L1");
    expect(html).toContain("2.5 L");
    expect(html).toContain("data:image/png;base64");
  });

  it("escape HTML ในชื่อ", async () => {
    const html = await buildSolventLabelHtml({ name: "<script>x", idForQr: "x" });
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>x");
  });

  it("ไม่มี exp → แสดง '-'", async () => {
    const html = await buildSolventLabelHtml({ name: "Acetone", idForQr: "a" });
    expect(html).toContain("EXP");
    expect(html).toContain("-");
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npm run test -- src/lib/stockLabel.test.ts`
Expected: FAIL — `buildSolventLabelHtml is not a function` / ไม่มี export

- [ ] **Step 3: เพิ่ม implementation**

แก้ `src/lib/stockLabel.ts` — เพิ่มฟังก์ชันใหม่ต่อท้าย `buildStockLabelHtml` (ก่อน `escapeHtml`). ใช้ `color:#000` บังคับดำล้วน (gotcha thermal — ดู memory `project_thermal_label_pure_black`):

```ts
/** สติกเกอร์สารเคมี — solvent ไม่ได้ track รายขวด จึงไม่มี StockUnit/qrId จริง
 *  QR encode idForQr (= _id ของสารเคมี) เป็นตัวบอกว่าเป็นสารตัวไหน
 *  scanner ในแอปยัง resolve ไม่ได้ (ไม่มี StockUnit) — เป็นสติกเกอร์ระบุตัวเท่านั้น */
export async function buildSolventLabelHtml(payload: {
  name: string;
  idForQr: string;
  lotNo?: string;
  exp?: string | null;
  sizeLabel?: string;
}): Promise<string> {
  const qr = await QRCode.toDataURL(payload.idForQr, {
    margin: 3,
    width: 512,
    errorCorrectionLevel: "M",
  });
  const exp = payload.exp ? new Date(payload.exp).toLocaleDateString("th-TH") : "-";
  const size = payload.sizeLabel || "-";
  return `
<div style="display:flex;gap:8px;align-items:center;font-family:'Kanit',sans-serif;width:152mm;height:101mm;box-sizing:border-box;padding:6mm;color:#000;">
  <img src="${qr}" alt="qr" style="width:56mm;height:56mm;flex:none;" />
  <div style="font-size:12pt;line-height:1.4;min-width:0;color:#000;">
    <div style="font-weight:700;font-size:15pt;">${escapeHtml(payload.name || "")}</div>
    <div>สารเคมี · ขนาด: ${escapeHtml(size)}</div>
    <div>Lot: ${escapeHtml(payload.lotNo || "-")}</div>
    <div>EXP: <b>${escapeHtml(exp)}</b></div>
  </div>
</div>`.trim();
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npm run test -- src/lib/stockLabel.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/stockLabel.ts src/lib/stockLabel.test.ts
git commit -m "feat(stock): buildSolventLabelHtml for solvent receive stickers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/lib/stockLabel.ts src/lib/stockLabel.test.ts
```

---

## Task 2: Pure helpers ของตะกร้า

**Files:**
- Create: `src/components/lis/stock/receiveCart.helpers.ts`
- Create: `src/components/lis/stock/receiveCart.helpers.test.ts`

- [ ] **Step 1: เขียน failing test**

สร้าง `src/components/lis/stock/receiveCart.helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  makeEmptyRow,
  validateRow,
  buildBottles,
  composeSolventNote,
} from "./receiveCart.helpers";

describe("receiveCart.helpers", () => {
  it("makeEmptyRow คืนแถวว่าง category=null", () => {
    const r = makeEmptyRow();
    expect(r.category).toBeNull();
    expect(r.itemId).toBe("");
    expect(r.source).toBe("primary");
    expect(r.count).toBe("1");
    expect(r.qty).toBe("1");
    expect(r.sameExp).toBe(true);
  });

  it("validateRow: ยังไม่เลือกของ → error", () => {
    expect(validateRow(makeEmptyRow())).toBe("ยังไม่ได้เลือกของ");
  });

  it("validateRow: standard ต้องมี size>0, count เป็นจำนวนเต็มบวก, source", () => {
    const base = { ...makeEmptyRow(), category: "standard" as const, itemId: "s1" };
    expect(validateRow({ ...base, sizeMl: "0" })).toBe("ขนาด/ขวดไม่ถูกต้อง");
    expect(validateRow({ ...base, sizeMl: "100", count: "0" })).toBe("จำนวนขวดต้องเป็นจำนวนเต็มบวก");
    expect(validateRow({ ...base, sizeMl: "100", count: "2", source: "" as never })).toBe("ต้องเลือกที่มา");
    expect(validateRow({ ...base, sizeMl: "100", count: "2" })).toBeNull();
  });

  it("validateRow: solvent/glassware ต้อง qty เป็นจำนวนเต็มบวก", () => {
    const sol = { ...makeEmptyRow(), category: "solvent" as const, itemId: "x", qty: "0" };
    expect(validateRow(sol)).toBe("จำนวนต้องเป็นจำนวนเต็มบวก");
    expect(validateRow({ ...sol, qty: "3" })).toBeNull();
  });

  it("buildBottles: sameExp → ทุกขวด exp เดียวกัน", () => {
    const r = { ...makeEmptyRow(), count: "3", sameExp: true, commonExp: "2027-01-01" };
    expect(buildBottles(r)).toEqual([
      { exp: "2027-01-01" }, { exp: "2027-01-01" }, { exp: "2027-01-01" },
    ]);
  });

  it("buildBottles: sameExp + commonExp ว่าง → exp undefined", () => {
    const r = { ...makeEmptyRow(), count: "2", sameExp: true, commonExp: "" };
    expect(buildBottles(r)).toEqual([{ exp: undefined }, { exp: undefined }]);
  });

  it("buildBottles: per-bottle exp ตัดตามจำนวน", () => {
    const r = { ...makeEmptyRow(), count: "2", sameExp: false, perExp: ["2027-01-01", "2027-02-02", "x"] };
    expect(buildBottles(r)).toEqual([{ exp: "2027-01-01" }, { exp: "2027-02-02" }]);
  });

  it("composeSolventNote: รวม lot/exp/ขนาด/note ด้วย ·", () => {
    const r = { ...makeEmptyRow(), lotNo: "L1", exp: "2027-01-01", sizeLabel: "2.5 L", note: "ใหม่" };
    expect(composeSolventNote(r)).toBe("lot L1 · exp 2027-01-01 · ขนาด 2.5 L · ใหม่");
    expect(composeSolventNote({ ...makeEmptyRow() })).toBe("");
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npm run test -- src/components/lis/stock/receiveCart.helpers.test.ts`
Expected: FAIL — ไม่มี module / export

- [ ] **Step 3: เขียน implementation**

สร้าง `src/components/lis/stock/receiveCart.helpers.ts`:

```ts
export type CartCategory = "standard" | "solvent" | "glassware";

export interface CartRow {
  id: string;
  category: CartCategory | null;
  itemId: string;
  itemName: string;
  itemCode: string; // standard code; "" สำหรับ solvent/glassware
  // standard
  source: "primary" | "supply";
  sizeMl: string;
  count: string;
  sameExp: boolean;
  commonExp: string;
  perExp: string[];
  // solvent
  qty: string;
  sizeLabel: string;
  exp: string;
  // shared
  lotNo: string;
  note: string;
}

let rowSeq = 0;
export function makeEmptyRow(): CartRow {
  rowSeq += 1;
  return {
    id: `row_${rowSeq}`,
    category: null,
    itemId: "",
    itemName: "",
    itemCode: "",
    source: "primary",
    sizeMl: "100",
    count: "1",
    sameExp: true,
    commonExp: "",
    perExp: [""],
    qty: "1",
    sizeLabel: "",
    exp: "",
    lotNo: "",
    note: "",
  };
}

/** คืน error string ถ้าไม่ผ่าน, null ถ้าผ่าน */
export function validateRow(row: CartRow): string | null {
  if (!row.category || !row.itemId) return "ยังไม่ได้เลือกของ";
  if (row.category === "standard") {
    if (!(Number(row.sizeMl) > 0)) return "ขนาด/ขวดไม่ถูกต้อง";
    const c = Number(row.count);
    if (!Number.isInteger(c) || c < 1) return "จำนวนขวดต้องเป็นจำนวนเต็มบวก";
    if (row.source !== "primary" && row.source !== "supply") return "ต้องเลือกที่มา";
    return null;
  }
  const q = Number(row.qty);
  if (!Number.isInteger(q) || q < 1) return "จำนวนต้องเป็นจำนวนเต็มบวก";
  return null;
}

export function buildBottles(row: CartRow): { exp?: string }[] {
  const n = Math.max(1, Number(row.count) || 1);
  if (row.sameExp) {
    return Array.from({ length: n }, () => ({ exp: row.commonExp || undefined }));
  }
  return row.perExp.slice(0, n).map((e) => ({ exp: e || undefined }));
}

export function composeSolventNote(row: CartRow): string {
  const parts: string[] = [];
  if (row.lotNo) parts.push(`lot ${row.lotNo}`);
  if (row.exp) parts.push(`exp ${row.exp}`);
  if (row.sizeLabel) parts.push(`ขนาด ${row.sizeLabel}`);
  if (row.note) parts.push(row.note);
  return parts.join(" · ");
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npm run test -- src/components/lis/stock/receiveCart.helpers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/lis/stock/receiveCart.helpers.ts src/components/lis/stock/receiveCart.helpers.test.ts
git commit -m "feat(stock): pure helpers for receive cart (row/validate/bottles/note)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/components/lis/stock/receiveCart.helpers.ts src/components/lis/stock/receiveCart.helpers.test.ts
```

---

## Task 3: Component `ReceiveCart.tsx`

**Files:**
- Create: `src/components/lis/stock/ReceiveCart.tsx`

- [ ] **Step 1: เขียน component**

สร้าง `src/components/lis/stock/ReceiveCart.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ArrowDownToLine, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { buildStockLabelHtml, buildSolventLabelHtml } from "@/lib/stockLabel";
import {
  makeEmptyRow, validateRow, buildBottles, composeSolventNote,
} from "@/components/lis/stock/receiveCart.helpers";
import type { CartRow, CartCategory } from "@/components/lis/stock/receiveCart.helpers";
import type {
  StockStandardItem, StockSolventItem, StockGlasswareItem, StockUnitItem,
} from "@/types/stock";

interface PickOption {
  category: CartCategory;
  id: string;
  name: string;
  code: string;
  label: string; // ข้อความที่โชว์
}

const CATEGORY_LABEL: Record<CartCategory, string> = {
  standard: "Standard",
  solvent: "สารเคมี",
  glassware: "เครื่องแก้ว",
};

export default function ReceiveCart() {
  const qc = useQueryClient();
  const { data: standards = [] } = useQuery({ queryKey: ["stock", "standards"], queryFn: api.getStandards });
  const { data: solvents = [] } = useQuery({ queryKey: ["stock", "solvents"], queryFn: api.getSolvents });
  const { data: glassware = [] } = useQuery({ queryKey: ["stock", "glassware"], queryFn: api.getGlassware });

  const options = useMemo<PickOption[]>(() => {
    const std = (standards as StockStandardItem[]).map((s) => ({
      category: "standard" as const, id: s._id, name: s.name, code: s.code,
      label: `${s.code} ${s.name}`,
    }));
    const sol = (solvents as StockSolventItem[]).map((s) => ({
      category: "solvent" as const, id: s._id, name: s.name, code: "",
      label: s.name,
    }));
    const gla = (glassware as StockGlasswareItem[]).map((g) => ({
      category: "glassware" as const, id: g._id, name: g.name, code: "",
      label: g.name,
    }));
    return [...std, ...sol, ...gla];
  }, [standards, solvents, glassware]);

  const [rows, setRows] = useState<CartRow[]>(() => [makeEmptyRow()]);
  const [printAfter, setPrintAfter] = useState(true);
  const [busy, setBusy] = useState(false);

  const patchRow = (id: string, patch: Partial<CartRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, makeEmptyRow()]);
  const removeRow = (id: string) =>
    setRows((prev) => (prev.length <= 1 ? [makeEmptyRow()] : prev.filter((r) => r.id !== id)));

  const pickItem = (id: string, opt: PickOption) =>
    patchRow(id, {
      category: opt.category, itemId: opt.id, itemName: opt.name, itemCode: opt.code,
    });

  const ensurePerExp = (id: string, len: number) =>
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const next = [...r.perExp];
      while (next.length < len) next.push("");
      next.length = len;
      return { ...r, perExp: next };
    }));

  const submit = async () => {
    // validate ทั้งหมดก่อน
    for (let i = 0; i < rows.length; i++) {
      const err = validateRow(rows[i]);
      if (err) { toast.error(`แถวที่ ${i + 1}: ${err}`); return; }
    }
    setBusy(true);
    const labels: string[] = [];
    const okIds = new Set<string>();
    let okCount = 0;
    let failCount = 0;

    for (const row of rows) {
      try {
        if (row.category === "standard") {
          const created = await api.receiveStockUnits(row.itemId, {
            lotNo: row.lotNo, sizeMl: Number(row.sizeMl), unit: "ml",
            source: row.source, bottles: buildBottles(row),
          });
          if (printAfter) {
            for (const u of created as StockUnitItem[]) labels.push(await buildStockLabelHtml(u));
          }
        } else if (row.category === "solvent") {
          const n = Number(row.qty);
          await api.receiveSolvent(row.itemId, { qty: n, note: composeSolventNote(row) });
          if (printAfter) {
            const html = await buildSolventLabelHtml({
              name: row.itemName, idForQr: row.itemId, lotNo: row.lotNo,
              exp: row.exp || null, sizeLabel: row.sizeLabel,
            });
            for (let i = 0; i < n; i++) labels.push(html);
          }
        } else if (row.category === "glassware") {
          await api.receiveGlassware(row.itemId, { qty: Number(row.qty), note: row.note });
        }
        okIds.add(row.id);
        okCount += 1;
      } catch (err) {
        failCount += 1;
        toast.error(`${row.itemName || "รายการ"}: ${(err as Error).message}`);
      }
    }

    // ปริ้นท้ายสุด — print fail ไม่ถือว่า receive ล้ม
    for (const html of labels) {
      try {
        await api.printDocument({ docType: "stock-label", html });
      } catch (err) {
        toast.error(`ปริ้นลาเบลไม่สำเร็จ: ${(err as Error).message}`);
      }
    }

    if (okCount > 0) toast.success(`รับเข้าสำเร็จ ${okCount} รายการ${failCount ? ` · ล้มเหลว ${failCount}` : ""}`);
    // ลบแถวที่สำเร็จ เก็บแถว fail ไว้ retry
    setRows((prev) => {
      const left = prev.filter((r) => !okIds.has(r.id));
      return left.length ? left : [makeEmptyRow()];
    });
    qc.invalidateQueries({ queryKey: ["stock", "units"] });
    qc.invalidateQueries({ queryKey: ["stock", "solvents"] });
    qc.invalidateQueries({ queryKey: ["stock", "glassware"] });
    qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
    setBusy(false);
  };

  const validCount = rows.filter((r) => r.itemId && !validateRow(r)).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5" /> รับเข้า stock (หลายรายการ)
          </CardTitle>
          <Button size="sm" variant="outline" onClick={addRow}>
            <Plus className="w-4 h-4 mr-1" /> เพิ่มแถว
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row, idx) => (
            <div key={row.id} className="border rounded-md p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6">{idx + 1}.</span>
                <ItemPicker
                  options={options}
                  value={row.itemId}
                  onPick={(opt) => pickItem(row.id, opt)}
                />
                {row.category && <Badge variant="outline">{CATEGORY_LABEL[row.category]}</Badge>}
                <Button size="icon" variant="ghost" className="ml-auto" onClick={() => removeRow(row.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>

              {row.category === "standard" && (
                <div className="space-y-2 pl-8">
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant={row.source === "primary" ? "default" : "outline"}
                      onClick={() => patchRow(row.id, { source: "primary" })}>primary</Button>
                    <Button type="button" size="sm" variant={row.source === "supply" ? "default" : "outline"}
                      onClick={() => patchRow(row.id, { source: "supply" })}>supply</Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div><Label>Lot No</Label><Input value={row.lotNo} onChange={(e) => patchRow(row.id, { lotNo: e.target.value })} placeholder="optional" /></div>
                    <div><Label>ขนาด/ขวด (ml)</Label><Input type="number" value={row.sizeMl} onChange={(e) => patchRow(row.id, { sizeMl: e.target.value })} /></div>
                    <div><Label>จำนวนขวด</Label><Input type="number" min="1" value={row.count}
                      onChange={(e) => { patchRow(row.id, { count: e.target.value }); ensurePerExp(row.id, Math.max(1, Number(e.target.value) || 1)); }} /></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id={`sameExp-${row.id}`} checked={row.sameExp} onCheckedChange={(v) => patchRow(row.id, { sameExp: v === true })} />
                    <label htmlFor={`sameExp-${row.id}`} className="text-sm cursor-pointer">EXP เท่ากันทุกขวด</label>
                  </div>
                  {row.sameExp ? (
                    <div><Label>EXP (ทุกขวด)</Label><Input type="date" value={row.commonExp} onChange={(e) => patchRow(row.id, { commonExp: e.target.value })} /></div>
                  ) : (
                    <div className="space-y-2">
                      {Array.from({ length: Math.max(1, Number(row.count) || 1) }, (_, i) => (
                        <div key={i}>
                          <Label>EXP ขวดที่ {i + 1}</Label>
                          <Input type="date" value={row.perExp[i] ?? ""}
                            onChange={(e) => setRows((prev) => prev.map((r) => {
                              if (r.id !== row.id) return r;
                              const x = [...r.perExp]; x[i] = e.target.value; return { ...r, perExp: x };
                            }))} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {row.category === "solvent" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-8">
                  <div><Label>จำนวน (ขวด)</Label><Input type="number" min="1" value={row.qty} onChange={(e) => patchRow(row.id, { qty: e.target.value })} /></div>
                  <div><Label>ขนาด/ขวด</Label><Input value={row.sizeLabel} onChange={(e) => patchRow(row.id, { sizeLabel: e.target.value })} placeholder="เช่น 2.5 L" /></div>
                  <div><Label>Lot No</Label><Input value={row.lotNo} onChange={(e) => patchRow(row.id, { lotNo: e.target.value })} placeholder="optional" /></div>
                  <div><Label>EXP</Label><Input type="date" value={row.exp} onChange={(e) => patchRow(row.id, { exp: e.target.value })} /></div>
                  <div className="col-span-2 sm:col-span-3"><Label>หมายเหตุ</Label><Input value={row.note} onChange={(e) => patchRow(row.id, { note: e.target.value })} placeholder="optional" /></div>
                </div>
              )}

              {row.category === "glassware" && (
                <div className="grid grid-cols-2 gap-2 pl-8">
                  <div><Label>จำนวน (ชิ้น)</Label><Input type="number" min="1" value={row.qty} onChange={(e) => patchRow(row.id, { qty: e.target.value })} /></div>
                  <div><Label>หมายเหตุ</Label><Input value={row.note} onChange={(e) => patchRow(row.id, { note: e.target.value })} placeholder="optional" /></div>
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Checkbox id="printAfterCart" checked={printAfter} onCheckedChange={(v) => setPrintAfter(v === true)} />
              <label htmlFor="printAfterCart" className="text-sm cursor-pointer">ปริ้นลาเบลหลังรับเข้า (standard + สารเคมี)</label>
            </div>
            <Button onClick={submit} disabled={busy || validCount === 0}>
              <ArrowDownToLine className="w-4 h-4 mr-1" />
              {busy ? "กำลังบันทึก..." : `รับเข้าทั้งหมด (${validCount} รายการ)`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ItemPicker({
  options, value, onPick,
}: {
  options: PickOption[];
  value: string;
  onPick: (opt: PickOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  const groups: { cat: CartCategory; items: PickOption[] }[] = [
    { cat: "standard", items: options.filter((o) => o.category === "standard") },
    { cat: "solvent", items: options.filter((o) => o.category === "solvent") },
    { cat: "glassware", items: options.filter((o) => o.category === "glassware") },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-64 justify-between font-normal">
          <span className="truncate">{selected ? selected.label : "เลือกของ..."}</span>
          <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="ค้นหา code หรือชื่อ" />
          <CommandList>
            <CommandEmpty>ไม่พบรายการ</CommandEmpty>
            {groups.map((g) => g.items.length > 0 && (
              <CommandGroup key={g.cat} heading={CATEGORY_LABEL[g.cat]}>
                {g.items.map((o) => (
                  <CommandItem
                    key={`${o.category}-${o.id}`}
                    value={o.label}
                    onSelect={() => { onPick(o); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จากไฟล์นี้ (repo มี ~12 latent error เดิม — ดู memory; อย่าให้มีเพิ่มจาก `ReceiveCart.tsx`/helpers/stockLabel)

- [ ] **Step 3: lint ไฟล์ใหม่**

Run: `npm run lint`
Expected: ไม่มี error ใหม่ (เช่น unused import) จากไฟล์ที่เพิ่ม

- [ ] **Step 4: Commit**

```bash
git add src/components/lis/stock/ReceiveCart.tsx
git commit -m "feat(stock): ReceiveCart multi-item receive form

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/components/lis/stock/ReceiveCart.tsx
```

---

## Task 4: เสียบเข้า Stock.tsx + ลบ ReceiveTab เดิม

**Files:**
- Modify: `src/pages/Stock.tsx`

- [ ] **Step 1: เพิ่ม import ReceiveCart**

ใน `src/pages/Stock.tsx` หลังบรรทัด import `ReceiveBottlesDialog` (บรรทัด 32) เพิ่ม:

```tsx
import ReceiveCart from "@/components/lis/stock/ReceiveCart";
```

- [ ] **Step 2: เปลี่ยน tab content**

แก้บรรทัด 1227 จาก:

```tsx
        <TabsContent value="receive"><ReceiveTab /></TabsContent>
```

เป็น:

```tsx
        <TabsContent value="receive"><ReceiveCart /></TabsContent>
```

- [ ] **Step 3: ลบ ReceiveTab + helper ที่ใช้เฉพาะมัน**

ลบบล็อกทั้งหมดตั้งแต่ comment `// Receive Tab (รับเข้ารวมศูนย์)` (รวม `type ReceiveCategory`, `const RECEIVE_CATEGORIES`, `function LevelBadge`, `interface ReceiveRow`, `function ReceiveTab`) — เดิมคือช่วงบรรทัดประมาณ 577–777 จนสุดฟังก์ชัน `ReceiveTab` (ก่อน comment `// History Tab`). คงเหลือให้ comment `// History Tab` ต่อกับ section ก่อนหน้าได้สะอาด

หมายเหตุ: `SimpleMoveDialog` **ห้ามลบ** — ยังถูกใช้ใน `SolventsTab`/`GlasswareTab`

- [ ] **Step 4: ลบ import ที่ตายแล้ว**

ลบบรรทัด 28–29:

```tsx
import { qtyStatus } from "@/lib/stockStatus";
import type { QtyStatus } from "@/lib/stockStatus";
```

(ใช้เฉพาะใน ReceiveTab — grep ยืนยันแล้ว)

- [ ] **Step 5: type-check + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ (โดยเฉพาะ "qtyStatus is not defined" / unused — ต้องไม่มี)

Run: `npm run lint`
Expected: ไม่มี error ใหม่ใน `Stock.tsx` (no-unused-vars สำหรับ qtyStatus/QtyStatus ต้องหาย)

- [ ] **Step 6: รัน test ทั้งชุดกันพัง regression**

Run: `npm run test`
Expected: PASS ทั้งหมด

- [ ] **Step 7: Commit**

```bash
git add src/pages/Stock.tsx
git commit -m "feat(stock): wire ReceiveCart into receive tab, drop old ReceiveTab

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/pages/Stock.tsx
```

---

## Task 5: Manual E2E + verification

**Files:** (ไม่มี — ทดสอบจริง)

- [ ] **Step 1: รันแอป**

Run (สอง process): `npm run dev` (root) และ `cd server && npm run dev`
ต้องมี backend ขึ้นที่ 3001 ไม่งั้น `/LIS/api/...` 404

- [ ] **Step 2: ทดสอบ flow รวม**

ไปแท็บ Stock → "รับเข้า" แล้วตรวจ checklist (อ้างอิงสเปก §Testing):
  1. เพิ่ม 3 แถว: standard + solvent + glassware เลือกของจาก combobox (ค้นหาได้) กรอกครบ
  2. กด "รับเข้าทั้งหมด (3 รายการ)" → toast สำเร็จ
  3. ตรวจแท็บ Standards: รายขวด standard เพิ่มถูกจำนวน + EXP ตรง
  4. ตรวจแท็บ สารเคมี: qty เพิ่มตามจำนวน
  5. ตรวจแท็บ เครื่องแก้ว: qty เพิ่มตามจำนวน
  6. ตรวจปริ้น: standard N ใบ, solvent N ใบ (มี QR), glass ไม่ปริ้น (ถ้า env ปริ้นไม่พร้อม ให้ดู network call `/print` ว่ายิงครบจำนวน)
  7. ตรวจแท็บ ประวัติ: transaction ครบ + note ของ solvent มี lot/exp

- [ ] **Step 3: ทดสอบ partial fail**

  1. เพิ่ม 2 แถว standard — แถวหนึ่งกรอก count = 0 (หรือทำให้ fail)
  2. validate ควรเตือนก่อน submit (toast "แถวที่ N: ...") และไม่ยิง API เลย
  3. ปรับให้ผ่าน validate แต่จงใจให้ backend ปฏิเสธ (เช่น size ผิด) เพื่อดูว่า: แถวสำเร็จหาย แถว fail ค้างในตะกร้า + toast รายงานถูก

- [ ] **Step 4: สรุปผลให้ผู้ใช้**

รายงานผล manual ตามจริง (อะไรผ่าน/ไม่ผ่าน) — ถ้าผ่านหมดค่อยบอกว่าเสร็จ

---

## Self-Review Notes

- **Spec coverage:** cart UI (T3) · 3 หมวด + ฟิลด์ (T3 helpers T2) · standard รายขวด+ลาเบลเดิม (T3) · solvent qty+สติกเกอร์ใหม่ (T1+T3) · glass qty (T3) · submit loop ไม่ atomic + เก็บแถว fail (T3) · ปริ้นท้าย+print-fail ไม่ล้ม receive (T3) · ลบ ReceiveTab/แบนเนอร์ (T4) · solvent QR = _id (T1+T3) · note ยัด lot/exp (T2 composeSolventNote) → ครบทุกข้อ
- **Placeholder scan:** ไม่มี TBD/TODO — โค้ดเต็มทุก step
- **Type consistency:** `CartRow`/`CartCategory`/`PickOption` ใช้ชื่อตรงกันทุก task; `buildSolventLabelHtml` payload `{name,idForQr,lotNo,exp,sizeLabel}` ตรงกันใน T1/T3; api signatures ตรงกับ `src/lib/api.ts` (`receiveStockUnits(id,{lotNo,sizeMl,unit,source,bottles})`, `receiveSolvent(id,{qty,note})`, `receiveGlassware(id,{qty,note})`, `printDocument({docType,html})`)
- **ความเสี่ยงที่ต้องระวังตอนทำ:** การลบบล็อก ReceiveTab ใน Stock.tsx ใช้บรรทัดโดยประมาณ — ให้ยึด anchor comment (`// Receive Tab` ถึงก่อน `// History Tab`) แทนเลขบรรทัดตรงๆ เพราะไฟล์อาจขยับ
