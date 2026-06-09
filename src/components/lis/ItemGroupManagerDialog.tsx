import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { api, type ItemGroupItem } from "@/lib/api";
import { resolveItemGroups } from "@/lib/itemGroups";
import { getItemNo, getRawCommonName, getTradeName } from "@/lib/masterItemFields";

type RawItem = Record<string, unknown>;
type Draft = {
  _id?: string;
  name: string;
  description: string;
  commonNames: string[];
  tradeNames: string[];
  includeItemNos: string[];
  excludeItemNos: string[];
  status: "active" | "inactive";
};

const emptyDraft: Draft = {
  name: "", description: "", commonNames: [], tradeNames: [],
  includeItemNos: [], excludeItemNos: [], status: "active",
};

// chip multi-select แบบค้นหาได้: พิมพ์กรอง + คลิกเลือก/ตัดออก + ลบ chip ทีละตัว
function ChipMultiSelect({
  label, values, options, onChange, placeholder,
}: {
  label: string; values: string[]; options: string[];
  onChange: (next: string[]) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (o: string) =>
    onChange(values.includes(o) ? values.filter((x) => x !== o) : [...values, o]);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {values.length === 0 && <span className="text-xs text-muted-foreground">— ยังไม่เลือก —</span>}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm"
            className="h-8 w-full justify-between font-normal text-muted-foreground">
            {placeholder}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="ค้นหา..." className="h-9" />
            <CommandList>
              <CommandEmpty>ไม่พบ</CommandEmpty>
              <CommandGroup>
                {options.map((o) => {
                  const selected = values.includes(o);
                  return (
                    <CommandItem key={o} value={o} onSelect={() => toggle(o)}>
                      <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                      {o}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function ItemGroupManagerDialog({
  open, onOpenChange, items,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: RawItem[];
}) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const { data: groups = [] } = useQuery({
    queryKey: ["item-groups"],
    queryFn: async () => {
      const res = await api.get<ItemGroupItem[]>("/item-groups");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
  });

  // distinct options จาก catalog
  const catalog = useMemo(
    () => items.map((it) => ({
      itemNo: getItemNo(it),
      commonName: getRawCommonName(it),
      tradeName: getTradeName(it),
    })),
    [items],
  );
  const commonNameOptions = useMemo(
    () => Array.from(new Set(catalog.map((c) => c.commonName).filter(Boolean))).sort(),
    [catalog],
  );
  const tradeNameOptions = useMemo(
    () => Array.from(new Set(catalog.map((c) => c.tradeName).filter(Boolean))).sort(),
    [catalog],
  );

  // preview: itemNo ที่เข้ากลุ่มตาม draft
  const previewMembers = useMemo(() => {
    const draftGroup: ItemGroupItem = {
      _id: draft._id ?? "__draft__", name: draft.name || "draft",
      description: draft.description, commonNames: draft.commonNames,
      tradeNames: draft.tradeNames, includeItemNos: draft.includeItemNos,
      excludeItemNos: draft.excludeItemNos, status: "active", sortOrder: 0,
    };
    return catalog.filter((c) => resolveItemGroups(c, [draftGroup]).length > 0);
  }, [catalog, draft]);

  const memberCountFor = (grp: ItemGroupItem) =>
    catalog.filter((c) => resolveItemGroups(c, [grp]).length > 0).length;

  const selectGroup = (grp: ItemGroupItem) => {
    setSelectedId(grp._id);
    setDraft({
      _id: grp._id, name: grp.name, description: grp.description ?? "",
      commonNames: grp.commonNames ?? [], tradeNames: grp.tradeNames ?? [],
      includeItemNos: grp.includeItemNos ?? [], excludeItemNos: grp.excludeItemNos ?? [],
      status: grp.status ?? "active",
    });
  };

  const newGroup = () => { setSelectedId(null); setDraft(emptyDraft); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: draft.name.trim(), description: draft.description,
        commonNames: draft.commonNames, tradeNames: draft.tradeNames,
        includeItemNos: draft.includeItemNos, excludeItemNos: draft.excludeItemNos,
        status: draft.status,
      };
      if (draft._id) return api.put(`/item-groups/${draft._id}`, body);
      return api.post("/item-groups", body);
    },
    onSuccess: () => {
      toast.success("บันทึกกลุ่มแล้ว");
      queryClient.invalidateQueries({ queryKey: ["item-groups"] });
      newGroup();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/item-groups/${id}`),
    onSuccess: () => {
      toast.success("ลบกลุ่มแล้ว");
      queryClient.invalidateQueries({ queryKey: ["item-groups"] });
      newGroup();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl sm:w-[94vw] max-h-[94vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>จัดกลุ่ม Item</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[280px_1fr]">
          {/* ซ้าย: รายชื่อกลุ่ม */}
          <div className="space-y-2 border-r pr-4">
            <Button size="sm" variant="outline" className="w-full gap-1" onClick={newGroup}>
              <Plus className="h-4 w-4" /> กลุ่มใหม่
            </Button>
            <div className="max-h-[72vh] space-y-1 overflow-auto">
              {groups.map((grp) => (
                <button
                  key={grp._id}
                  type="button"
                  onClick={() => selectGroup(grp)}
                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${
                    selectedId === grp._id ? "bg-accent" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{grp.name}</span>
                  <Badge variant="outline" className="ml-1">{memberCountFor(grp)}</Badge>
                </button>
              ))}
              {groups.length === 0 && (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground">ยังไม่มีกลุ่ม</div>
              )}
            </div>
          </div>

          {/* ขวา: ฟอร์ม */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">ชื่อกลุ่ม</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">สถานะ</Label>
                <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as Draft["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="inactive">inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">คำอธิบาย</Label>
              <Textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ChipMultiSelect label="commonname" placeholder="เลือก commonname"
                values={draft.commonNames} options={commonNameOptions}
                onChange={(v) => setDraft({ ...draft, commonNames: v })} />
              <ChipMultiSelect label="trade name" placeholder="เลือก trade name"
                values={draft.tradeNames} options={tradeNameOptions}
                onChange={(v) => setDraft({ ...draft, tradeNames: v })} />
            </div>

            <div className="rounded border bg-muted/30 p-2">
              <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>สมาชิกที่เข้ากลุ่มจริง (live)</span>
                <Badge variant="secondary">{previewMembers.length}</Badge>
              </div>
              <div className="max-h-48 overflow-auto text-xs">
                {previewMembers.slice(0, 100).map((m) => (
                  <span key={m.itemNo} className="mr-1 inline-block">{m.itemNo}</span>
                ))}
                {previewMembers.length === 0 && <span className="text-muted-foreground">— ยังไม่มี —</span>}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              {draft._id ? (
                <Button variant="ghost" className="gap-1 text-destructive"
                  onClick={() => draft._id && deleteMutation.mutate(draft._id)}>
                  <Trash2 className="h-4 w-4" /> ลบกลุ่ม
                </Button>
              ) : <span />}
              <Button disabled={!draft.name.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
