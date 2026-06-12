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
    try {
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
    } finally {
      setBusy(false);
    }
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
