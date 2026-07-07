// src/components/lis/stock/StockRequisitionButton.tsx
// ปุ่ม "เบิก stock" แบบ persistent (วางใน PageHeader actions) — Popover เลือก สารเคมี/Standard → เปิด dialog เบิก
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Package, Plus } from "lucide-react";

import ChemicalRequisitionDialog from "@/components/lis/daily-check/ChemicalRequisitionDialog";
import StandardRequisitionDialog from "@/components/lis/stock/StandardRequisitionDialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  roomSlug: string;
  instruments: { id: string; name: string; group?: string }[];
}

export default function StockRequisitionButton({ roomSlug, instruments }: Props) {
  const queryClient = useQueryClient();
  const [chooser, setChooser] = useState(false);
  const [which, setWhich] = useState<"chemical" | "standard" | null>(null);

  const refreshStandards = () => {
    queryClient.invalidateQueries({ queryKey: ["stock", "units"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "transactions"] });
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
            <Button variant="ghost" className="justify-start" onClick={() => { setWhich("chemical"); setChooser(false); }}>
              <FlaskConical className="mr-2 h-4 w-4" /> สารเคมี (solvent)
            </Button>
            <Button variant="ghost" className="justify-start" onClick={() => { setWhich("standard"); setChooser(false); }}>
              <Package className="mr-2 h-4 w-4" /> Standard
            </Button>
          </div>
        </PopoverContent>
      </Popover>

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
        <StandardRequisitionDialog instruments={instruments} onClose={() => setWhich(null)} onSaved={refreshStandards} />
      )}
    </>
  );
}
