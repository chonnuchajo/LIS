// src/components/lis/stock/StockRequisitionButton.tsx
// Persistent stock requisition button used in PageHeader actions.
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Package, Plus } from "lucide-react";
import { toast } from "sonner";

import ChemicalRequisitionDialog from "@/components/lis/daily-check/ChemicalRequisitionDialog";
import StandardRequisitionDialog from "@/components/lis/stock/StandardRequisitionDialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import type { StockTransactionItem, StockUnitItem } from "@/types/stock";

interface Props {
  roomSlug: string;
  instruments: { id: string; name: string; group?: string }[];
  initialQrId?: string | null;
  onInitialQrConsumed?: () => void;
}

function formatScanBlockDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function scannedUnitBlockMessage(unit: StockUnitItem, now = new Date()) {
  const remaining = unit.volume?.remaining;
  if (unit.status === "empty" || (remaining != null && Number(remaining) <= 0)) {
    const date = formatScanBlockDate(unit.updatedAt || unit.discardedAt || unit.createdAt);
    return date ? `ขวดนี้หมดแล้วเมื่อ ${date}` : "ขวดนี้หมดแล้ว";
  }
  if (unit.status === "discarded") {
    return "ขวดนี้ไม่มีประสิทธิภาพแล้วไม่ควรใช้งาน";
  }
  if (unit.exp && new Date(unit.exp).getTime() < now.getTime()) {
    const date = formatScanBlockDate(unit.exp);
    return date ? `ขวดนี้หมดอายุแล้วเมื่อ ${date}` : "ขวดนี้หมดอายุแล้ว";
  }
  return "";
}

function scannedResolutionBlockMessage(transactions: StockTransactionItem[]) {
  const resolved = transactions.find((tx) => tx.deductionResolution?.reason);
  const reason = resolved?.deductionResolution?.reason;
  if (!resolved || !reason) return "";
  const date = formatScanBlockDate(resolved.deductionResolution?.resolvedAt || resolved.createdAt);
  if (reason === "expired") return date ? `ขวดนี้หมดอายุแล้วเมื่อ ${date}` : "ขวดนี้หมดอายุแล้ว";
  if (reason === "empty") return date ? `ขวดนี้หมดแล้วเมื่อ ${date}` : "ขวดนี้หมดแล้ว";
  if (reason === "ineffective") return "ขวดนี้ไม่มีประสิทธิภาพแล้วไม่ควรใช้งาน";
  return "";
}

