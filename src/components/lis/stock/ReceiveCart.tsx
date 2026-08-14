import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ArrowDownToLine, Check, ChevronsUpDown, ChevronRight, ChevronDown, Camera } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

import StockRawLabelPreviewDialog from "@/components/lis/StockRawLabelPreviewDialog";
import StockQrScanner from "@/components/lis/StockQrScanner";
import StockPhotoUploader from "@/components/lis/stock/StockPhotoUploader";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { buildStockLabelHtml, buildSolventLabelHtml } from "@/lib/stockLabel";
import {
  makeEmptyRow, validateRow, buildBottles, findReceiveScanMatch, applyReceiveScanMatch,
  applyReceiveBarcodeRegistration,
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
  label: string; // เธเนเธญเธเธงเธฒเธกเธ—เธตเนเนเธเธงเน
  barcodes?: string[];
}

const CATEGORY_LABEL: Record<CartCategory, string> = {
  standard: "Standard",
  solvent: "เธชเธฒเธฃเน€เธเธกเธต",
  glassware: "เน€เธเธฃเธทเนเธญเธเนเธเนเธง",
};

export default function ReceiveCart() {
  const qc = useQueryClient();
  const { data: standards = [] } = useQuery({ queryKey: ["stock", "standards"], queryFn: api.getStandards });
  const { data: solvents = [] } = useQuery({ queryKey: ["stock", "solvents"], queryFn: api.getSolvents });
  const { data: glassware = [] } = useQuery({ queryKey: ["stock", "glassware"], queryFn: api.getGlassware });

  const options = useMemo<PickOption[]>(() => {
    const std = (standards as StockStandardItem[]).map((s) => ({
      category: "standard" as const, id: s._id, name: s.name, code: s.code,
      label: `${s.code} ${s.name}`, barcodes: s.barcodes ?? [],
    }));
    const sol = (solvents as StockSolventItem[]).map((s) => ({
      category: "solvent" as const, id: s._id, name: s.name, code: "",
      label: s.name, barcodes: s.barcodes ?? [],
    }));
    const gla = (glassware as StockGlasswareItem[]).map((g) => ({
      category: "glassware" as const, id: g._id, name: g.name, code: "",
      label: g.name, barcodes: g.barcodes ?? [],
    }));
    return [...std, ...sol, ...gla];
  }, [standards, solvents, glassware]);

  const [rows, setRows] = useState<CartRow[]>(() => [makeEmptyRow()]);
  const [printAfter, setPrintAfter] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingLabels, setPendingLabels] = useState<string[]>([]);
  const [labelPreviewOpen, setLabelPreviewOpen] = useState(false);
  const [autoPrintLabels, setAutoPrintLabels] = useState(false);
  const [labelPrintJobId, setLabelPrintJobId] = useState(0);
  const [scanText, setScanText] = useState("");
  const [pendingBarcode, setPendingBarcode] = useState("");
  const [pendingBarcodeOption, setPendingBarcodeOption] = useState<PickOption | null>(null);
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);

  const patchRow = (id: string, patch: Partial<CartRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, makeEmptyRow()]);
  const removeRow = (id: string) =>
    setRows((prev) => (prev.length <= 1 ? [makeEmptyRow()] : prev.filter((r) => r.id !== id)));

  const pickItem = (id: string, opt: PickOption) =>
    patchRow(id, {
      category: opt.category, itemId: opt.id, itemName: opt.name, itemCode: opt.code,
    });

  const clearPendingBarcode = () => {
    setPendingBarcode("");
    setPendingBarcodeOption(null);
  };

  const applyReceiveBarcodeScan = (value: string) => {
    const normalizedScanText = value.trim();
    if (!normalizedScanText) return;

    const match = findReceiveScanMatch(normalizedScanText, options);
    if (!match) {
      setPendingBarcode(normalizedScanText);
      setPendingBarcodeOption(null);
      setScanText("");
      setCameraScannerOpen(false);
      toast.success("Barcode ใหม่: เลือกรายการ stock เพื่อลงทะเบียน");
      return;
    }

    setRows((prev) => applyReceiveScanMatch(prev, match));
    setScanText("");
    setCameraScannerOpen(false);
    toast.success(`เพิ่มรายการ: ${match.label}`);
  };

  const handleScanSubmit = () => applyReceiveBarcodeScan(scanText);

  const confirmPendingBarcode = () => {
    if (!pendingBarcodeOption) {
      toast.error("เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธฃเธฒเธขเธเธฒเธฃ stock เธชเธณเธซเธฃเธฑเธ Barcode เธเธตเน");
      return;
    }

    setRows((prev) => applyReceiveBarcodeRegistration(prev, pendingBarcode, pendingBarcodeOption));
    toast.success(`Barcode เนเธซเธกเน: ${pendingBarcode}`);
    clearPendingBarcode();
  };

  const ensureBottleFields = (id: string, len: number) =>
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const nextExp = [...r.perExp];
      while (nextExp.length < len) nextExp.push("");
      nextExp.length = len;
      const nextPhotos = r.perPhotoUrls.map((urls) => [...urls]);
      while (nextPhotos.length < len) nextPhotos.push([]);
      nextPhotos.length = len;
      return { ...r, perExp: nextExp, perPhotoUrls: nextPhotos };
    }));

  const setBottlePhotoUrls = (id: string, index: number, photoUrls: string[]) =>
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const nextPhotos = r.perPhotoUrls.map((urls) => [...urls]);
      while (nextPhotos.length <= index) nextPhotos.push([]);
      nextPhotos[index] = photoUrls;
      return { ...r, perPhotoUrls: nextPhotos };
    }));

  const registerBarcodeIfNeeded = async (row: CartRow) => {
    if (!row.barcode.trim() || !row.category) return;
    await api.registerStockBarcode({ barcode: row.barcode.trim(), category: row.category, itemId: row.itemId });
  };

  const submit = async () => {
    // validate เธ—เธฑเนเธเธซเธกเธ”เธเนเธญเธ
    for (let i = 0; i < rows.length; i++) {
      const err = validateRow(rows[i]);
      if (err) { toast.error(`เนเธ–เธงเธ—เธตเน ${i + 1}: ${err}`); return; }
    }
    setBusy(true);
    try {
      const labels: string[] = [];
      const okIds = new Set<string>();
      let okCount = 0;
      let failCount = 0;

      for (const row of rows) {
        let created: StockUnitItem[] = [];
        try {
          await registerBarcodeIfNeeded(row);
          if (row.category === "standard") {
            const receiveType = row.type;
            if (receiveType !== "primary" && receiveType !== "supplier" && receiveType !== "working") {
              throw new Error("เธ•เนเธญเธเน€เธฅเธทเธญเธเธเธฃเธฐเน€เธ เธ— Barcode");
            }
            created = await api.receiveStockUnits(row.itemId, {
              lotNo: row.lotNo.trim(), sizeMl: Number(row.sizeMl), unit: "ml",
              type: receiveType, bottles: buildBottles(row),
            });
          } else if (row.category === "solvent") {
            await api.receiveSolvent(row.itemId, {
              qty: Number(row.qty),
              lotNo: row.lotNo.trim(),
              exp: row.exp,
              sizeLabel: row.sizeLabel,
              note: row.note,
              photoUrls: row.photoUrls,
            });
          } else if (row.category === "glassware") {
            await api.receiveGlassware(row.itemId, { qty: Number(row.qty), note: row.note });
          }
          okIds.add(row.id);
          okCount += 1;
        } catch (err) {
          failCount += 1;
          toast.error(`${row.itemName || "เธฃเธฒเธขเธเธฒเธฃ"}: ${(err as Error).message}`);
          continue;
        }
        // receive เธชเธณเน€เธฃเนเธเนเธฅเนเธง โ€” เธชเธฃเนเธฒเธเธฅเธฒเน€เธเธฅเนเธเธ best-effort เธซเนเธฒเธกเนเธซเนเธฅเนเธกเน€เธซเธฅเธงเธกเธตเธเธฅเธ•เนเธญเธชเธ–เธฒเธเธฐ receive
        if (printAfter) {
          try {
            if (row.category === "standard") {
              for (const u of created) labels.push(await buildStockLabelHtml(u));
            } else if (row.category === "solvent") {
              const n = Math.max(1, Number(row.qty));
              const html = await buildSolventLabelHtml({
                name: row.itemName, idForQr: row.itemId, lotNo: row.lotNo,
                exp: row.exp || null, sizeLabel: row.sizeLabel,
              });
              for (let i = 0; i < n; i++) labels.push(html);
            }
          } catch (err) {
            toast.error(`เธชเธฃเนเธฒเธเธฅเธฒเน€เธเธฅเนเธกเนเธชเธณเน€เธฃเนเธ: ${(err as Error).message}`);
          }
        }
      }

      if (labels.length > 0) {
        setPendingLabels(labels);
        setAutoPrintLabels(true);
        setLabelPrintJobId((id) => id + 1);
        setLabelPreviewOpen(true);
      }

      if (okCount > 0) toast.success(`เธฃเธฑเธเน€เธเนเธฒเธชเธณเน€เธฃเนเธ ${okCount} เธฃเธฒเธขเธเธฒเธฃ${failCount ? ` ยท เธฅเนเธกเน€เธซเธฅเธง ${failCount}` : ""}`);
      // เธฅเธเนเธ–เธงเธ—เธตเนเธชเธณเน€เธฃเนเธ เน€เธเนเธเนเธ–เธง fail เนเธงเน retry
      setRows((prev) => {
        const left = prev.filter((r) => !okIds.has(r.id));
        return left.length ? left : [makeEmptyRow()];
      });
      qc.invalidateQueries({ queryKey: ["stock", "standards"] });
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
    <>
      <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5" /> เธฃเธฑเธเน€เธเนเธฒ stock (เธซเธฅเธฒเธขเธฃเธฒเธขเธเธฒเธฃ)
          </CardTitle>
          <Button size="sm" variant="outline" onClick={addRow}>
            <Plus className="w-4 h-4 mr-1" /> เน€เธเธดเนเธกเนเธ–เธง
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="stock-receive-barcode">เธชเนเธเธ Barcode เธฃเธฑเธเน€เธเนเธฒ</Label>
              <Input
                id="stock-receive-barcode"
                value={scanText}
                onChange={(event) => setScanText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleScanSubmit();
                  }
                }}
                placeholder="เธชเนเธเธ/เธเธฃเธญเธ Barcode เนเธฅเนเธงเธเธ” Enter"
                autoComplete="off"
              />
            </div>
            <Button type="button" variant="outline" onClick={handleScanSubmit} disabled={!scanText.trim()}>
              เน€เธเธดเนเธกเธเธฒเธ Barcode
            </Button>
            <Button type="button" variant="outline" onClick={() => setCameraScannerOpen(true)}>
              <Camera className="w-4 h-4 mr-1" /> สแกนด้วยกล้อง
            </Button>
          </div>

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
                {row.barcode && <Badge variant="yellow-soft">Barcode เนเธซเธกเน: {row.barcode}</Badge>}
                <Button size="icon" variant="ghost" className="ml-auto" onClick={() => removeRow(row.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>

              {row.category === "standard" && (
                <div className="space-y-2 pl-8">
                  <div className="flex gap-2">
                    {(["primary", "working", "supplier"] as const).map((t) => (
                      <Button key={t} type="button" size="sm" variant={row.type === t ? "default" : "outline"}
                        onClick={() => patchRow(row.id, { type: t })}>{t}</Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div><Label>Lot No</Label><Input value={row.lotNo} onChange={(e) => patchRow(row.id, { lotNo: e.target.value })} placeholder="required" required /></div>
                    <div><Label>เธเธเธฒเธ”/เธเธงเธ” (ml)</Label><Input type="number" value={row.sizeMl} onChange={(e) => patchRow(row.id, { sizeMl: e.target.value })} /></div>
                    <div><Label>เธเธณเธเธงเธเธเธงเธ”</Label><Input type="number" min="1" value={row.count}
                      onChange={(e) => { patchRow(row.id, { count: e.target.value }); ensureBottleFields(row.id, Math.max(1, Number(e.target.value) || 1)); }} /></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id={`sameExp-${row.id}`} checked={row.sameExp} onCheckedChange={(v) => patchRow(row.id, { sameExp: v === true })} />
                    <label htmlFor={`sameExp-${row.id}`} className="text-sm cursor-pointer">EXP เน€เธ—เนเธฒเธเธฑเธเธ—เธธเธเธเธงเธ”</label>
                  </div>
                  {row.sameExp ? (
                    <div><Label>EXP (เธ—เธธเธเธเธงเธ”)</Label><Input type="date" value={row.commonExp} onChange={(e) => patchRow(row.id, { commonExp: e.target.value })} required /></div>
                  ) : (
                    <div className="space-y-2">
                      {Array.from({ length: Math.max(1, Number(row.count) || 1) }, (_, i) => (
                        <div key={i}>
                          <Label>EXP เธเธงเธ”เธ—เธตเน {i + 1}</Label>
                          <Input type="date" value={row.perExp[i] ?? ""}
                            required
                            onChange={(e) => setRows((prev) => prev.map((r) => {
                              if (r.id !== row.id) return r;
                              const x = [...r.perExp]; x[i] = e.target.value; return { ...r, perExp: x };
                            }))} />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    {Array.from({ length: Math.max(1, Number(row.count) || 1) }, (_, i) => (
                      <StockPhotoUploader
                        key={i}
                        label={`เธฃเธนเธเธเธงเธ”เธ—เธตเน ${i + 1} (เนเธกเนเธเธฑเธเธเธฑเธ)`}
                        value={row.perPhotoUrls[i] ?? []}
                        onChange={(photoUrls) => setBottlePhotoUrls(row.id, i, photoUrls)}
                        disabled={busy}
                      />
                    ))}
                  </div>
                </div>
              )}

              {row.category === "solvent" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-8">
                  <div><Label>เธเธณเธเธงเธ (เธเธงเธ”)</Label><Input type="number" min="1" value={row.qty} onChange={(e) => patchRow(row.id, { qty: e.target.value })} /></div>
                  <div><Label>เธเธเธฒเธ”/เธเธงเธ”</Label><Input value={row.sizeLabel} onChange={(e) => patchRow(row.id, { sizeLabel: e.target.value })} placeholder="เน€เธเนเธ 2.5 L" /></div>
                  <div><Label>Lot No</Label><Input value={row.lotNo} onChange={(e) => patchRow(row.id, { lotNo: e.target.value })} placeholder="required" required /></div>
                  <div><Label>EXP</Label><Input type="date" value={row.exp} onChange={(e) => patchRow(row.id, { exp: e.target.value })} required /></div>
                  <div className="col-span-2 sm:col-span-3"><Label>เธซเธกเธฒเธขเน€เธซเธ•เธธ</Label><Input value={row.note} onChange={(e) => patchRow(row.id, { note: e.target.value })} placeholder="optional" /></div>
                  <div className="col-span-2 sm:col-span-3">
                    <StockPhotoUploader
                      label="เธฃเธนเธเธเธงเธ”เธชเธฒเธฃเน€เธเธกเธต (เนเธกเนเธเธฑเธเธเธฑเธ)"
                      value={row.photoUrls}
                      onChange={(photoUrls) => patchRow(row.id, { photoUrls })}
                      disabled={busy}
                    />
                  </div>
                </div>
              )}

              {row.category === "glassware" && (
                <div className="grid grid-cols-2 gap-2 pl-8">
                  <div><Label>เธเธณเธเธงเธ (เธเธดเนเธ)</Label><Input type="number" min="1" value={row.qty} onChange={(e) => patchRow(row.id, { qty: e.target.value })} /></div>
                  <div><Label>เธซเธกเธฒเธขเน€เธซเธ•เธธ</Label><Input value={row.note} onChange={(e) => patchRow(row.id, { note: e.target.value })} placeholder="optional" /></div>
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Checkbox id="printAfterCart" checked={printAfter} onCheckedChange={(v) => setPrintAfter(v === true)} />
              <label htmlFor="printAfterCart" className="text-sm cursor-pointer">เธเธฃเธดเนเธเธฅเธฒเน€เธเธฅเธซเธฅเธฑเธเธฃเธฑเธเน€เธเนเธฒ (standard + เธชเธฒเธฃเน€เธเธกเธต)</label>
            </div>
            <Button onClick={submit} disabled={busy || validCount === 0}>
              <ArrowDownToLine className="w-4 h-4 mr-1" />
              {busy ? "เธเธณเธฅเธฑเธเธเธฑเธเธ—เธถเธ..." : `เธฃเธฑเธเน€เธเนเธฒเธ—เธฑเนเธเธซเธกเธ” (${validCount} เธฃเธฒเธขเธเธฒเธฃ)`}
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
      <Dialog open={Boolean(pendingBarcode)} onOpenChange={(open) => { if (!open) clearPendingBarcode(); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>เธฅเธเธ—เธฐเน€เธเธตเธขเธ Barcode เนเธซเธกเน</DialogTitle>
            <DialogDescription>
              Barcode เธเธตเนเธขเธฑเธเนเธกเนเธญเธขเธนเนเนเธเธฃเธฐเธเธ เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธฃเธฒเธขเธเธฒเธฃ stock เธ—เธตเนเธ•เนเธญเธเธเธนเธเธเธฑเธ Barcode เธเธตเนเธเนเธญเธเธฃเธฑเธเน€เธเนเธฒ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Barcode เธ—เธตเนเธชเนเธเธ</div>
              <div className="font-mono text-lg font-semibold">{pendingBarcode}</div>
            </div>
            <div className="space-y-1.5">
              <Label>เน€เธฅเธทเธญเธเธฃเธฒเธขเธเธฒเธฃ stock เธชเธณเธซเธฃเธฑเธ Barcode เธเธตเน</Label>
              <ItemPicker
                options={options}
                value={pendingBarcodeOption?.id ?? ""}
                onPick={setPendingBarcodeOption}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={clearPendingBarcode}>
              เธขเธเน€เธฅเธดเธ
            </Button>
            <Button type="button" onClick={confirmPendingBarcode}>
              เน€เธเธดเนเธก Barcode เน€เธเนเธฒเธฃเธฒเธขเธเธฒเธฃเธฃเธฑเธเน€เธเนเธฒ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <StockQrScanner
        open={cameraScannerOpen}
        title="สแกน Barcode ด้วยกล้อง"
        scanMode="barcode"
        showManualEntry={false}
        onClose={() => setCameraScannerOpen(false)}
        onScanned={applyReceiveBarcodeScan}
      />      <StockRawLabelPreviewDialog
        open={labelPreviewOpen}
        labels={pendingLabels}
        autoPrint={autoPrintLabels}
        autoPrintKey={labelPrintJobId}
        onOpenChange={(open) => {
          setLabelPreviewOpen(open);
          if (!open) {
            setPendingLabels([]);
            setAutoPrintLabels(false);
          }
        }}
        onPrinted={() => {
          setPendingLabels([]);
          setAutoPrintLabels(false);
        }}
      />
    </>
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
  const [query, setQuery] = useState("");
  // เธเนเธฒเน€เธฃเธดเนเธกเธ•เนเธ: เธ—เธธเธเธซเธกเธงเธ”เธซเธธเธเนเธงเน
  const [expanded, setExpanded] = useState<Record<CartCategory, boolean>>({
    standard: false, solvent: false, glassware: false,
  });
  const selected = options.find((o) => o.id === value);

  // เน€เธเธดเธ”/เธเธดเธ” popover เนเธ•เนเธฅเธฐเธเธฃเธฑเนเธเนเธซเนเธฃเธตเน€เธเนเธ•เธเธฅเธฑเธเน€เธเนเธเธซเธธเธ + เธฅเนเธฒเธเธเธณเธเนเธ
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setExpanded({ standard: false, solvent: false, glassware: false });
    }
  }

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const match = (o: PickOption) => !searching || o.label.toLowerCase().includes(q);

  const groups: { cat: CartCategory; items: PickOption[] }[] = [
    { cat: "standard", items: options.filter((o) => o.category === "standard" && match(o)) },
    { cat: "solvent", items: options.filter((o) => o.category === "solvent" && match(o)) },
    { cat: "glassware", items: options.filter((o) => o.category === "glassware" && match(o)) },
  ];
  const anyVisible = groups.some((g) => g.items.length > 0);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-64 justify-between font-normal">
          <span className="truncate">{selected ? selected.label : "เน€เธฅเธทเธญเธเธเธญเธ..."}</span>
          <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="เธเนเธเธซเธฒ code เธซเธฃเธทเธญเธเธทเนเธญ" value={query} onValueChange={setQuery} />
          <CommandList>
            {!anyVisible && <CommandEmpty>เนเธกเนเธเธเธฃเธฒเธขเธเธฒเธฃ</CommandEmpty>}
            {groups.map((g) => {
              if (g.items.length === 0) return null;
              const isOpen = searching || expanded[g.cat];
              return (
                <CommandGroup key={g.cat} className="p-0">
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => ({ ...p, [g.cat]: !p[g.cat] }))}
                    className="flex w-full items-center gap-1 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/50"
                  >
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    <span>{CATEGORY_LABEL[g.cat]}</span>
                    <span className="ml-auto tabular-nums">{g.items.length}</span>
                  </button>
                  {isOpen && g.items.map((o) => (
                    <CommandItem
                      key={`${o.category}-${o.id}`}
                      value={o.label}
                      onSelect={() => { onPick(o); handleOpenChange(false); }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                      {o.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
