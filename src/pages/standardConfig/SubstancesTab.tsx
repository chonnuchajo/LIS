import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import SlotEditor from "./SlotEditor";
import type { InstrumentConfig, StandardConfigDoc } from "./types";

export default function SubstancesTab() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery<StandardConfigDoc[]>({
    queryKey: ["standard-configs"],
    queryFn: () => api.getStandardConfigs(),
  });

  // Optimistic local cache for in-flight edits
  const [pending, setPending] = useState<Record<string, Partial<StandardConfigDoc>>>({});

  const mutation = useMutation({
    mutationFn: ({ nameLower, patch }: { nameLower: string; patch: Partial<StandardConfigDoc> }) =>
      api.updateStandardConfig(nameLower, patch),
    onSuccess: (_data, vars) => {
      setPending((p) => {
        const next = { ...p };
        delete next[vars.nameLower];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["standard-configs"] });
    },
    onError: (err: Error, vars) => {
      toast.error(`บันทึก ${vars.nameLower} ไม่สำเร็จ — ${err.message}`);
      setPending((p) => {
        const next = { ...p };
        delete next[vars.nameLower];
        return next;
      });
    },
  });

  const rows = useMemo<StandardConfigDoc[]>(() => {
    return data.map((row) => ({ ...row, ...(pending[row.nameLower] || {}) }));
  }, [data, pending]);

  const handleInstrumentChange = (
    row: StandardConfigDoc,
    field: "gc" | "hplc",
    next: InstrumentConfig,
  ) => {
    const patch = { gc: row.gc, hplc: row.hplc, [field]: next };
    setPending((p) => ({ ...p, [row.nameLower]: patch }));
    mutation.mutate({ nameLower: row.nameLower, patch });
  };

  if (isLoading) return <div className="py-8 text-sm text-muted-foreground">โหลด...</div>;

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[260px]">Standard</TableHead>
              <TableHead className="w-[120px]">Source</TableHead>
              <TableHead>GC</TableHead>
              <TableHead>HPLC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                  ยังไม่มี standard — กด Sync จาก Master เพื่อเริ่ม
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row._id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    <Badge variant={row.isManual ? "secondary" : "outline"}>
                      {row.isManual ? "manual" : "master"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <SlotEditor
                      label="GC"
                      value={row.gc}
                      onChange={(next) => handleInstrumentChange(row, "gc", next)}
                    />
                  </TableCell>
                  <TableCell>
                    <SlotEditor
                      label="HPLC"
                      value={row.hplc}
                      onChange={(next) => handleInstrumentChange(row, "hplc", next)}
                    />
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
