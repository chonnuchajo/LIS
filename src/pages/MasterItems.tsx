import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Database,
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

type MasterItem = Record<string, unknown>;

type MasterItemForm = {
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
  status: string;
  description: string;
};

const emptyForm: MasterItemForm = {
  itemCode: "",
  itemName: "",
  category: "",
  unit: "",
  status: "active",
  description: "",
};

const DIRECT_MASTER_ITEM_URL = "https://n8n-plant.icpladda.com/webhook/api/itme-all";

const idKeys = ["_id", "id", "itemId", "item_id", "item_no", "code", "itemCode"];
const codeKeys = ["item_no", "itemCode", "item_code", "code", "Code", "ITEM_CODE"];
const nameKeys = ["item_name1", "itemName", "item_name", "name", "Name", "ITEM_NAME", "description"];
const categoryKeys = ["inventory_posting_group", "category", "type", "group", "itemGroup", "item_group"];
const unitKeys = ["base_unit_of_mea", "unit", "uom", "UOM", "unitName"];
const statusKeys = ["status", "active", "isActive"];
const descriptionKeys = ["item_name2", "item_name3", "description", "detail", "remark", "note"];
const hiddenTableKeys = [
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

function displayValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getItemId(item: MasterItem) {
  const value = firstValue(item, idKeys);
  return value ? String(value) : "";
}

function itemToForm(item: MasterItem): MasterItemForm {
  const statusValue = firstValue(item, statusKeys);
  return {
    itemCode: String(firstValue(item, codeKeys)),
    itemName: String(firstValue(item, nameKeys)),
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
  return {
    ...(editing ?? {}),
    item_no: form.itemCode.trim(),
    item_name1: form.itemName.trim(),
    inventory_posting_group: form.category.trim(),
    base_unit_of_mea: form.unit.trim(),
    itemCode: form.itemCode.trim(),
    itemName: form.itemName.trim(),
    category: form.category.trim(),
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
    if (!q) return items;
    return items.filter((item) => JSON.stringify(item).toLowerCase().includes(q));
  }, [items, search]);

  const extraColumns = useMemo(() => {
    const used = new Set([
      ...idKeys,
      ...codeKeys,
      ...nameKeys,
      ...categoryKeys,
      ...unitKeys,
      ...statusKeys,
      ...descriptionKeys,
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
                        <TableCell colSpan={6 + extraColumns.length} className="py-8 text-center text-muted-foreground">
                          กำลังโหลด...
                        </TableCell>
                      </TableRow>
                    ) : filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6 + extraColumns.length} className="py-8 text-center text-muted-foreground">
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
                            <TableCell>{displayValue(firstValue(item, categoryKeys))}</TableCell>
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
