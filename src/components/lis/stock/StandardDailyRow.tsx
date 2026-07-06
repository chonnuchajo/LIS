// src/components/lis/stock/StandardDailyRow.tsx
// 1 แถวของ "Standard ที่แบ่งวันนี้" — แยก ข้อมูล / สถานะ / ปุ่มกด ให้ชัด
import { FlaskConical, MoreVertical, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { splitTimeLabel, standardStatusMeta } from "@/lib/standardStatus";
import { workingUsability } from "@/lib/stockUnit";
import { cn } from "@/lib/utils";
import type { StockUnitItem } from "@/types/stock";

interface Props {
  unit: StockUnitItem;
  onDiscard: (qrId: string) => void;
  onDetail: (qrId: string) => void;
}

export default function StandardDailyRow({ unit, onDiscard, onDetail }: Props) {
  const meta = standardStatusMeta(unit);
  const isDiscarded = workingUsability(unit) === "discarded";
  const label = splitTimeLabel(unit);

  const discardBtn = (className?: string) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive",
        className,
      )}
      onClick={() => onDiscard(unit.qrId)}
    >
      <Trash2 className="mr-1.5 h-4 w-4" /> แจ้งทิ้ง
    </Button>
  );

  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-start gap-3">
        {/* ไอคอน */}
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FlaskConical className="h-4 w-4" />
        </div>

        {/* ข้อมูล */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-medium">{unit.itemName}</span>
            <Badge className={cn("shrink-0 text-xs font-medium", meta.cls)}>{meta.label}</Badge>
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">
              {unit.volume?.remaining ?? "-"} {unit.volume?.unit}
            </span>
            {label && <> · {label}</>}
          </div>
        </div>

        {/* ปุ่มขวา: desktop = แจ้งทิ้ง + ⋮ / mobile = ⋮ อย่างเดียว */}
        <div className="flex shrink-0 items-center gap-1.5">
          {!isDiscarded && discardBtn("hidden sm:inline-flex")}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onDetail(unit.qrId)}>ดูรายละเอียด</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* mobile: ปุ่มแจ้งทิ้งเต็มความกว้าง */}
      {!isDiscarded && discardBtn("mt-3 w-full sm:hidden")}
    </div>
  );
}
