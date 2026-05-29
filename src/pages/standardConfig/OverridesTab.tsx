import { Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import type { StandardOverrideDoc } from "./types";

function renderSlots(cfg: { enabled: boolean; unit: string; slots: number[] }) {
  if (!cfg.enabled) return <span className="text-xs text-muted-foreground">—</span>;
  if (cfg.slots.length === 0) return <span className="text-xs text-amber-600">⚠ ยังไม่ตั้งค่า</span>;
  return (
    <span className="text-xs">{cfg.slots.length} × [{cfg.slots.join(", ")}] {cfg.unit}</span>
  );
}

export default function OverridesTab() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery<StandardOverrideDoc[]>({
    queryKey: ["standard-overrides"],
    queryFn: () => api.getStandardOverrides(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteStandardOverride(id),
    onSuccess: () => {
      toast.success("ลบ rule สำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["standard-overrides"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <div className="py-8 text-sm text-muted-foreground">โหลด...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {/* Add button comes in next task */}
        <span className="text-xs text-muted-foreground">{data.length} rules</span>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Pri</TableHead>
              <TableHead className="w-[200px]">Match</TableHead>
              <TableHead className="w-[140px]">Scope</TableHead>
              <TableHead>GC</TableHead>
              <TableHead>HPLC</TableHead>
              <TableHead className="w-[140px]">Note</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  ยังไม่มี override rules
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row._id}>
                  <TableCell className="text-xs">{row.priority}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="mr-1 text-xs">{row.matchType}</Badge>
                    <span className="text-xs font-mono">"{row.matchValue}"</span>
                  </TableCell>
                  <TableCell className="text-xs">{row.scope === "wholeCommonName" ? "whole" : "substance"}</TableCell>
                  <TableCell>{renderSlots(row.gc)}</TableCell>
                  <TableCell>{renderSlots(row.hplc)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.note}</TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (!confirm(`ลบ override rule นี้?`)) return;
                        deleteMutation.mutate(row._id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
