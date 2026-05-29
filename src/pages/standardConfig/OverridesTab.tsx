import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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

type OverrideFormValue = {
  matchType: MatchType;
  matchValue: string;
  scope: OverrideScope;
  priority: number;
  note: string;
  gc: InstrumentConfig;
  hplc: InstrumentConfig;
};

function OverrideForm({
  value, onChange, lockMatchType, configs, commonNames,
}: {
  value: OverrideFormValue;
  onChange: (next: OverrideFormValue) => void;
  lockMatchType: boolean;
  configs: StandardConfigDoc[];
  commonNames: string[];
}) {
  const preview = useMemo(() => {
    if (!value.matchValue.trim()) return [];
    const needle = value.matchValue.trim().toLowerCase();
    const hits: { commonName: string; substanceIndex: number }[] = [];
    for (const cn of commonNames) {
      const substances = parseSubstances(cn);
      if (value.matchType === "commonName") {
        if (cn.toLowerCase() === needle) hits.push({ commonName: cn, substanceIndex: 0 });
      } else if (value.matchType === "substring") {
        if (cn.toLowerCase().includes(needle)) hits.push({ commonName: cn, substanceIndex: 0 });
      } else {
        substances.forEach((sub, i) => {
          if (sub.trim().toLowerCase() === needle) hits.push({ commonName: cn, substanceIndex: i });
        });
      }
      if (hits.length >= 200) break;
    }
    return hits;
  }, [value.matchValue, value.matchType, commonNames]);

  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
      <div>
        <Label className="text-sm">Match type</Label>
        <RadioGroup
          value={value.matchType}
          onValueChange={(v) => onChange({ ...value, matchType: v as MatchType })}
          className="flex gap-4 mt-1"
        >
          {(["substring", "substance", "commonName"] as MatchType[]).map((mt) => (
            <label key={mt} className={`flex items-center gap-1 text-sm ${lockMatchType ? "opacity-40" : ""}`}>
              <RadioGroupItem value={mt} disabled={lockMatchType} /> {mt}
            </label>
          ))}
        </RadioGroup>
        {lockMatchType && (
          <div className="text-xs text-muted-foreground mt-1">
            ไม่สามารถแก้ match type ของ rule ที่มีอยู่ — ลบแล้วสร้างใหม่
          </div>
        )}
      </div>
      <div>
        <Label htmlFor="match-value" className="text-sm">Match value</Label>
        {value.matchType === "substring" ? (
          <Input
            id="match-value"
            value={value.matchValue}
            onChange={(e) => onChange({ ...value, matchValue: e.target.value })}
          />
        ) : value.matchType === "substance" ? (
          <Select value={value.matchValue} onValueChange={(v) => onChange({ ...value, matchValue: v })}>
            <SelectTrigger><SelectValue placeholder="เลือก substance" /></SelectTrigger>
            <SelectContent>
              {configs.map((c) => (<SelectItem key={c._id} value={c.name}>{c.name}</SelectItem>))}
            </SelectContent>
          </Select>
        ) : (
          <Select value={value.matchValue} onValueChange={(v) => onChange({ ...value, matchValue: v })}>
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
          value={value.scope}
          onValueChange={(v) => onChange({ ...value, scope: v as OverrideScope })}
          className="flex gap-4 mt-1"
        >
          <label className={`flex items-center gap-1 text-sm ${value.matchType === "commonName" ? "opacity-40" : ""}`}>
            <RadioGroupItem value="substanceOnly" disabled={value.matchType === "commonName"} />
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
            id="priority" type="number" value={value.priority}
            onChange={(e) => onChange({ ...value, priority: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="note" className="text-sm">Note</Label>
          <Input
            id="note" value={value.note}
            onChange={(e) => onChange({ ...value, note: e.target.value })}
          />
        </div>
      </div>
      <SlotEditor label="GC" value={value.gc} onChange={(gc) => onChange({ ...value, gc })} />
      <SlotEditor label="HPLC" value={value.hplc} onChange={(hplc) => onChange({ ...value, hplc })} />
      {value.matchValue.trim() && (
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
  );
}

function overlaps(a: StandardOverrideDoc, b: { matchType: MatchType; matchValueLower: string }): boolean {
  if (a.matchType === "substring" && b.matchType === "substring") {
    return a.matchValueLower.includes(b.matchValueLower) || b.matchValueLower.includes(a.matchValueLower);
  }
  if (a.matchType === b.matchType) {
    return a.matchValueLower === b.matchValueLower;
  }
  return false;
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
    queryKey: ["master-items"],
    queryFn: async () => {
      // api.get<T>(path) returns {data:{data: T}}
      const res = await api.get<unknown>("/master-items");
      const payload = res.data.data;
      return Array.isArray(payload) ? (payload as Array<Record<string, unknown>>) : [];
    },
  });

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

  // Add dialog state
  const [addOpen, setAddOpen] = useState(false);
  const initialAdd: OverrideFormValue = {
    matchType: "substring",
    matchValue: "",
    scope: "substanceOnly",
    priority: 0,
    note: "",
    gc: { enabled: false, unit: "ml", slots: [] },
    hplc: { enabled: false, unit: "ml", slots: [] },
  };
  const [addValue, setAddValue] = useState<OverrideFormValue>(initialAdd);

  // Edit dialog state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<OverrideFormValue | null>(null);

  const openEdit = (row: StandardOverrideDoc) => {
    setEditingId(row._id);
    setEditValue({
      matchType: row.matchType,
      matchValue: row.matchValue,
      scope: row.scope,
      priority: row.priority,
      note: row.note,
      gc: row.gc,
      hplc: row.hplc,
    });
  };

  const checkConflict = (formValue: OverrideFormValue, excludeId?: string): StandardOverrideDoc | null => {
    const needle = {
      matchType: formValue.matchType,
      matchValueLower: formValue.matchValue.trim().toLowerCase(),
    };
    for (const row of data) {
      if (excludeId && row._id === excludeId) continue;
      if (row.priority !== formValue.priority) continue;
      if (overlaps(row, needle)) return row;
    }
    return null;
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.createStandardOverride({
        matchType: addValue.matchType,
        matchValue: addValue.matchValue.trim(),
        scope: addValue.scope,
        priority: addValue.priority,
        note: addValue.note,
        gc: addValue.gc,
        hplc: addValue.hplc,
      }),
    onSuccess: () => {
      toast.success("เพิ่ม override rule สำเร็จ");
      setAddOpen(false);
      setAddValue(initialAdd);
      queryClient.invalidateQueries({ queryKey: ["standard-overrides"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submitAdd = () => {
    const conflict = checkConflict(addValue);
    if (conflict) {
      const ok = confirm(
        `rule นี้ priority เท่ากับ '${conflict.matchType} ${conflict.matchValue}' — อาจ match ทับกัน. บันทึกต่อ?`,
      );
      if (!ok) return;
    }
    createMutation.mutate();
  };

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingId || !editValue) throw new Error("no edit state");
      return api.updateStandardOverride(editingId, {
        matchValue: editValue.matchValue,
        scope: editValue.scope,
        priority: editValue.priority,
        note: editValue.note,
        gc: editValue.gc,
        hplc: editValue.hplc,
        // matchType intentionally omitted — server ignores it
      });
    },
    onSuccess: () => {
      toast.success("อัพเดต rule สำเร็จ");
      setEditingId(null);
      setEditValue(null);
      queryClient.invalidateQueries({ queryKey: ["standard-overrides"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submitEdit = () => {
    if (!editValue) return;
    const conflict = checkConflict(editValue, editingId ?? undefined);
    if (conflict) {
      const ok = confirm(
        `rule นี้ priority เท่ากับ '${conflict.matchType} ${conflict.matchValue}' — อาจ match ทับกัน. บันทึกต่อ?`,
      );
      if (!ok) return;
    }
    updateMutation.mutate();
  };

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
        <Dialog open={addOpen} onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setAddValue(initialAdd);
        }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> เพิ่ม Override Rule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>เพิ่ม Override Rule</DialogTitle></DialogHeader>
            <OverrideForm
              value={addValue}
              onChange={setAddValue}
              lockMatchType={false}
              configs={configs}
              commonNames={commonNames}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddOpen(false)}>ยกเลิก</Button>
              <Button
                onClick={submitAdd}
                disabled={!addValue.matchValue.trim() || createMutation.isPending}
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
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
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
                    <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TableCell>
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

      <Dialog open={editingId !== null} onOpenChange={(open) => { if (!open) { setEditingId(null); setEditValue(null); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>แก้ Override Rule</DialogTitle></DialogHeader>
          {editValue && (
            <OverrideForm
              value={editValue}
              onChange={setEditValue}
              lockMatchType
              configs={configs}
              commonNames={commonNames}
            />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditingId(null); setEditValue(null); }}>ยกเลิก</Button>
            <Button
              onClick={submitEdit}
              disabled={!editValue?.matchValue.trim() || updateMutation.isPending}
            >
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
