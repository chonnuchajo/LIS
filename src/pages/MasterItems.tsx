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
} from "lucide-react";
import { toast } from "sonner";

import AppSidebar from "@/components/lis/AppSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

type MasterItem = Record<string, unknown>;
type SimpleInstrument = "GC" | "HPLC" | "";

type SimpleMethodRow = {
  key: string;
  tradeName: string;
  commonName: string;
  instrument: SimpleInstrument;
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

function detectInstrument(value: unknown): SimpleInstrument {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text) return "";
  if (/\bHPLC\b/.test(text)) return "HPLC";
  if (/\bGC\b/.test(text)) return "GC";
  return "";
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

function getSimpleInstrument(item: MasterItem): SimpleInstrument {
  for (const key of methodInstrumentKeys) {
    const instrument = detectInstrument(item[key]);
    if (instrument) return instrument;
  }
  return "";
}

function buildSimpleMethodRows(items: MasterItem[]): SimpleMethodRow[] {
  const groups = new Map<string, SimpleMethodRow>();

  items.forEach((item) => {
    const tradeName = String(firstValue(item, tradeNameKeys)).trim();
    const commonName = String(firstValue(item, commonNameKeys)).trim();
    if (!tradeName && !commonName) return;

    const key = `${tradeName.toLowerCase()}||${commonName.toLowerCase()}`;
    const itemNo = String(firstValue(item, codeKeys)).trim();
    const instrument = getSimpleInstrument(item);
    const existing = groups.get(key);

    if (existing) {
      existing.itemCount += 1;
      existing.items.push(item);
      if (itemNo && !existing.itemNos.includes(itemNo)) existing.itemNos.push(itemNo);
      if (!existing.instrument && instrument) existing.instrument = instrument;
      return;
    }

    groups.set(key, {
      key,
      tradeName,
      commonName,
      instrument,
      itemCount: 1,
      itemNos: itemNo ? [itemNo] : [],
      items: [item],
    });
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
  const [methodDrafts, setMethodDrafts] = useState<Record<string, SimpleInstrument>>({});
  const [savingMethodKey, setSavingMethodKey] = useState<string | null>(null);

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

  const simpleMethodRows = useMemo(() => buildSimpleMethodRows(items), [items]);
  const configuredMethodCount = simpleMethodRows.filter((row) => row.instrument).length;

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

  const setMethodDraft = (key: string, value: string) => {
    setMethodDrafts((current) => ({
      ...current,
      [key]: value === "GC" || value === "HPLC" ? value : "",
    }));
  };

  const saveSimpleMethod = async (row: SimpleMethodRow) => {
    const instrument = methodDrafts[row.key] ?? row.instrument;
    const patchTargets = row.items
      .map((item) => ({ item, id: getItemId(item) }))
      .filter((target) => target.id);

    if (patchTargets.length === 0) {
      toast.error("ไม่พบรหัส item สำหรับบันทึก method");
      return;
    }

    setSavingMethodKey(row.key);
    try {
      await Promise.all(patchTargets.map(({ item, id }) => api.patch(`/master-items/${encodeURIComponent(id)}`, {
        ...item,
        simple_method: instrument,
        simpleMethod: instrument,
        instrument,
      })));
      toast.success("บันทึก simple method สำเร็จ");
      setMethodDrafts((current) => {
        const next = { ...current };
        delete next[row.key];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["master-items"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingMethodKey(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto p-6">
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

        <div className="mb-4 grid gap-3 md:grid-cols-4">
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
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Simple Method</div>
              <div className="mt-1 text-2xl font-semibold">{configuredMethodCount}/{simpleMethodRows.length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="items" className="space-y-4">
          <TabsList>
            <TabsTrigger value="items" className="gap-1.5">
              <PackageSearch className="h-4 w-4" />
              Items
            </TabsTrigger>
            <TabsTrigger value="simple-method" className="gap-1.5">
              <FlaskConical className="h-4 w-4" />
              Simple Method
            </TabsTrigger>
          </TabsList>

          <TabsContent value="items">
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
          </TabsContent>

          <TabsContent value="simple-method">
            <SimpleMethodTab
              rows={simpleMethodRows}
              isLoading={isLoading}
              isError={isError}
              error={error}
              methodDrafts={methodDrafts}
              savingMethodKey={savingMethodKey}
              onDraftChange={setMethodDraft}
              onSave={saveSimpleMethod}
            />
          </TabsContent>
        </Tabs>

        {(creating || editing) && (
          <MasterItemDialog
            item={editing}
            onClose={closeDialog}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["master-items"] })}
          />
        )}

        {deleting && (
          <Dialog open onOpenChange={(open) => { if (!open) setDeleting(null); }}>
            <DialogContent className="max-w-md">
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
      </main>
    </div>
  );
}

function SimpleMethodTab({
  rows,
  isLoading,
  isError,
  error,
  methodDrafts,
  savingMethodKey,
  onDraftChange,
  onSave,
}: {
  rows: SimpleMethodRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  methodDrafts: Record<string, SimpleInstrument>;
  savingMethodKey: string | null;
  onDraftChange: (key: string, value: string) => void;
  onSave: (row: SimpleMethodRow) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 space-y-0 md:flex-row md:items-center md:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-5 w-5" />
          จัดการ Simple Method
          <Badge variant="outline">{rows.length}</Badge>
        </CardTitle>
        <div className="text-sm text-muted-foreground">เรียงตาม tradename และ commonname</div>
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
                  <TableHead>tradename</TableHead>
                  <TableHead>commonname</TableHead>
                  <TableHead className="w-28 text-center">Items</TableHead>
                  <TableHead className="w-44">Method/Instrument</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
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
                    const draftValue = methodDrafts[row.key] ?? row.instrument;
                    const selectValue = draftValue || "unassigned";
                    const isDirty = methodDrafts[row.key] !== undefined && methodDrafts[row.key] !== row.instrument;
                    const isSaving = savingMethodKey === row.key;

                    return (
                      <TableRow key={row.key}>
                        <TableCell className="min-w-52 font-medium">{displayValue(row.tradeName)}</TableCell>
                        <TableCell className="min-w-72">{displayValue(row.commonName)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{row.itemCount}</Badge>
                        </TableCell>
                        <TableCell>
                          <Select value={selectValue} onValueChange={(value) => onDraftChange(row.key, value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">ยังไม่กำหนด</SelectItem>
                              <SelectItem value="GC">GC</SelectItem>
                              <SelectItem value="HPLC">HPLC</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant={isDirty ? "default" : "outline"}
                              disabled={isSaving || !isDirty}
                              onClick={() => onSave(row)}
                            >
                              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
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
      <DialogContent className="max-w-2xl">
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
