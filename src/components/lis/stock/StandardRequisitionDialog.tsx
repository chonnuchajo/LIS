import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, QrCode } from "lucide-react";
import { toast } from "sonner";

import StockQrScanner from "@/components/lis/StockQrScanner";
import WithdrawDialog from "@/components/lis/stock/WithdrawDialog";
import PerformanceDropDialog from "@/components/lis/stock/PerformanceDropDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { buildUnitTree, parseScannedQrId, pickFefoSealed, unitDerivedStatus, workingUsability } from "@/lib/stockUnit";
import { cn } from "@/lib/utils";
import type { StockStandardItem, StockUnitItem } from "@/types/stock";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const USABILITY: Record<string, { label: string; cls: string; usable: boolean }> = {
  active: { label: "ยังใช้ได้", cls: "bg-emerald-100 text-emerald-700", usable: true },
  freqDue: { label: "หมดความถี่", cls: "bg-amber-100 text-amber-700", usable: false },
  expired: { label: "หมดอายุ", cls: "bg-orange-100 text-orange-700", usable: false },
  empty: { label: "หมด", cls: "bg-slate-100 text-slate-600", usable: false },
  discarded: { label: "ทิ้งแล้ว", cls: "bg-destructive/15 text-destructive", usable: false },
};

export default function StandardRequisitionDialog({ onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [withdrawQr, setWithdrawQr] = useState("");        // sealed qrId ที่จะแบ่ง → เปิด WithdrawDialog
  const [perfDropQr, setPerfDropQr] = useState("");        // working qrId ที่จะแจ้ง/ทิ้ง

  const { data: standards = [] } = useQuery({
    queryKey: ["stock", "standards"],
    queryFn: api.getStandards,
  });
  const standard = useMemo(() => standards.find((s) => s.code === code) ?? null, [standards, code]);

  const { data: units = [] } = useQuery({
    queryKey: ["stock", "units", code],
    queryFn: () => api.getStockUnits({ itemCode: code }),
    enabled: !!code,
  });

  const workings = units.filter((u) => u.kind === "working" && u.status !== "discarded");
  const sealed = units
    .filter((u) => u.kind === "sealed" && unitDerivedStatus(u) === "active")
    .sort((a, b) => (a.exp ? +new Date(a.exp) : Infinity) - (b.exp ? +new Date(b.exp) : Infinity));
  const labelOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of buildUnitTree(units)) map.set(r.unit._id, r.label);
    return map;
  }, [units]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stock", "units", code] });
    qc.invalidateQueries({ queryKey: ["stock", "units"] });
    qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };

  const onScanned = async (raw: string) => {
    setScanOpen(false);
    const qrId = parseScannedQrId(raw);
    try {
      const u = await api.getStockUnit(qrId);
      setCode(u.itemCode);
      if (u.kind === "sealed") setWithdrawQr(u.qrId); // สแกนขวด sealed → เปิดแบ่งเลย
    } catch {
      toast.error("ไม่พบขวดจาก QR นี้");
    }
  };

  const startWithdrawFefo = () => {
    const fefo = pickFefoSealed(units);
    if (!fefo) { toast.error("ไม่มีขวด sealed ที่แบ่งได้ — ไปเพิ่มขวดที่หน้า Stock"); return; }
    setWithdrawQr(fefo.qrId);
  };

  const reuse = (u: StockUnitItem) => {
    toast.success(`ใช้ working ${labelOf.get(u._id) ?? u.qrId} (ยังใช้ได้ — ไม่ต้องแบ่งใหม่)`);
    onSaved();
    onClose();
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>เบิก Standard</DialogTitle>
            <DialogDescription>เลือก standard แล้วใช้ working เดิม หรือแบ่ง working ใหม่จากขวด sealed</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1.5 block">Standard</Label>
              <div className="flex gap-2">
                <Popover open={pickOpen} onOpenChange={setPickOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" role="combobox" className="flex-1 justify-between font-normal">
                      <span className="truncate">{standard ? `${standard.name} (${standard.code})` : "เลือก standard..."}</span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="ค้นหาชื่อ/code" />
                      <CommandList>
                        <CommandEmpty>ไม่พบรายการ</CommandEmpty>
                        {standards.map((s) => (
                          <CommandItem key={s.code} value={`${s.name} ${s.code}`} onSelect={() => { setCode(s.code); setPickOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", code === s.code ? "opacity-100" : "opacity-0")} />
                            <span className="flex-1">{s.name}</span>
                            <span className="text-xs text-muted-foreground">{s.code}</span>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="outline" size="icon" title="สแกน QR ขวด" onClick={() => setScanOpen(true)}>
                  <QrCode className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {code && (
              <>
                <div>
                  <Label className="mb-1.5 block">working ที่มี</Label>
                  {workings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">ยังไม่มี working — แบ่งใหม่ด้านล่าง</p>
                  ) : (
                    <ul className="divide-y rounded border">
                      {workings.map((u) => {
                        const st = workingUsability(u);
                        const meta = USABILITY[st] ?? USABILITY.active;
                        return (
                          <li key={u._id} className="flex items-center gap-2 p-2 text-sm">
                            <span className="w-10 text-xs text-muted-foreground">{labelOf.get(u._id) ?? "-"}</span>
                            <Badge className={cn("text-xs", meta.cls)}>{meta.label}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {u.volume?.remaining ?? "-"} {u.volume?.unit} · EXP {u.exp ? new Date(u.exp).toLocaleDateString("th-TH") : "-"}
                            </span>
                            <span className="ml-auto flex gap-1">
                              {meta.usable && <Button type="button" size="sm" onClick={() => reuse(u)}>ใช้อันนี้</Button>}
                              <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => setPerfDropQr(u.qrId)}>
                                แจ้ง/ทิ้ง
                              </Button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div>
                  <Label className="mb-1.5 block">แบ่ง working ใหม่จากขวด sealed</Label>
                  {sealed.length === 0 ? (
                    <p className="text-sm text-muted-foreground">ไม่มีขวด sealed ที่แบ่งได้</p>
                  ) : (
                    <div className="space-y-2">
                      <Button type="button" variant="secondary" onClick={startWithdrawFefo}>
                        + แบ่งจากขวด EXP ใกล้สุด ({labelOf.get(sealed[0]._id) ?? "1"} · EXP {sealed[0].exp ? new Date(sealed[0].exp).toLocaleDateString("th-TH") : "-"})
                      </Button>
                      {sealed.length > 1 && (
                        <ul className="divide-y rounded border">
                          {sealed.map((u) => (
                            <li key={u._id} className="flex items-center gap-2 p-2 text-sm">
                              <span className="w-10 text-xs text-muted-foreground">{labelOf.get(u._id) ?? "-"}</span>
                              <span className="text-xs text-muted-foreground">
                                Lot {u.lotNo || "-"} · เหลือ {u.volume?.remaining} {u.volume?.unit} · EXP {u.exp ? new Date(u.exp).toLocaleDateString("th-TH") : "-"}
                              </span>
                              <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => setWithdrawQr(u.qrId)}>แบ่ง</Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StockQrScanner open={scanOpen} title="สแกน QR ขวด standard" onClose={() => setScanOpen(false)} onScanned={onScanned} />

      {withdrawQr && (
        <WithdrawDialog
          qrId={withdrawQr}
          onClose={() => setWithdrawQr("")}
          onSaved={() => { refresh(); onSaved(); onClose(); }}
        />
      )}
      {perfDropQr && (
        <PerformanceDropDialog
          qrId={perfDropQr}
          onClose={() => setPerfDropQr("")}
          onSaved={() => { refresh(); onSaved(); }}
        />
      )}
    </>
  );
}
