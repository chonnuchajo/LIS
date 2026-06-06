import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, AlertTriangle, Clock, Plus, Pencil, Trash2, Minus, ArrowDownToLine, History, Search, ScanLine } from "lucide-react";
import { toast } from "sonner";

import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { api } from "@/lib/api";
import { summarizeUnits } from "@/lib/stockUnit";
import UnitsDrawer from "@/components/lis/stock/UnitsDrawer";
import ReceiveBottlesDialog from "@/components/lis/stock/ReceiveBottlesDialog";
import StockQrScanner from "@/components/lis/StockQrScanner";
import WithdrawDialog from "@/components/lis/stock/WithdrawDialog";
import DiscardDialog from "@/components/lis/stock/DiscardDialog";
import type {
  StockStandardItem, StockSolventItem, StockGlasswareItem,
  StockTransactionItem, StockUnitItem,
} from "@/types/stock";

const LOW_STD_QTY = 1;
const LOW_SOL_QTY = 3;
const LOW_GLASS_QTY = 5;

type StandardStatusFilter = "all" | "ok" | "out" | "low" | "expired" | "soon";
const STANDARD_STATUS_OPTIONS: { value: StandardStatusFilter; label: string }[] = [
  { value: "all", label: "ทุกสถานะ" },
  { value: "ok", label: "ปกติ" },
  { value: "out", label: "หมด" },
  { value: "low", label: "ใกล้หมด" },
  { value: "expired", label: "หมดอายุ" },
  { value: "soon", label: "ใกล้หมดอายุ" },
];

