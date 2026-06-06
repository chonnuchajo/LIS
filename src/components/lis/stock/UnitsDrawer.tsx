import { X } from "lucide-react";
import type { StockStandardItem } from "@/types/stock";
import StandardUnitsPanel from "./StandardUnitsPanel";

export default function UnitsDrawer({ standard, onClose }: { standard: StockStandardItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <div className="bg-background w-full max-w-2xl h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-background">
          <div>
            <div className="font-bold">{standard.name}</div>
            <div className="text-xs text-muted-foreground">{standard.code} · รายขวด</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4">
          <StandardUnitsPanel standard={standard} />
        </div>
      </div>
    </div>
  );
}