export default function StockRequisitionButton({
  roomSlug,
  instruments,
  initialQrId,
  onInitialQrConsumed,
}: Props) {
  const queryClient = useQueryClient();
  const [chooser, setChooser] = useState(false);
  const [which, setWhich] = useState<"chemical" | "standard" | null>(null);
  const [initialStandardQrId, setInitialStandardQrId] = useState<string | null>(null);
  const [initialSolventId, setInitialSolventId] = useState<string | null>(null);
  const consumedQrRef = useRef<string | null>(null);
  const normalizedInitialQrId = initialQrId?.trim() ?? "";
  const shouldResolveInitialQr = Boolean(normalizedInitialQrId) && consumedQrRef.current !== normalizedInitialQrId;

  useEffect(() => {
    if (!normalizedInitialQrId) consumedQrRef.current = null;
  }, [normalizedInitialQrId]);

  const { data: scannedUnit = null, isFetched: scannedUnitFetched } = useQuery({
    queryKey: ["stock", "unit", normalizedInitialQrId],
    queryFn: async () => {
      try {
        return await api.getStockUnit(normalizedInitialQrId);
      } catch {
        return null;
      }
    },
    enabled: shouldResolveInitialQr,
    retry: false,
  });

  const { data: resolvedDeductions = [], isFetched: resolvedDeductionsFetched } = useQuery({
    queryKey: ["stock", "resolved-deductions", normalizedInitialQrId],
    queryFn: () => api.getStockTransactions({
      itemType: "standard",
      action: "deduct",
      qrId: normalizedInitialQrId,
      limit: 10,
    }),
    enabled: shouldResolveInitialQr,
    retry: false,
  });

  const { data: solvents = [], isFetched: solventsFetched } = useQuery({
    queryKey: ["stock", "solvents"],
    queryFn: api.getSolvents,
    enabled: shouldResolveInitialQr,
  });

  useEffect(() => {
    if (!shouldResolveInitialQr || !scannedUnitFetched || !resolvedDeductionsFetched || !solventsFetched) return;

    consumedQrRef.current = normalizedInitialQrId;
    if (scannedUnit) {
      const blockMessage = scannedUnitBlockMessage(scannedUnit) || scannedResolutionBlockMessage(resolvedDeductions);
      if (blockMessage) {
        toast.error(blockMessage);
        onInitialQrConsumed?.();
        return;
      }
      queryClient.setQueryData<StockUnitItem[]>(["stock", "units"], (current = []) => {
        const existing = current.find((row) => row.qrId === scannedUnit.qrId);
        if (existing) return current.map((row) => (row.qrId === scannedUnit.qrId ? scannedUnit : row));
        return [scannedUnit, ...current];
      });
      setInitialStandardQrId(scannedUnit.qrId);
      setInitialSolventId(null);
      setWhich("standard");
      setChooser(false);
      onInitialQrConsumed?.();
      return;
    }

    const matchedSolvent = solvents.find((row) => row._id === normalizedInitialQrId);
    if (matchedSolvent) {
      setInitialStandardQrId(null);
      setInitialSolventId(normalizedInitialQrId);
      setWhich("chemical");
      setChooser(false);
      onInitialQrConsumed?.();
      return;
    }

    toast.error("ไม่พบรายการ stock จาก QR นี้");
    onInitialQrConsumed?.();
  }, [
    normalizedInitialQrId,
    onInitialQrConsumed,
    shouldResolveInitialQr,
    scannedUnit,
    scannedUnitFetched,
    resolvedDeductions,
    resolvedDeductionsFetched,
    solvents,
    solventsFetched,
    queryClient,
  ]);

  const refreshStandards = () => {
    queryClient.invalidateQueries({ queryKey: ["stock", "pending-deductions"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "units"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };

  const openChooser = (target: "chemical" | "standard") => {
    setInitialStandardQrId(null);
    setInitialSolventId(null);
    setWhich(target);
    setChooser(false);
  };

  return (
    <>
      <Popover open={chooser} onOpenChange={setChooser}>
        <PopoverTrigger asChild>
          <Button><Plus className="mr-1 h-4 w-4" /> เบิก stock</Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="end">
          <p className="mb-2 px-1 text-xs text-muted-foreground">เบิกอะไร?</p>
          <div className="grid gap-1">
            <Button variant="ghost" className="justify-start" onClick={() => openChooser("chemical")}>
              <FlaskConical className="mr-2 h-4 w-4" /> สารเคมี (solvent)
            </Button>
            <Button variant="ghost" className="justify-start" onClick={() => openChooser("standard")}>
              <Package className="mr-2 h-4 w-4" /> Standard
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {which === "chemical" && (
        <ChemicalRequisitionDialog
          roomSlug={roomSlug}
          instruments={instruments}
          initialSolventId={initialSolventId}
          onClose={() => {
            setWhich(null);
            setInitialSolventId(null);
          }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["stock", "pending-deductions"] });
            queryClient.invalidateQueries({ queryKey: ["chemical-requisitions"] });
            queryClient.invalidateQueries({ queryKey: ["stock", "solvents"] });
            queryClient.invalidateQueries({ queryKey: ["stock", "units"] });
            queryClient.invalidateQueries({ queryKey: ["stock", "transactions"] });
          }}
        />
      )}
      {which === "standard" && (
        <StandardRequisitionDialog
          initialQrId={initialStandardQrId}
          onClose={() => {
            setWhich(null);
            setInitialStandardQrId(null);
          }}
          onSaved={refreshStandards}
        />
      )}
    </>
  );
}
