import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, QrCode } from "lucide-react";
import { toast } from "sonner";

import StockQrScanner from "@/components/lis/StockQrScanner";
import PendingDeductionResolutionFields from "@/components/lis/stock/PendingDeductionResolutionFields";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { todayStr, validateRequisitionQty } from "@/lib/chemicalRequisition";
import { isDeductionResolutionReady } from "@/lib/deductionResolution";
import { cn } from "@/lib/utils";
import type { DeductionResolutionReason } from "@/types/stock";

interface Props {
  roomSlug: string;
  instruments: { id: string; name: string }[];
  presetInstrumentId?: string;
  initialSolventId?: string | null;
  initialSolventUnitQrId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ChemicalRequisitionDialog({
  roomSlug,
  instruments,
  presetInstrumentId,
  initialSolventId,
  initialSolventUnitQrId,
  onClose,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [instrumentId, setInstrumentId] = useState(presetInstrumentId ?? "");
  const [solventId, setSolventId] = useState(initialSolventId ?? "");
  const [solventUnitQrId, setSolventUnitQrId] = useState(initialSolventUnitQrId ?? "");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [pendingReason, setPendingReason] = useState<DeductionResolutionReason | "">("");
  const [pendingNote, setPendingNote] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const { data: solvents = [] } = useQuery({
    queryKey: ["stock", "solvents"],
    queryFn: api.getSolvents,
  });

  const solvent = useMemo(
    () => solvents.find((row) => row._id === solventId) ?? null,
    [solvents, solventId],
  );
  const qtyNum = Number(qty);
  const qtyError = solvent ? validateRequisitionQty(qtyNum, solvent.qty) : "";
  const { data: pendingDeductions = [] } = useQuery({
    queryKey: ["stock", "pending-deductions", "solvent", solventId, instrumentId],
    enabled: Boolean(instrumentId && solventId),
    queryFn: () =>
      api.getPendingStockDeductions({
        itemType: "solvent",
        itemId: solventId,
        instrumentId,
      }),
  });
  const pendingDeduction = pendingDeductions[0] ?? null;
  const pendingReady = !pendingDeduction || isDeductionResolutionReady(pendingReason, pendingNote);
  const canSave = Boolean(instrumentId && solventId && !qtyError && user?.name && pendingReady);

  useEffect(() => {
    setPendingReason("");
    setPendingNote("");
  }, [pendingDeduction?._id]);

  useEffect(() => {
    if (initialSolventId) setSolventId(initialSolventId);
    if (initialSolventUnitQrId) {
      setSolventUnitQrId(initialSolventUnitQrId);
      setQty("1");
    }
  }, [initialSolventId, initialSolventUnitQrId]);

  const onScanned = async (id: string) => {
    setScanOpen(false);
    try {
      const unit = await api.getStockUnit(id);
      if (unit.itemType === "solvent" && unit.itemId) {
        const found = solvents.find((row) => row._id === unit.itemId);
        if (!found) {
          toast.error("ไม่พบสารเคมีจาก QR นี้");
          return;
        }
        setSolventId(found._id);
        setSolventUnitQrId(unit.qrId);
        setQty("1");
        return;
      }
    } catch {
      /* fallback to legacy solvent QR */
    }
    const found = solvents.find((row) => row._id === id);
    if (!found) {
      toast.error("ไม่พบสารเคมีจาก QR นี้");
      return;
    }
    setSolventId(found._id);
    setSolventUnitQrId("");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (pendingDeduction && pendingReason) {
        await api.resolveStockDeduction(pendingDeduction._id, {
          reason: pendingReason,
          note: pendingNote.trim() || undefined,
          _user: { email: user?.email ?? "", name: user?.name ?? "" },
        });
      }
      return api.createChemicalRequisition({
        roomSlug,
        date: todayStr(),
        instrumentId,
        instrumentName: instruments.find((row) => row.id === instrumentId)?.name ?? "",
        solventId,
        solventUnitQrId: solventUnitQrId || undefined,
        qty: qtyNum,
        note: note || undefined,
        requestedBy: { email: user?.email ?? "", name: user?.name ?? "" },
      });
    },
    onSuccess: () => {
      toast.success(`เบิก ${solvent?.name ?? "สารเคมี"} ${qtyNum} ขวดแล้ว`);
      onSaved();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "บันทึกไม่สำเร็จ"),
  });

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เบิกสารเคมี</DialogTitle>
            <DialogDescription>
              เลือกเครื่องและสารเคมี (solvent) ที่จะเบิก
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1.5 block">เครื่อง</Label>
              <div className="flex flex-wrap gap-1.5">
                {instruments.map((instrument) => (
                  <Button
                    key={instrument.id}
                    type="button"
                    size="sm"
                    variant={instrumentId === instrument.id ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => setInstrumentId(instrument.id)}
                  >
                    {instrument.name}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">สารเคมี (solvent)</Label>
              <div className="flex gap-2">
                <Popover open={pickOpen} onOpenChange={setPickOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="flex-1 justify-between font-normal"
                    >
                      <span className="truncate">
                        {solvent ? `${solvent.name} (คงเหลือ ${solvent.qty})` : "เลือกสารเคมี..."}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="ค้นหาชื่อสารเคมี" />
                      <CommandList>
                        <CommandEmpty>ไม่พบรายการ</CommandEmpty>
                        {solvents.map((row) => (
                          <CommandItem
                            key={row._id}
                            value={row.name}
                            onSelect={() => {
                              setSolventId(row._id);
                              setSolventUnitQrId("");
                              setPickOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                solventId === row._id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="flex-1">{row.name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              คงเหลือ {row.qty}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="สแกนบาร์โค้ด"
                  aria-label="สแกนบาร์โค้ด"
                  onClick={() => setScanOpen(true)}
                >
                  <QrCode className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">จำนวน (ขวด)</Label>
              <Input type="number" min="1" value={qty} disabled={Boolean(solventUnitQrId)} onChange={(e) => setQty(e.target.value)} />
              {solventUnitQrId && <p className="mt-1 text-xs text-muted-foreground">สแกน QR รายขวดแล้ว ระบบจะเบิกขวดนี้ 1 ขวด</p>}
              {qtyError && <p className="mt-1 text-sm text-destructive">{qtyError}</p>}
            </div>

            {pendingDeduction && (
              <PendingDeductionResolutionFields
                transaction={pendingDeduction}
                reason={pendingReason}
                note={pendingNote}
                onReasonChange={setPendingReason}
                onNoteChange={setPendingNote}
              />
            )}

            <div>
              <Label className="mb-1.5 block">หมายเหตุ</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="optional"
              />
            </div>

            <div>
              <Label className="mb-1.5 block">ผู้เบิก</Label>
              <Input value={user?.name ?? ""} readOnly disabled className="bg-muted/40" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button
              type="button"
              disabled={!canSave || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "กำลังบันทึก..." : "เบิก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StockQrScanner
        open={scanOpen}
        title="สแกนบาร์โค้ดสารเคมี"
        onClose={() => setScanOpen(false)}
        onScanned={onScanned}
      />
    </>
  );
}
