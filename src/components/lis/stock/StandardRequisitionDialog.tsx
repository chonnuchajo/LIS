import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { isUsableBottle } from "@/lib/stockStatus";
import { defaultWeightCount, sumWeights, validateWeights } from "@/lib/standardRequisition";
import { cn } from "@/lib/utils";
import type { StockUnitItem } from "@/types/stock";

type Instrument = { id: string; name: string; group?: string };
const TYPES = ["primary", "working", "supplier"] as const;
type BottleType = (typeof TYPES)[number];

interface Props {
  instruments: Instrument[];
  onClose: () => void;
  onSaved: () => void;
}

export default function StandardRequisitionDialog({ instruments, onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [instrumentId, setInstrumentId] = useState("");
  const [code, setCode] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const [bottleType, setBottleType] = useState<BottleType>("primary");
  const [qrId, setQrId] = useState("");
  const [weights, setWeights] = useState<string[]>([""]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: standards = [] } = useQuery({ queryKey: ["stock", "standards"], queryFn: api.getStandards });
  const { data: allUnits = [] } = useQuery({ queryKey: ["stock", "units"], queryFn: () => api.getStockUnits() });

  const instrument = instruments.find((i) => i.id === instrumentId);

  // สารที่มีขวดใช้ได้จริง ≥ 1 (ทุก type) — "เปลี่ยน code เป็น stock ที่มี"
  const usableByCode = useMemo(() => {
    const m = new Map<string, StockUnitItem[]>();
    for (const u of allUnits) {
      if (!isUsableBottle(u)) continue;
      const list = m.get(u.itemCode);
      if (list) list.push(u);
      else m.set(u.itemCode, [u]);
    }
    return m;
  }, [allUnits]);

  const inStock = useMemo(
    () => standards.filter((s) => (usableByCode.get(s.code)?.length ?? 0) > 0),
    [standards, usableByCode],
  );
  const standard = standards.find((s) => s.code === code) ?? null;

  const bottlesOfType = useMemo(
    () => (usableByCode.get(code) ?? []).filter((u) => (u.type || "primary") === bottleType)
      .sort((a, b) => (a.exp ? +new Date(a.exp) : Infinity) - (b.exp ? +new Date(b.exp) : Infinity)),
    [usableByCode, code, bottleType],
  );
  const typeCounts = useMemo(() => {
    const c: Record<BottleType, number> = { primary: 0, working: 0, supplier: 0 };
    for (const u of usableByCode.get(code) ?? []) c[((u.type || "primary") as BottleType)] += 1;
    return c;
  }, [usableByCode, code]);

  const bottle = bottlesOfType.find((b) => b.qrId === qrId) ?? bottlesOfType[0] ?? null;
  const remainingMg = bottle?.volume?.remaining ?? 0;
  const nums = weights.map((w) => Number(w));
  const total = sumWeights(nums);
  const weightError = bottle ? validateWeights(nums, remainingMg) : "";
  const canSave = !!(instrumentId && bottle && !weightError && user?.name);

  // เปลี่ยนเครื่อง → ตั้งจำนวนช่องน้ำหนักตาม default (gc=3/hplc=1)
  const pickInstrument = (id: string) => {
    setInstrumentId(id);
    const g = instruments.find((i) => i.id === id)?.group;
    setWeights(Array.from({ length: defaultWeightCount(g) }, () => ""));
  };
  const pickStandard = (c: string) => {
    setCode(c); setPickOpen(false); setQrId("");
    const counts = { primary: 0, working: 0, supplier: 0 } as Record<BottleType, number>;
    for (const u of usableByCode.get(c) ?? []) counts[((u.type || "primary") as BottleType)] += 1;
    const first = TYPES.find((t) => counts[t] > 0) ?? "primary";
    setBottleType(first);
  };
  const setWeightAt = (i: number, v: string) => setWeights((prev) => { const x = [...prev]; x[i] = v; return x; });
  const setCount = (n: number) => setWeights((prev) => {
    const x = prev.slice(0, Math.max(1, n));
    while (x.length < n) x.push("");
    return x;
  });

  const submit = async () => {
    if (!bottle) return;
    setBusy(true);
    try {
      await api.deductStockUnitMg(bottle.qrId, {
        weights: nums,
        instrumentId,
        instrumentName: instrument?.name,
        note: note || undefined,
      });
      toast.success(`เบิก ${standard?.name ?? "standard"} ${nums.length} น้ำหนัก (${total} mg)`);
      qc.invalidateQueries({ queryKey: ["stock", "units"] });
      qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
      onSaved(); onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>เบิก Standard</DialogTitle>
          <DialogDescription>เลือกเครื่อง สาร ประเภทขวด แล้วกรอก mg แต่ละน้ำหนัก</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* เครื่อง */}
          <div>
            <Label className="mb-1.5 block">เครื่อง</Label>
            <div className="flex flex-wrap gap-1.5">
              {instruments.map((i) => (
                <Button key={i.id} type="button" size="sm" variant={instrumentId === i.id ? "default" : "outline"}
                  className="h-8 text-xs" onClick={() => pickInstrument(i.id)}>{i.name}</Button>
              ))}
            </div>
          </div>

          {/* สาร (เฉพาะที่มีขวด) */}
          <div>
            <Label className="mb-1.5 block">Standard (มีของในสต็อก)</Label>
            <Popover open={pickOpen} onOpenChange={setPickOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                  <span className="truncate">{standard ? `${standard.name} (${standard.code})` : "เลือก standard..."}</span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <Command>
                  <CommandInput placeholder="ค้นหาชื่อ/code" />
                  <CommandList>
                    <CommandEmpty>ไม่มีสารที่มีขวดใช้ได้</CommandEmpty>
                    {inStock.map((s) => (
                      <CommandItem key={s.code} value={`${s.name} ${s.code}`} onSelect={() => pickStandard(s.code)}>
                        <Check className={cn("mr-2 h-4 w-4", code === s.code ? "opacity-100" : "opacity-0")} />
                        <span className="flex-1">{s.name}</span>
                        <span className="text-xs text-muted-foreground">{usableByCode.get(s.code)?.length ?? 0} ขวด</span>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {code && (
            <>
              {/* ประเภทขวด */}
              <div>
                <Label className="mb-1.5 block">ประเภทขวด</Label>
                <div className="flex gap-1.5">
                  {TYPES.map((t) => (
                    <Button key={t} type="button" size="sm" disabled={typeCounts[t] === 0}
                      variant={bottleType === t ? "default" : "outline"} className="h-8 text-xs"
                      onClick={() => { setBottleType(t); setQrId(""); }}>
                      {t} ({typeCounts[t]})
                    </Button>
                  ))}
                </div>
              </div>

              {/* ขวด */}
              <div>
                <Label className="mb-1.5 block">ขวด (EXP ใกล้สุดก่อน)</Label>
                {bottlesOfType.length === 0 ? (
                  <p className="text-sm text-muted-foreground">ไม่มีขวดประเภทนี้</p>
                ) : (
                  <div className="space-y-1.5">
                    {bottlesOfType.map((u) => (
                      <label key={u.qrId} className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm",
                        (bottle?.qrId === u.qrId) ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
                        <input type="radio" name="bottle" checked={bottle?.qrId === u.qrId} onChange={() => setQrId(u.qrId)} />
                        <span className="text-xs text-muted-foreground">
                          Lot {u.lotNo || "-"} · เหลือ {u.volume?.remaining} {u.volume?.unit} · EXP {u.exp ? new Date(u.exp).toLocaleDateString("th-TH") : "-"}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* จำนวนน้ำหนัก + mg */}
              {bottle && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label>จำนวนน้ำหนัก</Label>
                    <Input type="number" min={1} max={20} value={weights.length} className="h-8 w-20"
                      onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} />
                  </div>
                  <div className="space-y-1.5">
                    {weights.map((w, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-16 text-xs text-muted-foreground">น้ำหนัก {i + 1}</span>
                        <Input type="number" step="0.0001" min="0" placeholder="mg" value={w}
                          onChange={(e) => setWeightAt(i, e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    รวม {total} mg · คงเหลือหลังหัก {Math.max(0, remainingMg - total)} mg
                  </p>
                  {weightError && <p className="mt-1 text-sm text-destructive">{weightError}</p>}
                </div>
              )}

              <div>
                <Label className="mb-1.5 block">หมายเหตุ</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button type="button" disabled={!canSave || busy} onClick={submit}>
            {busy ? "กำลังบันทึก..." : "เบิก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
