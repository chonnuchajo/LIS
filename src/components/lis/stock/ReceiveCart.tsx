import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, ArrowDownToLine, Check, ChevronsUpDown, ChevronRight, ChevronDown, Camera, Pencil } from "lucide-react";
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
  applyReceiveBarcodeRegistration, sanitizeDecimalInput, sanitizeIntegerInput,
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
  barcodes?: string[];
  sizeLiter?: number;
  price?: number;
}

function localDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
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
      label: `${s.code} ${s.name}`, barcodes: s.barcodes ?? [],
    }));
    const sol = (solvents as StockSolventItem[]).map((s) => ({
      category: "solvent" as const, id: s._id, name: s.name, code: "",
      label: s.name, barcodes: s.barcodes ?? [], sizeLiter: s.sizeLiter, price: s.price,
    }));
    const gla = (glassware as StockGlasswareItem[]).map((g) => ({
      category: "glassware" as const, id: g._id, name: g.name, code: "",
      label: g.name, barcodes: g.barcodes ?? [],
    }));
    return [...std, ...sol, ...gla];
  }, [standards, solvents, glassware]);

  const [rows, setRows] = useState<CartRow[]>(() => []);
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
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  const patchRow = (id: string, patch: Partial<CartRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (editingRowId === id) setEditingRowId(null);
  };

  const optionPatch = (opt: PickOption): Partial<CartRow> => ({
    category: opt.category,
    itemId: opt.id,
    itemName: opt.name,
    itemCode: opt.code,
    ...(opt.category === "solvent" ? {
      sizeLiter: opt.sizeLiter && opt.sizeLiter > 0 ? String(opt.sizeLiter) : "",
      price: opt.price != null ? String(opt.price) : "",
    } : {}),
  });

  const addPickedItem = (opt: PickOption) => {
    setRows((prev) => [...prev, { ...makeEmptyRow(), ...optionPatch(opt) }]);
    toast.success(`เพิ่มรายการ: ${opt.label}`);
  };

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
      toast.error("กรุณาเลือกรายการ stock สำหรับ Barcode นี้");
      return;
    }

    setRows((prev) => applyReceiveBarcodeRegistration(prev, pendingBarcode, pendingBarcodeOption));
    toast.success(`Barcode ใหม่: ${pendingBarcode}`);
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
        let created: StockUnitItem[] = [];
        try {
          await registerBarcodeIfNeeded(row);
          if (row.category === "standard") {
            const receiveType = row.type;
            if (receiveType !== "primary" && receiveType !== "supplier" && receiveType !== "working") {
              throw new Error("ต้องเลือกประเภท Barcode");
            }
            created = await api.receiveStockUnits(row.itemId, {
              lotNo: row.lotNo.trim(), purity: row.purity.trim(), sizeMl: Number(row.sizeMl), unit: "mg",
              type: receiveType, bottles: buildBottles(row),
            });
          } else if (row.category === "solvent") {
            await api.receiveSolvent(row.itemId, {
              qty: Number(row.qty),
              lotNo: row.lotNo.trim(),
              exp: row.exp,
              sizeLiter: Number(row.sizeLiter),
              price: Number(row.price),
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
          toast.error(`${row.itemName || "รายการ"}: ${(err as Error).message}`);
          continue;
        }
        // receive สำเร็จแล้ว — สร้างลาเบลแบบ best-effort ห้ามให้ล้มเหลวมีผลต่อสถานะ receive
        if (printAfter) {
          try {
            if (row.category === "standard") {
              for (const u of created) labels.push(await buildStockLabelHtml(u));
            } else if (row.category === "solvent") {
              const n = Math.max(1, Number(row.qty));
              const receivedDate = localDateInputValue();
              for (let i = 0; i < n; i++) {
                labels.push(await buildSolventLabelHtml({
                  name: row.itemName,
                  idForQr: row.itemId,
                  lotNo: row.lotNo,
                  receivedDate,
                  exp: row.exp || null,
                  bottleNo: i + 1,
                }));
              }
            }
          } catch (err) {
            toast.error(`สร้างลาเบลไม่สำเร็จ: ${(err as Error).message}`);
          }
        }
      }

      if (labels.length > 0) {
        setPendingLabels(labels);
        setAutoPrintLabels(true);
        setLabelPrintJobId((id) => id + 1);
        setLabelPreviewOpen(true);
      }

      if (okCount > 0) toast.success(`รับเข้าสำเร็จ ${okCount} รายการ${failCount ? ` · ล้มเหลว ${failCount}` : ""}`);
      // ลบแถวที่สำเร็จ เก็บแถว fail ไว้ retry
      setRows((prev) => prev.filter((r) => !okIds.has(r.id)));
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
  const editingRow = editingRowId ? rows.find((row) => row.id === editingRowId) ?? null : null;

  const rowUnit = (row: CartRow) => (row.category === "glassware" ? "ชิ้น" : "ขวด");
  const rowQty = (row: CartRow) => (row.category === "standard" ? row.count : row.qty);
  const rowLot = (row: CartRow) => (row.category === "glassware" ? "-" : row.lotNo || "-");
  const patchRowQty = (row: CartRow, value: string) => {
    const qty = sanitizeIntegerInput(value);
    if (row.category === "standard") {
      patchRow(row.id, { count: qty });
      ensureBottleFields(row.id, Math.max(1, Number(qty) || 1));
      return;
    }
    patchRow(row.id, { qty });
  };

  const renderDetailFields = (row: CartRow) => (
    <div className="space-y-4 py-2">
      {row.category === "standard" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["primary", "working", "supplier"] as const).map((type) => (
              <Button
                key={type}
                type="button"
                size="sm"
                variant={row.type === type ? "default" : "outline"}
                onClick={() => patchRow(row.id, { type })}
              >
                {type}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <Label htmlFor={`standard-lot-${row.id}`}>Lot No</Label>
              <Input id={`standard-lot-${row.id}`} value={row.lotNo} onChange={(e) => patchRow(row.id, { lotNo: e.target.value })} placeholder="required" required />
            </div>
            <div>
              <Label htmlFor={`standard-purity-${row.id}`}>% Purity</Label>
              <Input id={`standard-purity-${row.id}`} value={row.purity} onChange={(e) => patchRow(row.id, { purity: e.target.value })} placeholder="เช่น 99.5" inputMode="decimal" required />
            </div>
            <div>
              <Label htmlFor={`standard-size-${row.id}`}>ขนาด/ขวด (mg)</Label>
              <Input id={`standard-size-${row.id}`} value={row.sizeMl} onChange={(e) => patchRow(row.id, { sizeMl: sanitizeDecimalInput(e.target.value, 4) })} inputMode="decimal" placeholder="เช่น 100 หรือ 0.1234" />
            </div>
            <div>
              <Label htmlFor={`standard-count-${row.id}`}>จำนวนขวด</Label>
              <Input id={`standard-count-${row.id}`} min="1" step="1" inputMode="numeric" value={row.count} onChange={(e) => patchRowQty(row, e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id={`sameExp-${row.id}`} checked={row.sameExp} onCheckedChange={(value) => patchRow(row.id, { sameExp: value === true })} />
            <label htmlFor={`sameExp-${row.id}`} className="text-sm cursor-pointer">EXP เท่ากันทุกขวด</label>
          </div>
          {row.sameExp ? (
            <div>
              <Label htmlFor={`standard-common-exp-${row.id}`}>EXP (ทุกขวด)</Label>
              <Input id={`standard-common-exp-${row.id}`} type="date" value={row.commonExp} onChange={(e) => patchRow(row.id, { commonExp: e.target.value })} required />
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from({ length: Math.max(1, Number(row.count) || 1) }, (_, index) => (
                <div key={index}>
                  <Label>EXP ขวดที่ {index + 1}</Label>
                  <Input
                    type="date"
                    value={row.perExp[index] ?? ""}
                    required
                    onChange={(event) => setRows((prev) => prev.map((current) => {
                      if (current.id !== row.id) return current;
                      const perExp = [...current.perExp];
                      perExp[index] = event.target.value;
                      return { ...current, perExp };
                    }))}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            {Array.from({ length: Math.max(1, Number(row.count) || 1) }, (_, index) => (
              <StockPhotoUploader
                key={index}
                label={`รูปขวดที่ ${index + 1} (ไม่บังคับ)`}
                value={row.perPhotoUrls[index] ?? []}
                onChange={(photoUrls) => setBottlePhotoUrls(row.id, index, photoUrls)}
                disabled={busy}
              />
            ))}
          </div>
        </div>
      )}

      {row.category === "solvent" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div>
            <Label htmlFor={`${row.id}-solvent-qty`}>จำนวน (ขวด)</Label>
            <Input id={`${row.id}-solvent-qty`} min="1" step="1" inputMode="numeric" value={row.qty} onChange={(e) => patchRowQty(row, e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`${row.id}-solvent-size`}>ขนาด/ขวด (ลิตร)</Label>
            <Input id={`${row.id}-solvent-size`} type="number" min="0.001" step="any" value={row.sizeLiter} onChange={(e) => patchRow(row.id, { sizeLiter: e.target.value })} placeholder="เช่น 2.5" required />
          </div>
          <div>
            <Label htmlFor={`${row.id}-solvent-price`}>ราคา (บาท)</Label>
            <Input id={`${row.id}-solvent-price`} type="number" min="0" step="any" value={row.price} onChange={(e) => patchRow(row.id, { price: e.target.value })} placeholder="เช่น 1200" required />
          </div>
          <div>
            <Label htmlFor={`${row.id}-solvent-lot`}>Lot No</Label>
            <Input id={`${row.id}-solvent-lot`} value={row.lotNo} onChange={(e) => patchRow(row.id, { lotNo: e.target.value })} placeholder="required" required />
          </div>
          <div>
            <Label htmlFor={`${row.id}-solvent-exp`}>EXP</Label>
            <Input id={`${row.id}-solvent-exp`} type="date" value={row.exp} onChange={(e) => patchRow(row.id, { exp: e.target.value })} required />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <Label htmlFor={`${row.id}-solvent-note`}>หมายเหตุ</Label>
            <Input id={`${row.id}-solvent-note`} value={row.note} onChange={(e) => patchRow(row.id, { note: e.target.value })} placeholder="optional" />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <StockPhotoUploader label="รูปขวดสารเคมี (ไม่บังคับ)" value={row.photoUrls} onChange={(photoUrls) => patchRow(row.id, { photoUrls })} disabled={busy} />
          </div>
        </div>
      )}

      {row.category === "glassware" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor={`${row.id}-glassware-qty`}>จำนวน (ชิ้น)</Label>
            <Input id={`${row.id}-glassware-qty`} min="1" step="1" inputMode="numeric" value={row.qty} onChange={(e) => patchRowQty(row, e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`${row.id}-glassware-note`}>หมายเหตุ</Label>
            <Input id={`${row.id}-glassware-note`} value={row.note} onChange={(e) => patchRow(row.id, { note: e.target.value })} placeholder="optional" />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
            <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5" /> รับเข้า Stock
            </CardTitle>
            <Button onClick={submit} disabled={busy || validCount === 0}>
              <ArrowDownToLine className="w-4 h-4 mr-1" />
              {busy ? "กำลังบันทึก..." : `รับเข้าทั้งหมด (${validCount} รายการ)`}
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <section className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="font-medium">เพิ่มรายการรับเข้า</div>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] lg:items-end">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="stock-receive-barcode">ค้นหา / สแกน Barcode</Label>
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
                      placeholder="สแกน Barcode หรือพิมพ์ชื่อ/code แล้วกด Enter"
                      autoComplete="off"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={handleScanSubmit} disabled={!scanText.trim()}>
                    เพิ่มรายการ
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setCameraScannerOpen(true)}>
                    <Camera className="w-4 h-4 mr-1" /> สแกนด้วยกล้อง
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label>ค้นจากรายการในระบบ</Label>
                  <ItemPicker
                    options={options}
                    value=""
                    placeholder="ค้นหาหรือเลือกสาร/สินค้า..."
                    onPick={addPickedItem}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">สามารถสแกน Barcode ต่อเนื่องได้เลย</p>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">รายการที่จะรับเข้า</div>
                <Badge variant="outline">{rows.length} รายการ</Badge>
              </div>

              {rows.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  ยังไม่มีรายการรับเข้า ค้นหาหรือสแกน Barcode เพื่อเพิ่มรายการ
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead className="bg-muted/60 text-muted-foreground">
                      <tr>
                        <th className="w-12 px-3 py-2 text-left font-medium">#</th>
                        <th className="px-3 py-2 text-left font-medium">สาร/สินค้า</th>
                        <th className="w-40 px-3 py-2 text-left font-medium">Lot</th>
                        <th className="w-28 px-3 py-2 text-right font-medium">จำนวน</th>
                        <th className="w-20 px-3 py-2 text-left font-medium">หน่วย</th>
                        <th className="w-28 px-3 py-2 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map((row, index) => (
                        <tr key={row.id}>
                          <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>
                          <td className="px-3 py-2 font-medium">{row.itemName || "-"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{rowLot(row)}</td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              aria-label={`จำนวน ${row.itemName || "รายการ"}`}
                              className="ml-auto h-8 w-20 text-right"
                              min="1"
                              step="1"
                              inputMode="numeric"
                              value={rowQty(row)}
                              onChange={(event) => patchRowQty(row, event.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{rowUnit(row)}</td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-1">
                              <Button type="button" size="icon" variant="ghost" aria-label={`แก้ไข ${row.itemName || "รายการ"}`} onClick={() => setEditingRowId(row.id)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button type="button" size="icon" variant="ghost" aria-label={`ลบ ${row.itemName || "รายการ"}`} onClick={() => removeRow(row.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Checkbox id="printAfterCart" checked={printAfter} onCheckedChange={(value) => setPrintAfter(value === true)} />
                <label htmlFor="printAfterCart" className="text-sm cursor-pointer">ปริ้นลาเบลหลังรับเข้า (standard + สารเคมี)</label>
              </div>
              <Button onClick={submit} disabled={busy || validCount === 0}>
                <ArrowDownToLine className="w-4 h-4 mr-1" />
                {busy ? "กำลังบันทึก..." : `รับเข้า ${validCount} รายการ`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(editingRow)} onOpenChange={(open) => { if (!open) setEditingRowId(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไขรายการรับเข้า</DialogTitle>
            <DialogDescription>{editingRow?.itemName || "รายการรับเข้า"}</DialogDescription>
          </DialogHeader>
          {editingRow && renderDetailFields(editingRow)}
          <DialogFooter>
            <Button type="button" onClick={() => setEditingRowId(null)}>เสร็จ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
<Dialog open={Boolean(pendingBarcode)} onOpenChange={(open) => { if (!open) clearPendingBarcode(); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>ลงทะเบียน Barcode ใหม่</DialogTitle>
            <DialogDescription>
              Barcode นี้ยังไม่อยู่ในระบบ กรุณาเลือกรายการ stock ที่ต้องผูกกับ Barcode นี้ก่อนรับเข้า
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Barcode ที่สแกน</div>
              <div className="font-mono text-lg font-semibold">{pendingBarcode}</div>
            </div>
            <div className="space-y-1.5">
              <Label>เลือกรายการ stock สำหรับ Barcode นี้</Label>
              <ItemPicker
                options={options}
                value={pendingBarcodeOption?.id ?? ""}
                onPick={setPendingBarcodeOption}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={clearPendingBarcode}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={confirmPendingBarcode}>
              เพิ่ม Barcode เข้ารายการรับเข้า
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
  options, value, onPick, placeholder = "เลือกของ...",
}: {
  options: PickOption[];
  value: string;
  onPick: (opt: PickOption) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // ค่าเริ่มต้น: ทุกหมวดหุบไว้
  const [expanded, setExpanded] = useState<Record<CartCategory, boolean>>({
    standard: false, solvent: false, glassware: false,
  });
  const selected = options.find((o) => o.id === value);

  // เปิด/ปิด popover แต่ละครั้งให้รีเซ็ตกลับเป็นหุบ + ล้างคำค้น
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
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="ค้นหา code หรือชื่อ" value={query} onValueChange={setQuery} />
          <CommandList>
            {!anyVisible && <CommandEmpty>ไม่พบรายการ</CommandEmpty>}
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
