import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Database,
  FlaskConical,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
  Download,
} from "lucide-react";
import { toast } from "sonner";

import AppLayout from "@/components/lis/AppLayout";
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
import { api, type MachineItem } from "@/lib/api";

type MasterItem = Record<string, unknown>;
type SimpleInstrument = "GC" | "HPLC";

const INSTRUMENT_ORDER: SimpleInstrument[] = ["GC", "HPLC"];

type SimpleMethodRow = {
  key: string;
  tradeName: string;
  commonName: string;
  instruments: SimpleInstrument[];
  itemCount: number;
  itemNos: string[];
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
};

const emptyForm: MasterItemForm = {
  itemCode: "",
  itemName: "",
  itemType: "",
  category: "",
  unit: "",
  status: "active",
  description: "",
};

const DIRECT_MASTER_ITEM_URL = "https://n8n-plant.icpladda.com/webhook/API/Item-production";

const classificationTypes = [
  { key: "ulv", code: "ULV", label: "น้ำ (ยูแอลวี)", group: "water" },
  { key: "ec", code: "EC", label: "น้ำ (อีซี)", group: "water" },
  { key: "ew", code: "EW", label: "น้ำ (อีดับเบิ้ลยู)", group: "water" },
  { key: "sc", code: "SC", label: "น้ำ (เอสซี)", group: "water" },
  { key: "sl", code: "SL", label: "น้ำ (เอสแอล)", group: "water" },
  { key: "wv", code: "W/V", label: "น้ำ (ดับเบิ้ลยูวี)", group: "water" },
  { key: "ww", code: "W/W", label: "ทราย/เม็ด", group: "sand" },
  { key: "wp", code: "WP", label: "ผง (ดับเบิลยูพี)", group: "powder" },
  { key: "wdg", code: "WDG", label: "เม็ด/ผงเม็ด (ดับเบิลยูจี)", group: "powder" },
  { key: "gr", code: "GR", label: "ทราย/เม็ด (จีอาร์)", group: "sand" },
  { key: "st", code: "ST", label: "เม็ดละลายน้ำ (เอสที)", group: "sand" },
  { key: "sp", code: "SP", label: "ผง (เอสพี)", group: "powder" },
  { key: "ds", code: "DS", label: "ผง (ดีเอส)", group: "powder" },
  { key: "dp", code: "DP", label: "ผงฝุ่น", group: "powder" },
] as const;

const productTypeLabels: Record<string, string> = {
  water: "น้ำ",
  sand: "ยา",
  powder: "ผง",
};

const idKeys = ["_id", "id", "itemId", "item_id", "item_no", "code", "itemCode"];
const codeKeys = ["item_no", "itemCode", "item_code", "code", "Code", "ITEM_CODE"];
const nameKeys = ["item_name1", "itemName", "item_name", "name", "Name", "ITEM_NAME", "description"];
const typeKeys = ["common_name", "commonname", "commonName", "itemType", "item_type"];
const categoryKeys = ["inventory_posting_group", "category", "type", "group", "itemGroup", "item_group"];
const unitKeys = ["base_unit_of_mea", "unit", "uom", "UOM", "unitName"];
const statusKeys = ["status", "active", "isActive"];
const descriptionKeys = ["item_name2", "item_name3", "description", "detail", "remark", "note"];
const tradeNameKeys = ["trade_name", "tradename", "tradeName", "item_name1", "itemName"];
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

function detectInstruments(value: unknown): SimpleInstrument[] {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text) return [];
  const found: SimpleInstrument[] = [];
  if (/\bGC\b/.test(text)) found.push("GC");
  if (/\bHPLC\b/.test(text)) found.push("HPLC");
  return found;
}

function sortInstruments(values: Iterable<SimpleInstrument>): SimpleInstrument[] {
  const set = new Set(values);
  return INSTRUMENT_ORDER.filter((value) => set.has(value));
}

function toggleInstrument(
  current: SimpleInstrument[],
  value: SimpleInstrument,
  enabled: boolean,
): SimpleInstrument[] {
  const next = new Set(current);
  if (enabled) next.add(value);
  else next.delete(value);
  return sortInstruments(next);
}

