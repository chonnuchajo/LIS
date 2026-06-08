import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Archive,
  ChevronDown,
  Database,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import AppLayout from "@/components/lis/AppLayout";
import ItemGroupManagerDialog from "@/components/lis/ItemGroupManagerDialog";
import PageHeader from "@/components/lis/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Textarea } from "@/components/ui/textarea";
import { api, type MachineItem, type ParameterItem, type ItemGroupItem } from "@/lib/api";
import { useItemGroupMembership } from "@/hooks/useItemGroupMembership";
import { parseSubstances } from "@/lib/substances";
import { readSlotMethods, type MethodDoc } from "@/lib/methodRegistry";
import { buildOverrideMap, normalizeCommonName, normalizeKey } from "@/lib/commonNameOverride";
import type { CommonNameOverrideRow } from "@/lib/commonNameOverride";
import {
  classificationTypes,
  getClassification,
  getCommonName,
  productTypeLabels,
} from "@/lib/productClassification";

type MasterItem = Record<string, unknown>;
// A substance slot holds a SET of method codes (an AND-set). A row's assignments
// is one inner array per substance, positional (slot i ↔ substance i).
type MatchType = "contains" | "startsWith" | "endsWith";

type ExclusionRule = {
  _id: string;
  pattern: string;
  matchType: MatchType;
};

// Toggle one method code on/off within a single substance slot (AND-set).
function toggleMethod(slot: string[], code: string): string[] {
  return slot.includes(code) ? slot.filter((c) => c !== code) : [...slot, code];
}

// Replace one substance slot's method-set, preserving positional alignment.
function setSlotMethods(row: string[][], index: number, next: string[]): string[][] {
  const copy = row.map((s) => [...s]);
  if (index >= 0 && index < copy.length) copy[index] = next;
  return copy;
}

const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  contains: "มีคำ",
  startsWith: "ขึ้นต้น",
  endsWith: "ลงท้าย",
};

function matchesExclusion(commonName: string, rule: ExclusionRule): boolean {
  const target = commonName.trim().toLowerCase();
  const needle = rule.pattern.trim().toLowerCase();
  if (!target || !needle) return false;
  switch (rule.matchType) {
    case "startsWith": return target.startsWith(needle);
    case "endsWith": return target.endsWith(needle);
    case "contains":
    default: return target.includes(needle);
  }
}

type SimpleMethodRow = {
  key: string;
  commonName: string;
  substances: string[];
  // positional: assignments[i] is the AND-set of method codes for substance i
  assignments: string[][];
  itemNos: string[];
  rawCommonNames: string[];
  items: MasterItem[];
};

type MasterItemForm = {
  itemCode: string;
  itemName: string;
  itemType: string;
  category: string;
  unit: string;
  status: string;
  description: string;
  requiredInspectionQty: string;
};

const emptyForm: MasterItemForm = {
  itemCode: "",
  itemName: "",
  itemType: "",
  category: "",
  unit: "",
  status: "active",
  description: "",
  requiredInspectionQty: "0",
};

type MasterItemOverride = {
  itemNo: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  category: string;
  unit: string;
  status: string;
  description: string;
  requiredInspectionQty: number;
};

type MasterItemOverrideMap = Record<string, MasterItemOverride>;

const DIRECT_MASTER_ITEM_URL = "https://n8n-plant.icpladda.com/webhook/API/Item-production";

const idKeys = ["_id", "id", "itemId", "item_id", "item_no", "code", "itemCode"];
const codeKeys = ["item_no", "itemCode", "item_code", "code", "Code", "ITEM_CODE"];
const nameKeys = ["item_name1", "itemName", "item_name", "name", "Name", "ITEM_NAME", "description"];
const typeKeys = ["common_name", "commonname", "commonName", "itemType", "item_type"];
const categoryKeys = ["inventory_posting_group", "category", "type", "group", "itemGroup", "item_group"];
const unitKeys = ["base_unit_of_mea", "unit", "uom", "UOM", "unitName"];
const statusKeys = ["status", "active", "isActive"];
const descriptionKeys = ["item_name2", "item_name3", "description", "detail", "remark", "note"];
const commonNameKeys = ["common_name", "commonname", "commonName", "item_name2", "itemType"];
const methodInstrumentKeys = [
  "simple_method",
  "simpleMethod",
  "method",
  "method_name",
  "test_method",
  "testMethod",
  "instrument",
  "instrument_type",
  "machine",
];
const hiddenTableKeys = [
  "trade_name",
  "tradename",
  "tradeName",
  "search_name",
  "dm1",
  "dm2",
  "sales_unit_mea",
  "purch_unit_mea",
  "unit_cost",
];

const OVERRIDE_FIELD_MAP: Array<{ key: keyof MasterItemOverride; targets: string[] }> = [
  { key: "itemCode", targets: codeKeys },
  { key: "itemName", targets: nameKeys },
  { key: "itemType", targets: typeKeys },
  { key: "category", targets: categoryKeys },
  { key: "unit", targets: unitKeys },
  { key: "status", targets: statusKeys },
  { key: "description", targets: descriptionKeys },
];

function applyOverride(item: MasterItem, override?: MasterItemOverride): MasterItem {
  if (!override) return item;
  const merged: MasterItem = { ...item };
  OVERRIDE_FIELD_MAP.forEach(({ key, targets }) => {
    const value = override[key];
    if (typeof value === "string" && value !== "") {
      targets.forEach((target) => {
        merged[target] = value;
      });
    }
  });
  return merged;
}

function normalizeItems(payload: unknown): MasterItem[] {
  if (Array.isArray(payload)) return payload.filter(isObject);
  if (isObject(payload)) {
    const candidates = [payload.data, payload.items, payload.result, payload.rows];
    const found = candidates.find(Array.isArray);
    if (Array.isArray(found)) return found.filter(isObject);
  }
  return [];
}

function isObject(value: unknown): value is MasterItem {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function firstValue(item: MasterItem, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

// Escape regex-special chars so a method label/code can be matched literally.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Auto-suggest method codes from an item's ERP method/instrument text. Scans the
// text for each active method's label or code (case-insensitive whole-word) and
// returns the matching codes — a convenience over fully manual selection.
function detectMethods(value: unknown, activeMethods: MethodDoc[]): string[] {
  const text = String(value ?? "").trim();
  if (!text) return [];
  const found: string[] = [];
  for (const m of activeMethods) {
    const needles = [m.code, m.label].filter((s): s is string => !!s && s.trim() !== "");
    const hit = needles.some((needle) => {
      const re = new RegExp(`\\b${escapeRegExp(needle.trim())}\\b`, "i");
      return re.test(text);
    });
    if (hit && !found.includes(m.code)) found.push(m.code);
  }
  return found;
}

function emptyAssignments(count: number): string[][] {
  return Array.from({ length: count }, () => []);
}

function alignAssignments(source: string[][], substanceCount: number): string[][] {
  const result = emptyAssignments(substanceCount);
  for (let i = 0; i < Math.min(source.length, substanceCount); i += 1) {
    result[i] = Array.isArray(source[i]) ? [...source[i]] : [];
  }
  return result;
}

function slotsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = [...b].sort();
  return [...a].sort().every((value, index) => value === sb[index]);
}

function assignmentsEqual(a: string[][], b: string[][]): boolean {
  if (a.length !== b.length) return false;
  return a.every((slot, index) => slotsEqual(slot, b[index]));
}

function displayValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function displayProductType(value: unknown) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return "-";
  return productTypeLabels[rawValue] ?? rawValue;
}

function getItemCategory(item: MasterItem) {
  return String(firstValue(item, categoryKeys)).trim();
}

