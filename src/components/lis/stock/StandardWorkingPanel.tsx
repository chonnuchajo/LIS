// src/components/lis/stock/StandardWorkingPanel.tsx
// แท็บ "Standard ใช้งานอยู่" — working standard ทุกตัวที่ยังไม่ทิ้ง + ค้นหา + filter สถานะ → แจ้งทิ้งได้
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Search } from "lucide-react";

import StandardUnitList from "@/components/lis/stock/StandardUnitList";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { activeWorkingUnits, type StandardStatusFilter } from "@/lib/standardStatus";

export default function StandardWorkingPanel() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StandardStatusFilter>("all");

  const { data: units = [], isLoading } = useQuery({
    queryKey: ["stock", "units", "working"],
    queryFn: () => api.getStockUnits({ kind: "working" }),
  });

  const rows = useMemo(
    () => activeWorkingUnits(units, { search, statusFilter }),
    [units, search, statusFilter],
  );
  const hasAny = units.some((u) => u.kind === "working" && u.status !== "discarded");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / code standard"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StandardStatusFilter)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            <SelectItem value="usable">พร้อมใช้งาน</SelectItem>
            <SelectItem value="attention">ต้องจัดการ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isLoading && rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border py-10 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Package className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            {hasAny ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มี Standard ที่กำลังใช้งาน"}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{rows.length} รายการ</p>
          <StandardUnitList units={rows} />
        </>
      )}
    </div>
  );
}
