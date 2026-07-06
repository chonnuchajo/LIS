// src/components/lis/stock/StandardDailyPanel.tsx
// การ์ด "Standard ที่แบ่งวันนี้" — working units ที่แบ่งวันนี้ (5 แถวแรก) + ปุ่มดูทั้งหมด
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Package } from "lucide-react";

import StandardUnitList from "@/components/lis/stock/StandardUnitList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { todayWorkingUnits } from "@/lib/standardStatus";

interface Props {
  /** ปุ่ม "ดูรายการ Standard ทั้งหมด" → แท็บ Standard ใช้งานอยู่ */
  onViewAll: () => void;
}

const PREVIEW_LIMIT = 5;

export default function StandardDailyPanel({ onViewAll }: Props) {
  const { data: units = [] } = useQuery({
    queryKey: ["stock", "units", "working"],
    queryFn: () => api.getStockUnits({ kind: "working" }),
  });

  const today = useMemo(() => todayWorkingUnits(units), [units]);
  const shown = today.slice(0, PREVIEW_LIMIT);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Standard ที่แบ่งวันนี้
          </span>
          {today.length > 0 && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground">
              {today.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {today.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Package className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">ยังไม่มีการแบ่งวันนี้</p>
          </div>
        ) : (
          <div className="space-y-2">
            <StandardUnitList units={shown} />
            {today.length > PREVIEW_LIMIT && (
              <Button variant="ghost" className="w-full text-primary" onClick={onViewAll}>
                ดูรายการ Standard ทั้งหมด ({today.length})
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
