import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { parseSubstances } from "@/lib/substances";
import SlotEditor from "./SlotEditor";
import type {
  InstrumentConfig,
  MatchType,
  OverrideScope,
  StandardConfigDoc,
  StandardOverrideDoc,
} from "./types";

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

  const { data: configs = [] } = useQuery<StandardConfigDoc[]>({
    queryKey: ["standard-configs"],
    queryFn: () => api.getStandardConfigs(),
  });

  const { data: masterItems = [] } = useQuery<Array<Record<string, unknown>>>({
    queryKey: ["master-items-for-overrides"],
    queryFn: async () => {
      // api.get<T>(path) returns {data:{data: T}}
      const res = await api.get<unknown>("/master-items");
      const payload = res.data.data;
      return Array.isArray(payload) ? (payload as Array<Record<string, unknown>>) : [];
    },
  });

  const [addOpen, setAddOpen] = useState(false);
  const [matchType, setMatchType] = useState<MatchType>("substring");
  const [matchValue, setMatchValue] = useState("");
  const [scope, setScope] = useState<OverrideScope>("substanceOnly");
  const [priority, setPriority] = useState(0);
  const [note, setNote] = useState("");
  const [gc, setGc] = useState<InstrumentConfig>({ enabled: false, unit: "ml", slots: [] });
  const [hplc, setHplc] = useState<InstrumentConfig>({ enabled: false, unit: "ml", slots: [] });

  const commonNames = useMemo(() => {
    const keys = ["common_name", "commonname", "commonName", "item_name2", "itemType"];
    const set = new Set<string>();
    for (const item of masterItems) {
      for (const k of keys) {
        const v = item[k];
        if (v !== undefined && v !== null && String(v).trim()) {
          set.add(String(v).trim());
          break;
        }
      }
    }
    return [...set].sort();
  }, [masterItems]);

  const preview = useMemo(() => {
    if (!matchValue.trim()) return [];
    const needle = matchValue.trim().toLowerCase();
    const hits: { commonName: string; substanceIndex: number }[] = [];
    for (const cn of commonNames) {
      const substances = parseSubstances(cn);
      if (matchType === "commonName") {
        if (cn.toLowerCase() === needle) hits.push({ commonName: cn, substanceIndex: 0 });
      } else if (matchType === "substring") {
        if (cn.toLowerCase().includes(needle)) hits.push({ commonName: cn, substanceIndex: 0 });
      } else {
        substances.forEach((sub, i) => {
          if (sub.trim().toLowerCase() === needle) hits.push({ commonName: cn, substanceIndex: i });
        });
      }
      if (hits.length >= 200) break;
    }
    return hits;
  }, [matchValue, matchType, commonNames]);

  const createMutation = useMutation({
    mutationFn: () =>
      api.createStandardOverride({
        matchType, matchValue: matchValue.trim(), scope, priority, note, gc, hplc,
      }),
    onSuccess: () => {
      toast.success("เพิ่ม override rule สำเร็จ");
      setAddOpen(false);
      setMatchValue(""); setNote(""); setPriority(0);
      setGc({ enabled: false, unit: "ml", slots: [] });
      setHplc({ enabled: false, unit: "ml", slots: [] });
      queryClient.invalidateQueries({ queryKey: ["standard-overrides"] });
    },
    onError: (err: Error) => toast.error(err.message),
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
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> เพิ่ม Override Rule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>เพิ่ม Override Rule</DialogTitle></DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <Label className="text-sm">Match type</Label>
                <RadioGroup value={matchType} onValueChange={(v) => setMatchType(v as MatchType)} className="flex gap-4 mt-1">
                  <label className="flex items-center gap-1 text-sm"><RadioGroupItem value="substring" /> Substring</label>
                  <label className="flex items-center gap-1 text-sm"><RadioGroupItem value="substance" /> Substance</label>
                  <label className="flex items-center gap-1 text-sm"><RadioGroupItem value="commonName" /> CommonName</label>
                </RadioGroup>
              </div>
              <div>
                <Label htmlFor="match-value" className="text-sm">Match value</Label>
                {matchType === "substring" ? (
                  <Input id="match-value" value={matchValue} onChange={(e) => setMatchValue(e.target.value)} />
                ) : matchType === "substance" ? (
                  <Select value={matchValue} onValueChange={setMatchValue}>
                    <SelectTrigger><SelectValue placeholder="เลือก substance" /></SelectTrigger>
                    <SelectContent>
                      {configs.map((c) => (<SelectItem key={c._id} value={c.name}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={matchValue} onValueChange={setMatchValue}>
                    <SelectTrigger><SelectValue placeholder="เลือก commonName" /></SelectTrigger>
                    <SelectContent>
                      {commonNames.map((cn) => (<SelectItem key={cn} value={cn}>{cn}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label className="text-sm">Scope</Label>
                <RadioGroup
                  value={scope}
                  onValueChange={(v) => setScope(v as OverrideScope)}
                  className="flex gap-4 mt-1"
                >
                  <label className={`flex items-center gap-1 text-sm ${matchType === "commonName" ? "opacity-40" : ""}`}>
                    <RadioGroupItem value="substanceOnly" disabled={matchType === "commonName"} />
                    เฉพาะ substance ที่ match
                  </label>
                  <label className="flex items-center gap-1 text-sm">
                    <RadioGroupItem value="wholeCommonName" /> ทั้ง commonName
                  </label>
                </RadioGroup>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="priority" className="text-sm">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="note" className="text-sm">Note</Label>
                  <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              </div>
              <SlotEditor label="GC" value={gc} onChange={setGc} />
              <SlotEditor label="HPLC" value={hplc} onChange={setHplc} />
              {matchValue.trim() && (
                <div className="rounded border bg-muted/40 p-2 text-xs">
                  <div className="font-medium mb-1">จะกระทบ commonName เหล่านี้ ({preview.length} รายการ):</div>
                  {preview.length === 0 ? (
                    <div className="text-muted-foreground">ไม่ match commonName ใดๆ</div>
                  ) : (
                    <ul className="space-y-0.5">
                      {preview.slice(0, 5).map((h, i) => (
                        <li key={i}>· {h.commonName} (substance #{h.substanceIndex + 1})</li>
                      ))}
                      {preview.length > 5 && (
                        <li className="text-muted-foreground">… และอีก {preview.length - 5}</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddOpen(false)}>ยกเลิก</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!matchValue.trim() || createMutation.isPending}
              >
                บันทึก
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
