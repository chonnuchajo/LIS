import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, RefreshCw, Search, Trash2 } from "lucide-react";
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
import { useSearchParams } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [errored, setErrored] = useState<Set<string>>(new Set());

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
      setErrored((s) => {
        const n = new Set(s); n.delete(vars.nameLower); return n;
      });
      queryClient.invalidateQueries({ queryKey: ["standard-configs"] });
    },
    onError: (err: Error, vars) => {
      toast.error(`บันทึก ${vars.nameLower} ไม่สำเร็จ — ${err.message}`);
      setErrored((s) => new Set(s).add(vars.nameLower));
      // DO NOT delete from `pending` — keep the local edit visible per spec
    },
  });

  const rows = useMemo<StandardConfigDoc[]>(() => {
    return data.map((row) => ({ ...row, ...(pending[row.nameLower] || {}) }));
  }, [data, pending]);

  const [searchParams, setSearchParams] = useSearchParams();
  const q = (searchParams.get("q") || "").toLowerCase();
  const filter = searchParams.get("filter") || "all"; // all | gc | hplc | unset

  const filteredRows = useMemo(() => {
    return rows
      .filter((r) => (q ? r.nameLower.includes(q) : true))
      .filter((r) => {
        if (filter === "gc") return r.gc.enabled;
        if (filter === "hplc") return r.hplc.enabled;
        if (filter === "unset") return !r.gc.enabled && !r.hplc.enabled;
        return true;
      });
  }, [rows, q, filter]);

  const handleInstrumentChange = (
    row: StandardConfigDoc,
    field: "gc" | "hplc",
    next: InstrumentConfig,
  ) => {
    const patch = { gc: row.gc, hplc: row.hplc, [field]: next };
    setPending((p) => ({ ...p, [row.nameLower]: patch }));
    mutation.mutate({ nameLower: row.nameLower, patch });
  };

  const retry = (row: StandardConfigDoc) => {
    const patch = pending[row.nameLower];
    if (!patch) return;
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
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="ค้นหา..."
              value={searchParams.get("q") || ""}
              onChange={(e) => {
                const next = new URLSearchParams(searchParams);
                if (e.target.value) next.set("q", e.target.value);
                else next.delete("q");
                setSearchParams(next, { replace: true });
              }}
              className="h-8 w-40 pl-7 text-sm"
            />
          </div>
          <Select
            value={filter}
            onValueChange={(v) => {
              const next = new URLSearchParams(searchParams);
              if (v === "all") next.delete("filter");
              else next.set("filter", v);
              setSearchParams(next, { replace: true });
            }}
          >
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="gc">GC enabled</SelectItem>
              <SelectItem value="hplc">HPLC enabled</SelectItem>
              <SelectItem value="unset">ยังไม่ตั้งค่า</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  ยังไม่มี standard — กด Sync จาก Master เพื่อเริ่ม
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow key={row._id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{row.name}</span>
                      {errored.has(row.nameLower) && (
                        <Button size="sm" variant="outline" onClick={() => retry(row)}>ลองอีกครั้ง</Button>
                      )}
                    </div>
                  </TableCell>
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
