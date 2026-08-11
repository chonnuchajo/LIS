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

interface Props {
  roomSlug: string;
  instruments: { id: string; name: string; group?: string }[];
  initialQrId?: string | null;
  onInitialQrConsumed?: () => void;
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

  const { data: units = [], isFetched: unitsFetched } = useQuery({
    queryKey: ["stock", "units"],
    queryFn: () => api.getStockUnits(),
    enabled: shouldResolveInitialQr,
  });

  const { data: solvents = [], isFetched: solventsFetched } = useQuery({
    queryKey: ["stock", "solvents"],
    queryFn: api.getSolvents,
    enabled: shouldResolveInitialQr,
  });

  useEffect(() => {
    if (!shouldResolveInitialQr || !unitsFetched || !solventsFetched) return;

    consumedQrRef.current = normalizedInitialQrId;
    const matchedUnit = units.find((row) => row.qrId === normalizedInitialQrId);
    if (matchedUnit) {
      setInitialStandardQrId(normalizedInitialQrId);
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
    solvents,
    solventsFetched,
    units,
    unitsFetched,
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
