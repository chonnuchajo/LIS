import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Hash,
  Image as ImageIcon,
  List as ListIcon,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Timer as TimerIcon,
  Trash2,
  Type as TypeIcon,
  X,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  api,
  type ParameterItem,
  type ParameterScope,
  type ParameterValueField,
  type ParameterValueFieldType,
  type StandardOperator,
  type TimerUnit,
} from "@/lib/api";
import {
  formatClassificationOption,
  getClassification,
  getCommonName,
  productTypeLabels,
} from "@/lib/productClassification";
import {
  partsToSec,
  secToParts,
  formatTimerHuman,
  type TimerParts,
} from "@/lib/parameterValidation";

const VALUE_TYPE_OPTIONS: { value: ParameterValueFieldType; label: string }[] = [
  { value: "text", label: "ข้อความ (Text)" },
  { value: "number", label: "จำนวนเต็ม (Number)" },
  { value: "float", label: "ทศนิยม (Float)" },
  { value: "enum", label: "ตัวเลือก (Enum)" },
  { value: "photo", label: "ภาพถ่าย (Photo)" },
  { value: "timer", label: "จับเวลา (Timer)" },
];

const OPERATOR_OPTIONS: { value: StandardOperator | "none"; label: string }[] = [
  { value: "none", label: "ไม่ตรวจค่าผิดปกติ" },
  { value: "lt", label: "< น้อยกว่า" },
  { value: "lte", label: "≤ น้อยกว่าหรือเท่ากับ" },
  { value: "eq", label: "= เท่ากับ" },
  { value: "gte", label: "≥ มากกว่าหรือเท่ากับ" },
  { value: "gt", label: "> มากกว่า" },
  { value: "between", label: "ระหว่าง (range)" },
  { value: "tolerance", label: "± % (tolerance)" },
];

type MasterItemRecord = Record<string, unknown>;
const ITEM_NAME_KEYS = ["item_name1", "itemName", "item_name", "name"];
const PRODUCT_TYPE_SOURCE_KEYS = [
  "common_name",
  "commonname",
  "commonName",
  "item_name2",
  "item_name3",
  "item_name1",
  "itemName",
];
const CATEGORY_KEYS = [
  "inventory_posting_group",
  "category",
  "itemGroup",
  "item_group",
  "group",
];
const COMMON_NAME_DIRECT_KEYS = ["common_name", "commonname", "commonName"];

function getItemProductType(item: MasterItemRecord): string {
  const source = PRODUCT_TYPE_SOURCE_KEYS
    .map((k) => item[k])
    .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
    .join(" ");
  return getClassification(source)?.group ?? "";
}

function getItemCategory(item: MasterItemRecord): string {
  return firstString(item, CATEGORY_KEYS);
}

function formatProductTypeOption(value: string): string {
  return productTypeLabels[value] ?? value;
}

function getItemCommonName(item: MasterItemRecord): string {
  for (const key of COMMON_NAME_DIRECT_KEYS) {
    const direct = getCommonName(item[key]);
    if (direct) return direct;
  }
  const name = firstString(item, ITEM_NAME_KEYS);
  return getCommonName(name);
}

