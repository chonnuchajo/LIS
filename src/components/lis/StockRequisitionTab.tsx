import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Package, Plus } from "lucide-react";

import ChemicalRequisitionDialog from "@/components/lis/daily-check/ChemicalRequisitionDialog";
import ChemicalRequisitionPanel from "@/components/lis/ChemicalRequisitionPanel";
import StandardRequisitionDialog from "@/components/lis/stock/StandardRequisitionDialog";
import PerformanceDropDialog from "@/components/lis/stock/PerformanceDropDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { todayStr } from "@/lib/chemicalRequisition";

interface Props {
  roomSlug: string;
  instruments: { id: string; name: string }[];
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

export default function StockRequisitionTab({ roomSlug, instruments }: Props) {
  const queryClient = useQueryClient();
  const [chooser, setChooser] = useState(false);
  const [which, setWhich] = useState<"chemical" | "standard" | null>(null);
  const [perfDropQr, setPerfDropQr] = useState("");

  const { data: stdTx = [], refetch } = useQuery({
    queryKey: ["stock", "transactions", "standard-withdraw"],
    queryFn: () => api.getStockTransactions({ action: "withdraw", itemType: "standard", limit: 100 }),
  });
  const today = todayStr();
  const todayStd = stdTx.filter((t) => t.createdAt && new Date(t.createdAt).toLocaleDateString("sv-SE") === today);

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

      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-primary" /> Standard ที่แบ่งวันนี้
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayStd.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีการแบ่งวันนี้</p>
          ) : (
            <ul className="divide-y">
              {todayStd.map((t) => (
                <li key={t._id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="w-12 text-xs tabular-nums text-muted-foreground">{t.createdAt ? fmtTime(t.createdAt) : ""}</span>
                  <span className="font-medium">{t.itemName}</span>
                  {(t.volumeDelta ?? t.delta) != null && (
                    <span className="text-muted-foreground">{Math.abs((t.volumeDelta ?? t.delta)!)} {t.unit}</span>
                  )}
                  {(t.userName || t.userEmail) && <span className="text-xs text-muted-foreground">โดย {t.userName || t.userEmail}</span>}
                  {t.qrId && (
                    <button type="button" className="ml-auto text-xs text-destructive hover:underline" onClick={() => setPerfDropQr(t.qrId!)}>
                      แจ้ง/ทิ้ง
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
        <StandardRequisitionDialog onClose={() => setWhich(null)} onSaved={() => refetch()} />
      )}
      {perfDropQr && (
        <PerformanceDropDialog qrId={perfDropQr} onClose={() => setPerfDropQr("")} onSaved={() => refetch()} />
      )}
    </div>
  );
}
