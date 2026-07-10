import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Plus, Search, Trash2 } from "lucide-react";
import { api, type ParameterValueField, type StandardOperator, type SubstanceStandard } from "@/lib/api";
import { tradeNameKeys } from "@/lib/masterItemFields";
import { OPERATOR_OPTIONS } from "@/lib/standardOperators";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";

const COMMON_NAME_KEYS = ["common_name", "commonname", "commonName", "item_name2", "itemType"];
const PICKER_CATEGORY_OPTIONS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "RM", label: "RM" },
  { value: "FG", label: "FG" },
  { value: "other", label: "อื่นๆ" },
] as const;

type PickerCategory = (typeof PICKER_CATEGORY_OPTIONS)[number]["value"];

type Props = {
  open: boolean;
  field: ParameterValueField;
  onClose: () => void;
  onSave: (next: SubstanceStandard[]) => void;
};

type EditableSubstanceStandard = SubstanceStandard & { headOnly?: boolean };

function pickField(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row?.[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function standardKey(value: string): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function buildCommonNameOptions(commonNames: string[]): string[] {
  return [...new Set(commonNames.map((v) => String(v).trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, ["th", "en"]));
}

function readRowCategories(row: Record<string, unknown>): ("RM" | "FG")[] {
  const raw = String(
    row.inventory_posting_group ??
      row.category ??
      row.type ??
      row.group ??
      row.itemGroup ??
      row.item_group ??
      "",
  ).toUpperCase();
  const tokens = raw.split(/[^A-Z0-9]+/).filter(Boolean);
  const categories: ("RM" | "FG")[] = [];
  if (raw === "RM" || tokens.includes("RM") || raw.includes("RAW MATERIAL")) categories.push("RM");
  if (raw === "FG" || tokens.includes("FG") || raw.includes("FINISHED GOOD")) categories.push("FG");
  return categories;
}

function rowMatchesPickerCategory(row: Record<string, unknown>, category: PickerCategory): boolean {
  if (category === "all") return true;
  const categories = readRowCategories(row);
  if (category === "other") return categories.length === 0;
  return categories.includes(category);
}

export function SubstanceStandardsDialog({ open, field, onClose, onSave }: Props) {
  const [list, setList] = useState<EditableSubstanceStandard[]>(field.substanceStandards ?? []);
  const [pickerCategory, setPickerCategory] = useState<PickerCategory>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setList((field.substanceStandards ?? []) as EditableSubstanceStandard[]);
      setPickerCategory("all");
      setSearch("");
    }
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
  const categoryRows = useMemo(
    () => safeRows.filter((row) => rowMatchesPickerCategory(row, pickerCategory)),
    [safeRows, pickerCategory],
  );
  const categoryCommonNameKeys = useMemo(
    () => new Set(categoryRows.map((row) => standardKey(pickField(row, COMMON_NAME_KEYS))).filter(Boolean)),
    [categoryRows],
  );

  const commonNameOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const commonNames = categoryRows
      .map((row) => pickField(row, COMMON_NAME_KEYS))
      .filter((commonName) => !q || commonName.toLowerCase().includes(q));
    return buildCommonNameOptions(commonNames);
  }, [categoryRows, search]);

  const tradeNameOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byTrade = new Map<string, Set<string>>();
    for (const row of categoryRows) {
      const tradeName = pickField(row, tradeNameKeys);
      if (!tradeName) continue;
      const commonName = pickField(row, COMMON_NAME_KEYS);
      if (
        q &&
        !tradeName.toLowerCase().includes(q) &&
        !commonName.toLowerCase().includes(q)
      ) {
        continue;
      }
      if (!byTrade.has(tradeName)) byTrade.set(tradeName, new Set());
      if (commonName) byTrade.get(tradeName)!.add(commonName);
    }
    return [...byTrade.entries()]
      .map(([tradeName, commonNames]) => ({ tradeName, commonNames: buildCommonNameOptions([...commonNames]) }))
      .sort((a, b) => a.tradeName.localeCompare(b.tradeName, ["th", "en"]));
  }, [categoryRows, search]);

  const filterVisibleGroupCommonNames = (commonNames: string[] = [], groupName = "") => {
    const q = search.trim().toLowerCase();
    const categoryNames =
      pickerCategory === "all"
        ? commonNames
        : commonNames.filter((commonName) => categoryCommonNameKeys.has(standardKey(commonName)));
    if (!q) return categoryNames;
    const groupMatches = groupName.toLowerCase().includes(q);
    return categoryNames.filter((commonName) => groupMatches || commonName.toLowerCase().includes(q));
  };

  const selectedKeys = useMemo(() => new Set(list.map((s) => standardKey(s.substance)).filter(Boolean)), [list]);

  const addStandard = (name: string) => {
    const substance = String(name ?? "").trim();
    const key = standardKey(substance);
    if (!key) return;
    setList((prev) => {
      if (prev.some((std) => standardKey(std.substance) === key)) return prev;
      return [...prev, { substance, operator: "gte", value: null, value2: null, headOnly: false }];
    });
  };

  const removeAt = (i: number) => setList((prev) => prev.filter((_, idx) => idx !== i));
  const cloneAt = (i: number) =>
    setList((prev) => {
      const current = prev[i];
      if (!current) return prev;
      const clone: EditableSubstanceStandard = {
        ...current,
        productTypes: [...(current.productTypes ?? [])],
        regulatoryTypes: [...(current.regulatoryTypes ?? [])],
        categories: [...(current.categories ?? [])],
      };
      return [...prev.slice(0, i + 1), clone, ...prev.slice(i + 1)];
    });
  const patchAt = (i: number, patch: Partial<EditableSubstanceStandard>) =>
    setList((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const commonNameList = (names: string[]) => (
    <div className="max-h-[34rem] overflow-y-auto rounded border divide-y">
      {names.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">ไม่พบ common name</p>
      ) : (
        names.map((commonName) => {
          const picked = selectedKeys.has(standardKey(commonName));
          return (
            <button
              key={commonName}
              type="button"
              disabled={picked}
              onClick={() => addStandard(commonName)}
              className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40"
              title={commonName}
            >
              <span className="min-w-0 break-words font-medium text-foreground">{commonName}</span>
              {!picked && <Plus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
            </button>
          );
        })
      )}
    </div>
  );

  const tradeNameList = (items: { tradeName: string; commonNames: string[] }[]) => (
    <div className="max-h-[34rem] overflow-y-auto rounded border divide-y">
      {items.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">ไม่พบ trade name</p>
      ) : (
        items.map(({ tradeName, commonNames }) => {
          const allAdded = commonNames.length > 0 && commonNames.every((n) => selectedKeys.has(standardKey(n)));
          return (
            <button
              key={tradeName}
              type="button"
              disabled={commonNames.length === 0 || allAdded}
              onClick={() => commonNames.forEach(addStandard)}
              className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40"
              title={tradeName}
            >
              <div className="min-w-0">
                <div className="break-words font-medium text-foreground">{tradeName}</div>
                {commonNames.length > 0 ? (
                  <div className="mt-1 break-words text-xs text-muted-foreground">{commonNames.join(", ")}</div>
                ) : null}
              </div>
              {!allAdded && commonNames.length > 0 && <Plus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] sm:w-[95vw] max-w-[1400px] sm:max-w-[1400px] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>ตั้งเงื่อนไขรายสาร - {field.label}</DialogTitle>
          <DialogDescription className="sr-only">
            เลือกสารจาก master items แล้วตั้งเกณฑ์รายสารสำหรับช่องนี้
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 overflow-hidden md:grid-cols-[1fr_1.6fr]">
          <div>
            <Label className="text-sm mb-1.5 block">เลือกสาร</Label>
            <div className="mb-2">
              <div className="relative">
                <Label htmlFor="substance-picker-search" className="sr-only">ค้นหา</Label>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="substance-picker-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหา..."
                  autoComplete="off"
                  className="h-9 pl-8"
                />
              </div>
            </div>
            <div className="mb-2">
              <Label htmlFor="substance-picker-category" className="sr-only">หมวดหมู่สาร</Label>
              <NativeSelect
                id="substance-picker-category"
                value={pickerCategory}
                onChange={(e) => setPickerCategory(e.target.value as PickerCategory)}
                aria-label="หมวดหมู่สาร"
                className="h-9"
              >
                {PICKER_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Tabs defaultValue="common">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="common">commonName</TabsTrigger>
                <TabsTrigger value="group">กลุ่ม</TabsTrigger>
                <TabsTrigger value="trade">trade name</TabsTrigger>
              </TabsList>
              <TabsContent value="common">
                {commonNameList(commonNameOptions)}
              </TabsContent>
              <TabsContent value="group">
                <div className="max-h-[34rem] overflow-y-auto rounded border divide-y">
                  {safeGroups.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">ไม่พบกลุ่ม</p>
                  ) : (
                    safeGroups.map((g) => {
                      const commonNames = buildCommonNameOptions(filterVisibleGroupCommonNames(g.commonNames ?? [], g.name));
                      const allAdded = commonNames.length > 0 && commonNames.every((n) => selectedKeys.has(standardKey(n)));
                      return (
                        <button
                          key={g._id}
                          type="button"
                          disabled={commonNames.length === 0 || allAdded}
                          onClick={() => commonNames.forEach(addStandard)}
                          className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-40"
                        >
                          <span className="truncate">{g.name}</span>
                          {!allAdded && commonNames.length > 0 && <Plus className="h-4 w-4 text-primary shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </TabsContent>
              <TabsContent value="trade">
                {tradeNameList(tradeNameOptions)}
              </TabsContent>
            </Tabs>
          </div>

          <div className="min-w-0">
            <Label className="text-sm mb-1.5 block">
              เกณฑ์ต่อสาร ({list.length})
              {field.unit ? (
                <span className="font-normal text-muted-foreground"> · หน่วย: {field.unit}</span>
              ) : null}
            </Label>
            <div className="max-h-[34rem] space-y-1 overflow-y-auto pr-1">
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground">ยังไม่ได้เลือกสาร</p>
              ) : (
                list.map((std, i) => (
                  <div
                    key={`${standardKey(std.substance)}-${i}`}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border px-2 py-1.5"
                  >
                    <span
                      className="min-w-0 flex-1 basis-40 truncate text-sm font-medium"
                      title={std.substance}
                    >
                      {std.substance}
                    </span>
                    <NativeSelect
                      aria-label={`เงื่อนไข ${std.substance}`}
                      value={std.operator}
                      onChange={(e) => patchAt(i, { operator: e.target.value as StandardOperator })}
                      className="h-8 w-44 px-2 py-1"
                    >
                      {OPERATOR_OPTIONS.filter((o) => o.value !== "none").map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </NativeSelect>
                    <Input
                      type="number"
                      aria-label={`ค่า ${std.substance}`}
                      value={std.value ?? ""}
                      onChange={(e) => patchAt(i, { value: e.target.value === "" || !Number.isFinite(Number(e.target.value)) ? null : Number(e.target.value) })}
                      placeholder={std.operator === "tolerance" ? "ค่ามาตรฐาน" : std.operator === "between" ? "ตั้งแต่" : "ค่า"}
                      className="h-8 w-24"
                    />
                    {(std.operator === "between" || std.operator === "tolerance") && (
                      <Input
                        type="number"
                        aria-label={`ค่าที่สอง ${std.substance}`}
                        value={std.value2 ?? ""}
                        onChange={(e) => patchAt(i, { value2: e.target.value === "" || !Number.isFinite(Number(e.target.value)) ? null : Number(e.target.value) })}
                        placeholder={std.operator === "tolerance" ? "+/- %" : "ถึง"}
                        className="h-8 w-24"
                      />
                    )}
                    <label
                      className="flex items-center gap-1 text-xs text-amber-700"
                      title="ให้หัวหน้า QC พิจารณาเท่านั้น"
                    >
                      <input
                        type="checkbox"
                        aria-label={`หน.QC ${std.substance}`}
                        checked={std.headOnly === true}
                        onChange={(e) => patchAt(i, { headOnly: e.target.checked })}
                      />
                      หน.QC
                    </label>
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => cloneAt(i)}
                        title="คัดลอกกฎนี้"
                        aria-label={`คัดลอก ${std.substance}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeAt(i)}
                        title="ลบ"
                        aria-label={`ลบ ${std.substance}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              onSave(list as SubstanceStandard[]);
              onClose();
            }}
          >
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