function isObject(v: unknown): v is MasterItemRecord {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function normalizeItems(payload: unknown): MasterItemRecord[] {
  if (Array.isArray(payload)) return payload.filter(isObject);
  if (isObject(payload)) {
    const candidates = [payload.data, payload.items, payload.result, payload.rows];
    const found = candidates.find(Array.isArray);
    if (Array.isArray(found)) return (found as unknown[]).filter(isObject);
  }
  return [];
}

function firstString(item: MasterItemRecord, keys: string[]) {
  for (const k of keys) {
    const v = item[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, ["th", "en"]),
  );
}

const emptyValueField = (): ParameterValueField => ({
  label: "",
  type: "text",
  unit: "",
  standardValue: null,
  standardOperator: undefined,
  standardValue2: null,
  options: [],
  requireNoteOn: [],
  expectedValues: [],
  timerDurationSec: null,
  timerUnit: undefined,
  required: false,
});

const emptyForm = (scope: ParameterScope = "qc"): ParameterItem => ({
  name: "",
  scope,
  status: "active",
  applyAll: false,
  commonNames: [],
  itemNames: [],
  productTypes: [],
  categories: [],
  valueFields: [],
  sortOrder: 0,
  note: "",
});

const SCOPE_LABEL: Record<ParameterScope, string> = {
  lab: "Lab",
  qc: "QC",
};

const SCOPE_BADGE_CLASS: Record<ParameterScope, string> = {
  lab: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  qc: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100",
};

type MultiSelectPopoverProps = {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
  options: string[];
  groupedOptions?: { label: string; options: string[] }[];
  disabled?: boolean;
  emptyText?: string;
  labelFor?: (value: string) => string;
};

function MultiSelectPopover({
  label,
  placeholder,
  values,
  onChange,
  options,
  groupedOptions,
  disabled,
  emptyText = "ไม่มีตัวเลือก",
  labelFor,
}: MultiSelectPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const flatOptions = useMemo(
    () => (groupedOptions ? groupedOptions.flatMap((g) => g.options) : options),
    [groupedOptions, options],
  );

  const display = (v: string) => (labelFor ? labelFor(v) : v);
  const matchFilter = (opt: string) =>
    !search.trim() || display(opt).toLowerCase().includes(search.toLowerCase());

  const toggle = (value: string) => {
    if (values.includes(value)) onChange(values.filter((v) => v !== value));
    else onChange([...values, value]);
  };

  const clear = () => onChange([]);
  const selectAll = () => onChange([...flatOptions]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {values.length > 0 && !disabled ? (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ล้าง
          </button>
        ) : null}
      </div>
      <Popover open={open && !disabled} onOpenChange={(v) => !disabled && setOpen(v)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-11 w-full justify-between text-base font-normal",
              values.length === 0 && "text-muted-foreground",
            )}
          >
            <span className="truncate">
              {values.length === 0 ? placeholder : `เลือกแล้ว ${values.length} รายการ`}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] min-w-[320px] p-0"
          align="start"
        >
          <div className="border-b p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหา..."
                className="pl-8"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-primary hover:underline"
                disabled={flatOptions.length === 0}
              >
                เลือกทั้งหมด ({flatOptions.length})
              </button>
              <button
                type="button"
                onClick={clear}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ล้างทั้งหมด
              </button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {flatOptions.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            ) : groupedOptions ? (
              groupedOptions.map((g) => {
                const filtered = g.options.filter(matchFilter);
                if (filtered.length === 0) return null;
                return (
                  <div key={g.label} className="mb-1">
                    <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.label}
                    </div>
                    {filtered.map((opt) => (
                      <OptionRow
                        key={opt}
                        value={opt}
                        label={display(opt)}
                        checked={values.includes(opt)}
                        onToggle={() => toggle(opt)}
                      />
                    ))}
                  </div>
                );
              })
            ) : (
              options.filter(matchFilter).map((opt) => (
                <OptionRow
                  key={opt}
                  value={opt}
                  label={display(opt)}
                  checked={values.includes(opt)}
                  onToggle={() => toggle(opt)}
                />
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {values.map((v) => (
            <Badge
              key={v}
              variant="secondary"
              className="gap-1 pr-1 text-xs font-normal"
            >
              {display(v)}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggle(v)}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OptionRow({
  value,
  label,
  checked,
  onToggle,
}: {
  value: string;
  label?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
        checked && "bg-muted",
      )}
    >
      <Checkbox checked={checked} className="pointer-events-none" />
      <span className="flex-1 truncate">{label ?? value}</span>
      {checked ? <Check className="h-4 w-4 text-primary" /> : null}
    </button>
  );
}

function StandardPreview({ field }: { field: ParameterValueField }) {
  const op = field.standardOperator;
  const v1 = field.standardValue;
  const v2 = field.standardValue2;
  const unit = field.unit ? ` ${field.unit}` : "";

  if (!op) {
    return (
      <p className="text-xs text-muted-foreground">
        ยังไม่ได้กำหนดเงื่อนไข — จะไม่ตรวจค่าผิดปกติ
      </p>
    );
  }
  if (v1 == null) {
    return (
      <p className="text-xs text-muted-foreground">
        ยังไม่ได้กรอกค่ามาตรฐาน
      </p>
    );
  }

  let text = "";
  switch (op) {
    case "lt": text = `ค่าปกติ: < ${v1}${unit}`; break;
    case "lte": text = `ค่าปกติ: ≤ ${v1}${unit}`; break;
    case "eq": text = `ค่าปกติ: = ${v1}${unit}`; break;
    case "gte": text = `ค่าปกติ: ≥ ${v1}${unit}`; break;
    case "gt": text = `ค่าปกติ: > ${v1}${unit}`; break;
    case "between":
      if (v2 == null) return <p className="text-xs text-muted-foreground">ยังไม่ได้กรอกค่าสิ้นสุดของช่วง</p>;
      text = `ค่าปกติ: ${v1} - ${v2}${unit}`;
      break;
    case "tolerance":
      if (v2 == null || v2 <= 0) return <p className="text-xs text-muted-foreground">ยังไม่ได้กรอก tolerance %</p>;
      {
        const low = v1 - Math.abs(v1) * (v2 / 100);
        const high = v1 + Math.abs(v1) * (v2 / 100);
        text = `ค่าปกติ: ${v1} ± ${v2}% (${low} - ${high})${unit}`;
      }
      break;
  }
  return <p className="text-xs text-emerald-700">{text}</p>;
}

const TIMER_PART_LABEL: Record<keyof TimerParts, string> = {
  months: "เดือน",
  days: "วัน",
  hours: "ชม",
  minutes: "นาที",
  seconds: "วิ",
};

function pickPartsForUnit(unit: TimerUnit): Array<keyof TimerParts> {
  switch (unit) {
    case "minute": return ["minutes", "seconds"];
    case "hour": return ["hours", "minutes", "seconds"];
    case "day": return ["days", "hours", "minutes", "seconds"];
    case "month": return ["months", "days", "hours", "minutes", "seconds"];
  }
}

function TimerDurationInput({
  unit,
  sec,
  onChange,
}: {
  unit: TimerUnit | undefined;
  sec: number;
  onChange: (newSec: number) => void;
}) {
  if (!unit) {
    return (
      <p className="text-xs text-muted-foreground">
        เลือก "หน่วย" ก่อน
      </p>
    );
  }
  const parts = secToParts(sec, unit);
  const keys = pickPartsForUnit(unit);
  return (
    <div className="flex items-center gap-1">
      {keys.map((key, i) => (
        <Fragment key={key}>
          {i > 0 && <span className="text-muted-foreground text-lg">:</span>}
          <div className="flex flex-col items-center">
            <Input
              type="number"
              min={0}
              value={parts[key] ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                const next: TimerParts = {
                  ...parts,
                  [key]: Number.isFinite(v) && v >= 0 ? v : 0,
                };
                onChange(partsToSec(next));
              }}
              className="h-10 w-20 text-center"
            />
            <span className="text-[10px] text-muted-foreground mt-0.5">
              {TIMER_PART_LABEL[key]}
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function TimerPreview({ field }: { field: ParameterValueField }) {
  if (!field.timerDurationSec || field.timerDurationSec <= 0 || !field.timerUnit) {
    return (
      <p className="text-xs text-muted-foreground">
        ยังไม่ได้กำหนดระยะเวลา
      </p>
    );
  }
  return (
    <p className="text-xs text-emerald-700">
      จับเวลา: {formatTimerHuman(field.timerDurationSec)} ({field.timerDurationSec.toLocaleString()} วินาที)
    </p>
  );
}

const FIELD_TYPE_META: Record<
  ParameterValueFieldType,
  {
    label: string;
    Icon: typeof TypeIcon;
    accent: string;
    tint: string;
    text: string;
    iconText: string;
  }
> = {
  text: {
    label: "ข้อความ",
    Icon: TypeIcon,
    accent: "bg-slate-400",
    tint: "bg-slate-50/60",
    text: "text-slate-700",
    iconText: "text-slate-500",
  },
  number: {
    label: "จำนวนเต็ม",
    Icon: Hash,
    accent: "bg-blue-500",
    tint: "bg-blue-50/50",
    text: "text-blue-700",
    iconText: "text-blue-500",
  },
  float: {
    label: "ทศนิยม",
    Icon: Hash,
    accent: "bg-blue-500",
    tint: "bg-blue-50/50",
    text: "text-blue-700",
    iconText: "text-blue-500",
  },
  enum: {
    label: "ตัวเลือก",
    Icon: ListIcon,
    accent: "bg-violet-500",
    tint: "bg-violet-50/50",
    text: "text-violet-700",
    iconText: "text-violet-500",
  },
  timer: {
    label: "จับเวลา",
    Icon: TimerIcon,
    accent: "bg-amber-500",
    tint: "bg-amber-50/50",
    text: "text-amber-700",
    iconText: "text-amber-500",
  },
  photo: {
    label: "ภาพถ่าย",
    Icon: ImageIcon,
    accent: "bg-pink-500",
    tint: "bg-pink-50/50",
    text: "text-pink-700",
    iconText: "text-pink-500",
  },
};

function summarizeField(field: ParameterValueField): string {
  switch (field.type) {
    case "text":
      return "ข้อความ";
    case "number":
    case "float": {
      const unit = field.unit ? ` ${field.unit}` : "";
      const op = field.standardOperator;
      const v1 = field.standardValue;
      const v2 = field.standardValue2;
      if (!op || v1 == null) return field.unit ? `หน่วย ${field.unit}` : "ยังไม่ตั้งเงื่อนไข";
      switch (op) {
        case "lt": return `< ${v1}${unit}`;
        case "lte": return `≤ ${v1}${unit}`;
        case "eq": return `= ${v1}${unit}`;
        case "gte": return `≥ ${v1}${unit}`;
        case "gt": return `> ${v1}${unit}`;
        case "between": return v2 != null ? `${v1} - ${v2}${unit}` : `≥ ${v1}${unit}`;
        case "tolerance": return v2 != null ? `${v1} ± ${v2}%${unit}` : `= ${v1}${unit}`;
      }
      return "";
    }
    case "enum": {
      const opts = field.options ?? [];
      if (opts.length === 0) return "ยังไม่มีตัวเลือก";
      const expected = field.expectedValues ?? [];
      const head = opts.slice(0, 3).join("/");
      const more = opts.length > 3 ? `+${opts.length - 3}` : "";
      const exp = expected.length > 0 ? ` · ปกติ: ${expected.join(",")}` : "";
      return `${head}${more}${exp}`;
    }
    case "timer": {
      if (!field.timerDurationSec || field.timerDurationSec <= 0) return "ยังไม่ตั้งระยะเวลา";
      return formatTimerHuman(field.timerDurationSec);
    }
    case "photo":
      return "ภาพถ่าย";
  }
}

type ValueFieldEditorProps = {
  field: ParameterValueField;
  index: number;
  total: number;
  onChange: (next: ParameterValueField) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
};

function ValueFieldEditor({
  field,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: ValueFieldEditorProps) {
  const [optionDraft, setOptionDraft] = useState("");
  const [expanded, setExpanded] = useState(!field.label?.trim());

  const addOption = () => {
    const v = optionDraft.trim();
    if (!v) return;
    if ((field.options ?? []).includes(v)) {
      setOptionDraft("");
      return;
    }
    onChange({ ...field, options: [...(field.options ?? []), v] });
    setOptionDraft("");
  };

  const removeOption = (opt: string) => {
    onChange({
      ...field,
      options: (field.options ?? []).filter((o) => o !== opt),
      requireNoteOn: (field.requireNoteOn ?? []).filter((o) => o !== opt),
      expectedValues: (field.expectedValues ?? []).filter((o) => o !== opt),
    });
  };

  const toggleRequireNote = (opt: string) => {
    const current = field.requireNoteOn ?? [];
    const next = current.includes(opt)
      ? current.filter((o) => o !== opt)
      : [...current, opt];
    onChange({ ...field, requireNoteOn: next });
  };

  const toggleExpected = (opt: string) => {
    const current = field.expectedValues ?? [];
    const next = current.includes(opt)
      ? current.filter((o) => o !== opt)
      : [...current, opt];
    onChange({ ...field, expectedValues: next });
  };

  const requiresUnit = field.type === "number" || field.type === "float";
  const isEnum = field.type === "enum";
  const meta = FIELD_TYPE_META[field.type];
  const TypeIconComp = meta.Icon;

  return (
    <div className="group relative overflow-hidden rounded-lg border border-grey-200 bg-background transition-shadow hover:shadow-sm">
      {/* type-color accent stripe */}
      <div className={cn("absolute inset-y-0 left-0 w-1", meta.accent)} aria-hidden />

      {/* header row — always visible */}
      <div className="flex items-center gap-2 pl-4 pr-2 py-2">
        <div className="flex flex-col gap-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            title="เลื่อนขึ้น"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            title="เลื่อนลง"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
        <GripVertical className="h-4 w-4 text-grey-300" aria-hidden />
        <span className="font-mono text-xs text-muted-foreground tabular-nums w-5 text-right">
          {index + 1}
        </span>
        <TypeIconComp className={cn("h-4 w-4 shrink-0", meta.iconText)} />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 flex items-baseline gap-2 min-w-0 text-left hover:opacity-80"
        >
          <span className="font-medium text-sm truncate">
            {field.label?.trim() || <span className="text-muted-foreground italic">ยังไม่ได้ตั้งชื่อ</span>}
          </span>
          <span className={cn("text-xs font-medium", meta.text)}>
            {meta.label}
          </span>
          <span className="text-xs text-muted-foreground font-mono truncate">
            · {summarizeField(field)}
          </span>
          {field.required && <span className="text-xs text-red-500 shrink-0">*</span>}
        </button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "ย่อ" : "ขยาย"}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onRemove}
          title="ลบช่อง"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* body — collapsible */}
      {expanded ? (
        <div className={cn("pl-4 pr-3 pb-4 pt-2 border-t border-grey-100", meta.tint)}>
        <div className="space-y-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox
              checked={!!field.required}
              onCheckedChange={(v) => onChange({ ...field, required: v === true })}
              className="h-3.5 w-3.5"
            />
            บังคับกรอก
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-6 space-y-1.5">
              <Label className="text-sm">ชื่อช่อง *</Label>
              <Input
                value={field.label}
                onChange={(e) => onChange({ ...field, label: e.target.value })}
                placeholder="เช่น ผล, ค่า, หมายเหตุ"
                className="h-10"
              />
            </div>
            <div className="sm:col-span-6 space-y-1.5">
              <Label className="text-sm">ชนิดข้อมูล *</Label>
              <Select
                value={field.type}
                onValueChange={(v) =>
                  onChange({
                    ...field,
                    type: v as ParameterValueFieldType,
                    unit: v === "number" || v === "float" ? field.unit ?? "" : "",
                    options: v === "enum" ? field.options ?? [] : [],
                    requireNoteOn: v === "enum" ? field.requireNoteOn ?? [] : [],
                    expectedValues: v === "enum" ? field.expectedValues ?? [] : [],
                    standardValue: v === "number" || v === "float" ? field.standardValue : null,
                    standardOperator: v === "number" || v === "float" ? field.standardOperator : undefined,
                    standardValue2: v === "number" || v === "float" ? field.standardValue2 ?? null : null,
                    timerDurationSec: v === "timer" ? field.timerDurationSec ?? null : null,
                    timerUnit: v === "timer" ? field.timerUnit : undefined,
                  })
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALUE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {requiresUnit ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="sm:col-span-3 space-y-1.5">
                  <Label className="text-sm">หน่วย *</Label>
                  <Input
                    value={field.unit ?? ""}
                    onChange={(e) => onChange({ ...field, unit: e.target.value })}
                    placeholder="เช่น %, mg/L, cP"
                    className="h-10"
                  />
                </div>
                <div className="sm:col-span-4 space-y-1.5">
                  <Label className="text-sm">เงื่อนไข</Label>
                  <Select
                    value={field.standardOperator ?? "none"}
                    onValueChange={(v) => {
                      const op = v === "none" ? undefined : (v as StandardOperator);
                      onChange({
                        ...field,
                        standardOperator: op,
                        standardValue2:
                          op === "between" || op === "tolerance" ? field.standardValue2 ?? null : null,
                      });
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATOR_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {field.standardOperator === "between" ? (
                  <>
                    <div className="sm:col-span-3 space-y-1.5">
                      <Label className="text-sm">ตั้งแต่ *</Label>
                      <Input
                        type="number"
                        value={field.standardValue ?? ""}
                        onChange={(e) =>
                          onChange({
                            ...field,
                            standardValue: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="h-10"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label className="text-sm">ถึง *</Label>
                      <Input
                        type="number"
                        value={field.standardValue2 ?? ""}
                        onChange={(e) =>
                          onChange({
                            ...field,
                            standardValue2: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="h-10"
                      />
                    </div>
                  </>
                ) : field.standardOperator === "tolerance" ? (
                  <>
                    <div className="sm:col-span-3 space-y-1.5">
                      <Label className="text-sm">ค่ามาตรฐาน *</Label>
                      <Input
                        type="number"
                        value={field.standardValue ?? ""}
                        onChange={(e) =>
                          onChange({
                            ...field,
                            standardValue: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="h-10"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label className="text-sm">± (%) *</Label>
                      <Input
                        type="number"
                        value={field.standardValue2 ?? ""}
                        onChange={(e) =>
                          onChange({
                            ...field,
                            standardValue2: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="h-10"
                      />
                    </div>
                  </>
                ) : field.standardOperator ? (
                  <div className="sm:col-span-5 space-y-1.5">
                    <Label className="text-sm">ค่ามาตรฐาน *</Label>
                    <Input
                      type="number"
                      value={field.standardValue ?? ""}
                      onChange={(e) =>
                        onChange({
                          ...field,
                          standardValue: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className="h-10"
                    />
                  </div>
                ) : null}
              </div>
              <StandardPreview field={field} />
            </div>
          ) : null}

          {isEnum ? (
            <div className="space-y-1.5">
              <Label className="text-sm">ตัวเลือก * (กด Enter เพื่อเพิ่ม)</Label>
              <div className="flex gap-2">
                <Input
                  value={optionDraft}
                  onChange={(e) => setOptionDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                  placeholder="พิมพ์แล้ว Enter"
                  className="h-10"
                />
                <Button type="button" variant="outline" onClick={addOption} className="h-10">
                  เพิ่ม
                </Button>
              </div>
              {(field.options ?? []).length > 0 ? (
                <div className="mt-2 space-y-1">
                  {(field.options ?? []).map((opt) => {
                    const needsNote = (field.requireNoteOn ?? []).includes(opt);
                    const isExpected = (field.expectedValues ?? []).includes(opt);
                    return (
                      <div
                        key={opt}
                        className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1 text-xs"
                      >
                        <span className="font-medium">{opt}</span>
                        <div className="flex items-center gap-3">
                          <label className="flex cursor-pointer items-center gap-1 text-emerald-700">
                            <Checkbox
                              checked={isExpected}
                              onCheckedChange={() => toggleExpected(opt)}
                              className="h-3.5 w-3.5"
                            />
                            ปกติ
                          </label>
                          <label className="flex cursor-pointer items-center gap-1 text-muted-foreground">
                            <Checkbox
                              checked={needsNote}
                              onCheckedChange={() => toggleRequireNote(opt)}
                              className="h-3.5 w-3.5"
                            />
                            ต้องการคำอธิบาย
                          </label>
                          <button
                            type="button"
                            onClick={() => removeOption(opt)}
                            className="rounded p-0.5 text-destructive hover:bg-destructive/10"
                            title="ลบตัวเลือก"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  ยังไม่มีตัวเลือก — ต้องมีอย่างน้อย 1 ตัว
                </p>
              )}
              {(field.options ?? []).length > 0 ? (() => {
                const expected = field.expectedValues ?? [];
                const opts = field.options ?? [];
                if (expected.length === 0) {
                  return (
                    <p className="mt-1 text-xs text-muted-foreground">
                      ยังไม่ได้กำหนดค่าที่คาดหวัง — จะไม่ตรวจค่าผิดปกติ
                    </p>
                  );
                }
                if (expected.length === opts.length) {
                  return (
                    <p className="mt-1 text-xs text-amber-700">
                      ทุกค่าถูกตั้งเป็นปกติ — จะไม่มี abnormal
                    </p>
                  );
                }
                return (
                  <p className="mt-1 text-xs text-emerald-700">
                    ค่าที่คาดหวัง: {expected.join(", ")} — ค่าอื่นจะถูกมาร์คผิดปกติ
                  </p>
                );
              })() : null}
            </div>
          ) : null}

          {field.type === "timer" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="sm:col-span-6 space-y-1.5">
                  <Label className="text-sm">ระยะเวลา *</Label>
                  <TimerDurationInput
                    unit={field.timerUnit}
                    sec={field.timerDurationSec ?? 0}
                    onChange={(newSec) =>
                      onChange({ ...field, timerDurationSec: newSec })
                    }
                  />
                </div>
                <div className="sm:col-span-6 space-y-1.5">
                  <Label className="text-sm">หน่วย *</Label>
                  <Select
                    value={field.timerUnit ?? ""}
                    onValueChange={(v) =>
                      onChange({ ...field, timerUnit: v as TimerUnit })
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="เลือกหน่วย" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minute">นาที</SelectItem>
                      <SelectItem value="hour">ชั่วโมง</SelectItem>
                      <SelectItem value="day">วัน</SelectItem>
                      <SelectItem value="month">เดือน (30 วัน)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <TimerPreview field={field} />
            </div>
          ) : null}
        </div>
        </div>
      ) : null}
    </div>
  );
}

type DialogProps = {
  open: boolean;
  item: ParameterItem | null;
  defaultScope: ParameterScope;
  itemNameOptions: string[];
  commonNameOptions: string[];
  productTypeOptions: string[];
  categoryOptions: string[];
  onClose: () => void;
  onSaved: () => void;
};

function ParameterDialog({
  open,
  item,
  defaultScope,
  itemNameOptions,
  commonNameOptions,
  productTypeOptions,
  categoryOptions,
  onClose,
  onSaved,
}: DialogProps) {
  const isEdit = !!item?._id;
  const [form, setForm] = useState<ParameterItem>(emptyForm(defaultScope));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(item ? { ...emptyForm(defaultScope), ...item, scope: item.scope ?? defaultScope } : emptyForm(defaultScope));
    }
  }, [open, item, defaultScope]);

  const set = <K extends keyof ParameterItem>(key: K, value: ParameterItem[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateField = (index: number, next: ParameterValueField) => {
    const copy = [...(form.valueFields ?? [])];
    copy[index] = next;
    set("valueFields", copy);
  };

  const removeField = (index: number) => {
    const copy = [...(form.valueFields ?? [])];
    copy.splice(index, 1);
    set("valueFields", copy);
  };

  const moveField = (index: number, dir: -1 | 1) => {
    const copy = [...(form.valueFields ?? [])];
    const target = index + dir;
    if (target < 0 || target >= copy.length) return;
    [copy[index], copy[target]] = [copy[target], copy[index]];
    set("valueFields", copy);
  };

  const addField = () => {
    set("valueFields", [...(form.valueFields ?? []), emptyValueField()]);
  };

  const validate = (): string | null => {
    if (!form.name?.trim()) return "กรุณากรอกชื่อพารามิเตอร์";
    if (!form.applyAll) {
      const total =
        (form.commonNames?.length ?? 0) +
        (form.itemNames?.length ?? 0) +
        (form.productTypes?.length ?? 0) +
        (form.categories?.length ?? 0);
      if (total === 0) {
        return "กรุณาเลือก 'ใช้กับ' อย่างน้อย 1 รายการ หรือเลือก 'ใช้กับทั้งหมด'";
      }
    }
    const fields = form.valueFields ?? [];
    for (let i = 0; i < fields.length; i += 1) {
      const f = fields[i];
      if (!f.label?.trim()) return `ช่องที่ ${i + 1}: กรุณากรอกชื่อช่อง`;
      if ((f.type === "number" || f.type === "float") && !f.unit?.trim()) {
        return `ช่อง "${f.label}": ต้องระบุหน่วย`;
      }
      if (f.type === "number" || f.type === "float") {
        if (f.standardOperator) {
          if (f.standardValue == null) {
            return `ช่อง "${f.label}": ต้องระบุค่ามาตรฐาน`;
          }
          if (f.standardOperator === "between") {
            if (f.standardValue2 == null) {
              return `ช่อง "${f.label}": ต้องระบุค่าสิ้นสุดของช่วง`;
            }
            if (f.standardValue > f.standardValue2) {
              return `ช่อง "${f.label}": ค่าเริ่มต้นต้องน้อยกว่าหรือเท่ากับค่าสิ้นสุด`;
            }
          }
          if (f.standardOperator === "tolerance") {
            if (f.standardValue2 == null || f.standardValue2 <= 0) {
              return `ช่อง "${f.label}": tolerance % ต้องมากกว่า 0`;
            }
          }
        }
      }
      if (f.type === "enum" && (!f.options || f.options.length === 0)) {
        return `ช่อง "${f.label}": ต้องมีตัวเลือกอย่างน้อย 1 ตัว`;
      }
      if (f.type === "timer") {
        if (!f.timerUnit) {
          return `ช่อง "${f.label}": ต้องระบุหน่วยเวลา`;
        }
        if (!f.timerDurationSec || f.timerDurationSec <= 0) {
          return `ช่อง "${f.label}": ต้องระบุระยะเวลา > 0`;
        }
      }
    }
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    const payload: Partial<ParameterItem> = {
      name: form.name.trim(),
      scope: form.scope ?? "qc",
      status: form.status ?? "active",
      applyAll: !!form.applyAll,
      commonNames: form.applyAll ? [] : form.commonNames ?? [],
      itemNames: form.applyAll ? [] : form.itemNames ?? [],
      productTypes: form.applyAll ? [] : form.productTypes ?? [],
      categories: form.applyAll ? [] : form.categories ?? [],
      valueFields: form.valueFields ?? [],
      sortOrder: form.sortOrder ?? 0,
      note: form.note?.trim() || "",
    };
    try {
      if (isEdit && item?._id) {
        await api.updateParameter(item._id, payload);
        toast.success("แก้ไขพารามิเตอร์สำเร็จ");
      } else {
        await api.createParameter(payload);
        toast.success("เพิ่มพารามิเตอร์สำเร็จ");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] w-[95vw] sm:max-w-5xl overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-xl">
            {isEdit ? "แก้ไขพารามิเตอร์" : "เพิ่มพารามิเตอร์การตรวจสอบ"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-12">
            <div className="sm:col-span-5 space-y-1.5">
              <Label className="text-sm font-medium">ชื่อพารามิเตอร์ *</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="เช่น pH, ความหนืด, การละลาย"
                autoFocus
                className="h-11 text-base"
              />
            </div>
            <div className="sm:col-span-3 space-y-1.5">
              <Label className="text-sm font-medium">หน่วยงาน *</Label>
              <Select
                value={form.scope ?? "qc"}
                onValueChange={(v) => set("scope", v as ParameterScope)}
              >
                <SelectTrigger className="h-11 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qc">QC</SelectItem>
                  <SelectItem value="lab">Lab</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">สถานะ</Label>
              <Select
                value={form.status ?? "active"}
                onValueChange={(v) => set("status", v as ParameterItem["status"])}
              >
                <SelectTrigger className="h-11 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">เปิด</SelectItem>
                  <SelectItem value="inactive">ปิด</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">ลำดับ</Label>
              <Input
                type="number"
                value={form.sortOrder ?? 0}
                onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
                className="h-11 text-base"
              />
            </div>
          </div>

          <div className="rounded-lg border p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">ใช้กับ</h3>
                <p className="text-xs text-muted-foreground">
                  เลือกได้หลายมิติพร้อมกัน — Item Name / Common Name / ประเภท / หมวดหมู่
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!!form.applyAll}
                  onCheckedChange={(v) => set("applyAll", v === true)}
                />
                <span className="font-medium">ใช้กับทั้งหมด</span>
              </label>
            </div>

            <div
              className={cn(
                "mt-5 grid grid-cols-1 gap-5 md:grid-cols-2",
                form.applyAll && "pointer-events-none opacity-50",
              )}
            >
              <MultiSelectPopover
                label="Item Name"
                placeholder="เลือก item name"
                values={form.itemNames ?? []}
                onChange={(v) => set("itemNames", v)}
                options={itemNameOptions}
                disabled={form.applyAll}
                emptyText="ยังไม่มี master items"
              />
              <MultiSelectPopover
                label="Common Name"
                placeholder="เลือก common name (EC / SC / WP ...)"
                values={form.commonNames ?? []}
                onChange={(v) => set("commonNames", v)}
                options={commonNameOptions}
                labelFor={formatClassificationOption}
                disabled={form.applyAll}
                emptyText="ยังไม่มี common name ที่ตรวจจับได้"
              />
              <MultiSelectPopover
                label="ประเภท"
                placeholder="เลือกประเภทสินค้า (น้ำ / ทราย / ผง)"
                values={form.productTypes ?? []}
                onChange={(v) => set("productTypes", v)}
                options={productTypeOptions}
                labelFor={formatProductTypeOption}
                disabled={form.applyAll}
                emptyText="ยังไม่มีประเภทสินค้า"
              />
              <MultiSelectPopover
                label="หมวดหมู่"
                placeholder="เลือกหมวดหมู่ (RM / FG)"
                values={form.categories ?? []}
                onChange={(v) => set("categories", v)}
                options={categoryOptions}
                disabled={form.applyAll}
                emptyText="ยังไม่มีหมวดหมู่"
              />
            </div>
          </div>

          <div className="rounded-lg border p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">ค่าที่ต้องใส่</h3>
                <p className="text-xs text-muted-foreground">
                  กำหนดช่องที่ผู้กรอกผลต้องใส่ — text / number / float / enum
                </p>
              </div>
              <Button type="button" variant="outline" onClick={addField}>
                <Plus className="mr-1 h-4 w-4" /> เพิ่มช่อง
              </Button>
            </div>

            {(form.valueFields ?? []).length === 0 ? (
              <p className="mt-4 rounded-md bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                ยังไม่มีช่องรับค่า — กดปุ่ม "เพิ่มช่อง" เพื่อเริ่ม
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {(form.valueFields ?? []).map((f, i) => (
                  <ValueFieldEditor
                    key={i}
                    field={f}
                    index={i}
                    total={form.valueFields?.length ?? 0}
                    onChange={(next) => updateField(i, next)}
                    onRemove={() => removeField(i)}
                    onMove={(dir) => moveField(i, dir)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">หมายเหตุ</Label>
            <Textarea
              rows={3}
              value={form.note ?? ""}
              onChange={(e) => set("note", e.target.value)}
              placeholder="ข้อมูลเพิ่มเติม (optional)"
              className="text-base"
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
              className="h-11 px-6"
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={busy} className="h-11 px-6">
              {busy ? "กำลังบันทึก..." : isEdit ? "บันทึกการแก้ไข" : "เพิ่มพารามิเตอร์"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ParameterSettings() {
  const queryClient = useQueryClient();
  const [scopeTab, setScopeTab] = useState<ParameterScope>("qc");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<ParameterItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ParameterItem | null>(null);

  const parametersQuery = useQuery({
    queryKey: ["parameters"],
    queryFn: () => api.getParameters(),
  });
  const parameters = parametersQuery.data ?? [];

  const masterItemsQuery = useQuery({
    queryKey: ["master-items-for-parameters"],
    queryFn: async () => {
      const res = await api.get<unknown>("/master-items");
      return normalizeItems(res.data.data);
    },
    staleTime: 5 * 60 * 1000,
  });
  const masterItems = masterItemsQuery.data ?? [];

  const itemNameOptions = useMemo(
    () => uniqueSorted(masterItems.map((m) => firstString(m, ITEM_NAME_KEYS))),
    [masterItems],
  );
  const productTypeOptions = useMemo(
    () => uniqueSorted(masterItems.map(getItemProductType)),
    [masterItems],
  );
  const categoryOptions = useMemo(
    () => uniqueSorted(masterItems.map(getItemCategory)),
    [masterItems],
  );
  const commonNameOptions = useMemo(
    () => uniqueSorted(masterItems.map(getItemCommonName)),
    [masterItems],
  );

  const scopedParameters = useMemo(
    () => parameters.filter((p) => (p.scope ?? "qc") === scopeTab),
    [parameters, scopeTab],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...scopedParameters].sort(
      (a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999),
    );
    return sorted.filter((p) => {
      const haystack = [
        p.name,
        p.note,
        ...(p.commonNames ?? []),
        ...(p.itemNames ?? []),
        ...(p.productTypes ?? []),
        ...(p.categories ?? []),
        ...(p.valueFields ?? []).map((f) => f.label),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      const matchesStatus =
        statusFilter === "all" || (p.status ?? "active") === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [scopedParameters, search, statusFilter]);

  const activeCount = scopedParameters.filter((p) => (p.status ?? "active") === "active").length;
  const qcCount = parameters.filter((p) => (p.scope ?? "qc") === "qc").length;
  const labCount = parameters.filter((p) => p.scope === "lab").length;

  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleting?._id) return;
    try {
      await api.deleteParameter(deleting._id);
      toast.success("ลบพารามิเตอร์สำเร็จ");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["parameters"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl md:text-2xl font-bold text-foreground">
            <SlidersHorizontal className="h-6 w-6" />
            พารามิเตอร์การตรวจสอบ
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            กำหนดพารามิเตอร์ที่ต้องตรวจ — เลือกใช้กับ Item Name / ประเภท
            ได้พร้อมกัน และกำหนดช่องค่าที่ผู้กรอกต้องใส่
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => parametersQuery.refetch()}
            disabled={parametersQuery.isFetching}
          >
            <RefreshCw
              className={parametersQuery.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            />
            Refresh
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            เพิ่มพารามิเตอร์
          </Button>
        </div>
      </div>

      <Tabs
        value={scopeTab}
        onValueChange={(v) => setScopeTab(v as ParameterScope)}
        className="mb-4"
      >
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid">
          <TabsTrigger value="qc" className="gap-2">
            QC
            <span className="rounded-full bg-muted px-1.5 text-xs font-semibold tabular-nums">
              {qcCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="lab" className="gap-2">
            Lab
            <span className="rounded-full bg-muted px-1.5 text-xs font-semibold tabular-nums">
              {labCount}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard label={`ทั้งหมดใน ${SCOPE_LABEL[scopeTab]}`} value={scopedParameters.length} />
        <SummaryCard label="เปิดใช้งาน" value={activeCount} tone="active" />
        <SummaryCard
          label="ปิดใช้งาน"
          value={scopedParameters.length - activeCount}
          tone="inactive"
        />
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">รายการพารามิเตอร์</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ / ใช้กับ / ช่อง..."
                className="pl-8"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="active">เปิดใช้งาน</SelectItem>
                <SelectItem value="inactive">ปิดใช้งาน</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {parametersQuery.isLoading ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              กำลังโหลด...
            </p>
          ) : parametersQuery.isError ? (
            <div className="mx-6 my-4 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <p className="font-medium text-destructive">โหลดข้อมูลไม่สำเร็จ</p>
                <p className="text-muted-foreground">
                  {(parametersQuery.error as Error)?.message}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>ใช้กับ</TableHead>
                    <TableHead>ค่าที่ต้องใส่</TableHead>
                    <TableHead className="w-28">สถานะ</TableHead>
                    <TableHead className="w-28 text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        ไม่มีข้อมูล
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((p, i) => {
                      const pScope = (p.scope ?? "qc") as ParameterScope;
                      return (
                      <TableRow key={p._id ?? i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge className={cn("text-[10px] font-semibold uppercase", SCOPE_BADGE_CLASS[pScope])}>
                              {SCOPE_LABEL[pScope]}
                            </Badge>
                            <span className="font-medium">{p.name}</span>
                          </div>
                          {p.note ? (
                            <div className="mt-0.5 text-xs text-muted-foreground">{p.note}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <ApplyToBadges item={p} />
                        </TableCell>
                        <TableCell>
                          <ValueFieldBadges fields={p.valueFields ?? []} />
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              (p.status ?? "active") === "active" ? "default" : "secondary"
                            }
                          >
                            {(p.status ?? "active") === "active" ? "เปิด" : "ปิด"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditing(p)}
                            title="แก้ไข"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleting(p)}
                            title="ลบ"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      <ParameterDialog
        open={creating || !!editing}
        item={editing}
        defaultScope={scopeTab}
        itemNameOptions={itemNameOptions}
        commonNameOptions={commonNameOptions}
        productTypeOptions={productTypeOptions}
        categoryOptions={categoryOptions}
        onClose={closeDialog}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["parameters"] })}
      />

      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            ลบพารามิเตอร์ <span className="font-semibold">{deleting?.name}</span>?
            การลบไม่สามารถย้อนกลับได้
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              ลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "active" | "inactive";
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-2xl font-bold",
            tone === "active" && "text-emerald-600",
            tone === "inactive" && "text-muted-foreground",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function ApplyToBadges({ item }: { item: ParameterItem }) {
  if (item.applyAll) {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
        ทั้งหมด
      </Badge>
    );
  }
  const groups: { label: string; values: string[]; color: string }[] = [
    {
      label: "Item",
      values: item.itemNames ?? [],
      color: "bg-violet-50 text-violet-700",
    },
    {
      label: "Common",
      values: item.commonNames ?? [],
      color: "bg-blue-50 text-blue-700",
    },
    {
      label: "ประเภท",
      values: item.productTypes ?? [],
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "หมวดหมู่",
      values: item.categories ?? [],
      color: "bg-amber-50 text-amber-700",
    },
  ].filter((g) => g.values.length > 0);

  if (groups.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {groups.map((g) => (
        <span
          key={g.label}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs",
            g.color,
          )}
          title={g.values.join(", ")}
        >
          <span className="font-semibold">{g.label}:</span>
          <span className="truncate max-w-[180px]">
            {g.values.slice(0, 2).join(", ")}
            {g.values.length > 2 ? ` +${g.values.length - 2}` : ""}
          </span>
        </span>
      ))}
    </div>
  );
}

function ValueFieldBadges({ fields }: { fields: ParameterValueField[] }) {
  if (fields.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {fields.map((f, i) => {
        const detail =
          f.type === "enum"
            ? ` (${(f.options ?? []).slice(0, 3).join("/")}${
                (f.options?.length ?? 0) > 3 ? "..." : ""
              })`
            : f.type === "number" || f.type === "float"
              ? f.unit
                ? ` [${f.unit}]`
                : ""
              : "";
        return (
          <span
            key={i}
            className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs"
            title={`${f.type}${detail}`}
          >
            <span className="font-medium">{f.label}</span>
            <span className="ml-1 text-muted-foreground">· {f.type}</span>
            {detail ? <span className="text-muted-foreground">{detail}</span> : null}
            {f.required ? <span className="ml-1 text-destructive">*</span> : null}
          </span>
        );
      })}
    </div>
  );
}
