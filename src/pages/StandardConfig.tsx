import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FlaskConical, Pencil, Plus, Search, Trash2 } from "lucide-react";

import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useConfirm } from "@/context/ConfirmDialog";
import {
  normalizeTimes,
  validateStandardConfigInput,
  type Instrument,
  type Scope,
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
  instrument: Instrument;
  scope: Scope;
  commonName: string;
  times: string;
  note: string;
  isDefault: boolean;
};

const emptyForm: FormState = {
  id: null,
  instrument: "GC",
  scope: "substance",
  commonName: "",
  times: "",
  note: "",
  isDefault: false,
};

export default function StandardConfig() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);

  const { data: configs = [], isLoading } = useQuery<StandardConfigDoc[]>({
    queryKey: ["standard-configs"],
    queryFn: () => api.getStandardConfigs(),
  });

  const { data: methods = [] } = useQuery({ queryKey: ['methods'], queryFn: () => api.getMethods() });

  // Suggestions for the commonName combobox — distinct commonNames from master items.
  const { data: masterItemRows = [] } = useQuery<Array<Record<string, unknown>>>({
    queryKey: ["master-items"],
    queryFn: async () => {
      const res = await api.get<unknown>("/master-items");
      const payload = (res as { data: { data: unknown } }).data.data;
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

  // Default rows always shown; substance rows filtered by commonName search.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return configs.filter((c) => {
      if (c.isDefault) return true;
      if (!q) return true;
      return (c.commonName ?? "").toLowerCase().includes(q);
    });
  }, [configs, search]);

  const saveMutation = useMutation({
    mutationFn: (payload: { id: string | null; data: Record<string, unknown> }) =>
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
      instrument: c.instrument,
      scope: c.scope,
      commonName: c.commonName ?? "",
      times: String(c.times),
      note: c.note ?? "",
      isDefault: c.isDefault,
    });
  };

  const submit = () => {
    if (!form) return;
    const input = {
      instrument: form.instrument,
      scope: form.scope,
      commonName: form.scope === "all" ? null : form.commonName,
      times: normalizeTimes(form.times),
      note: form.note,
    };
    const err = validateStandardConfigInput(input, new Set(methods.map((m) => m.code)));
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError(null);
    // Default rows only update times + note; the server ignores other fields anyway.
    const data = form.isDefault
      ? { times: input.times, note: input.note }
      : input;
    saveMutation.mutate({ id: form.id, data });
  };

  return (
    <AppLayout title="Standard Config">
      <div className="space-y-4">
        <PageHeader
          title={
            <span className="inline-flex items-center gap-2">
              <FlaskConical className="w-6 h-6" />
              Standard Config
            </span>
          }
          description="ตั้งค่าจำนวนครั้งที่ใช้ standard ต่อเครื่อง/ต่อสาร (ใช้สำหรับตัดสต็อกในอนาคต)"
        />

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อสาร..."
              className="pl-8"
            />
          </div>
          <Button onClick={openAdd} className="gap-1">
            <Plus className="h-4 w-4" /> เพิ่มสาร
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">เครื่อง</TableHead>
                <TableHead>เป้าหมาย</TableHead>
                <TableHead className="w-28 text-right">จำนวนครั้ง</TableHead>
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
                    <TableCell className="font-medium">{c.instrument}</TableCell>
                    <TableCell>
                      {c.isDefault ? (
                        <span className="flex items-center gap-2">
                          ทั้งหมด
                          <Badge variant="secondary">ค่าตั้งต้น</Badge>
                        </span>
                      ) : (
                        c.commonName
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.times} ครั้ง</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.note}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          aria-label="แก้ไข"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {c.isDefault ? null : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            aria-label="ลบ"
                            disabled={deleteMutation.isPending}
                            onClick={async () => {
                              const ok = await confirm({
                                title: "ลบรายการ",
                                description: `ลบ "${c.instrument} — ${c.commonName}"?`,
                                confirmText: "ลบ",
                                variant: "danger",
                              });
                              if (ok) deleteMutation.mutate(c._id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
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
            <DialogTitle>
              {form?.isDefault
                ? `แก้ค่าตั้งต้น (เครื่อง ${form.instrument})`
                : form?.id
                  ? "แก้ไขสาร"
                  : "เพิ่มสาร"}
            </DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">เครื่อง *</Label>
                <div className="flex gap-2 flex-wrap">
                  {/* Standard config only applies to machine-based methods (GC/HPLC). */}
                  {methods.filter((m) => m.active && m.requiresMachine).map((m) => (
                    <Button
                      key={m.code}
                      type="button"
                      variant={form.instrument === m.code ? "default" : "outline"}
                      disabled={form.isDefault}
                      onClick={() => setForm({ ...form, instrument: m.code })}
                      className="flex-1"
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>
                {fieldError?.field === "instrument" ? (
                  <p className="text-xs text-destructive">{fieldError.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sc-commonname" className="text-sm">
                  สาร (commonName) *
                </Label>
                {form.isDefault ? (
                  <Input id="sc-commonname" value="ทั้งหมด (ค่าตั้งต้น)" disabled />
                ) : (
                  <>
                    <Input
                      id="sc-commonname"
                      list="standard-config-commonnames"
                      value={form.commonName}
                      onChange={(e) => setForm({ ...form, commonName: e.target.value })}
                      placeholder="เลือกชื่อสารจากรายการ"
                    />
                    <datalist id="standard-config-commonnames">
                      {commonNameSuggestions.map((cn) => (
                        <option key={cn} value={cn} />
                      ))}
                    </datalist>
                  </>
                )}
                {fieldError?.field === "commonName" ? (
                  <p className="text-xs text-destructive">{fieldError.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sc-times" className="text-sm">
                  จำนวนครั้ง *
                </Label>
                <Input
                  id="sc-times"
                  type="number"
                  min={1}
                  step={1}
                  value={form.times}
                  onChange={(e) => setForm({ ...form, times: e.target.value })}
                />
                {fieldError?.field === "times" ? (
                  <p className="text-xs text-destructive">{fieldError.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sc-note" className="text-sm">
                  หมายเหตุ
                </Label>
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
