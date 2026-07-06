import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Package, Plus } from "lucide-react";

import ChemicalRequisitionDialog from "@/components/lis/daily-check/ChemicalRequisitionDialog";
import ChemicalRequisitionPanel from "@/components/lis/ChemicalRequisitionPanel";
import StandardRequisitionDialog from "@/components/lis/stock/StandardRequisitionDialog";
import StandardDailyPanel from "@/components/lis/stock/StandardDailyPanel";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  roomSlug: string;
  instruments: { id: string; name: string }[];
  /** ปุ่ม "ดูรายการ Standard ทั้งหมด" → แท็บประวัติ filter standard */
  onViewAllStandards: () => void;
}

export default function StockRequisitionTab({ roomSlug, instruments, onViewAllStandards }: Props) {
  const queryClient = useQueryClient();
  const [chooser, setChooser] = useState(false);
  const [which, setWhich] = useState<"chemical" | "standard" | null>(null);

  const refreshStandards = () => {
    queryClient.invalidateQueries({ queryKey: ["stock", "units"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };

  return (
    <div className="space-y-4">
      <Popover open={chooser} onOpenChange={setChooser}>
        <PopoverTrigger asChild>
          <Button><Plus className="mr-1 h-4 w-4" /> เบิก stock</Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <p className="mb-2 px-1 text-xs text-muted-foreground">เบิกอะไร?</p>
          <div className="grid gap-1">
            <Button variant="ghost" className="justify-start" onClick={() => { setWhich("chemical"); setChooser(false); }}>
              <FlaskConical className="mr-2 h-4 w-4" /> สารเคมี (solvent)
            </Button>
            <Button variant="ghost" className="justify-start" onClick={() => { setWhich("standard"); setChooser(false); }}>
              <Package className="mr-2 h-4 w-4" /> Standard
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <ChemicalRequisitionPanel roomSlug={roomSlug} />

      <StandardDailyPanel onViewAll={onViewAllStandards} />

      {which === "chemical" && (
        <ChemicalRequisitionDialog
          roomSlug={roomSlug}
          instruments={instruments}
          onClose={() => setWhich(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["chemical-requisitions"] });
            queryClient.invalidateQueries({ queryKey: ["stock", "solvents"] });
            queryClient.invalidateQueries({ queryKey: ["stock", "transactions"] });
          }}
        />
      )}
      {which === "standard" && (
        <StandardRequisitionDialog onClose={() => setWhich(null)} onSaved={refreshStandards} />
      )}
    </div>
  );
}
