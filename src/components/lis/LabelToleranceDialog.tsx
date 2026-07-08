import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Search } from "lucide-react";
import { api, type ParameterValueField, type LabelToleranceStandard } from "@/lib/api";
import { parseSubstances, extractSubstanceName, matchSubstanceKey } from "@/lib/substances";
import { tradeNameKeys } from "@/lib/masterItemFields";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const COMMON_NAME_KEYS = ["common_name", "commonname", "commonName", "item_name2", "itemType"];
function pickField(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row?.[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}
function buildSubstances(commonNames: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const cn of commonNames) {
    for (const raw of parseSubstances(cn)) {
      const name = extractSubstanceName(raw) || raw;
      const key = matchSubstanceKey(name);
      if (key && !byKey.has(key)) byKey.set(key, name);
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, ["th", "en"]));
}
function buildCommonNameOptions(commonNames: string[]): string[] {
  return [...new Set(commonNames.map((v) => String(v).trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, ["th", "en"]));
}
function previewLine(std: LabelToleranceStandard): string {
  if (std.autoPct == null) return "";
  const c = 1; // ตัวอย่างฉลาก 1%
  const a = c * (std.autoPct / 100);
  const h = std.headPct != null ? c * (std.headPct / 100) : a;
  const auto = `ผ่าน ${(c - a).toFixed(3)}–${(c + a).toFixed(3)}`;
  const head = std.headPct != null ? ` · หัวหน้าถึง ${(c - h).toFixed(3)}–${(c + h).toFixed(3)}` : "";
  return `ตัวอย่างฉลาก 1% → ${auto}${head}`;
}
function isRowInvalid(std: LabelToleranceStandard): boolean {
  return std.autoPct == null || std.autoPct <= 0 || (std.headPct != null && std.headPct < std.autoPct);
}

type Props = {
  open: boolean;
  field: ParameterValueField;
  onClose: () => void;
  onSave: (next: LabelToleranceStandard[]) => void;
};

export function LabelToleranceDialog({ open, field, onClose, onSave }: Props) {
  const unit = field.unit ? ` ${field.unit}` : "";
  const [list, setList] = useState<LabelToleranceStandard[]>(field.labelToleranceStandards ?? []);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) { setList(field.labelToleranceStandards ?? []); setSearch(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: masterRows = [] } = useQuery<Record<string, unknown>[]>({
    queryKey: ["master-items"],
    queryFn: async () => {
      const res = await api.get<Record<string, unknown>[]>("/master-items");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
    enabled: open,
  });
  const { data: groups = [] } = useQuery<{ _id: string; name: string; commonNames?: string[] }[]>({
    queryKey: ["item-groups"],
    queryFn: async () => {
      const res = await api.get<{ _id: string; name: string; commonNames?: string[] }[]>("/item-groups");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
    enabled: open,
  });
  const safeRows = Array.isArray(masterRows) ? masterRows : [];
  const safeGroups = Array.isArray(groups) ? groups : [];

  const commonNameOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const commonNames = safeRows
      .map((row) => pickField(row, COMMON_NAME_KEYS))
      .filter((cn) => !q || cn.toLowerCase().includes(q));
    return buildCommonNameOptions(commonNames);
  }, [safeRows, search]);

  const tradeNameOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byTrade = new Map<string, Set<string>>();
    for (const row of safeRows) {
      const tradeName = pickField(row, tradeNameKeys);
      if (!tradeName) continue;
      const cn = pickField(row, COMMON_NAME_KEYS);
      if (!byTrade.has(tradeName)) byTrade.set(tradeName, new Set());
      if (cn) byTrade.get(tradeName)!.add(cn);
    }
    return [...byTrade.entries()]
      .filter(([t]) => !q || t.toLowerCase().includes(q))
      .map(([tradeName, cns]) => ({ tradeName, substances: buildSubstances([...cns]) }))
      .sort((a, b) => a.tradeName.localeCompare(b.tradeName, ["th", "en"]));
  }, [safeRows, search]);

  const selectedKeys = useMemo(() => new Set(list.map((s) => matchSubstanceKey(s.substance))), [list]);
  const hasInvalid = useMemo(() => list.some(isRowInvalid), [list]);
  const addSubstance = (name: string) => {
    const key = matchSubstanceKey(name);
    if (!key || selectedKeys.has(key)) return;
    setList((prev) => [...prev, { substance: name, autoPct: null, headPct: null }]);
  };
  const removeAt = (i: number) => setList((prev) => prev.filter((_, idx) => idx !== i));
  const patchAt = (i: number, patch: Partial<LabelToleranceStandard>) =>
    setList((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const filterBox = (
    <div className="relative mb-2">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา..." className="h-9 pl-8" />
    </div>
  );
  const commonNameList = (names: string[]) => (
    <div className="max-h-[30rem] overflow-y-auto rounded border divide-y">
      {names.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">ไม่พบ common name</p>
      ) : names.map((cn) => {
        const subs = buildSubstances([cn]);
        const allAdded = subs.length > 0 && subs.every((n) => selectedKeys.has(matchSubstanceKey(n)));
        return (
          <button key={cn} type="button" disabled={subs.length === 0 || allAdded}
            onClick={() => subs.forEach(addSubstance)}
            className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40" title={cn}>
            <div className="min-w-0">
              <div className="break-words font-medium text-foreground">{cn}</div>
              {subs.length > 0 && <div className="mt-1 break-words text-xs text-muted-foreground">สาร: {subs.join(", ")}</div>}
            </div>
            {!allAdded && subs.length > 0 && <Plus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
          </button>
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] sm:w-[95vw] max-w-[1400px] sm:max-w-[1400px] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>ตั้งเกณฑ์ตาม %สาร — {field.label}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            ศูนย์กลางแกะจาก %ในชื่อสารอัตโนมัติ · สารที่ชื่อไม่มี % จะข้ามการตรวจ
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 overflow-hidden md:grid-cols-[1fr_1.6fr]">
          <div>
            <Label className="text-sm mb-1.5 block">เลือกสาร</Label>
            <Tabs defaultValue="common">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="common">commonName</TabsTrigger>
                <TabsTrigger value="group">กลุ่ม</TabsTrigger>
                <TabsTrigger value="trade">trade name</TabsTrigger>
              </TabsList>
              <TabsContent value="common">{filterBox}{commonNameList(commonNameOptions)}</TabsContent>
              <TabsContent value="group">
                <div className="max-h-[30rem] overflow-y-auto rounded border divide-y">
                  {safeGroups.map((g) => {
                    const subs = buildSubstances(g.commonNames ?? []);
                    const allAdded = subs.length > 0 && subs.every((n) => selectedKeys.has(matchSubstanceKey(n)));
                    return (
                      <button key={g._id} type="button" disabled={subs.length === 0 || allAdded}
                        onClick={() => subs.forEach(addSubstance)}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-40">
                        <span className="truncate">{g.name}</span>
                        {!allAdded && subs.length > 0 && <Plus className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </TabsContent>
              <TabsContent value="trade">
                {filterBox}
                <div className="max-h-[30rem] overflow-y-auto rounded border divide-y">
                  {tradeNameOptions.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">ไม่พบ trade name</p>
                  ) : tradeNameOptions.map(({ tradeName, substances }) => {
                    const allAdded = substances.length > 0 && substances.every((n) => selectedKeys.has(matchSubstanceKey(n)));
                    return (
                      <button key={tradeName} type="button" disabled={substances.length === 0 || allAdded}
                        onClick={() => substances.forEach(addSubstance)}
                        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40" title={tradeName}>
                        <div className="min-w-0">
                          <div className="break-words font-medium text-foreground">{tradeName}</div>
                          {substances.length > 0 && <div className="mt-1 break-words text-xs text-muted-foreground">สาร: {substances.join(", ")}</div>}
                        </div>
                        {!allAdded && substances.length > 0 && <Plus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <Label className="text-sm mb-1.5 block">เกณฑ์ต่อสาร ({list.length})</Label>
            <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground">ยังไม่ได้เลือกสาร</p>
              ) : list.map((std, i) => (
                <div key={matchSubstanceKey(std.substance)} className="rounded border p-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{std.substance}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeAt(i)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">±ออโต้</span>
                    <Input type="number" value={std.autoPct ?? ""} placeholder="เช่น 2.5"
                      onChange={(e) => patchAt(i, { autoPct: e.target.value === "" || !Number.isFinite(Number(e.target.value)) ? null : Number(e.target.value) })}
                      className="h-8 w-20" />
                    <span className="text-muted-foreground">% · ±หัวหน้า</span>
                    <Input type="number" value={std.headPct ?? ""} placeholder="เช่น 5"
                      onChange={(e) => patchAt(i, { headPct: e.target.value === "" || !Number.isFinite(Number(e.target.value)) ? null : Number(e.target.value) })}
                      className="h-8 w-20" />
                    <span className="text-muted-foreground">%{unit}</span>
                  </div>
                  <p className="text-xs text-emerald-700">{previewLine(std)}</p>
                  {isRowInvalid(std) && (
                    <p className="text-xs text-red-600">กรอก ±ออโต้ (&gt;0) และ ±หัวหน้า ≥ ±ออโต้</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {hasInvalid && (
          <p className="text-right text-xs text-red-600">กรอก ±ออโต้ (&gt;0) และ ±หัวหน้า ≥ ±ออโต้ ให้ครบทุกสาร</p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button type="button" variant="primary" disabled={hasInvalid} onClick={() => { onSave(list); onClose(); }}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
