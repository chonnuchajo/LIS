import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGc, setNewGc] = useState<InstrumentConfig>({ enabled: false, unit: "ml", slots: [] });
  const [newHplc, setNewHplc] = useState<InstrumentConfig>({ enabled: false, unit: "ml", slots: [] });

  const syncMutation = useMutation({
    mutationFn: () => api.syncStandardConfigs(),
    onSuccess: (result) => {
      toast.success(`Sync เสร็จ — เพิ่ม ${result.added} / อัพเดต ${result.updated}`);
      queryClient.invalidateQueries({ queryKey: ["standard-configs"] });
    },
    onError: (err: Error) => toast.error(`Sync ไม่สำเร็จ — ${err.message}`),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createStandardConfig({
        name: newName.trim(),
        gc: newGc,
        hplc: newHplc,
      }),
    onSuccess: () => {
      toast.success("เพิ่ม standard สำเร็จ");
      setAddOpen(false);
      setNewName("");
      setNewGc({ enabled: false, unit: "ml", slots: [] });
      setNewHplc({ enabled: false, unit: "ml", slots: [] });
      queryClient.invalidateQueries({ queryKey: ["standard-configs"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (nameLower: string) => api.deleteStandardConfig(nameLower),
    onSuccess: () => {
      toast.success("ลบสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["standard-configs"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          Sync จาก Master
        </Button>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> เพิ่ม Standard</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>เพิ่ม Standard</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="new-std-name">ชื่อ Standard</Label>
                <Input id="new-std-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <SlotEditor label="GC" value={newGc} onChange={setNewGc} />
              <SlotEditor label="HPLC" value={newHplc} onChange={setNewHplc} />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddOpen(false)}>ยกเลิก</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim() || createMutation.isPending}
              >
                บันทึก
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[260px]">Standard</TableHead>
              <TableHead className="w-[120px]">Source</TableHead>
              <TableHead>GC</TableHead>
              <TableHead>HPLC</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
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
                  <TableCell>
                    {row.isManual && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (!confirm(`ลบ ${row.name}?`)) return;
                          deleteMutation.mutate(row.nameLower);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
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