// ============================================================
// Standards Tab
// ============================================================
function StandardsTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["stock", "standards"],
    queryFn: api.getStandards,
  });

  const { data: allUnits = [] } = useQuery({
    queryKey: ["stock", "units"],
    queryFn: () => api.getStockUnits(),
  });
  const unitsByCode = useMemo(() => {
    const m = new Map<string, StockUnitItem[]>();
    for (const u of allUnits) {
      const arr = m.get(u.itemCode) ?? [];
      arr.push(u);
      m.set(u.itemCode, arr);
    }
    return m;
  }, [allUnits]);

  const [drawer, setDrawer] = useState<StockStandardItem | null>(null);
  const [receiving, setReceiving] = useState<StockStandardItem | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StandardStatusFilter>("all");
  const [editing, setEditing] = useState<StockStandardItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<StockStandardItem | null>(null);

  const now = Date.now();

  // per-bottle summary per standard (counts derived from StockUnit, not stale tier qty)
  const sumOf = (s: StockStandardItem) => summarizeUnits(unitsByCode.get(s.code) ?? [], new Date(now));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter(s => {
      if (q && !s.name.toLowerCase().includes(q) && !s.code.toLowerCase().includes(q)) return false;
      if (statusFilter === "all") return true;
      const sum = summarizeUnits(unitsByCode.get(s.code) ?? [], new Date(now));
      const totalActive = sum.sealed + sum.working;
      const eOk = sum.expired === 0 && sum.expiringSoon === 0;
      if (statusFilter === "ok") return totalActive > LOW_STD_QTY && eOk;
      if (statusFilter === "out") return totalActive === 0;
      if (statusFilter === "low") return totalActive > 0 && totalActive <= LOW_STD_QTY;
      if (statusFilter === "expired") return sum.expired > 0;
      if (statusFilter === "soon") return sum.expiringSoon > 0;
      return true;
    });
  }, [data, search, statusFilter, now, unitsByCode]);

  const lowList = data.filter(s => { const x = sumOf(s); return x.sealed + x.working <= LOW_STD_QTY; });
  const expiringList = data.filter(s => { const x = sumOf(s); return x.expired > 0 || x.expiringSoon > 0; });

  return (
    <div className="space-y-4">
      {(lowList.length > 0 || expiringList.length > 0) && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <span className="font-semibold text-destructive">
                แจ้งเตือน Standard ({lowList.length + expiringList.length} รายการ)
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {lowList.slice(0, 8).map(s => {
                const x = sumOf(s);
                const totalActive = x.sealed + x.working;
                const out = totalActive === 0;
                return (
                  <div key={`low-${s._id}`} className="flex items-center gap-2 text-destructive">
                    <Package className="w-3.5 h-3.5" />
                    <span><strong>{s.name}</strong> {out ? "หมดแล้ว" : `ใกล้หมด เหลือรวม ${totalActive} ขวด`}</span>
                  </div>
                );
              })}
              {expiringList.slice(0, 8).map(s => {
                const x = sumOf(s);
                const expired = x.expired > 0;
                return (
                  <div key={`exp-${s._id}`} className={`flex items-center gap-2 ${expired ? "text-destructive" : "text-amber-600"}`}>
                    <Clock className="w-3.5 h-3.5" />
                    <span><strong>{s.name}</strong> {expired ? `หมดอายุ ${x.expired} ขวด` : `ใกล้หมดอายุ ${x.expiringSoon} ขวด`}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:space-y-0 space-y-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-5 h-5" /> Standards (สาร Standard)
            <Badge variant="outline">{data.length}</Badge>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหา code หรือชื่อ" className="pl-8 h-9 w-full sm:w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StandardStatusFilter)}>
              <SelectTrigger className="h-9 w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STANDARD_STATUS_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4 mr-1" /> เพิ่มรายการ
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Code</TableHead>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead className="text-center">คงคลัง (ขวด)</TableHead>
                  <TableHead className="text-center">working (ขวด)</TableHead>
                  <TableHead className="hidden xl:table-cell">ความถี่</TableHead>
                  <TableHead className="hidden xl:table-cell">อุณหภูมิ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">กำลังโหลด...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">ไม่มีข้อมูล</TableCell></TableRow>
                ) : filtered.map(item => {
                  return (
                    <TableRow key={item._id}>
                      <TableCell className="font-semibold text-primary">{item.code}</TableCell>
                      <TableCell className="font-medium">
                        <button type="button" className="hover:underline text-left" onClick={() => setDrawer(item)}>{item.name}</button>
                      </TableCell>
                      {(() => {
                        const sum = summarizeUnits(unitsByCode.get(item.code) ?? []);
                        return (
                          <>
                            <TableCell className="text-center">{sum.sealed}</TableCell>
                            <TableCell className="text-center">{sum.working}</TableCell>
                          </>
                        );
                      })()}
                      <TableCell className="hidden xl:table-cell text-xs">{item.frequency || "-"}</TableCell>
                      <TableCell className="hidden xl:table-cell text-xs">{item.storageTemp || "-"}</TableCell>
                      <TableCell>
                        {(() => {
                          const sum = summarizeUnits(unitsByCode.get(item.code) ?? []);
                          return (
                            <div className="flex flex-wrap gap-1">
                              {sum.sealed + sum.working === 0 && <Badge className="bg-destructive/15 text-destructive text-xs">หมด</Badge>}
                              {sum.expired > 0 && <Badge className="bg-destructive/15 text-destructive text-xs">หมดอายุ {sum.expired}</Badge>}
                              {sum.expiringSoon > 0 && <Badge className="bg-amber-100 text-amber-700 text-xs">ใกล้หมดอายุ {sum.expiringSoon}</Badge>}
                              {sum.sealed + sum.working > 0 && sum.expired === 0 && sum.expiringSoon === 0 && <Badge className="bg-emerald-100 text-emerald-700 text-xs">ปกติ</Badge>}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title="รับเข้า (ขวด)" onClick={() => setReceiving(item)}><ArrowDownToLine className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" title="รายขวด" onClick={() => setDrawer(item)}><Package className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" title="แก้ไข" onClick={() => setEditing(item)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" title="ลบ" onClick={() => setDeleting(item)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {(creating || editing) && (
        <StandardDialog
          item={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["stock", "standards"] }); }}
        />
      )}
      {deleting && (
        <DeleteDialog
          name={`${deleting.code} ${deleting.name}`}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await api.deleteStandard(deleting._id);
            toast.success("ลบรายการแล้ว");
            qc.invalidateQueries({ queryKey: ["stock", "standards"] });
            qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
            setDeleting(null);
          }}
        />
      )}
      {drawer && <UnitsDrawer standard={drawer} onClose={() => setDrawer(null)} />}
      {receiving && (
        <ReceiveBottlesDialog
          standard={receiving}
          onClose={() => setReceiving(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["stock", "units"] }); }}
        />
      )}
    </div>
  );
}

