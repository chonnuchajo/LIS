// src/components/lis/stock/StandardUnitList.tsx
// list working standard rows + ถือ dialog แจ้งทิ้ง/ดูรายละเอียด — ใช้ร่วมการ์ดวันนี้ + แท็บ Standard ใช้งานอยู่
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import PerformanceDropDialog from "@/components/lis/stock/PerformanceDropDialog";
import StandardDailyRow from "@/components/lis/stock/StandardDailyRow";
import StandardUnitDetailDialog from "@/components/lis/stock/StandardUnitDetailDialog";
import type { StockUnitItem } from "@/types/stock";

interface Props {
  units: StockUnitItem[];
}

export default function StandardUnitList({ units }: Props) {
  const qc = useQueryClient();
  const [discardQr, setDiscardQr] = useState("");
  const [detailQr, setDetailQr] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stock", "units"] });
    qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };

  return (
    <div className="space-y-2">
      {units.map((u) => (
        <StandardDailyRow key={u._id} unit={u} onDiscard={setDiscardQr} onDetail={setDetailQr} />
      ))}

      {discardQr && (
        <PerformanceDropDialog qrId={discardQr} onClose={() => setDiscardQr("")} onSaved={refresh} />
      )}
      {detailQr && (
        <StandardUnitDetailDialog qrId={detailQr} onClose={() => setDetailQr("")} />
      )}
    </div>
  );
}
