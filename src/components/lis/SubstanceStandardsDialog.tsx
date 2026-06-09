import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Search } from "lucide-react";
import { api, type ParameterValueField, type SubstanceStandard, type StandardOperator } from "@/lib/api";
import { parseSubstances, extractSubstanceName, matchSubstanceKey } from "@/lib/substances";
import { OPERATOR_OPTIONS, describeSubstanceStandard } from "@/lib/standardOperators";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";

const COMMON_NAME_KEYS = ["common_name", "commonname", "commonName", "item_name2", "itemType"];
const ITEM_NAME_KEYS = ["item_name", "itemname", "itemName", "description", "item_desc"];

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

type Props = {
  open: boolean;
  field: ParameterValueField;
  onClose: () => void;
  onSave: (next: SubstanceStandard[]) => void;
};

export function SubstanceStandardsDialog({ open, field, onClose, onSave }: Props) {
  const unit = field.unit ? ` ${field.unit}` : "";
  const [list, setList] = useState<SubstanceStandard[]>(field.substanceStandards ?? []);
  const [search, setSearch] = useState("");
  const [manual, setManual] = useState("");

  // reseed รายการทุกครั้งที่เปิด dialog (component คงอยู่ในหน้า ไม่ remount)
  useEffect(() => {
    if (open) {
      setList(field.substanceStandards ?? []);
      setSearch("");
      setManual("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: masterRows = [] } = useQuery<Record<string, unknown>[]>({
    queryKey: ["master-items"],
    queryFn: async () => {
      // api.get wraps the response as { data: { data: rawJson } } — unwrap both
      // levels. Key is shared with MasterItems/ParameterSettings; a non-array here
      // would poison the shared cache and crash those pages' .map/.filter.
      const res = await api.get<Record<string, unknown>[]>("/master-items");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
    enabled: open,
  });

  const { data: groups = [] } = useQuery<{ _id: string; name: string; commonNames?: string[] }[]>({
    queryKey: ["item-groups"],
    queryFn: async () => {
      // api.get wraps the response as { data: { data: rawJson } } — must unwrap
      // both levels. This key is shared with ParameterSettings/MasterItems/etc;
      // returning a non-array here would poison the shared cache for them.
      const res = await api.get<{ _id: string; name: string; commonNames?: string[] }[]>("/item-groups");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
    enabled: open,
  });

  // กัน white-screen: ["master-items"]/["item-groups"] เป็น query key ที่ใช้ร่วม
  // หลายหน้า ถ้ามี component อื่นเขียน cache เป็น non-array จะ crash ที่ .map/.filter
  // — coerce เป็น array ก่อนใช้เสมอ
  const safeRows = Array.isArray(masterRows) ? masterRows : [];
  const safeGroups = Array.isArray(groups) ? groups : [];

  const byCommonName = useMemo(
    () => buildSubstances(safeRows.map((r) => pickField(r, COMMON_NAME_KEYS)).filter(Boolean)),
    [safeRows],
  );
  const byName = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? safeRows.filter((r) => pickField(r, ITEM_NAME_KEYS).toLowerCase().includes(q))
      : safeRows;
    return buildSubstances(rows.map((r) => pickField(r, COMMON_NAME_KEYS)).filter(Boolean));
  }, [safeRows, search]);

  const selectedKeys = useMemo(() => new Set(list.map((s) => matchSubstanceKey(s.substance))), [list]);

  const addSubstance = (name: string) => {
    const key = matchSubstanceKey(name);
    if (!key || selectedKeys.has(key)) return;
    setList((prev) => [...prev, { substance: name, operator: "gte", value: null, value2: null }]);
  };
  const removeAt = (i: number) => setList((prev) => prev.filter((_, idx) => idx !== i));
  const patchAt = (i: number, patch: Partial<SubstanceStandard>) =>
    setList((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const filterBox = (
    <div className="relative mb-2">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา..." className="h-9 pl-8" />
    </div>
  );

  const pickList = (names: string[]) => (
    <div className="max-h-56 overflow-y-auto rounded border divide-y">
      {names.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">ไม่พบสาร</p>
      ) : (
        names.map((name) => {
          const picked = selectedKeys.has(matchSubstanceKey(name));
          return (
            <button
              key={name}
              type="button"
              disabled={picked}
              onClick={() => addSubstance(name)}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-40"
            >
              <span className="truncate">{name}</span>
              {!picked && <Plus className="h-4 w-4 text-primary shrink-0" />}
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>ตั้งเงื่อนไขรายสาร — {field.label}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="text-sm mb-1.5 block">เลือกสาร</Label>
            <Tabs defaultValue="common">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="common">commonName</TabsTrigger>
                <TabsTrigger value="name">ชื่อ</TabsTrigger>
                <TabsTrigger value="group">กลุ่ม</TabsTrigger>
              </TabsList>
              <TabsContent value="common">{pickList(byCommonName)}</TabsContent>
              <TabsContent value="name">
                {filterBox}
                {pickList(byName)}
              </TabsContent>
              <TabsContent value="group">
                <div className="max-h-56 overflow-y-auto rounded border divide-y">
                  {safeGroups.map((g) => {
                    const subs = buildSubstances(g.commonNames ?? []);
                    const allAdded = subs.length > 0 && subs.every((n) => selectedKeys.has(matchSubstanceKey(n)));
                    return (
                      <button
                        key={g._id}
                        type="button"
                        disabled={subs.length === 0 || allAdded}
                        onClick={() => subs.forEach(addSubstance)}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-40"
                      >
                        <span className="truncate">{g.name}</span>
                        {!allAdded && subs.length > 0 && <Plus className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
            <div className="mt-2 flex gap-2">
              <Input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addSubstance(manual); setManual(""); }
                }}
                placeholder="พิมพ์ชื่อสารเพิ่มเอง แล้ว Enter"
                className="h-9"
              />
              <Button type="button" variant="outline" className="h-9" onClick={() => { addSubstance(manual); setManual(""); }}>
                เพิ่ม
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-sm mb-1.5 block">เกณฑ์ต่อสาร ({list.length})</Label>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground">ยังไม่ได้เลือกสาร</p>
              ) : (
                list.map((std, i) => (
                  <div key={matchSubstanceKey(std.substance)} className="rounded border p-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{std.substance}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeAt(i)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={std.operator}
                        onValueChange={(v) => patchAt(i, { operator: v as StandardOperator })}
                      >
                        <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {OPERATOR_OPTIONS.filter((o) => o.value !== "none").map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={std.value ?? ""}
                        onChange={(e) => patchAt(i, { value: e.target.value === "" || !Number.isFinite(Number(e.target.value)) ? null : Number(e.target.value) })}
                        placeholder={std.operator === "tolerance" ? "ค่ามาตรฐาน" : std.operator === "between" ? "ตั้งแต่" : "ค่า"}
                        className="h-8 w-24"
                      />
                      {(std.operator === "between" || std.operator === "tolerance") && (
                        <Input
                          type="number"
                          value={std.value2 ?? ""}
                          onChange={(e) => patchAt(i, { value2: e.target.value === "" || !Number.isFinite(Number(e.target.value)) ? null : Number(e.target.value) })}
                          placeholder={std.operator === "tolerance" ? "± %" : "ถึง"}
                          className="h-8 w-24"
                        />
                      )}
                      <span className="text-xs text-emerald-700">{describeSubstanceStandard(std, unit.trim())}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button type="button" variant="primary" onClick={() => { onSave(list); onClose(); }}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