// ============================================================
// Solvents Tab
// ============================================================
function SolventsTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["stock", "solvents"],
    queryFn: api.getSolvents,
  });

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<StockSolventItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<StockSolventItem | null>(null);
  const [moving, setMoving] = useState<{ item: StockSolventItem; mode: "deduct" | "receive" } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? data.filter(s => s.name.toLowerCase().includes(q)) : data;
  }, [data, search]);

  const lowList = data.filter(s => s.qty < LOW_SOL_QTY);

  return (
    <div className="space-y-4">
      {lowList.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <span className="font-semibold text-destructive">สารเคมีใกล้หมด ({lowList.length} รายการ)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-sm text-destructive">
              {lowList.map(s => <div key={s._id}>• {s.name} เหลือ {s.qty} ขวด</div>)}
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:space-y-0 space-y-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-5 h-5" /> สารเคมี / Solvents
            <Badge variant="outline">{data.length}</Badge>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา" className="pl-8 h-9 w-full sm:w-64" />
            </div>
            <Button size="sm" onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-1" /> เพิ่มรายการ</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>รายการ</TableHead>
                <TableHead className="text-right">ขนาด (ลิตร)</TableHead>
                <TableHead className="text-right">จำนวน (ขวด)</TableHead>
                <TableHead className="text-right">ราคา (บาท)</TableHead>
                <TableHead>หมายเหตุ</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6">กำลังโหลด...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>
              ) : filtered.map(item => (
                <TableRow key={item._id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right">{item.sizeLiter}</TableCell>
                  <TableCell className="text-right">
                    <Badge className={item.qty < LOW_SOL_QTY ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}>
                      {item.qty}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{item.price.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.note}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setMoving({ item, mode: "deduct" })}><Minus className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setMoving({ item, mode: "receive" })}><ArrowDownToLine className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(item)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleting(item)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {(creating || editing) && (
        <SimpleItemDialog
          title="สารเคมี"
          item={editing}
          fields={[
            { key: "name", label: "ชื่อรายการ", type: "text", required: true },
            { key: "sizeLiter", label: "ขนาด (ลิตร)", type: "number" },
            { key: "qty", label: "จำนวนคงเหลือ (ขวด)", type: "number" },
            { key: "price", label: "ราคา (บาท)", type: "number" },
            { key: "note", label: "หมายเหตุ", type: "text" },
          ]}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSubmit={async (payload) => {
            if (editing) await api.updateSolvent(editing._id, payload);
            else await api.createSolvent(payload);
            qc.invalidateQueries({ queryKey: ["stock", "solvents"] });
            qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
          }}
        />
      )}
      {deleting && (
        <DeleteDialog
          name={deleting.name}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await api.deleteSolvent(deleting._id);
            toast.success("ลบรายการแล้ว");
            qc.invalidateQueries({ queryKey: ["stock", "solvents"] });
            qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
            setDeleting(null);
          }}
        />
      )}
      {moving && (
        <SimpleMoveDialog
          title={moving.mode === "deduct" ? "ตัด stock สารเคมี" : "รับเข้าสารเคมี"}
          mode={moving.mode}
          itemName={moving.item.name}
          currentQty={moving.item.qty}
          unit="ขวด"
          onClose={() => setMoving(null)}
          onSubmit={async (qty, note) => {
            if (moving.mode === "deduct") await api.deductSolvent(moving.item._id, { qty, note });
            else await api.receiveSolvent(moving.item._id, { qty, note });
            qc.invalidateQueries({ queryKey: ["stock", "solvents"] });
            qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Glassware Tab
// ============================================================
function GlasswareTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["stock", "glassware"],
    queryFn: api.getGlassware,
  });

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<StockGlasswareItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<StockGlasswareItem | null>(null);
  const [moving, setMoving] = useState<{ item: StockGlasswareItem; mode: "deduct" | "receive" } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? data.filter(s => s.name.toLowerCase().includes(q)) : data;
  }, [data, search]);

  const lowList = data.filter(s => s.qty < LOW_GLASS_QTY);

  return (
    <div className="space-y-4">
      {lowList.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <span className="font-semibold text-destructive">เครื่องแก้วใกล้หมด ({lowList.length} รายการ)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-sm text-destructive">
              {lowList.map(s => <div key={s._id}>• {s.name} เหลือ {s.qty} ชิ้น</div>)}
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:space-y-0 space-y-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-5 h-5" /> เครื่องแก้ว / Glassware
            <Badge variant="outline">{data.length}</Badge>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา" className="pl-8 h-9 w-full sm:w-64" />
            </div>
            <Button size="sm" onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-1" /> เพิ่มรายการ</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>รายการ</TableHead>
                <TableHead className="text-right">จำนวน (ชิ้น)</TableHead>
                <TableHead className="text-right">ราคา/ชิ้น (บาท)</TableHead>
                <TableHead>หมายเหตุ</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6">กำลังโหลด...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>
              ) : filtered.map(item => (
                <TableRow key={item._id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right">
                    <Badge className={item.qty < LOW_GLASS_QTY ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}>
                      {item.qty}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{item.pricePerPiece.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.note}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setMoving({ item, mode: "deduct" })}><Minus className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setMoving({ item, mode: "receive" })}><ArrowDownToLine className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(item)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleting(item)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {(creating || editing) && (
        <SimpleItemDialog
          title="เครื่องแก้ว"
          item={editing}
          fields={[
            { key: "name", label: "ชื่อรายการ", type: "text", required: true },
            { key: "qty", label: "จำนวนคงเหลือ (ชิ้น)", type: "number" },
            { key: "pricePerPiece", label: "ราคา/ชิ้น (บาท)", type: "number" },
            { key: "note", label: "หมายเหตุ", type: "text" },
          ]}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSubmit={async (payload) => {
            if (editing) await api.updateGlassware(editing._id, payload);
            else await api.createGlassware(payload);
            qc.invalidateQueries({ queryKey: ["stock", "glassware"] });
            qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
          }}
        />
      )}
      {deleting && (
        <DeleteDialog
          name={deleting.name}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await api.deleteGlassware(deleting._id);
            toast.success("ลบรายการแล้ว");
            qc.invalidateQueries({ queryKey: ["stock", "glassware"] });
            qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
            setDeleting(null);
          }}
        />
      )}
      {moving && (
        <SimpleMoveDialog
          title={moving.mode === "deduct" ? "ตัด stock เครื่องแก้ว" : "รับเข้าเครื่องแก้ว"}
          mode={moving.mode}
          itemName={moving.item.name}
          currentQty={moving.item.qty}
          unit="ชิ้น"
          onClose={() => setMoving(null)}
          onSubmit={async (qty, note) => {
            if (moving.mode === "deduct") await api.deductGlassware(moving.item._id, { qty, note });
            else await api.receiveGlassware(moving.item._id, { qty, note });
            qc.invalidateQueries({ queryKey: ["stock", "glassware"] });
            qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// History Tab
// ============================================================
function HistoryTab() {
  const [type, setType] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["stock", "transactions", type, action],
    queryFn: () => api.getStockTransactions({ itemType: type || undefined, action: action || undefined, limit: 300 }),
  });

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:space-y-0 space-y-2">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-5 h-5" /> ประวัติการใช้ / รับเข้า
          <Badge variant="outline">{data.length}</Badge>
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Select value={type || "all"} onValueChange={v => setType(v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 w-full sm:w-40"><SelectValue placeholder="ทุกหมวด" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกหมวด</SelectItem>
              <SelectItem value="standard">Standards</SelectItem>
              <SelectItem value="solvent">สารเคมี</SelectItem>
              <SelectItem value="glassware">เครื่องแก้ว</SelectItem>
            </SelectContent>
          </Select>
          <Select value={action || "all"} onValueChange={v => setAction(v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 w-full sm:w-40"><SelectValue placeholder="ทุก action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุก action</SelectItem>
              <SelectItem value="deduct">ตัด stock</SelectItem>
              <SelectItem value="receive">รับเข้า</SelectItem>
              <SelectItem value="create">สร้างใหม่</SelectItem>
              <SelectItem value="update">แก้ไข</SelectItem>
              <SelectItem value="delete">ลบ</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>เวลา</TableHead>
              <TableHead>หมวด</TableHead>
              <TableHead>รายการ</TableHead>
              <TableHead>Action</TableHead>
              <TableHead className="text-right">Δ qty</TableHead>
              <TableHead>คงเหลือ</TableHead>
              <TableHead>โดย</TableHead>
              <TableHead>หมายเหตุ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6">กำลังโหลด...</TableCell></TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">ไม่มีประวัติ</TableCell></TableRow>
            ) : data.map(t => (
              <TableRow key={t._id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(t.createdAt).toLocaleString("th-TH")}</TableCell>
                <TableCell><Badge variant="outline">{t.itemType}</Badge></TableCell>
                <TableCell>
                  <div className="font-medium">{t.itemName || t.itemId}</div>
                  {t.itemCode && <div className="text-xs text-muted-foreground">{t.itemCode}</div>}
                  {t.tier && <Badge className="text-xs mt-1" variant="outline">{t.tier}</Badge>}
                </TableCell>
                <TableCell><ActionBadge action={t.action} /></TableCell>
                <TableCell className={`text-right font-mono ${t.delta != null && t.delta < 0 ? "text-destructive" : t.delta != null && t.delta > 0 ? "text-emerald-600" : ""}`}>
                  {t.delta != null ? (t.delta > 0 ? `+${t.delta}` : t.delta) : "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {t.beforeQty ?? "-"} → <strong>{t.afterQty ?? "-"}</strong> {t.unit || ""}
                </TableCell>
                <TableCell className="text-xs">{t.userName || t.userEmail || "-"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.note || ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, string> = {
    create: "bg-blue-100 text-blue-700",
    update: "bg-slate-100 text-slate-700",
    delete: "bg-destructive/10 text-destructive",
    deduct: "bg-amber-100 text-amber-700",
    receive: "bg-emerald-100 text-emerald-700",
  };
  return <Badge className={`text-xs ${map[action] || ""}`}>{action}</Badge>;
}

// ============================================================
// Reusable dialogs
// ============================================================
function DeleteDialog({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void | Promise<void> }) {
  return (
    <AlertDialog open onOpenChange={open => { if (!open) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ยืนยันลบรายการ?</AlertDialogTitle>
          <AlertDialogDescription>กำลังจะลบ "{name}" — การลบไม่สามารถย้อนกลับได้</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm()} className="bg-destructive hover:bg-destructive/90">ลบ</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface SimpleField {
  key: string;
  label: string;
  type: "text" | "number";
  required?: boolean;
}
function SimpleItemDialog<T extends { _id?: string }>({
  title, item, fields, onClose, onSubmit,
}: {
  title: string;
  item: T | null;
  fields: SimpleField[];
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const f of fields) init[f.key] = (item as Record<string, unknown> | null)?.[f.key] ?? (f.type === "number" ? 0 : "");
    return init;
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      for (const f of fields) if (f.type === "number") payload[f.key] = Number(payload[f.key]) || 0;
      await onSubmit(payload);
      toast.success(item ? "แก้ไขสำเร็จ" : "เพิ่มรายการสำเร็จ");
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{item ? `แก้ไข${title}` : `เพิ่ม${title}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {fields.map(f => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={f.key}>{f.label}{f.required && <span className="text-destructive ml-1">*</span>}</Label>
                <Input
                  id={f.key} type={f.type} required={f.required}
                  value={String(form[f.key] ?? "")}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                />
              </div>
            ))}
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

function SimpleMoveDialog({
  title, mode, itemName, currentQty, unit, onClose, onSubmit,
}: {
  title: string;
  mode: "deduct" | "receive";
  itemName: string;
  currentQty: number;
  unit: string;
  onClose: () => void;
  onSubmit: (qty: number, note?: string) => Promise<void>;
}) {
  const [qty, setQty] = useState<string>("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(qty);
    if (!n || n <= 0) { toast.error("กรุณาระบุจำนวน"); return; }
    if (mode === "deduct" && n > currentQty) { toast.error("จำนวนไม่พอ"); return; }
    setBusy(true);
    try {
      await onSubmit(n, note || undefined);
      toast.success(mode === "deduct" ? "ตัด stock สำเร็จ" : "รับเข้าสำเร็จ");
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{itemName} — คงเหลือ {currentQty} {unit}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label>จำนวน ({unit})</Label>
              <Input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} required />
            </div>
            <div>
              <Label>หมายเหตุ</Label>
              <Input value={note} onChange={e => setNote(e.target.value)} placeholder="optional" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={busy}>{busy ? "กำลังบันทึก..." : "ยืนยัน"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StandardDialog({
  item, onClose, onSaved,
}: {
  item: StockStandardItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const [form, setForm] = useState<StockStandardItem>(() => item ?? {
    _id: "",
    code: "",
    name: "",
    primary: { qty: 0, ordered: 0, sizeMg: null, exp: "", usesPerBottle: null, pricePerUnit: 0, totalPrice: 0 },
    supplier: { qty: 0, sizeMg: null, exp: "" },
    working: { qty: 0, sizeMg: null, exp: "" },
    usagePerUseMg: null,
    frequency: "",
    storageTemp: "",
    status: "",
    expiryStatus: "",
  });
  const [busy, setBusy] = useState(false);

  const setField = (path: string, value: unknown) => {
    setForm(prev => {
      const copy: StockStandardItem = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let target: Record<string, unknown> = copy as unknown as Record<string, unknown>;
      for (let i = 0; i < keys.length - 1; i++) target = target[keys[i]] as Record<string, unknown>;
      target[keys[keys.length - 1]] = value;
      return copy;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form };
      // strip _id from payload (it's url param for updates)
      const { _id: _stripId, createdAt: _stripCa, updatedAt: _stripUa, ...body } = payload;
      void _stripId; void _stripCa; void _stripUa;
      // numeric coercion
      body.primary.qty = Number(body.primary.qty) || 0;
      body.primary.ordered = Number(body.primary.ordered) || 0;
      body.primary.pricePerUnit = Number(body.primary.pricePerUnit) || 0;
      body.supplier.qty = Number(body.supplier.qty) || 0;
      body.working.qty = Number(body.working.qty) || 0;
      if (isEdit) await api.updateStandard(item!._id, body);
      else await api.createStandard(body);
      toast.success(isEdit ? "แก้ไขสำเร็จ" : "เพิ่มรายการสำเร็จ");
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? `แก้ไข Standard: ${item?.name}` : "เพิ่ม Standard ใหม่"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Code <span className="text-destructive">*</span></Label>
                <Input required value={form.code} onChange={e => setField("code", e.target.value)} />
              </div>
              <div>
                <Label>ชื่อ <span className="text-destructive">*</span></Label>
                <Input required value={form.name} onChange={e => setField("name", e.target.value)} />
              </div>
            </div>

            {(["primary", "supplier", "working"] as const).map(tier => (
              <div key={tier} className="border rounded-md p-3">
                <div className="font-semibold mb-2 capitalize">{tier} stock</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <Label>จำนวน (ขวด)</Label>
                    <Input type="number" value={String(form[tier]?.qty ?? 0)} onChange={e => setField(`${tier}.qty`, e.target.value)} />
                  </div>
                  <div>
                    <Label>ขนาด (mg)</Label>
                    <Input value={String(form[tier]?.sizeMg ?? "")} onChange={e => setField(`${tier}.sizeMg`, e.target.value)} placeholder="เช่น 100 หรือ -" />
                  </div>
                  <div>
                    <Label>EXP</Label>
                    <Input value={String(form[tier]?.exp ?? "")} onChange={e => setField(`${tier}.exp`, e.target.value)} placeholder="dd/mm/yyyy" />
                  </div>
                </div>
                {tier === "primary" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                    <div>
                      <Label>สั่งแล้ว (ขวด)</Label>
                      <Input type="number" value={String(form.primary?.ordered ?? 0)} onChange={e => setField("primary.ordered", e.target.value)} />
                    </div>
                    <div>
                      <Label>ครั้งที่ใช้/ขวด</Label>
                      <Input value={String(form.primary?.usesPerBottle ?? "")} onChange={e => setField("primary.usesPerBottle", e.target.value)} />
                    </div>
                    <div>
                      <Label>ราคา/หน่วย (บาท)</Label>
                      <Input type="number" value={String(form.primary?.pricePerUnit ?? 0)} onChange={e => setField("primary.pricePerUnit", e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>อัตราการใช้/ครั้ง (mg)</Label>
                <Input value={String(form.usagePerUseMg ?? "")} onChange={e => setField("usagePerUseMg", e.target.value)} />
              </div>
              <div>
                <Label>ความถี่</Label>
                <Input value={form.frequency} onChange={e => setField("frequency", e.target.value)} placeholder="เช่น 1/1 Week" />
              </div>
              <div>
                <Label>อุณหภูมิที่เก็บ (°C)</Label>
                <Input value={form.storageTemp} onChange={e => setField("storageTemp", e.target.value)} placeholder="เช่น 20 ± 4" />
              </div>
              <div>
                <Label>หมายเหตุ</Label>
                <Input value={form.status} onChange={e => setField("status", e.target.value)} />
              </div>
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

// ============================================================
// Page
// ============================================================
const StockPage = () => {
  const [scanOpen, setScanOpen] = useState(false);
  const [scannedQr, setScannedQr] = useState<string | null>(null);
  const [scannedUnit, setScannedUnit] = useState<StockUnitItem | null>(null);
  const [action, setAction] = useState<"withdraw" | "discard" | null>(null);
  const qc = useQueryClient();

  const onScanned = async (qrId: string) => {
    setScanOpen(false);
    setScannedQr(qrId);
    try {
      const u = await api.getStockUnit(qrId);
      setScannedUnit(u);
    } catch (err) {
      toast.error((err as Error).message);
      setScannedQr(null);
    }
  };
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stock", "units"] });
    qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };
  const closeScanned = () => { setScannedQr(null); setScannedUnit(null); setAction(null); };

  return (
    <AppLayout>
      <PageHeader
        className="mb-6"
        title={<span className="inline-flex items-center gap-2"><Package className="w-6 h-6" /> Stock Management</span>}
        description="จัดการ inventory: Standards, สารเคมี, เครื่องแก้ว — บันทึกข้อมูลใน MongoDB"
      />
      <Tabs defaultValue="standard">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="standard">Standards</TabsTrigger>
          <TabsTrigger value="solvent">สารเคมี</TabsTrigger>
          <TabsTrigger value="glassware">เครื่องแก้ว</TabsTrigger>
          <TabsTrigger value="history">ประวัติ</TabsTrigger>
        </TabsList>
        <TabsContent value="standard"><StandardsTab /></TabsContent>
        <TabsContent value="solvent"><SolventsTab /></TabsContent>
        <TabsContent value="glassware"><GlasswareTab /></TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
      </Tabs>

      <Button
        className="fixed bottom-6 right-6 rounded-full shadow-lg h-14 w-14 p-0"
        title="สแกน QR ขวด" onClick={() => setScanOpen(true)}
      >
        <ScanLine className="w-6 h-6" />
      </Button>

      <StockQrScanner open={scanOpen} onClose={() => setScanOpen(false)} onScanned={onScanned} />

      {scannedQr && scannedUnit && !action && (
        <Dialog open onOpenChange={(o) => { if (!o) closeScanned(); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{scannedUnit.itemName}</DialogTitle>
              <DialogDescription>
                {scannedUnit.itemCode} · {scannedUnit.kind === "working" ? "working" : "คงคลัง"} · เหลือ {scannedUnit.volume?.remaining} {scannedUnit.volume?.unit}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-2">
              {scannedUnit.status === "discarded" ? (
                <p className="text-destructive font-medium text-center">ขวดนี้ถูกทิ้งแล้ว ใช้งานต่อไม่ได้</p>
              ) : (
                <>
                  {scannedUnit.kind === "sealed" && (
                    <Button onClick={() => setAction("withdraw")}>แบ่งใช้ → working</Button>
                  )}
                  <Button variant="destructive" onClick={() => setAction("discard")}>ทิ้งขวด</Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {scannedQr && action === "withdraw" && (
        <WithdrawDialog qrId={scannedQr} onClose={closeScanned} onSaved={refresh} />
      )}
      {scannedQr && action === "discard" && (
        <DiscardDialog qrId={scannedQr} onClose={closeScanned} onSaved={refresh} />
      )}
    </AppLayout>
  );
};

export default StockPage;