function getProductTypeGroup(item: MasterItem) {
  const source = [
    firstValue(item, typeKeys),
    firstValue(item, descriptionKeys),
    firstValue(item, nameKeys),
  ].filter(Boolean).join(" ");
  return getClassification(source)?.group ?? "";
}

const PARAM_ITEM_NAME_KEYS = ["item_name1", "itemName", "item_name", "name"];

function getItemNameForParam(item: MasterItem): string {
  for (const key of PARAM_ITEM_NAME_KEYS) {
    const value = item[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

// itemGroupIds = group IDs ที่ item นี้สังกัด — resolve มาจาก useItemGroupMembership
// (catalog ดิบ keyed by raw itemNo) เพื่อให้ตรงกับฝั่ง testing เป๊ะ. ห้าม resolve
// จาก item ที่ผ่าน applyOverride แล้ว เพราะ override เขียนทับ commonname.
function getParametersFor(
  item: MasterItem,
  parameters: ParameterItem[],
  itemGroupIds: string[] = [],
): ParameterItem[] {
  if (parameters.length === 0) return [];
  const itemName = getItemNameForParam(item);
  const productType = getProductTypeGroup(item);
  const category = getItemCategory(item);
  const commonName = getCommonName(firstValue(item, commonNameKeys))
    || getCommonName(firstValue(item, nameKeys));

  return parameters.filter((parameter) => {
    if ((parameter.status ?? "active") !== "active") return false;
    if (parameter.applyAll) return true;
    if (itemName && parameter.itemNames?.includes(itemName)) return true;
    if (productType && parameter.productTypes?.includes(productType)) return true;
    if (category && parameter.categories?.includes(category)) return true;
    if (commonName && parameter.commonNames?.includes(commonName)) return true;
    if (itemGroupIds.length > 0 && (parameter.itemGroups ?? []).some((g) => itemGroupIds.includes(g))) return true;
    return false;
  });
}

function countParametersFor(
  item: MasterItem,
  parameters: ParameterItem[],
  itemGroupIds: string[] = [],
): number {
  return getParametersFor(item, parameters, itemGroupIds).length;
}

function getItemId(item: MasterItem) {
  const value = firstValue(item, idKeys);
  return value ? String(value) : "";
}

function getDetectedSlot(item: MasterItem, activeMethods: MethodDoc[]): string[] {
  if (activeMethods.length === 0) return [];
  for (const key of methodInstrumentKeys) {
    const found = detectMethods(item[key], activeMethods);
    if (found.length > 0) return found;
  }
  return [];
}

export function buildSimpleMethodRows(
  items: MasterItem[],
  overrides: Record<string, string[][]> = {},
  cnMap: Map<string, string> = new Map(),
  activeMethods: MethodDoc[] = [],
): SimpleMethodRow[] {
  const groups = new Map<string, SimpleMethodRow>();
  const collected = new Map<string, string[][]>();

  items.forEach((item) => {
    const rawCommonName = String(firstValue(item, commonNameKeys)).trim();
    if (!rawCommonName) return;
    const commonName = normalizeCommonName(rawCommonName, cnMap);

    const key = normalizeKey(commonName);
    const itemNo = String(firstValue(item, codeKeys)).trim();
    const substances = parseSubstances(commonName);
    const count = substances.length;

    let candidate: string[][] = emptyAssignments(count);
    const override = itemNo ? overrides[itemNo] : undefined;
    if (override && override.length > 0) {
      candidate = alignAssignments(override, count);
    } else {
      const detected = getDetectedSlot(item, activeMethods);
      if (detected.length > 0 && count === 1) candidate = [detected];
    }

    const existing = groups.get(key);
    const current = collected.get(key) ?? emptyAssignments(count);
    // positional merge: keep substance i; fill empties from the detected/override candidate
    const merged = current.map((slot, idx) =>
      slot.length > 0 ? slot : [...(candidate[idx] ?? [])],
    );
    collected.set(key, merged);

    if (existing) {
      existing.items.push(item);
      if (itemNo && !existing.itemNos.includes(itemNo)) existing.itemNos.push(itemNo);
      if (!existing.rawCommonNames.includes(rawCommonName)) existing.rawCommonNames.push(rawCommonName);
      return;
    }

    groups.set(key, {
      key,
      commonName,
      substances,
      assignments: emptyAssignments(count),
      itemNos: itemNo ? [itemNo] : [],
      rawCommonNames: [rawCommonName],
      items: [item],
    });
  });

  groups.forEach((row, key) => {
    row.assignments = collected.get(key) ?? emptyAssignments(row.substances.length);
  });

  return Array.from(groups.values()).sort((a, b) =>
    a.commonName.localeCompare(b.commonName, ["th", "en"]),
  );
}

function itemToForm(item: MasterItem, metaQty = 0): MasterItemForm {
  const statusValue = firstValue(item, statusKeys);
  const classification = getClassification([
    firstValue(item, typeKeys),
    firstValue(item, descriptionKeys),
    firstValue(item, nameKeys),
  ].filter(Boolean).join(" "));
  return {
    itemCode: String(firstValue(item, codeKeys)),
    itemName: String(firstValue(item, nameKeys)),
    itemType: classification?.code ?? String(firstValue(item, typeKeys)),
    category: String(firstValue(item, categoryKeys)),
    unit: String(firstValue(item, unitKeys)),
    status:
      typeof statusValue === "boolean"
        ? statusValue ? "active" : "inactive"
        : String(statusValue || "active"),
    description: String(firstValue(item, descriptionKeys)),
    requiredInspectionQty: String(metaQty || 0),
  };
}

function buildPayload(form: MasterItemForm, editing: MasterItem | null) {
  const classification = getClassification(form.itemType);
  const itemType = classification?.code ?? form.itemType.trim();
  const category = form.category.trim();
  const payload = {
    ...(editing ?? {}),
  };
  delete payload.product_type;
  delete payload.productType;
  delete payload.product_group;
  delete payload.productGroup;

  return {
    ...payload,
    item_no: form.itemCode.trim(),
    item_name1: form.itemName.trim(),
    common_name: itemType,
    commonname: itemType,
    inventory_posting_group: category,
    base_unit_of_mea: form.unit.trim(),
    itemCode: form.itemCode.trim(),
    itemName: form.itemName.trim(),
    itemType,
    category,
    unit: form.unit.trim(),
    status: form.status,
    description: form.description.trim(),
  };
}

async function fetchDirectMasterItems() {
  const response = await fetch(DIRECT_MASTER_ITEM_URL, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Cannot fetch master items: ${response.status}`);
  }
  return normalizeItems(await response.json());
}

export default function MasterItems() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [productTypeFilter, setProductTypeFilter] = useState("all");
  const [editing, setEditing] = useState<{ item: MasterItem; originalItemNo: string; override?: MasterItemOverride } | null>(null);
  const [viewing, setViewing] = useState<{ item: MasterItem; originalItemNo: string; override?: MasterItemOverride } | null>(null);
  const [exporting, setExporting] = useState<null | "xlsx" | "pdf">(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);

  const {
    data: items = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["master-items"],
    queryFn: async () => {
      try {
        const res = await api.get<unknown>("/master-items");
        return normalizeItems(res.data.data);
      } catch {
        return fetchDirectMasterItems();
      }
    },
  });

  const { data: overrideMap = {} } = useQuery<MasterItemOverrideMap>({
    queryKey: ["master-item-meta"],
    queryFn: async () => {
      const res = await api.get<MasterItemOverride[]>("/master-item-meta");
      const map: MasterItemOverrideMap = {};
      (res.data.data || []).forEach((entry) => {
        if (entry && entry.itemNo) map[entry.itemNo] = entry;
      });
      return map;
    },
  });

  const { data: parameters = [] } = useQuery({
    queryKey: ["parameters"],
    queryFn: () => api.getParameters(),
  });

  const { data: cnOverrides = [] } = useQuery({
    queryKey: ["common-name-overrides"],
    queryFn: async () => {
      const res = await api.get<CommonNameOverrideRow[]>("/common-name-overrides");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
  });

  const { data: itemGroups = [] } = useQuery({
    queryKey: ["item-groups"],
    queryFn: async () => {
      const res = await api.get<ItemGroupItem[]>("/item-groups");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
  });

  // group membership keyed by raw itemNo (single source of truth, ตรงกับ testing flow)
  const groupMembership = useItemGroupMembership();
  const groupIdsFor = (itemNo: string) => groupMembership.get(String(itemNo ?? "").trim()) ?? [];

  const cnMap = useMemo(() => buildOverrideMap(cnOverrides), [cnOverrides]);

  const enrichedItems = useMemo(
    () => items.map((item) => {
      const originalItemNo = String(firstValue(item, codeKeys)).trim();
      const override = overrideMap[originalItemNo];
      const rawCommonName = String(firstValue(item, commonNameKeys)).trim();
      return {
        item: applyOverride(item, override),
        originalItemNo,
        override,
        rawCommonName,
        displayCommonName: normalizeCommonName(rawCommonName, cnMap),
      };
    }),
    [items, overrideMap, cnMap],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrichedItems.filter(({ item }) => {
      const matchesSearch = !q || JSON.stringify(item).toLowerCase().includes(q);
      const matchesCategory = categoryFilter === "all" || getItemCategory(item) === categoryFilter;
      const matchesProductType = productTypeFilter === "all" || getProductTypeGroup(item) === productTypeFilter;
      return matchesSearch && matchesCategory && matchesProductType;
    });
  }, [categoryFilter, enrichedItems, productTypeFilter, search]);

  const categoryOptions = useMemo(() => {
    const values = new Set<string>();
    enrichedItems.forEach(({ item }) => {
      const category = getItemCategory(item);
      if (category) values.add(category);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [enrichedItems]);

  const extraColumns = useMemo(() => {
    const used = new Set([
      ...idKeys,
      ...codeKeys,
      ...nameKeys,
      ...typeKeys,
      ...categoryKeys,
      ...unitKeys,
      ...statusKeys,
      ...descriptionKeys,
      ...methodInstrumentKeys,
      ...hiddenTableKeys,
    ]);
    const keys: string[] = [];
    for (const item of items) {
      Object.keys(item).forEach((key) => {
        if (!used.has(key) && !keys.includes(key)) keys.push(key);
      });
      if (keys.length >= 3) break;
    }
    return keys;
  }, [items]);

  const activeCount = enrichedItems.filter(({ item }) => {
    const status = firstValue(item, statusKeys);
    if (status === "") return true;
    return status === true || String(status || "").toLowerCase() === "active";
  }).length;

  const handleExport = async (format: "xlsx" | "pdf") => {
    if (filteredItems.length === 0) {
      toast.error("ไม่มีข้อมูลสำหรับ export");
      return;
    }
    setExporting(format);
    try {
      const rows = filteredItems.map(({ item }) => item);
      const blob = await api.exportMasterItems(format, rows, "Master Item");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `master-item-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <AppLayout>
        <PageHeader
          className="mb-6"
          title={
            <span className="inline-flex items-center gap-2">
              <Database className="h-6 w-6" />
              Master Item
            </span>
          }
          description="จัดการรายการ item จาก n8n webhook"
          actions={
            <Button variant="outline" className="gap-1" onClick={() => setGroupDialogOpen(true)}>
              <Database className="h-4 w-4" /> จัดกลุ่ม
            </Button>
          }
        />

        <div className="mb-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">ทั้งหมด</div>
              <div className="mt-1 text-2xl font-semibold">{items.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Active</div>
              <div className="mt-1 text-2xl font-semibold">{activeCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">แสดงผล</div>
              <div className="mt-1 text-2xl font-semibold">{filteredItems.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 space-y-0 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageSearch className="h-5 w-5" />
              รายการ Item
              <Badge variant="outline">{filteredItems.length}</Badge>
            </CardTitle>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="หมวดหมู่" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                {categoryOptions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="ประเภทสินค้า" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภทสินค้า</SelectItem>
                {Object.entries(productTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหา item"
                className="pl-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => handleExport("xlsx")}
                disabled={exporting !== null || filteredItems.length === 0}
                title="ดาวน์โหลดเป็น Excel (ตามที่กรองอยู่)"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {exporting === "xlsx" ? "กำลังสร้าง..." : "Excel"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport("pdf")}
                disabled={exporting !== null || filteredItems.length === 0}
                title="ดาวน์โหลดเป็น PDF (ตามที่กรองอยู่)"
              >
                <FileText className="h-4 w-4" />
                {exporting === "pdf" ? "กำลังสร้าง..." : "PDF"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isError ? (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {(error as Error).message}
              </div>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>ชื่อ Item</TableHead>
                      <TableHead>commonname</TableHead>
                      <TableHead>ประเภทสินค้า</TableHead>
                      <TableHead>หมวดหมู่</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-center">พารามิเตอร์</TableHead>
                      <TableHead>Status</TableHead>
                      {extraColumns.map((key) => (
                        <TableHead key={key}>{key}</TableHead>
                      ))}
                      <TableHead className="w-28 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9 + extraColumns.length} className="py-8 text-center text-muted-foreground">
                          กำลังโหลด...
                        </TableCell>
                      </TableRow>
                    ) : filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9 + extraColumns.length} className="py-8 text-center text-muted-foreground">
                          ไม่มีข้อมูล
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredItems.map(({ item, originalItemNo, override, rawCommonName, displayCommonName }, index) => {
                        const matchedParameters = getParametersFor(item, parameters, groupIdsFor(originalItemNo));
                        const metaQty = matchedParameters.length;
                        const form = itemToForm(item, metaQty);
                        const rowKey = getItemId(item) || originalItemNo || `row-${index}`;
                        return (
                          <TableRow
                            key={rowKey}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setViewing({ item, originalItemNo, override })}
                          >
                            <TableCell className="font-semibold text-primary">
                              {displayValue(firstValue(item, codeKeys))}
                            </TableCell>
                            <TableCell className="min-w-56 font-medium">
                              {displayValue(firstValue(item, nameKeys))}
                            </TableCell>
                            <TableCell onClick={(event) => event.stopPropagation()}>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="min-w-0 flex-1 truncate"
                                  title={displayCommonName !== rawCommonName ? `จากระบบ: ${rawCommonName}` : undefined}
                                >
                                  {displayValue(displayCommonName)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{displayProductType(getProductTypeGroup(item))}</TableCell>
                            <TableCell>{displayValue(getItemCategory(item))}</TableCell>
                            <TableCell>{displayValue(firstValue(item, unitKeys))}</TableCell>
                            <TableCell className="text-center">
                              <HoverCard openDelay={120} closeDelay={80}>
                                <HoverCardTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={(event) => event.stopPropagation()}
                                    className="inline-flex cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                                  >
                                    {metaQty > 0 ? (
                                      <Badge variant="secondary" className="font-medium">{metaQty}</Badge>
                                    ) : (
                                      <Badge variant="outline" className="border-amber-500/40 bg-amber-50 text-amber-700 dark:bg-amber-950/30">
                                        0
                                      </Badge>
                                    )}
                                  </button>
                                </HoverCardTrigger>
                                <HoverCardContent align="center" className="w-72 p-3">
                                  {metaQty > 0 ? (
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                                        <span>พารามิเตอร์ที่ตรงกับ Item นี้</span>
                                        <span>{metaQty} รายการ</span>
                                      </div>
                                      <ul className="space-y-1 text-sm">
                                        {matchedParameters.map((param) => (
                                          <li key={param._id ?? param.name} className="flex items-center gap-2">
                                            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/70" />
                                            <span className="min-w-0 flex-1 truncate font-medium">{param.name}</span>
                                            {param.scope && (
                                              <Badge variant="outline" className="h-4 px-1 text-[10px] uppercase">
                                                {param.scope}
                                              </Badge>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-muted-foreground">
                                      ยังไม่มีพารามิเตอร์ที่ตรงกับ Item นี้
                                    </div>
                                  )}
                                </HoverCardContent>
                              </HoverCard>
                            </TableCell>
                            <TableCell>
                              <Badge variant={form.status === "inactive" ? "secondary" : "default"}>
                                {form.status}
                              </Badge>
                            </TableCell>
                            {extraColumns.map((key) => (
                              <TableCell key={key} className="max-w-64 truncate">
                                {displayValue(item[key])}
                              </TableCell>
                            ))}
                            <TableCell onClick={(event) => event.stopPropagation()}>
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setEditing({ item, originalItemNo, override })}
                                  title="แก้ไข"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {editing && (
          <MasterItemDialog
            item={editing.item}
            originalItemNo={editing.originalItemNo}
            initialMetaQty={countParametersFor(editing.item, parameters, groupIdsFor(editing.originalItemNo))}
            onClose={() => setEditing(null)}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ["master-items"] });
              queryClient.invalidateQueries({ queryKey: ["master-item-meta"] });
            }}
          />
        )}

        {viewing && (
          <MasterItemDetailDialog
            item={viewing.item}
            originalItemNo={viewing.originalItemNo}
            parameters={getParametersFor(viewing.item, parameters, groupIdsFor(viewing.originalItemNo))}
            groups={itemGroups}
            itemGroupIds={groupIdsFor(viewing.originalItemNo)}
            extraColumns={extraColumns}
            onClose={() => setViewing(null)}
            onEdit={() => {
              setEditing(viewing);
              setViewing(null);
            }}
          />
        )}

        <ItemGroupManagerDialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen} items={items} />
    </AppLayout>
  );
}

// "all" | "unassigned" | a specific method code
type SimpleMethodFilter = string;

export function SimpleMethodPage() {
  const queryClient = useQueryClient();
  const [methodDrafts, setMethodDrafts] = useState<Record<string, string[][]>>({});
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<SimpleMethodFilter>("all");

  const {
    data: items = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["master-items"],
    queryFn: async () => {
      try {
        const res = await api.get<unknown>("/master-items");
        return normalizeItems(res.data.data);
      } catch {
        return fetchDirectMasterItems();
      }
    },
  });

  const { data: registryMethods = [] } = useQuery({
    queryKey: ["methods"],
    queryFn: () => api.getMethods(),
  });
  const activeMethods = useMemo(() => registryMethods.filter((m) => m.active), [registryMethods]);

  const { data: simpleMethodEntries = [] } = useQuery({
    queryKey: ["simple-methods"],
    queryFn: async () => {
      const res = await api.get<Array<{ itemNo: string; instruments?: string[]; methods?: string[][] }>>("/simple-methods");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
  });

  const { data: exclusions = [] } = useQuery({
    queryKey: ["simple-method-exclusions"],
    queryFn: async () => {
      const res = await api.get<ExclusionRule[]>("/simple-method-exclusions");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
  });

  const { data: cnOverrides = [] } = useQuery({
    queryKey: ["common-name-overrides"],
    queryFn: async () => {
      const res = await api.get<CommonNameOverrideRow[]>("/common-name-overrides");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
  });

  const cnMap = useMemo(() => buildOverrideMap(cnOverrides), [cnOverrides]);

  // substance count per itemNo, using the (override-resolved) commonName so the
  // count aligns with parseSubstances exactly as buildSimpleMethodRows does.
  const substanceCountByItemNo = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((item) => {
      const itemNo = String(firstValue(item, codeKeys)).trim();
      if (!itemNo) return;
      const rawCommonName = String(firstValue(item, commonNameKeys)).trim();
      if (!rawCommonName) return;
      const commonName = normalizeCommonName(rawCommonName, cnMap);
      map.set(itemNo, parseSubstances(commonName).length);
    });
    return map;
  }, [items, cnMap]);

  // itemNo → positional AND-sets, read via readSlotMethods (new methods win,
  // legacy instruments mapped) and padded/truncated to that item's substance count.
  const overrides = useMemo(() => {
    const map: Record<string, string[][]> = {};
    simpleMethodEntries.forEach((entry) => {
      if (!entry || !entry.itemNo) return;
      const count = substanceCountByItemNo.get(entry.itemNo) ?? 0;
      map[entry.itemNo] = readSlotMethods(entry, count);
    });
    return map;
  }, [simpleMethodEntries, substanceCountByItemNo]);

  const rows = useMemo(
    () => buildSimpleMethodRows(items, overrides, cnMap, activeMethods),
    [items, overrides, cnMap, activeMethods],
  );

  const visibleRows = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    return rows.filter((row) => {
      if (exclusions.some((rule) => matchesExclusion(row.commonName, rule))) return false;
      if (needle) {
        const haystack = `${row.commonName} ${row.itemNos.join(" ")}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (statusFilter === "all") return true;
      if (statusFilter === "unassigned") return row.assignments.some((slot) => slot.length === 0);
      // otherwise statusFilter is a specific method code
      return row.assignments.some((slot) => slot.includes(statusFilter));
    });
  }, [rows, searchText, statusFilter, exclusions]);

  const dirtyRows = useMemo(
    () => rows.filter((row) => {
      const draft = methodDrafts[row.key];
      return draft !== undefined && !assignmentsEqual(draft, row.assignments);
    }),
    [rows, methodDrafts],
  );

  const setMethodDraft = (key: string, assignments: string[][]) => {
    setMethodDrafts((current) => ({
      ...current,
      [key]: assignments,
    }));
  };

  const toggleRowSelected = (key: string, selected: boolean) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (selected) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const toggleAllVisibleSelected = (selected: boolean) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      visibleRows.forEach((row) => {
        if (selected) next.add(row.key);
        else next.delete(row.key);
      });
      return next;
    });
  };

  // Toggle a method code ON for every substance slot of each selected row.
  const applyBulkAdd = (code: string) => {
    if (selectedKeys.size === 0) return;
    setMethodDrafts((current) => {
      const next = { ...current };
      visibleRows.forEach((row) => {
        if (!selectedKeys.has(row.key)) return;
        const base = current[row.key] ?? row.assignments;
        next[row.key] = base.map((slot) => (slot.includes(code) ? [...slot] : [...slot, code]));
      });
      return next;
    });
  };

  // Clear all method codes from every substance slot of each selected row.
  const applyBulkClear = () => {
    if (selectedKeys.size === 0) return;
    setMethodDrafts((current) => {
      const next = { ...current };
      visibleRows.forEach((row) => {
        if (!selectedKeys.has(row.key)) return;
        next[row.key] = row.substances.map(() => []);
      });
      return next;
    });
  };

  const saveAllDirty = async () => {
    if (dirtyRows.length === 0) return;
    setSavingAll(true);
    try {
      const updates = dirtyRows.flatMap((row) => {
        const methods = methodDrafts[row.key] ?? row.assignments;
        return row.items
          .map((item) => String(firstValue(item, codeKeys)).trim())
          .filter((itemNo) => itemNo)
          .map((itemNo) => ({ itemNo, methods }));
      });
      if (updates.length === 0) {
        toast.error("ไม่พบรหัส item สำหรับบันทึก method");
        return;
      }
      await api.put("/simple-methods", { updates });
      toast.success(`บันทึก ${dirtyRows.length} รายการสำเร็จ`);
      setMethodDrafts({});
      setSelectedKeys(new Set());
      queryClient.invalidateQueries({ queryKey: ["simple-methods"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <AppLayout fixedHeight mainClassName="relative flex flex-col overflow-hidden p-4 sm:p-6 pb-24">
        <PageHeader
          className="mb-4 shrink-0"
          title={
            <span className="inline-flex items-center gap-2">
              <FlaskConical className="h-6 w-6" />
              Simple Method
            </span>
          }
          description="กำหนดวิธีวิเคราะห์ตาม commonname"
        />

        <SimpleMethodTab
          rows={visibleRows}
          totalRows={rows.length}
          isLoading={isLoading}
          isError={isError}
          error={error}
          activeMethods={activeMethods}
          methodDrafts={methodDrafts}
          selectedKeys={selectedKeys}
          searchText={searchText}
          statusFilter={statusFilter}
          exclusions={exclusions}
          onSearchTextChange={setSearchText}
          onStatusFilterChange={setStatusFilter}
          onDraftChange={setMethodDraft}
          onToggleRow={toggleRowSelected}
          onToggleAll={toggleAllVisibleSelected}
          onExclusionsChanged={() => queryClient.invalidateQueries({ queryKey: ["simple-method-exclusions"] })}
        />

        <div className="pointer-events-none absolute inset-x-6 bottom-6 z-30 flex justify-center">
          <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-full border bg-card px-4 py-2 shadow-lg">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">เลือก</span>
                <Badge variant="secondary" className="rounded-full">{selectedKeys.size}</Badge>
                <span className="text-muted-foreground">รายการ</span>
              </div>
              <div className="mx-1 h-6 w-px bg-border" aria-hidden />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">เพิ่มทุกสาร:</span>
                <BulkAddMethodPicker
                  methods={activeMethods}
                  disabled={selectedKeys.size === 0}
                  onAdd={applyBulkAdd}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-full px-3 text-muted-foreground"
                  disabled={selectedKeys.size === 0}
                  onClick={applyBulkClear}
                >
                  ล้าง
                </Button>
              </div>
              <div className="mx-1 h-6 w-px bg-border" aria-hidden />
              <Button
                size="sm"
                disabled={dirtyRows.length === 0 || savingAll}
                onClick={saveAllDirty}
                className="rounded-full"
              >
                {savingAll ? "กำลังบันทึก..." : `บันทึก${dirtyRows.length > 0 ? ` (${dirtyRows.length})` : ""}`}
              </Button>
            </div>
          </div>
    </AppLayout>
  );
}

export function MachinesPage() {
  return (
    <AppLayout>
        <PageHeader
          className="mb-6"
          title={
            <span className="inline-flex items-center gap-2">
              <Wrench className="h-6 w-6" />
              รายการเครื่อง
            </span>
          }
          description="จัดการเครื่องมือและข้อมูลทะเบียนเครื่อง"
        />

        <MachinesTab />
    </AppLayout>
  );
}

// Compact per-slot method picker: a trigger showing the selected method labels as
// badges (or a muted placeholder), opening a popover of checkboxes for every active
// method. Selection logic stays in `toggleMethod`; this is presentational only.
function MethodSlotPicker({
  methods,
  selected,
  onChange,
}: {
  methods: MethodDoc[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const selectedLabels = methods.filter((m) => selected.includes(m.code));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 min-w-24 justify-between gap-1.5 px-2.5"
        >
          {selectedLabels.length > 0 ? (
            <span className="flex flex-wrap items-center gap-1">
              {selectedLabels.map((m) => (
                <Badge key={m.code} variant="secondary" className="rounded-full px-2 py-0 text-xs font-normal">
                  {m.label}
                </Badge>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">เลือก</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1.5">
        {methods.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">ยังไม่มี method</div>
        ) : (
          <div className="flex flex-col">
            {methods.map((m) => {
              const checked = selected.includes(m.code);
              return (
                <button
                  key={m.code}
                  type="button"
                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => onChange(toggleMethod(selected, m.code))}
                >
                  <Checkbox checked={checked} className="pointer-events-none" tabIndex={-1} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Floating-toolbar bulk picker: a single "เพิ่ม method ▾" trigger opening a popover
// that lists each active method. Clicking a method calls `onAdd(code)` and leaves the
// popover open so several can be added in a row.
function BulkAddMethodPicker({
  methods,
  disabled,
  onAdd,
}: {
  methods: MethodDoc[];
  disabled: boolean;
  onAdd: (code: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 rounded-full px-3"
          disabled={disabled}
        >
          เพิ่ม method
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-44 p-1.5">
        {methods.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">ยังไม่มี method</div>
        ) : (
          <div className="flex flex-col">
            {methods.map((m) => (
              <button
                key={m.code}
                type="button"
                className="rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => onAdd(m.code)}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function SimpleMethodTab({
  rows,
  totalRows,
  isLoading,
  isError,
  error,
  activeMethods,
  methodDrafts,
  selectedKeys,
  searchText,
  statusFilter,
  exclusions,
  onSearchTextChange,
  onStatusFilterChange,
  onDraftChange,
  onToggleRow,
  onToggleAll,
  onExclusionsChanged,
}: {
  rows: SimpleMethodRow[];
  totalRows: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  activeMethods: MethodDoc[];
  methodDrafts: Record<string, string[][]>;
  selectedKeys: Set<string>;
  searchText: string;
  statusFilter: SimpleMethodFilter;
  exclusions: ExclusionRule[];
  onSearchTextChange: (value: string) => void;
  onStatusFilterChange: (value: SimpleMethodFilter) => void;
  onDraftChange: (key: string, methods: string[][]) => void;
  onToggleRow: (key: string, selected: boolean) => void;
  onToggleAll: (selected: boolean) => void;
  onExclusionsChanged: () => void;
}) {
  const visibleSelectedCount = rows.reduce(
    (acc, row) => acc + (selectedKeys.has(row.key) ? 1 : 0),
    0,
  );
  const allSelected: boolean | "indeterminate" =
    rows.length > 0 && visibleSelectedCount === rows.length
      ? true
      : visibleSelectedCount === 0
        ? false
        : "indeterminate";
  const isFiltered = rows.length !== totalRows;

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CardHeader className="flex shrink-0 flex-col gap-3 space-y-0">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-5 w-5" />
            จัดการ Simple Method
            <Badge variant="outline">
              {isFiltered ? `${rows.length}/${totalRows}` : totalRows}
            </Badge>
          </CardTitle>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={(event) => onSearchTextChange(event.target.value)}
              placeholder="ค้นหา commonname / item no..."
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as SimpleMethodFilter)}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="ทุก Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุก Method</SelectItem>
              <SelectItem value="unassigned">ยังไม่กำหนด</SelectItem>
              {activeMethods.map((m) => (
                <SelectItem key={m.code} value={m.code}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ExclusionManager exclusions={exclusions} onChanged={onExclusionsChanged} />
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        {isError ? (
          <div className="m-6 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {(error as Error).message}
          </div>
        ) : (
          <div className="relative h-full overflow-auto border-t">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => onToggleAll(!!checked)}
                      aria-label="เลือกทุกแถว"
                    />
                  </TableHead>
                  <TableHead>commonname</TableHead>
                  <TableHead className="w-64">Method/Instrument</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      กำลังโหลด...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      ไม่มีข้อมูล simple method
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const draftValue = methodDrafts[row.key] ?? row.assignments;
                    const isDirty =
                      methodDrafts[row.key] !== undefined &&
                      !assignmentsEqual(methodDrafts[row.key], row.assignments);
                    const isRowSelected = selectedKeys.has(row.key);
                    const isMulti = row.substances.length > 1;

                    return (
                      <TableRow
                        key={row.key}
                        data-state={isRowSelected ? "selected" : undefined}
                        className="cursor-pointer"
                        onClick={() => onToggleRow(row.key, !isRowSelected)}
                      >
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={isRowSelected}
                            onCheckedChange={(checked) => onToggleRow(row.key, !!checked)}
                            aria-label={`เลือกแถว ${row.commonName}`}
                          />
                        </TableCell>
                        <TableCell className="min-w-72 font-medium" onClick={(event) => event.stopPropagation()}>
                          <span className="block min-w-0 truncate">{displayValue(row.commonName)}</span>
                        </TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <div
                            className={`flex flex-col gap-1.5 rounded-md border bg-background p-1.5 transition-colors ${
                              isMulti ? "" : "ml-auto w-fit"
                            } ${isDirty ? "border-primary" : "border-input"}`}
                          >
                            {row.substances.map((substance, index) => {
                              const current = draftValue[index] ?? [];
                              return (
                                <div
                                  key={`${row.key}-${index}`}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  {isMulti && (
                                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                      {substance}
                                    </span>
                                  )}
                                  <div className="ml-auto flex items-center justify-end">
                                    <MethodSlotPicker
                                      methods={activeMethods}
                                      selected={current}
                                      onChange={(next) =>
                                        onDraftChange(row.key, setSlotMethods(draftValue, index, next))
                                      }
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExclusionManager({
  exclusions,
  onChanged,
}: {
  exclusions: ExclusionRule[];
  onChanged: () => void;
}) {
  const [pattern, setPattern] = useState("");
  const [matchType, setMatchType] = useState<MatchType>("contains");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const addRule = async () => {
    const trimmed = pattern.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      await api.post("/simple-method-exclusions", { pattern: trimmed, matchType });
      setPattern("");
      setMatchType("contains");
      onChanged();
      toast.success(`ซ่อนสารที่ ${MATCH_TYPE_LABELS[matchType]} "${trimmed}"`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const removeRule = async (id: string) => {
    setRemovingId(id);
    try {
      await api.delete(`/simple-method-exclusions/${id}`);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full md:w-auto gap-2">
          สารที่ไม่ตรวจ
          {exclusions.length > 0 && (
            <Badge variant="secondary" className="rounded-full">{exclusions.length}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-3">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold">สารที่ไม่ตรวจ Simple Method</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              เพิ่มคำเพื่อซ่อน commonname ที่ไม่ต้องตรวจ (เลือกตำแหน่งที่ตรงได้)
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Input
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
              placeholder="เช่น seaweed"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addRule();
                }
              }}
            />
            <div className="flex items-center gap-2">
              <Select value={matchType} onValueChange={(value) => setMatchType(value as MatchType)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">มีคำนี้</SelectItem>
                  <SelectItem value="startsWith">ขึ้นต้นด้วย</SelectItem>
                  <SelectItem value="endsWith">ลงท้ายด้วย</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={addRule}
                disabled={adding || !pattern.trim()}
              >
                <Plus className="h-4 w-4" />
                เพิ่ม
              </Button>
            </div>
          </div>

          <div className="max-h-64 overflow-auto rounded-md border">
            {exclusions.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                ยังไม่มีรายการ
              </div>
            ) : (
              <ul className="divide-y">
                {exclusions.map((rule) => (
                  <li key={rule._id} className="flex items-center gap-2 px-3 py-2">
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {MATCH_TYPE_LABELS[rule.matchType]}
                    </Badge>
                    <span className="flex-1 truncate text-sm">{rule.pattern}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      disabled={removingId === rule._id}
                      onClick={() => removeRule(rule._id)}
                      aria-label={`ลบ ${rule.pattern}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CommonNameOverrideDialog({
  rawCommonNames,
  initialCanonical,
  onClose,
  onSaved,
}: {
  rawCommonNames: string[];
  initialCanonical: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [canonical, setCanonical] = useState(initialCanonical);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const value = canonical.trim();
    if (!value) {
      toast.error("กรุณาระบุชื่อมาตรฐาน");
      return;
    }
    setBusy(true);
    try {
      // apply the same canonical to every raw common_name passed in
      for (const raw of rawCommonNames) {
        await api.post("/common-name-overrides", { raw, canonical: value, note: note.trim() });
      }
      toast.success("ตั้งชื่อมาตรฐานสำเร็จ");
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>ตั้งชื่อมาตรฐาน (common name)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <span className="text-sm text-muted-foreground">ชื่อจากระบบ (raw)</span>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {rawCommonNames.map((raw) => <li key={raw}>{raw}</li>)}
            </ul>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">ชื่อมาตรฐาน</span>
            <Input value={canonical} onChange={(e) => setCanonical(e.target.value)} />
          </div>
          <div>
            <span className="text-sm text-muted-foreground">หมายเหตุ (ไม่บังคับ)</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>ยกเลิก</Button>
          <Button onClick={save} disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MasterItemDialog({
  item,
  originalItemNo,
  initialMetaQty,
  onClose,
  onSaved,
}: {
  item: MasterItem | null;
  originalItemNo: string;
  initialMetaQty: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<MasterItemForm>(() =>
    item ? itemToForm(item, initialMetaQty) : { ...emptyForm, requiredInspectionQty: String(initialMetaQty || 0) },
  );
  const [busy, setBusy] = useState(false);
  const isEdit = !!item;

  const setField = (key: keyof MasterItemForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setClassification = (value: string) => {
    const classification = getClassification(value);
    setForm((current) => ({
      ...current,
      itemType: classification?.code ?? value,
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.itemCode.trim() || !form.itemName.trim()) {
      toast.error("กรุณาระบุ Code และชื่อ Item");
      return;
    }

    const itemTypeCode = getClassification(form.itemType)?.code ?? form.itemType.trim();
    const qtyValue = Math.max(0, Math.floor(Number(form.requiredInspectionQty) || 0));
    const overrideKey = (isEdit && originalItemNo ? originalItemNo : form.itemCode.trim());
    const overridePayload = {
      itemCode: form.itemCode.trim(),
      itemName: form.itemName.trim(),
      itemType: itemTypeCode,
      category: form.category.trim(),
      unit: form.unit.trim(),
      status: form.status,
      description: form.description.trim(),
      requiredInspectionQty: qtyValue,
    };

    setBusy(true);
    try {
      await api.put(`/master-item-meta/${encodeURIComponent(overrideKey)}`, overridePayload);
      // best-effort sync to n8n webhook (may not persist there)
      try {
        const payload = buildPayload(form, item);
        if (isEdit) {
          const id = getItemId(item);
          if (id) await api.patch(`/master-items/${encodeURIComponent(id)}`, payload);
        } else {
          await api.post("/master-items", payload);
        }
      } catch {
        // webhook sync failure is non-fatal — override is source of truth
      }
      toast.success(isEdit ? "แก้ไข item สำเร็จ" : "เพิ่ม item สำเร็จ");
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "แก้ไข Item" : "เพิ่ม Item"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4 grid-cols-1 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="itemCode">Code</Label>
              <Input
                id="itemCode"
                value={form.itemCode}
                onChange={(event) => setField("itemCode", event.target.value)}
                required
                disabled={isEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="itemName">ชื่อ Item</Label>
              <Input
                id="itemName"
                value={form.itemName}
                onChange={(event) => setField("itemName", event.target.value)}
                required
                disabled={isEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="itemType">ประเภท</Label>
              <Select value={getClassification(form.itemType)?.code ?? ""} onValueChange={setClassification}>
                <SelectTrigger id="itemType">
                  <SelectValue placeholder="เลือกประเภท" />
                </SelectTrigger>
                <SelectContent>
                  {classificationTypes.map((item) => (
                    <SelectItem key={item.key} value={item.code}>
                      {item.code} - {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">หมวดหมู่</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(event) => setField("category", event.target.value)}
                disabled={isEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={form.unit}
                onChange={(event) => setField("unit", event.target.value)}
                disabled={isEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="requiredInspectionQty">พารามิเตอร์</Label>
              <Input
                id="requiredInspectionQty"
                type="number"
                value={form.requiredInspectionQty}
                disabled
                readOnly
              />
              <p className="text-xs text-muted-foreground">
                คำนวนอัตโนมัติจากพารามิเตอร์ที่ตั้งไว้ในหน้า "พารามิเตอร์การตรวจสอบ"
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setField("status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="inactive">inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="description">รายละเอียด</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) => setField("description", event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={busy}>{busy ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MasterItemDetailDialog({
  item,
  originalItemNo,
  parameters,
  groups,
  itemGroupIds,
  extraColumns,
  onClose,
  onEdit,
}: {
  item: MasterItem;
  originalItemNo: string;
  parameters: ParameterItem[];
  groups: ItemGroupItem[];
  itemGroupIds: string[];
  extraColumns: string[];
  onClose: () => void;
  onEdit: () => void;
}) {
  // membership resolve มาจาก catalog ดิบแล้ว (ส่งเป็น itemGroupIds) — map เป็นชื่อกลุ่มเพื่อแสดง
  const memberGroups = groups.filter((grp) => itemGroupIds.includes(grp._id));
  const classification = getClassification(firstValue(item, typeKeys));
  const productType = getProductTypeGroup(item);
  const statusValue = firstValue(item, statusKeys);
  const statusLabel = statusValue === false || String(statusValue || "").toLowerCase() === "inactive"
    ? "inactive"
    : "active";

  const fields: Array<{ label: string; value: React.ReactNode; full?: boolean }> = [
    { label: "Code", value: <span className="font-semibold text-primary">{displayValue(originalItemNo || firstValue(item, codeKeys))}</span> },
    { label: "ชื่อ Item", value: displayValue(firstValue(item, nameKeys)) },
    { label: "commonname", value: displayValue(firstValue(item, commonNameKeys)) },
    { label: "ประเภท", value: classification ? `${classification.code} - ${classification.label}` : displayValue(firstValue(item, typeKeys)) },
    { label: "ประเภทสินค้า", value: displayProductType(productType) },
    { label: "หมวดหมู่", value: displayValue(getItemCategory(item)) },
    { label: "Unit", value: displayValue(firstValue(item, unitKeys)) },
    {
      label: "Status",
      value: (
        <Badge variant={statusLabel === "inactive" ? "secondary" : "default"}>{statusLabel}</Badge>
      ),
    },
    {
      label: "รายละเอียด",
      value: displayValue(firstValue(item, descriptionKeys)),
      full: true,
    },
  ];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <DialogTitle>รายละเอียด Item</DialogTitle>
            <Button size="icon" variant="ghost" onClick={onEdit} title="แก้ไข" className="-mt-1">
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-2 grid-cols-1 md:grid-cols-2">
          {fields.map((field) => (
            <div
              key={field.label}
              className={`space-y-1 ${field.full ? "md:col-span-2" : ""}`}
            >
              <div className="text-xs font-medium text-muted-foreground">{field.label}</div>
              <div className="text-sm break-words">{field.value}</div>
            </div>
          ))}

          {memberGroups.length > 0 && (
            <div className="md:col-span-2 space-y-1">
              <div className="text-xs font-medium text-muted-foreground">กลุ่มที่สังกัด</div>
              <div className="flex flex-wrap gap-1">
                {memberGroups.map((grp) => (
                  <Badge key={grp._id} variant="secondary">{grp.name}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>พารามิเตอร์ที่ตรงกับ Item นี้</span>
              <span>{parameters.length} รายการ</span>
            </div>
            {parameters.length > 0 ? (
              <ul className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
                {parameters.map((param) => (
                  <li key={param._id ?? param.name} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/70" />
                    <span className="min-w-0 flex-1 truncate font-medium">{param.name}</span>
                    {param.scope && (
                      <Badge variant="outline" className="h-4 px-1 text-[10px] uppercase">
                        {param.scope}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                ยังไม่มีพารามิเตอร์ที่ตรงกับ Item นี้
              </div>
            )}
          </div>

          {extraColumns.length > 0 && extraColumns.some((key) => String(item[key] ?? "").trim() !== "") && (
            <div className="md:col-span-2 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">ข้อมูลเพิ่มเติม</div>
              <div className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
                {extraColumns.map((key) => {
                  const value = displayValue(item[key]);
                  if (!value || value === "-") return null;
                  return (
                    <div key={key} className="space-y-0.5">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{key}</div>
                      <div className="text-sm break-words">{value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ปิด</Button>
          <Button onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-1.5" />
            แก้ไข
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const emptyMachineForm: MachineItem = {
  code: "",
  type: "",
  registerNo: "",
  name: "",
  manufacturer: "",
  model: "",
  serialNo: "",
  manualDoc: "",
  installDate: "",
  startDate: "",
  location: "",
  status: "active",
  note: "",
};

function MachinesTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<MachineItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [retiring, setRetiring] = useState<MachineItem | null>(null);
  const [viewing, setViewing] = useState<MachineItem | null>(null);

  const {
    data: machines = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["machines"],
    queryFn: () => api.getMachines(),
  });

  const locationOptions = useMemo(() => {
    const values = new Set<string>();
    machines.forEach((m) => { if (m.location) values.add(m.location); });
    return Array.from(values).sort((a, b) => a.localeCompare(b, ["th", "en"]));
  }, [machines]);

  const typeOptions = useMemo(() => {
    const values = new Set<string>();
    machines.forEach((m) => { if (m.type) values.add(m.type); });
    return Array.from(values).sort((a, b) => a.localeCompare(b, ["th", "en"]));
  }, [machines]);

  const filteredMachines = useMemo(() => {
    const q = search.trim().toLowerCase();
    return machines.filter((m) => {
      const matchesSearch = !q || [m.code, m.name, m.manufacturer, m.model, m.serialNo, m.registerNo, m.location]
        .some((v) => String(v ?? "").toLowerCase().includes(q));
      const matchesLocation = locationFilter === "all" || m.location === locationFilter;
      const matchesStatus = statusFilter === "all" || m.status === statusFilter;
      return matchesSearch && matchesLocation && matchesStatus;
    });
  }, [machines, search, locationFilter, statusFilter]);

  const handleRetire = async () => {
    if (!retiring?._id) return;
    try {
      await api.updateMachine(retiring._id, { status: "retired" });
      toast.success("ปลดระวางเครื่องมือสำเร็จ");
      setRetiring(null);
      queryClient.invalidateQueries({ queryKey: ["machines"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="h-5 w-5" />
          รายการเครื่องมือ
          <Badge variant="outline">{filteredMachines.length}</Badge>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="สถานที่ตั้ง" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานที่</SelectItem>
              {locationOptions.map((value) => (
                <SelectItem key={value} value={value}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="สถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="active">active</SelectItem>
              <SelectItem value="inactive">inactive</SelectItem>
              <SelectItem value="retired">retired</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหารหัส, ชื่อ, ยี่ห้อ..."
              className="pl-8"
            />
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            เพิ่มเครื่องมือ
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isError ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {(error as Error).message}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัส</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>ชื่อเครื่องมือ</TableHead>
                  <TableHead>สถานที่</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">กำลังโหลด...</TableCell>
                  </TableRow>
                ) : filteredMachines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      ยังไม่มีข้อมูลเครื่องมือ — กด "เพิ่มเครื่องมือ" เพื่อเริ่มบันทึก
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMachines.map((m) => (
                    <TableRow
                      key={m._id ?? m.code}
                      className="cursor-pointer"
                      onClick={() => setViewing(m)}
                      title="คลิกเพื่อดูรายละเอียด"
                    >
                      <TableCell className="font-semibold text-primary">{m.code}</TableCell>
                      <TableCell>{displayValue(m.type)}</TableCell>
                      <TableCell className="min-w-52 font-medium">{m.name}</TableCell>
                      <TableCell>{displayValue(m.location)}</TableCell>
                      <TableCell>
                        <Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status ?? "active"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" onClick={() => setEditing(m)} title="แก้ไข">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {m.status !== "retired" && (
                            <Button size="icon" variant="ghost" onClick={() => setRetiring(m)} title="ปลดระวาง">
                              <Archive className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {viewing && (
        <MachineDetailDialog
          item={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null); }}
          onRetire={() => { setRetiring(viewing); setViewing(null); }}
        />
      )}

      {(creating || editing) && (
        <MachineDialog
          item={editing}
          typeOptions={typeOptions}
          onClose={closeDialog}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["machines"] })}
        />
      )}

      {retiring && (
        <Dialog open onOpenChange={(open) => { if (!open) setRetiring(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>ยืนยันปลดระวางเครื่องมือ</DialogTitle>
            </DialogHeader>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>{retiring.code} - {retiring.name}</div>
              <div>เครื่องมือจะถูกตั้งสถานะเป็น <span className="font-medium text-foreground">retired</span> (เลิกใช้งาน) ไม่ใช่การลบข้อมูล</div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRetiring(null)}>ยกเลิก</Button>
              <Button variant="destructive" onClick={handleRetire}>ปลดระวาง</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function MachineDetailDialog({
  item,
  onClose,
  onEdit,
  onRetire,
}: {
  item: MachineItem;
  onClose: () => void;
  onEdit: () => void;
  onRetire: () => void;
}) {
  const Row = ({ label, value }: { label: string; value?: string }) => (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium break-words">{displayValue(value)}</div>
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-primary">{item.code}</span>
            <span className="font-normal text-muted-foreground">{item.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <Row label="ประเภท" value={item.type} />
          <Row label="ทะเบียน" value={item.registerNo} />
          <Row label="ยี่ห้อ / ผู้ผลิต" value={item.manufacturer} />
          <Row label="รุ่น" value={item.model} />
          <Row label="S/N" value={item.serialNo} />
          <Row label="สถานที่ตั้ง" value={item.location} />
          <Row label="วันที่ติดตั้ง" value={item.installDate} />
          <Row label="เริ่มใช้งาน" value={item.startDate} />
          <Row label="เอกสารวิธีปฏิบัติงาน" value={item.manualDoc} />
          <Row label="สถานะ" value={item.status} />
          {item.note ? (
            <div className="col-span-2">
              <Row label="หมายเหตุ" value={item.note} />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ปิด</Button>
          {item.status !== "retired" && (
            <Button variant="destructive" onClick={onRetire}>
              <Archive className="h-4 w-4" />
              ปลดระวาง
            </Button>
          )}
          <Button onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            แก้ไข
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MachineDialog({
  item,
  typeOptions,
  onClose,
  onSaved,
}: {
  item: MachineItem | null;
  typeOptions: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<MachineItem>(() => item ? { ...item } : { ...emptyMachineForm });
  const [busy, setBusy] = useState(false);
  const [addingType, setAddingType] = useState(false);
  const [newType, setNewType] = useState("");
  const isEdit = !!item?._id;

  const setField = <K extends keyof MachineItem>(key: K, value: MachineItem[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  // รวมประเภทที่มีอยู่ + ค่าปัจจุบัน (เผื่อแก้ไขเครื่องที่เป็นประเภทเก่าที่ไม่อยู่ในลิสต์)
  const typeChoices = useMemo(() => {
    const set = new Set(typeOptions);
    if (form.type) set.add(form.type);
    return Array.from(set).sort((a, b) => a.localeCompare(b, ["th", "en"]));
  }, [typeOptions, form.type]);

  const confirmNewType = () => {
    const v = newType.trim();
    if (v) setField("type", v);
    setAddingType(false);
    setNewType("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("กรุณาระบุรหัสและชื่อเครื่องมือ");
      return;
    }
    setBusy(true);
    try {
      if (isEdit && item?._id) {
        await api.updateMachine(item._id, form);
        toast.success("แก้ไขเครื่องมือสำเร็จ");
      } else {
        await api.createMachine(form);
        toast.success("เพิ่มเครื่องมือสำเร็จ");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "แก้ไขเครื่องมือ" : "เพิ่มเครื่องมือ"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4 grid-cols-1 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="m-code">รหัสเครื่องมือ *</Label>
              <Input id="m-code" value={form.code} onChange={(e) => setField("code", e.target.value)} required placeholder="LD-049" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-type">ประเภท</Label>
              {addingType ? (
                <div className="flex gap-2">
                  <Input
                    id="m-type"
                    autoFocus
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    placeholder="พิมพ์ชื่อประเภทใหม่"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); confirmNewType(); }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={confirmNewType}>เพิ่ม</Button>
                  <Button type="button" variant="ghost" onClick={() => { setAddingType(false); setNewType(""); }}>ยกเลิก</Button>
                </div>
              ) : (
                <Select
                  value={form.type || ""}
                  onValueChange={(v) => {
                    if (v === "__add_new__") { setAddingType(true); setNewType(""); }
                    else setField("type", v);
                  }}
                >
                  <SelectTrigger id="m-type">
                    <SelectValue placeholder="เลือกประเภท" />
                  </SelectTrigger>
                  <SelectContent>
                    {typeChoices.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                    <SelectItem value="__add_new__" className="text-primary">➕ เพิ่มประเภทใหม่</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-register">หมายเลขทะเบียน</Label>
              <Input id="m-register" value={form.registerNo ?? ""} onChange={(e) => setField("registerNo", e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="m-name">ชื่อเครื่องมือ *</Label>
              <Input id="m-name" value={form.name} onChange={(e) => setField("name", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-manufacturer">ยี่ห้อ / ผู้ผลิต</Label>
              <Input id="m-manufacturer" value={form.manufacturer ?? ""} onChange={(e) => setField("manufacturer", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-model">รุ่น</Label>
              <Input id="m-model" value={form.model ?? ""} onChange={(e) => setField("model", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-serial">หมายเลขเครื่อง (S/N)</Label>
              <Input id="m-serial" value={form.serialNo ?? ""} onChange={(e) => setField("serialNo", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-doc">เอกสารวิธีปฏิบัติงาน</Label>
              <Input id="m-doc" value={form.manualDoc ?? ""} onChange={(e) => setField("manualDoc", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-install">วันที่ติดตั้ง</Label>
              <Input id="m-install" value={form.installDate ?? ""} onChange={(e) => setField("installDate", e.target.value)} placeholder="dd/mm/yyyy" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-start">วันที่เริ่มใช้งาน</Label>
              <Input id="m-start" value={form.startDate ?? ""} onChange={(e) => setField("startDate", e.target.value)} placeholder="dd/mm/yyyy" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-location">สถานที่ตั้ง</Label>
              <Input id="m-location" value={form.location ?? ""} onChange={(e) => setField("location", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>สถานะ</Label>
              <Select value={form.status ?? "active"} onValueChange={(v) => setField("status", v as MachineItem["status"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="inactive">inactive</SelectItem>
                  <SelectItem value="retired">retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="m-note">หมายเหตุ</Label>
              <Textarea id="m-note" value={form.note ?? ""} onChange={(e) => setField("note", e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={busy}>{busy ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