function instrumentsEqual(a: SimpleInstrument[], b: SimpleInstrument[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = sortInstruments(a);
  const sortedB = sortInstruments(b);
  return sortedA.every((value, index) => value === sortedB[index]);
}

function displayValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function normalizeClassificationValue(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s_-]/g, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getClassification(value: unknown) {
  const rawValue = String(value ?? "").trim();
  const normalized = normalizeClassificationValue(rawValue);
  const exactMatch = classificationTypes.find((item) => (
    normalizeClassificationValue(item.key) === normalized ||
    normalizeClassificationValue(item.code) === normalized ||
    normalizeClassificationValue(item.label) === normalized
  ));
  if (exactMatch) return exactMatch;

  const upperValue = rawValue.toUpperCase();
  return [...classificationTypes]
    .sort((a, b) => b.code.length - a.code.length)
    .find((item) => {
      const pattern = new RegExp(`(^|[^A-Z0-9])${escapeRegExp(item.code.toUpperCase())}([^A-Z0-9]|$)`);
      return pattern.test(upperValue);
    });
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

function getItemId(item: MasterItem) {
  const value = firstValue(item, idKeys);
  return value ? String(value) : "";
}

function getSimpleInstruments(item: MasterItem): SimpleInstrument[] {
  const collected = new Set<SimpleInstrument>();
  for (const key of methodInstrumentKeys) {
    for (const instrument of detectInstruments(item[key])) {
      collected.add(instrument);
    }
  }
  return sortInstruments(collected);
}

function buildSimpleMethodRows(
  items: MasterItem[],
  overrides: Record<string, SimpleInstrument[]> = {},
): SimpleMethodRow[] {
  const groups = new Map<string, SimpleMethodRow>();

  const instrumentSets = new Map<string, Set<SimpleInstrument>>();

  items.forEach((item) => {
    const tradeName = String(firstValue(item, tradeNameKeys)).trim();
    const commonName = String(firstValue(item, commonNameKeys)).trim();
    if (!tradeName && !commonName) return;

    const key = `${tradeName.toLowerCase()}||${commonName.toLowerCase()}`;
    const itemNo = String(firstValue(item, codeKeys)).trim();
    const override = itemNo ? overrides[itemNo] : undefined;
    const instruments = override ?? getSimpleInstruments(item);
    const existing = groups.get(key);
    const instrumentSet = instrumentSets.get(key) ?? new Set<SimpleInstrument>();
    instruments.forEach((value) => instrumentSet.add(value));
    instrumentSets.set(key, instrumentSet);

    if (existing) {
      existing.itemCount += 1;
      existing.items.push(item);
      if (itemNo && !existing.itemNos.includes(itemNo)) existing.itemNos.push(itemNo);
      return;
    }

    groups.set(key, {
      key,
      tradeName,
      commonName,
      instruments: [],
      itemCount: 1,
      itemNos: itemNo ? [itemNo] : [],
      items: [item],
    });
  });

  groups.forEach((row, key) => {
    row.instruments = sortInstruments(instrumentSets.get(key) ?? new Set());
  });

  return Array.from(groups.values()).sort((a, b) => (
    a.tradeName.localeCompare(b.tradeName, ["th", "en"]) ||
    a.commonName.localeCompare(b.commonName, ["th", "en"])
  ));
}

function itemToForm(item: MasterItem): MasterItemForm {
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
  const [editing, setEditing] = useState<MasterItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<MasterItem | null>(null);

  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
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

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !q || JSON.stringify(item).toLowerCase().includes(q);
      const matchesCategory = categoryFilter === "all" || getItemCategory(item) === categoryFilter;
      const matchesProductType = productTypeFilter === "all" || getProductTypeGroup(item) === productTypeFilter;
      return matchesSearch && matchesCategory && matchesProductType;
    });
  }, [categoryFilter, items, productTypeFilter, search]);

  const categoryOptions = useMemo(() => {
    const values = new Set<string>();
    items.forEach((item) => {
      const category = getItemCategory(item);
      if (category) values.add(category);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [items]);

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

  const activeCount = items.filter((item) => {
    const status = firstValue(item, statusKeys);
    if (status === "") return true;
    return status === true || String(status || "").toLowerCase() === "active";
  }).length;

  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const id = getItemId(deleting);
    if (!id) {
      toast.error("ไม่พบรหัส item สำหรับลบ");
      return;
    }

    try {
      await api.delete(`/master-items/${encodeURIComponent(id)}`);
      toast.success("ลบ item สำเร็จ");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["master-items"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <AppLayout>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Database className="h-6 w-6" />
              Master Item
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              จัดการรายการ item จาก n8n webhook
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              เพิ่ม Item
            </Button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-3">
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
          <CardHeader className="flex flex-col gap-3 space-y-0 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageSearch className="h-5 w-5" />
              รายการ Item
              <Badge variant="outline">{filteredItems.length}</Badge>
            </CardTitle>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-44">
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
              <SelectTrigger className="w-full md:w-44">
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
            <div className="relative w-full md:w-80">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหา item"
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isError ? (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {(error as Error).message}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>ชื่อ Item</TableHead>
                      <TableHead>commonname</TableHead>
                      <TableHead>ประเภทสินค้า</TableHead>
                      <TableHead>หมวดหมู่</TableHead>
                      <TableHead>Unit</TableHead>
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
                        <TableCell colSpan={8 + extraColumns.length} className="py-8 text-center text-muted-foreground">
                          กำลังโหลด...
                        </TableCell>
                      </TableRow>
                    ) : filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8 + extraColumns.length} className="py-8 text-center text-muted-foreground">
                          ไม่มีข้อมูล
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredItems.map((item, index) => {
                        const form = itemToForm(item);
                        const rowKey = getItemId(item) || `row-${index}`;
                        return (
                          <TableRow key={rowKey}>
                            <TableCell className="font-semibold text-primary">
                              {displayValue(firstValue(item, codeKeys))}
                            </TableCell>
                            <TableCell className="min-w-56 font-medium">
                              {displayValue(firstValue(item, nameKeys))}
                            </TableCell>
                            <TableCell>{displayValue(firstValue(item, typeKeys))}</TableCell>
                            <TableCell>{displayProductType(getProductTypeGroup(item))}</TableCell>
                            <TableCell>{displayValue(getItemCategory(item))}</TableCell>
                            <TableCell>{displayValue(firstValue(item, unitKeys))}</TableCell>
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
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => setEditing(item)} title="แก้ไข">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => setDeleting(item)} title="ลบ">
                                  <Trash2 className="h-4 w-4 text-destructive" />
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

        {(creating || editing) && (
          <MasterItemDialog
            item={editing}
            onClose={closeDialog}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["master-items"] })}
          />
        )}

        {deleting && (
          <Dialog open onOpenChange={(open) => { if (!open) setDeleting(null); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>ยืนยันลบ Item</DialogTitle>
              </DialogHeader>
              <div className="text-sm text-muted-foreground">
                {displayValue(firstValue(deleting, codeKeys))} - {displayValue(firstValue(deleting, nameKeys))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleting(null)}>ยกเลิก</Button>
                <Button variant="destructive" onClick={handleDelete}>ลบ</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
    </AppLayout>
  );
}

type SimpleMethodFilter = "all" | "gc-only" | "hplc-only" | "both" | "unassigned";

export function SimpleMethodPage() {
  const queryClient = useQueryClient();
  const [methodDrafts, setMethodDrafts] = useState<Record<string, SimpleInstrument[]>>({});
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

  const { data: overrides = {} } = useQuery({
    queryKey: ["simple-methods"],
    queryFn: async () => {
      const res = await api.get<Array<{ itemNo: string; instruments: string[] }>>("/simple-methods");
      const map: Record<string, SimpleInstrument[]> = {};
      (res.data.data || []).forEach((entry) => {
        if (!entry || !entry.itemNo) return;
        const filtered = (entry.instruments || [])
          .map((value) => String(value).toUpperCase())
          .filter((value): value is SimpleInstrument => value === "GC" || value === "HPLC");
        map[entry.itemNo] = sortInstruments(filtered);
      });
      return map;
    },
  });

  const rows = useMemo(() => buildSimpleMethodRows(items, overrides), [items, overrides]);

  const visibleRows = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    return rows.filter((row) => {
      if (needle) {
        const haystack = `${row.tradeName} ${row.commonName} ${row.itemNos.join(" ")}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (statusFilter === "all") return true;
      const hasGC = row.instruments.includes("GC");
      const hasHPLC = row.instruments.includes("HPLC");
      switch (statusFilter) {
        case "gc-only": return hasGC && !hasHPLC;
        case "hplc-only": return hasHPLC && !hasGC;
        case "both": return hasGC && hasHPLC;
        case "unassigned": return row.instruments.length === 0;
        default: return true;
      }
    });
  }, [rows, searchText, statusFilter]);

  const dirtyRows = useMemo(
    () => rows.filter((row) => {
      const draft = methodDrafts[row.key];
      return draft !== undefined && !instrumentsEqual(draft, row.instruments);
    }),
    [rows, methodDrafts],
  );

  const setMethodDraft = (key: string, instruments: SimpleInstrument[]) => {
    setMethodDrafts((current) => ({
      ...current,
      [key]: sortInstruments(instruments),
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

  const applyBulk = (instruments: SimpleInstrument[]) => {
    if (selectedKeys.size === 0) return;
    const sorted = sortInstruments(instruments);
    setMethodDrafts((current) => {
      const next = { ...current };
      selectedKeys.forEach((key) => {
        next[key] = sorted;
      });
      return next;
    });
  };

  const saveAllDirty = async () => {
    if (dirtyRows.length === 0) return;
    setSavingAll(true);
    try {
      const updates = dirtyRows.flatMap((row) => {
        const instruments = methodDrafts[row.key] ?? row.instruments;
        return row.items
          .map((item) => String(firstValue(item, codeKeys)).trim())
          .filter((itemNo) => itemNo)
          .map((itemNo) => ({ itemNo, instruments }));
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
        <div className="mb-4 shrink-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <FlaskConical className="h-6 w-6" />
            Simple Method
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            กำหนด GC/HPLC ตาม tradename และ commonname
          </p>
        </div>

        <SimpleMethodTab
          rows={visibleRows}
          totalRows={rows.length}
          isLoading={isLoading}
          isError={isError}
          error={error}
          methodDrafts={methodDrafts}
          selectedKeys={selectedKeys}
          searchText={searchText}
          statusFilter={statusFilter}
          onSearchTextChange={setSearchText}
          onStatusFilterChange={setStatusFilter}
          onDraftChange={setMethodDraft}
          onToggleRow={toggleRowSelected}
          onToggleAll={toggleAllVisibleSelected}
        />

        <div className="pointer-events-none absolute inset-x-6 bottom-6 z-30 flex justify-center">
          <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-full border bg-card px-4 py-2 shadow-lg">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">เลือก</span>
                <Badge variant="secondary" className="rounded-full">{selectedKeys.size}</Badge>
                <span className="text-muted-foreground">รายการ</span>
              </div>
              <div className="mx-1 h-6 w-px bg-border" aria-hidden />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">เปลี่ยนเป็น:</span>
                {INSTRUMENT_ORDER.map((instrument) => (
                  <Button
                    key={instrument}
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-full px-3"
                    disabled={selectedKeys.size === 0}
                    onClick={() => applyBulk([instrument])}
                  >
                    {instrument}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-full px-3"
                  disabled={selectedKeys.size === 0}
                  onClick={() => applyBulk([...INSTRUMENT_ORDER])}
                >
                  ทั้งหมด
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-full px-3 text-muted-foreground"
                  disabled={selectedKeys.size === 0}
                  onClick={() => applyBulk([])}
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
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Wrench className="h-6 w-6" />
            รายการเครื่อง
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            จัดการเครื่องมือและข้อมูลทะเบียนเครื่อง
          </p>
        </div>

        <MachinesTab />
    </AppLayout>
  );
}

function SimpleMethodTab({
  rows,
  totalRows,
  isLoading,
  isError,
  error,
  methodDrafts,
  selectedKeys,
  searchText,
  statusFilter,
  onSearchTextChange,
  onStatusFilterChange,
  onDraftChange,
  onToggleRow,
  onToggleAll,
}: {
  rows: SimpleMethodRow[];
  totalRows: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  methodDrafts: Record<string, SimpleInstrument[]>;
  selectedKeys: Set<string>;
  searchText: string;
  statusFilter: SimpleMethodFilter;
  onSearchTextChange: (value: string) => void;
  onStatusFilterChange: (value: SimpleMethodFilter) => void;
  onDraftChange: (key: string, instruments: SimpleInstrument[]) => void;
  onToggleRow: (key: string, selected: boolean) => void;
  onToggleAll: (selected: boolean) => void;
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
              placeholder="ค้นหา tradename / commonname / item no..."
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as SimpleMethodFilter)}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="ทุก Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุก Method</SelectItem>
              <SelectItem value="gc-only">GC เท่านั้น</SelectItem>
              <SelectItem value="hplc-only">HPLC เท่านั้น</SelectItem>
              <SelectItem value="both">GC + HPLC</SelectItem>
              <SelectItem value="unassigned">ยังไม่กำหนด</SelectItem>
            </SelectContent>
          </Select>
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
                  <TableHead>tradename</TableHead>
                  <TableHead>commonname</TableHead>
                  <TableHead className="w-28 text-center">Items</TableHead>
                  <TableHead className="w-64">Method/Instrument</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      กำลังโหลด...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      ไม่มีข้อมูล simple method
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const draftValue = methodDrafts[row.key] ?? row.instruments;
                    const allChecked: boolean | "indeterminate" =
                      draftValue.length === INSTRUMENT_ORDER.length
                        ? true
                        : draftValue.length === 0
                          ? false
                          : "indeterminate";
                    const isDirty =
                      methodDrafts[row.key] !== undefined &&
                      !instrumentsEqual(methodDrafts[row.key], row.instruments);
                    const isRowSelected = selectedKeys.has(row.key);

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
                            aria-label={`เลือกแถว ${row.tradeName}`}
                          />
                        </TableCell>
                        <TableCell className="min-w-52 font-medium">{displayValue(row.tradeName)}</TableCell>
                        <TableCell className="min-w-72">{displayValue(row.commonName)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{row.itemCount}</Badge>
                        </TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={`flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-left text-sm ring-offset-background transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                                  isDirty ? "border-primary" : "border-input"
                                }`}
                              >
                                {draftValue.length === 0 ? (
                                  <span className="text-muted-foreground">เลือก method...</span>
                                ) : (
                                  draftValue.map((m) => (
                                    <Badge key={m} variant="secondary" className="rounded-full">
                                      {m}
                                    </Badge>
                                  ))
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-44 p-2">
                              <div className="flex flex-col gap-1">
                                <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
                                  <Checkbox
                                    checked={allChecked}
                                    onCheckedChange={(checked) =>
                                      onDraftChange(row.key, checked ? [...INSTRUMENT_ORDER] : [])
                                    }
                                  />
                                  ทั้งหมด
                                </label>
                                {INSTRUMENT_ORDER.map((instrument) => (
                                  <label
                                    key={instrument}
                                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                  >
                                    <Checkbox
                                      checked={draftValue.includes(instrument)}
                                      onCheckedChange={(checked) =>
                                        onDraftChange(row.key, toggleInstrument(draftValue, instrument, !!checked))
                                      }
                                    />
                                    {instrument}
                                  </label>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
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

function MasterItemDialog({
  item,
  onClose,
  onSaved,
}: {
  item: MasterItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<MasterItemForm>(() => item ? itemToForm(item) : emptyForm);
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

    const payload = buildPayload(form, item);
    setBusy(true);
    try {
      if (isEdit) {
        const id = getItemId(item);
        await api.patch(`/master-items/${encodeURIComponent(id)}`, payload);
      } else {
        await api.post("/master-items", payload);
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
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "แก้ไข Item" : "เพิ่ม Item"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="itemCode">Code</Label>
              <Input
                id="itemCode"
                value={form.itemCode}
                onChange={(event) => setField("itemCode", event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="itemName">ชื่อ Item</Label>
              <Input
                id="itemName"
                value={form.itemName}
                onChange={(event) => setField("itemName", event.target.value)}
                required
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
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={form.unit}
                onChange={(event) => setField("unit", event.target.value)}
              />
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

const emptyMachineForm: MachineItem = {
  code: "",
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
  const [deleting, setDeleting] = useState<MachineItem | null>(null);
  const [seeding, setSeeding] = useState(false);

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

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const result = await api.seedMachines();
      toast.success(`นำเข้าข้อมูลตั้งต้น: เพิ่มใหม่ ${result.inserted} / ทั้งหมด ${result.total}`);
      queryClient.invalidateQueries({ queryKey: ["machines"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting?._id) return;
    try {
      await api.deleteMachine(deleting._id);
      toast.success("ลบเครื่องมือสำเร็จ");
      setDeleting(null);
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
      <CardHeader className="flex flex-col gap-3 space-y-0 md:flex-row md:items-center md:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="h-5 w-5" />
          รายการเครื่องมือ
          <Badge variant="outline">{filteredMachines.length}</Badge>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-full md:w-48">
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
            <SelectTrigger className="w-full md:w-36">
              <SelectValue placeholder="สถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="active">active</SelectItem>
              <SelectItem value="inactive">inactive</SelectItem>
              <SelectItem value="retired">retired</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full md:w-72">
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
          <Button variant="outline" onClick={handleSeed} disabled={seeding} title="นำเข้าข้อมูลตั้งต้นจาก machine.xls (เพิ่มเฉพาะรหัสที่ยังไม่มี)">
            <Download className="h-4 w-4" />
            {seeding ? "กำลังนำเข้า..." : "นำเข้าข้อมูลตั้งต้น"}
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัส</TableHead>
                  <TableHead>ทะเบียน</TableHead>
                  <TableHead>ชื่อเครื่องมือ</TableHead>
                  <TableHead>ยี่ห้อ / ผู้ผลิต</TableHead>
                  <TableHead>รุ่น</TableHead>
                  <TableHead>S/N</TableHead>
                  <TableHead>วันที่ติดตั้ง</TableHead>
                  <TableHead>เริ่มใช้งาน</TableHead>
                  <TableHead>สถานที่</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">กำลังโหลด...</TableCell>
                  </TableRow>
                ) : filteredMachines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                      ยังไม่มีข้อมูลเครื่องมือ — กด "นำเข้าข้อมูลตั้งต้น" เพื่อโหลดข้อมูลจาก machine.xls
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMachines.map((m) => (
                    <TableRow key={m._id ?? m.code}>
                      <TableCell className="font-semibold text-primary">{m.code}</TableCell>
                      <TableCell>{displayValue(m.registerNo)}</TableCell>
                      <TableCell className="min-w-52 font-medium">{m.name}</TableCell>
                      <TableCell>{displayValue(m.manufacturer)}</TableCell>
                      <TableCell>{displayValue(m.model)}</TableCell>
                      <TableCell>{displayValue(m.serialNo)}</TableCell>
                      <TableCell>{displayValue(m.installDate)}</TableCell>
                      <TableCell>{displayValue(m.startDate)}</TableCell>
                      <TableCell>{displayValue(m.location)}</TableCell>
                      <TableCell>
                        <Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status ?? "active"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(m)} title="แก้ไข">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleting(m)} title="ลบ">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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

      {(creating || editing) && (
        <MachineDialog
          item={editing}
          onClose={closeDialog}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["machines"] })}
        />
      )}

      {deleting && (
        <Dialog open onOpenChange={(open) => { if (!open) setDeleting(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>ยืนยันลบเครื่องมือ</DialogTitle>
            </DialogHeader>
            <div className="text-sm text-muted-foreground">
              {deleting.code} - {deleting.name}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)}>ยกเลิก</Button>
              <Button variant="destructive" onClick={handleDelete}>ลบ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function MachineDialog({
  item,
  onClose,
  onSaved,
}: {
  item: MachineItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<MachineItem>(() => item ? { ...item } : { ...emptyMachineForm });
  const [busy, setBusy] = useState(false);
  const isEdit = !!item?._id;

  const setField = <K extends keyof MachineItem>(key: K, value: MachineItem[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
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
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "แก้ไขเครื่องมือ" : "เพิ่มเครื่องมือ"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="m-code">รหัสเครื่องมือ *</Label>
              <Input id="m-code" value={form.code} onChange={(e) => setField("code", e.target.value)} required placeholder="LD-049" />
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
