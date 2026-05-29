import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FlaskConical, Pencil, Plus, Search, Trash2 } from "lucide-react";

import AppLayout from "@/components/lis/AppLayout";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import {
  normalizeTimes,
  validateStandardConfigInput,
  type StandardConfigDoc,
} from "@/lib/standardConfig";

const COMMON_NAME_KEYS = ["common_name", "commonname", "commonName"];

function pickCommonName(item: Record<string, unknown>): string {
  for (const k of COMMON_NAME_KEYS) {
    const v = item[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

type FormState = {
  id: string | null;
  keyword: string;
  gcTimes: string;
  hplcTimes: string;
  note: string;
};

const emptyForm: FormState = { id: null, keyword: "", gcTimes: "", hplcTimes: "", note: "" };

export default function StandardConfig() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);

  const { data: configs = [], isLoading } = useQuery<StandardConfigDoc[]>({
    queryKey: ["standard-configs"],
    queryFn: () => api.getStandardConfigs(),
  });

  // Suggestions for the keyword combobox — distinct commonNames from master items.
  const { data: masterItemRows = [] } = useQuery<Array<Record<string, unknown>>>({
    queryKey: ["master-items"],
    queryFn: async () => {
      const res = await api.get<unknown>("/master-items");
      const payload = res.data.data;
      return Array.isArray(payload) ? (payload as Array<Record<string, unknown>>) : [];
    },
  });
  const commonNameSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const it of masterItemRows) {
      const cn = pickCommonName(it);
      if (cn) set.add(cn);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [masterItemRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return configs;
    return configs.filter((c) => c.keyword.toLowerCase().includes(q));
  }, [configs, search]);

  const saveMutation = useMutation({
    mutationFn: (payload: { id: string | null; data: Partial<StandardConfigDoc> }) =>
      payload.id
        ? api.updateStandardConfig(payload.id, payload.data)
        : api.createStandardConfig(payload.data),
    onSuccess: () => {
      toast.success("บันทึกสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["standard-configs"] });
      setForm(null);
      setFieldError(null);
    },
    onError: (err: Error & { field?: string }) => {
      if (err.field) setFieldError({ field: err.field, message: err.message });
      else toast.error(`บันทึกไม่สำเร็จ — ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteStandardConfig(id),
    onSuccess: () => {
      toast.success("ลบแล้ว");
      queryClient.invalidateQueries({ queryKey: ["standard-configs"] });
    },
    onError: (err: Error) => toast.error(`ลบไม่สำเร็จ — ${err.message}`),
  });

  const openAdd = () => {
    setFieldError(null);
    setForm({ ...emptyForm });
  };
  const openEdit = (c: StandardConfigDoc) => {
    setFieldError(null);
    setForm({
      id: c._id,
      keyword: c.keyword,
      gcTimes: c.gcTimes == null ? "" : String(c.gcTimes),
      hplcTimes: c.hplcTimes == null ? "" : String(c.hplcTimes),
      note: c.note ?? "",
    });
  };

  const submit = () => {
    if (!form) return;
    const input = {
      keyword: form.keyword,
      gcTimes: normalizeTimes(form.gcTimes),
      hplcTimes: normalizeTimes(form.hplcTimes),
      note: form.note,
    };
    const err = validateStandardConfigInput(input);
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError(null);
    saveMutation.mutate({ id: form.id, data: input });
  };

  return (
    <AppLayout title="Standard Config">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <FlaskConical className="w-6 h-6" />
            Standard Config
          </h1>
          <p className="text-sm text-muted-foreground">
            ตั้งค่าจำนวนครั้งที่ใช้ standard ต่อสาร (ใช้สำหรับตัดสต็อกในอนาคต)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา keyword..."
              className="pl-8"
            />
          </div>
          <Button onClick={openAdd} className="gap-1">
            <Plus className="h-4 w-4" /> เพิ่ม Standard
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword (ใน commonName)</TableHead>
                <TableHead className="w-28 text-right">GC</TableHead>
                <TableHead className="w-28 text-right">HPLC</TableHead>
                <TableHead>หมายเหตุ</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    กำลังโหลด...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    ยังไม่มีข้อมูล
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c._id}>
                    <TableCell className="font-medium">{c.keyword}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.gcTimes ? `${c.gcTimes} ครั้ง` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.hplcTimes ? `${c.hplcTimes} ครั้ง` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.note}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`ลบ "${c.keyword}"?`)) deleteMutation.mutate(c._id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={!!form}
        onOpenChange={(o) => {
          if (!o) {
            setForm(null);
            setFieldError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? "แก้ไข Standard" : "เพิ่ม Standard"}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sc-keyword" className="text-sm">Keyword (ในชื่อ commonName) *</Label>
                <Input
                  id="sc-keyword"
                  list="standard-config-commonnames"
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                  placeholder="พิมพ์ หรือเลือกจากรายการ — match แบบมีคำนี้อยู่ในชื่อ"
                />
                <datalist id="standard-config-commonnames">
                  {commonNameSuggestions.map((cn) => (
                    <option key={cn} value={cn} />
                  ))}
                </datalist>
                {fieldError?.field === "keyword" ? (
                  <p className="text-xs text-destructive">{fieldError.message}</p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sc-gctimes" className="text-sm">GC — จำนวนครั้ง</Label>
                  <Input
                    id="sc-gctimes"
                    type="number"
                    min={0}
                    step={1}
                    value={form.gcTimes}
                    onChange={(e) => setForm({ ...form, gcTimes: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sc-hplctimes" className="text-sm">HPLC — จำนวนครั้ง</Label>
                  <Input
                    id="sc-hplctimes"
                    type="number"
                    min={0}
                    step={1}
                    value={form.hplcTimes}
                    onChange={(e) => setForm({ ...form, hplcTimes: e.target.value })}
                  />
                </div>
              </div>
              {fieldError?.field === "gcTimes" || fieldError?.field === "hplcTimes" ? (
                <p className="text-xs text-destructive">{fieldError.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">อย่างน้อยต้องกรอก 1 เครื่อง</p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="sc-note" className="text-sm">หมายเหตุ</Label>
                <Input
                  id="sc-note"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="(ไม่บังคับ)"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>
              ยกเลิก
            </Button>
            <Button onClick={submit} disabled={saveMutation.isPending}>
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
