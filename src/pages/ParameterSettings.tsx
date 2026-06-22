import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Filter,
  GripVertical,
  Hash,
  Image as ImageIcon,
  Link2,
  List as ListIcon,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Timer as TimerIcon,
  Trash2,
  Type as TypeIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { SubstanceStandardsDialog } from "@/components/lis/SubstanceStandardsDialog";
import { ConditionalStandardsDialog } from "@/components/lis/ConditionalStandardsDialog";
import { describeRule, describeSubstanceStandard } from "@/lib/standardOperators";
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
  type ItemGroupItem,
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
import { generateParameter } from "@/lib/aiApi";
import {
  partsToSec,
  secToParts,
  formatTimerHuman,
  type TimerParts,
} from "@/lib/parameterValidation";

const VALUE_TYPE_OPTIONS: { value: ParameterValueFieldType; label: string }[] = [
  { value: "text",  label: "ข้อความ (Text)" },
  { value: "number", label: "จำนวนเต็ม (Number)" },
  { value: "float", label: "ทศนิยม (Float)" },
  { value: "enum",  label: "ตัวเลือก (Enum)" },
  { value: "photo", label: "ภาพถ่าย (Photo)" },
  { value: "file",  label: "แนบไฟล์ (File)" },
  { value: "timer", label: "จับเวลา (Timer)" },
  { value: "reference", label: "ดึงค่าจาก parameter อื่น (Reference)" },
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

const FILE_TYPE_OPTIONS: { value: string; label: string; accept: string }[] = [
  { value: 'pdf',   label: 'PDF',   accept: 'application/pdf' },
  { value: 'excel', label: 'Excel', accept: '.xls,.xlsx' },
  { value: 'word',  label: 'Word',  accept: '.doc,.docx' },
  { value: 'csv',   label: 'CSV',   accept: '.csv' },
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
const ITEM_NO_KEYS = ["item_no", "itemNo", "item_code", "itemCode", "code"];
const COMMON_NAME_DIRECT_KEYS = ["common_name", "commonname", "commonName"];

const SUB_CATEGORY_PARENTS = ["RM", "FG"] as const;
type SubCategoryParent = (typeof SUB_CATEGORY_PARENTS)[number];

function extractItemNoPrefix(itemNo: string): string {
  const cleaned = itemNo.trim();
  if (!cleaned) return "";
  const dashIdx = cleaned.indexOf("-");
  return (dashIdx > 0 ? cleaned.slice(0, dashIdx) : cleaned).toUpperCase();
}

function getItemSubCategory(item: MasterItemRecord): string {
  return extractItemNoPrefix(firstString(item, ITEM_NO_KEYS));
}

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
  maxPhotos: 5,
  maxFiles: 5,
  allowedFileTypes: ['pdf'],
  phase: "both",
  triggersPhase2: false,
  refParameterId: null,
  refFieldLabel: null,
  refPhase: 1,
  conditionalMode: false,
  conditionalStandards: [],
  showLastBatch: false,
});

const emptyForm = (scope: ParameterScope = "qc"): ParameterItem => ({
  name: "",
  scope,
  shareWithLab: false,
  status: "active",
  applyAll: false,
  commonNames: [],
  itemNames: [],
  productTypes: [],
  categories: [],
  subCategories: [],
  itemGroups: [],
  valueFields: [],
  sortOrder: 0,
  note: "",
  hasPhases: false,
  multiEntry: false,
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
  if (field.substanceMode) {
    const stds = field.substanceStandards ?? [];
    if (stds.length === 0) {
      return <p className="text-xs text-muted-foreground">ยังไม่ได้ตั้งเงื่อนไขสาร</p>;
    }
    return (
      <p className="text-xs text-emerald-700">
        {stds
          .map((s) => `${s.substance} ${describeSubstanceStandard(s, field.unit ?? "")}`.trim())
          .join(" · ")}
      </p>
    );
  }
  if (field.conditionalMode) {
    const rules = field.conditionalStandards ?? [];
    if (rules.length === 0) return <p className="text-xs text-muted-foreground">ยังไม่ได้ตั้งกฎ</p>;
    return (
      <div className="space-y-0.5">
        {rules.map((r, i) => <p key={i} className="text-xs text-emerald-700">{describeRule(r, field.unit ?? "")}</p>)}
      </div>
    );
  }
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
  file: {
    label: "แนบไฟล์",
    Icon: Paperclip,
    accent: "bg-teal-500",
    tint: "bg-teal-50/50",
    text: "text-teal-700",
    iconText: "text-teal-500",
  },
  reference: {
    label: "อ้างอิง",
    Icon: Link2,
    accent: "bg-emerald-500",
    tint: "bg-emerald-50/50",
    text: "text-emerald-700",
    iconText: "text-emerald-500",
  },
};

function summarizeField(field: ParameterValueField): string {
  switch (field.type) {
    case "text":
      return "ข้อความ";
    case "number":
    case "float": {
      if (field.conditionalMode) {
        const n = (field.conditionalStandards ?? []).length;
        return n > 0 ? `เงื่อนไขพิเศษ ${n} กฎ` : "เงื่อนไขพิเศษ (ยังไม่ตั้งกฎ)";
      }
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
      return `ภาพถ่าย (สูงสุด ${field.maxPhotos ?? 5})`;
    case "file": {
      const types = (field.allowedFileTypes ?? ['pdf'])
        .map((t) => t.toUpperCase())
        .join(', ');
      return `${types} (สูงสุด ${field.maxFiles ?? 5} ไฟล์)`;
    }
    case "reference": {
      if (!field.refParameterId || !field.refFieldLabel) return "ยังไม่ได้เลือก parameter ต้นทาง";
      const phaseLabel = field.refPhase === 2 ? " · phase 2" : "";
      return `← ${field.refFieldLabel}${phaseLabel}`;
    }
  }
}

type OptionFilter = {
  itemNames?: string[];
  commonNames?: string[];
  productTypes?: string[];
  categories?: string[];
  subCategories?: string[];
  itemGroups?: string[];
};

type ValueFieldEditorProps = {
  field: ParameterValueField;
  index: number;
  total: number;
  onChange: (next: ParameterValueField) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  hasPhases?: boolean;
  allParameters?: ParameterItem[];
  currentParameterId?: string;
  siblingFields?: ParameterValueField[];
  itemNameOptions?: string[];
  commonNameOptions?: string[];
  productTypeOptions?: string[];
  categoryOptions?: string[];
  subCategoryByParent?: Record<SubCategoryParent, string[]>;
  groupOptions?: string[];
  groupIdByName?: Map<string, string>;
  groupNameById?: Map<string, string>;
};

function summarizeOptionFilter(f: OptionFilter | undefined, groupNameById?: Map<string, string>): string {
  if (!f) return '';
  const parts: string[] = [];
  if ((f.itemNames?.length ?? 0) > 0) {
    parts.push(`item: ${(f.itemNames ?? []).slice(0, 2).join('/')}${(f.itemNames?.length ?? 0) > 2 ? `+${(f.itemNames?.length ?? 0) - 2}` : ''}`);
  }
  if ((f.commonNames?.length ?? 0) > 0) {
    parts.push(`common: ${(f.commonNames ?? []).slice(0, 3).join('/')}`);
  }
  if ((f.productTypes?.length ?? 0) > 0) {
    parts.push((f.productTypes ?? []).map((p) => productTypeLabels[p] ?? p).join('/'));
  }
  if ((f.categories?.length ?? 0) > 0) {
    parts.push((f.categories ?? []).join('/'));
  }
  if ((f.subCategories?.length ?? 0) > 0) {
    parts.push(`sub: ${(f.subCategories ?? []).slice(0, 3).join('/')}`);
  }
  if ((f.itemGroups?.length ?? 0) > 0) {
    const names = (f.itemGroups ?? []).map((id) => groupNameById?.get(id)).filter(Boolean) as string[];
    parts.push(names.length > 0 ? `กลุ่ม: ${names.slice(0, 3).join('/')}` : `กลุ่ม: ${(f.itemGroups ?? []).length}`);
  }
  return parts.join(' · ');
}

function OptionFilterBadge({ filter, groupNameById }: { filter?: OptionFilter; groupNameById?: Map<string, string> }) {
  const label = summarizeOptionFilter(filter, groupNameById);
  if (!label) return null;
  return (
    <Badge variant="secondary" className="gap-1 text-[10px] bg-emerald-50 text-emerald-700 max-w-[280px] truncate">
      <Filter className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{label}</span>
    </Badge>
  );
}

function OptionFilterDialog({
  opt,
  filter,
  itemNameOptions,
  commonNameOptions,
  productTypeOptions,
  categoryOptions,
  subCategoryByParent,
  groupOptions = [],
  groupIdByName,
  groupNameById,
  onSetFilter,
  onClear,
}: {
  opt: string;
  filter?: OptionFilter;
  itemNameOptions: string[];
  commonNameOptions: string[];
  productTypeOptions: string[];
  categoryOptions: string[];
  subCategoryByParent?: Record<SubCategoryParent, string[]>;
  groupOptions?: string[];
  groupIdByName?: Map<string, string>;
  groupNameById?: Map<string, string>;
  onSetFilter: (next: OptionFilter) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasAny =
    (filter?.itemNames?.length ?? 0) +
      (filter?.commonNames?.length ?? 0) +
      (filter?.productTypes?.length ?? 0) +
      (filter?.categories?.length ?? 0) +
      (filter?.subCategories?.length ?? 0) +
      (filter?.itemGroups?.length ?? 0) >
    0;

  const activeParents = (filter?.categories ?? []).filter(
    (c): c is SubCategoryParent => (SUB_CATEGORY_PARENTS as readonly string[]).includes(c),
  );
  const groupedSubs = activeParents
    .map((parent) => ({
      label: `${parent} — หมวดย่อยจาก code`,
      options: subCategoryByParent?.[parent] ?? [],
    }))
    .filter((g) => g.options.length > 0);
  const flatSubOptions = groupedSubs.flatMap((g) => g.options);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "rounded p-0.5 hover:bg-emerald-50",
          hasAny ? "text-emerald-600" : "text-grey-400",
        )}
        title="แสดงเฉพาะ item ที่..."
      >
        <Filter className="h-3.5 w-3.5" />
      </button>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">แสดงเฉพาะ item ที่... — "{opt}"</DialogTitle>
          <p className="text-xs text-muted-foreground">
            เลือกได้หลายมิติพร้อมกัน — OR ข้ามมิติ (ตรงมิติใดมิติหนึ่งก็แสดง). ปล่อยว่างทั้งหมด = แสดงทุก item
          </p>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pt-2">
          <MultiSelectPopover
            label="Item Name"
            placeholder="เลือก item name"
            values={filter?.itemNames ?? []}
            onChange={(v) => onSetFilter({ itemNames: v })}
            options={itemNameOptions}
            emptyText="ยังไม่มี master items"
          />
          <MultiSelectPopover
            label="Common Name"
            placeholder="เลือก common name (EC / SC / WP ...)"
            values={filter?.commonNames ?? []}
            onChange={(v) => onSetFilter({ commonNames: v })}
            options={commonNameOptions}
            labelFor={formatClassificationOption}
            emptyText="ยังไม่มี common name"
          />
          <MultiSelectPopover
            label="ประเภท"
            placeholder="เลือกประเภทสินค้า (น้ำ / ทราย / ผง)"
            values={filter?.productTypes ?? []}
            onChange={(v) => onSetFilter({ productTypes: v })}
            options={productTypeOptions}
            labelFor={formatProductTypeOption}
            emptyText="ยังไม่มีประเภท"
          />
          <MultiSelectPopover
            label="หมวดหมู่"
            placeholder="เลือกหมวดหมู่ (RM / FG)"
            values={filter?.categories ?? []}
            onChange={(v) => {
              const nextParents = new Set(
                v.filter((c): c is SubCategoryParent =>
                  (SUB_CATEGORY_PARENTS as readonly string[]).includes(c),
                ),
              );
              const allowedSubs = new Set(
                Array.from(nextParents).flatMap((p) => subCategoryByParent?.[p] ?? []),
              );
              onSetFilter({
                categories: v,
                subCategories: (filter?.subCategories ?? []).filter((s) => allowedSubs.has(s)),
              });
            }}
            options={categoryOptions}
            emptyText="ยังไม่มีหมวดหมู่"
          />
          {activeParents.length > 0 && (
            <div className="md:col-span-2">
              <MultiSelectPopover
                label={`หมวดหมู่ย่อย (prefix code ของ ${activeParents.join(' / ')})`}
                placeholder="เลือก prefix เช่น F, FC, RO, RC ..."
                values={filter?.subCategories ?? []}
                onChange={(v) => onSetFilter({ subCategories: v })}
                options={flatSubOptions}
                groupedOptions={groupedSubs.length > 1 ? groupedSubs : undefined}
                emptyText="ไม่พบ prefix จาก master items"
              />
            </div>
          )}
          <MultiSelectPopover
            label="กลุ่ม Item"
            placeholder="เลือกกลุ่ม item ที่จัดเอง"
            values={(filter?.itemGroups ?? []).map((id) => groupNameById?.get(id) ?? id)}
            onChange={(names) =>
              onSetFilter({
                itemGroups: names
                  .map((name) => groupIdByName?.get(name))
                  .filter((id): id is string => !!id),
              })
            }
            options={groupOptions}
            emptyText="ยังไม่มีกลุ่ม — สร้างที่หน้า Master Item"
          />
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClear} disabled={!hasAny}>
            เคลียร์ทั้งหมด
          </Button>
          <Button type="button" onClick={() => setOpen(false)}>
            เสร็จ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ValueFieldEditor({
  field,
  index,
  total,
  onChange,
  onRemove,
  onMove,
  hasPhases = false,
  allParameters = [],
  currentParameterId,
  siblingFields = [],
  itemNameOptions = [],
  commonNameOptions = [],
  productTypeOptions = [],
  categoryOptions = [],
  subCategoryByParent,
  groupOptions = [],
  groupIdByName,
  groupNameById,
}: ValueFieldEditorProps) {
  const [optionDraft, setOptionDraft] = useState("");
  const [expanded, setExpanded] = useState(!field.label?.trim());
  const [substanceDialogOpen, setSubstanceDialogOpen] = useState(false);
  const [conditionalDialogOpen, setConditionalDialogOpen] = useState(false);

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
    const nextFilters = { ...(field.optionFilters ?? {}) };
    delete nextFilters[opt];
    onChange({
      ...field,
      options: (field.options ?? []).filter((o) => o !== opt),
      requireNoteOn: (field.requireNoteOn ?? []).filter((o) => o !== opt),
      expectedValues: (field.expectedValues ?? []).filter((o) => o !== opt),
      optionFilters: Object.keys(nextFilters).length > 0 ? nextFilters : undefined,
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

  const setOptionFilter = (opt: string, next: OptionFilter) => {
    const current = field.optionFilters ?? {};
    const merged: OptionFilter = { ...(current[opt] ?? {}), ...next };
    // Drop empty arrays so the entry "has any" check is honest
    const nonEmpty: OptionFilter = {};
    if ((merged.itemNames?.length ?? 0) > 0) nonEmpty.itemNames = merged.itemNames;
    if ((merged.commonNames?.length ?? 0) > 0) nonEmpty.commonNames = merged.commonNames;
    if ((merged.productTypes?.length ?? 0) > 0) nonEmpty.productTypes = merged.productTypes;
    if ((merged.categories?.length ?? 0) > 0) nonEmpty.categories = merged.categories;
    if ((merged.subCategories?.length ?? 0) > 0) nonEmpty.subCategories = merged.subCategories;
    if ((merged.itemGroups?.length ?? 0) > 0) nonEmpty.itemGroups = merged.itemGroups;
    const hasAny = Object.keys(nonEmpty).length > 0;
    let nextFilters: Record<string, OptionFilter>;
    if (!hasAny) {
      nextFilters = { ...current };
      delete nextFilters[opt];
    } else {
      nextFilters = { ...current, [opt]: nonEmpty };
    }
    onChange({
      ...field,
      optionFilters: Object.keys(nextFilters).length > 0 ? nextFilters : undefined,
    });
  };

  const clearOptionFilter = (opt: string) => {
    const current = field.optionFilters ?? {};
    const nextFilters = { ...current };
    delete nextFilters[opt];
    onChange({
      ...field,
      optionFilters: Object.keys(nextFilters).length > 0 ? nextFilters : undefined,
    });
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox
                checked={!!field.required}
                onCheckedChange={(v) => onChange({ ...field, required: v === true })}
                className="h-3.5 w-3.5"
              />
              บังคับกรอก
            </label>
            <label
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              title="ให้ช่องนี้กรอกได้หลายค่า (เก็บทุกค่า)"
            >
              <Checkbox
                checked={!!field.multiple}
                onCheckedChange={(v) => onChange({ ...field, multiple: v === true })}
                disabled={
                  !(field.type === "text" || field.type === "number" || field.type === "float" || field.type === "enum") ||
                  !!field.substanceMode
                }
                className="h-3.5 w-3.5"
              />
              ช่องนี้กรอกได้หลายค่า
            </label>
            {(field.type === "number" || field.type === "float" || field.type === "enum" || field.type === "text") && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground" title="โชว์ค่าช่องนี้จากผลตรวจครั้งก่อนของ common name เดียวกัน (เฉยๆ ไม่ตรวจ)">
                <Checkbox
                  checked={!!field.showLastBatch}
                  onCheckedChange={(v) => onChange({ ...field, showLastBatch: v === true })}
                  className="h-3.5 w-3.5"
                />
                โชว์ค่าแบชล่าสุด
              </label>
            )}
            {hasPhases ? (
              <>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">ใช้ตอนไหน:</span>
                  <Select
                    value={field.phase ?? "both"}
                    onValueChange={(v) =>
                      onChange({ ...field, phase: v as "both" | "before" | "after" })
                    }
                  >
                    <SelectTrigger className="h-7 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">ทั้ง 2 phase</SelectItem>
                      <SelectItem value="before">เฉพาะก่อน (Phase 1)</SelectItem>
                      <SelectItem value="after">เฉพาะหลัง (Phase 2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {field.phase !== "after" ? (
                  <label
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    title="เมื่อกรอกช่องนี้ (หรือ timer ครบเวลา) จะ unlock Phase 2 ให้ Lab ตรวจค่าหลัง"
                  >
                    <Checkbox
                      checked={!!field.triggersPhase2}
                      onCheckedChange={(v) => onChange({ ...field, triggersPhase2: v === true })}
                      className="h-3.5 w-3.5"
                    />
                    <span>ตัวเริ่ม Phase 2</span>
                  </label>
                ) : null}
              </>
            ) : null}
          </div>
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
                    conditionalMode: v === "number" || v === "float" ? field.conditionalMode : false,
                    timerDurationSec: v === "timer" ? field.timerDurationSec ?? null : null,
                    timerUnit: v === "timer" ? field.timerUnit : undefined,
                    maxPhotos: v === "photo" ? (field.maxPhotos ?? 5) : undefined,
                    maxFiles: v === "file" ? (field.maxFiles ?? 5) : field.maxFiles,
                    allowedFileTypes: v === "file"
                      ? (field.allowedFileTypes?.length ? field.allowedFileTypes : ['pdf'])
                      : field.allowedFileTypes,
                    // reference fields can't be required or trigger Phase 2 — reset to defaults
                    refParameterId: v === "reference" ? field.refParameterId ?? null : null,
                    refFieldLabel: v === "reference" ? field.refFieldLabel ?? null : null,
                    refPhase: v === "reference" ? field.refPhase ?? 1 : null,
                    required: v === "reference" ? false : field.required,
                    triggersPhase2: v === "reference" ? false : field.triggersPhase2,
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
              {/* โหมดเกณฑ์ */}
              {(() => {
                const mode: "single" | "substance" | "conditional" =
                  field.conditionalMode ? "conditional" : field.substanceMode ? "substance" : "single";
                const setMode = (m: "single" | "substance" | "conditional") =>
                  onChange({
                    ...field,
                    substanceMode: m === "substance",
                    conditionalMode: m === "conditional",
                    substanceStandards: m === "substance" ? field.substanceStandards ?? [] : field.substanceStandards,
                    conditionalStandards: m === "conditional" ? field.conditionalStandards ?? [] : field.conditionalStandards,
                    standardOperator: m === "single" ? field.standardOperator : undefined,
                    standardValue: m === "single" ? field.standardValue : null,
                    standardValue2: m === "single" ? field.standardValue2 : null,
                  });
                return (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">โหมดเกณฑ์:</span>
                    {([["single", "ค่าเดียว"], ["substance", "แยกตามสาร"], ["conditional", "เงื่อนไขพิเศษ"]] as const).map(([m, lbl]) => (
                      <label key={m} className="flex cursor-pointer items-center gap-1.5">
                        <input type="radio" checked={mode === m} onChange={() => setMode(m)} className="h-3.5 w-3.5" />
                        {lbl}
                      </label>
                    ))}
                  </div>
                );
              })()}

              {field.conditionalMode ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-3 space-y-1.5">
                      <Label className="text-sm">หน่วย *</Label>
                      <Input
                        value={field.unit ?? ""}
                        onChange={(e) => onChange({ ...field, unit: e.target.value })}
                        placeholder="เช่น %, ก., cP"
                        className="h-10"
                      />
                    </div>
                    <div className="sm:col-span-9 flex items-end">
                      <Button type="button" variant="outline" className="h-10" onClick={() => setConditionalDialogOpen(true)}>
                        ตั้งกฎ ({(field.conditionalStandards ?? []).length} กฎ)
                      </Button>
                    </div>
                  </div>
                  {(field.conditionalStandards ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">ยังไม่ได้ตั้งกฎ</p>
                  ) : (
                    <div className="space-y-0.5">
                      {(field.conditionalStandards ?? []).map((r, i) => (
                        <p key={i} className="text-xs text-emerald-700">{describeRule(r, field.unit ?? "")}</p>
                      ))}
                    </div>
                  )}
                  <ConditionalStandardsDialog
                    open={conditionalDialogOpen}
                    field={field}
                    allParameters={allParameters}
                    currentParameterId={currentParameterId}
                    siblingFields={siblingFields}
                    onClose={() => setConditionalDialogOpen(false)}
                    onSave={(next) => onChange({ ...field, conditionalStandards: next })}
                  />
                </div>
              ) : field.substanceMode ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-3 space-y-1.5">
                      <Label className="text-sm">หน่วย *</Label>
                      <Input
                        value={field.unit ?? ""}
                        onChange={(e) => onChange({ ...field, unit: e.target.value })}
                        placeholder="เช่น %, mg/L"
                        className="h-10"
                      />
                    </div>
                    <div className="sm:col-span-9 flex items-end">
                      <Button type="button" variant="outline" className="h-10" onClick={() => setSubstanceDialogOpen(true)}>
                        ตั้งเงื่อนไขรายสาร ({(field.substanceStandards ?? []).length} สาร)
                      </Button>
                    </div>
                  </div>
                  <StandardPreview field={field} />
                  <SubstanceStandardsDialog
                    open={substanceDialogOpen}
                    field={field}
                    onClose={() => setSubstanceDialogOpen(false)}
                    onSave={(next) => onChange({ ...field, substanceStandards: next })}
                  />
                </div>
              ) : (
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
              )}
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
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="font-medium truncate">{opt}</span>
                          <OptionFilterBadge filter={field.optionFilters?.[opt]} groupNameById={groupNameById} />
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
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
                          <OptionFilterDialog
                            opt={opt}
                            filter={field.optionFilters?.[opt]}
                            itemNameOptions={itemNameOptions}
                            commonNameOptions={commonNameOptions}
                            productTypeOptions={productTypeOptions}
                            categoryOptions={categoryOptions}
                            subCategoryByParent={subCategoryByParent}
                            groupOptions={groupOptions}
                            groupIdByName={groupIdByName}
                            groupNameById={groupNameById}
                            onSetFilter={(next) => setOptionFilter(opt, next)}
                            onClear={() => clearOptionFilter(opt)}
                          />
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

          {field.type === "file" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">จำนวนไฟล์สูงสุด (1–20)</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={field.maxFiles ?? 5}
                  onChange={(e) => {
                    const v = Math.min(20, Math.max(1, Number(e.target.value) || 1));
                    onChange({ ...field, maxFiles: v });
                  }}
                  className="h-10 w-28"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">ประเภทไฟล์ที่รับได้ *</Label>
                <div className="flex flex-wrap gap-4">
                  {FILE_TYPE_OPTIONS.map((opt) => {
                    const checked = (field.allowedFileTypes ?? []).includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className="flex cursor-pointer items-center gap-1.5 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const current = field.allowedFileTypes ?? [];
                            const next = v
                              ? [...current, opt.value]
                              : current.filter((t) => t !== opt.value);
                            onChange({ ...field, allowedFileTypes: next });
                          }}
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
                {(field.allowedFileTypes ?? []).length === 0 ? (
                  <p className="text-xs text-destructive">ต้องเลือกอย่างน้อย 1 ประเภท</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {field.type === "photo" ? (
            <div className="space-y-1.5">
              <Label className="text-sm">จำนวนภาพสูงสุด *</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={field.maxPhotos ?? 5}
                  onChange={(e) => {
                    const n = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
                    onChange({ ...field, maxPhotos: n });
                  }}
                  className="h-10 w-24"
                />
                <span className="text-sm text-grey-500">ภาพ (สูงสุด 20)</span>
              </div>
            </div>
          ) : null}

          {field.type === "reference" ? (
            <ReferenceFieldConfig
              field={field}
              onChange={onChange}
              allParameters={allParameters}
              currentParameterId={currentParameterId}
            />
          ) : null}
        </div>
        </div>
      ) : null}
    </div>
  );
}

type ReferenceFieldConfigProps = {
  field: ParameterValueField;
  onChange: (next: ParameterValueField) => void;
  allParameters: ParameterItem[];
  currentParameterId?: string;
};

function ReferenceFieldConfig({
  field,
  onChange,
  allParameters,
  currentParameterId,
}: ReferenceFieldConfigProps) {
  const sourceOptions = allParameters.filter(
    (p) => p._id && p._id !== currentParameterId && p.status !== "inactive",
  );
  const selectedSource = sourceOptions.find((p) => p._id === field.refParameterId);
  // Exclude reference fields from the field picker to avoid chained refs
  const fieldOptions = (selectedSource?.valueFields ?? []).filter(
    (f) => f.type !== "reference",
  );

  return (
    <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50/40 p-3">
      <div className="flex items-center gap-2 text-xs text-emerald-800">
        <Link2 className="h-3.5 w-3.5" />
        <span className="font-medium">ดึงค่าจาก parameter อื่นในคำร้องเดียวกัน</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-6 space-y-1.5">
          <Label className="text-sm">Parameter ต้นทาง *</Label>
          <Select
            value={field.refParameterId ?? "__none__"}
            onValueChange={(v) =>
              onChange({
                ...field,
                refParameterId: v === "__none__" ? null : v,
                refFieldLabel: null,
              })
            }
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="เลือก parameter..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— เลือก —</SelectItem>
              {sourceOptions.map((p) => (
                <SelectItem key={p._id} value={p._id!}>
                  {p.name} <span className="text-grey-400">({(p.scope ?? "qc").toUpperCase()})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-4 space-y-1.5">
          <Label className="text-sm">Field ต้นทาง *</Label>
          <Select
            value={field.refFieldLabel ?? "__none__"}
            onValueChange={(v) =>
              onChange({ ...field, refFieldLabel: v === "__none__" ? null : v })
            }
            disabled={!selectedSource}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="เลือก field..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— เลือก —</SelectItem>
              {fieldOptions.map((f) => (
                <SelectItem key={f.label} value={f.label}>
                  {f.label} <span className="text-grey-400">({f.type})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label className="text-sm">Phase</Label>
          <Select
            value={String(field.refPhase ?? 1)}
            onValueChange={(v) => onChange({ ...field, refPhase: Number(v) as 1 | 2 })}
            disabled={!selectedSource?.hasPhases}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Phase 1</SelectItem>
              <SelectItem value="2">Phase 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-emerald-700/80">
        ค่าจะถูกดึงจาก parameter ต้นทางบน <span className="font-medium">item เดียวกัน</span> ในคำร้องนี้ — ไม่ต้องกรอกซ้ำ
      </p>
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
  subCategoryByParent: Record<SubCategoryParent, string[]>;
  groupOptions: string[];
  groupIdByName: Map<string, string>;
  groupNameById: Map<string, string>;
  allParameters: ParameterItem[];
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
  subCategoryByParent,
  groupOptions,
  groupIdByName,
  groupNameById,
  allParameters,
  onClose,
  onSaved,
}: DialogProps) {
  const isEdit = !!item?._id;
  const [form, setForm] = useState<ParameterItem>(emptyForm(defaultScope));
  const [busy, setBusy] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const runAi = async () => {
    const desc = aiPrompt.trim();
    if (!desc) {
      toast.error("กรุณาพิมพ์ข้อกำหนดของงานวิเคราะห์ก่อน");
      return;
    }
    const scope = form.scope ?? defaultScope;
    setAiBusy(true);
    try {
      const { parameter, valid, error } = await generateParameter(desc, scope);
      const gen = parameter as Partial<ParameterItem>;
      // normalize each field with full defaults so the field editor never hits undefined
      const valueFields = (gen.valueFields ?? []).map((f) => ({
        ...emptyValueField(),
        ...f,
      }));
      setForm({
        ...emptyForm(scope),
        ...gen,
        scope,
        valueFields,
      });
      if (valid) {
        toast.success("สร้างพารามิเตอร์ด้วย AI แล้ว — ตรวจสอบและกดบันทึก");
      } else {
        toast.warning(`สร้างแล้วแต่ยังไม่ผ่านการตรวจ: ${error || ""} — โปรดแก้ไขก่อนบันทึก`);
      }
    } catch (err) {
      toast.error((err as Error).message || "สร้างด้วย AI ไม่สำเร็จ");
    } finally {
      setAiBusy(false);
    }
  };

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
        (form.categories?.length ?? 0) +
        (form.subCategories?.length ?? 0);
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
      if (f.type === "photo") {
        if (!f.maxPhotos || f.maxPhotos < 1 || f.maxPhotos > 20) {
          return `ช่อง "${f.label}": จำนวนภาพสูงสุดต้องอยู่ระหว่าง 1–20`;
        }
      }
      if (f.type === "file") {
        if (!f.allowedFileTypes || f.allowedFileTypes.length === 0) {
          return `ช่อง "${f.label}": ต้องเลือกประเภทไฟล์อย่างน้อย 1 ชนิด`;
        }
        if (!f.maxFiles || f.maxFiles < 1 || f.maxFiles > 20) {
          return `ช่อง "${f.label}": จำนวนไฟล์สูงสุดต้องอยู่ระหว่าง 1–20`;
        }
      }
      if (f.type === "reference") {
        if (!f.refParameterId || !f.refFieldLabel) {
          return `ช่อง "${f.label}": ต้องเลือก parameter และ field ต้นทาง`;
        }
        if (f.required) {
          return `ช่อง "${f.label}": field แบบ reference บังคับกรอกไม่ได้ (ดึงค่าอัตโนมัติ)`;
        }
        if (f.triggersPhase2) {
          return `ช่อง "${f.label}": field แบบ reference ใช้เป็น trigger ไม่ได้`;
        }
      }
      if (form.hasPhases && f.triggersPhase2 && f.phase === "after") {
        return `ช่อง "${f.label}": ตัวเริ่ม Phase 2 ต้องอยู่ใน Phase 1 (เลือก "ทั้ง 2 phase" หรือ "เฉพาะก่อน")`;
      }
    }
    if (form.hasPhases) {
      const hasBefore = fields.some((f) => f.phase === "both" || f.phase === "before");
      const hasTrigger = fields.some((f) => f.triggersPhase2);
      if (!hasBefore) {
        return "Parameter แบบ 2-phase ต้องมีอย่างน้อย 1 field ที่กรอกใน Phase 1 (เลือก 'ทั้ง 2 phase' หรือ 'เฉพาะก่อน')";
      }
      if (!hasTrigger) {
        return "Parameter แบบ 2-phase ต้องมีอย่างน้อย 1 field ติ๊ก 'ตัวเริ่ม Phase 2'";
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
    const scope = form.scope ?? "qc";
    const payload: Partial<ParameterItem> = {
      name: form.name.trim(),
      scope,
      shareWithLab: scope === "qc" ? !!form.shareWithLab : false,
      status: form.status ?? "active",
      applyAll: !!form.applyAll,
      commonNames: form.applyAll ? [] : form.commonNames ?? [],
      itemNames: form.applyAll ? [] : form.itemNames ?? [],
      productTypes: form.applyAll ? [] : form.productTypes ?? [],
      categories: form.applyAll ? [] : form.categories ?? [],
      subCategories: form.applyAll ? [] : form.subCategories ?? [],
      itemGroups: form.applyAll ? [] : form.itemGroups ?? [],
      valueFields: form.valueFields ?? [],
      sortOrder: form.sortOrder ?? 0,
      note: form.note?.trim() || "",
      hasPhases: !!form.hasPhases,
      multiEntry: !!form.multiEntry,
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
          {!isEdit && (
            <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-4 space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium text-violet-900">
                <Sparkles className="h-4 w-4" />
                สร้างด้วย AI — พิมพ์ข้อกำหนดงานวิเคราะห์
              </Label>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder='เช่น "วัด pH ต้องอยู่ระหว่าง 6.5–7.5, ความหนืดหน่วย cP เป็นทศนิยม, ลักษณะภายนอกเลือกใส/ขุ่น/ตกตะกอน โดยปกติคือใส และถ่ายรูป 1 รูป"'
                rows={3}
                disabled={aiBusy}
                className="text-sm"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-violet-700/80">
                  AI จะร่างช่องกรอกให้อัตโนมัติ — ตรวจสอบและแก้ไขได้ก่อนบันทึก
                </p>
                <Button
                  type="button"
                  onClick={runAi}
                  disabled={aiBusy || !aiPrompt.trim()}
                  className="gap-1.5 bg-violet-600 hover:bg-violet-700"
                >
                  {aiBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {aiBusy ? "กำลังสร้าง..." : "สร้างด้วย AI"}
                </Button>
              </div>
            </div>
          )}
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

          {(form.scope ?? "qc") === "qc" ? (
            <div className="rounded-lg border bg-sky-50/40 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={!!form.shareWithLab}
                  onCheckedChange={(v) => set("shareWithLab", v === true)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="text-sm font-medium">
                    แชร์ผลให้ Lab อ่าน
                  </span>
                  <p className="text-xs text-muted-foreground">
                    QC เป็นผู้กรอกค่า — Lab สามารถดูผลได้แบบอ่านอย่างเดียว
                  </p>
                </div>
              </label>
            </div>
          ) : null}

          <div className="rounded-lg border bg-amber-50/40 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={!!form.hasPhases}
                onCheckedChange={(v) => set("hasPhases", v === true)}
                disabled={!!form.multiEntry}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <span className="text-sm font-medium">
                  Parameter นี้มี 2 phase (ค่าก่อน / ค่าหลัง)
                </span>
                <p className="text-xs text-muted-foreground">
                  เปิดเมื่อ parameter ต้องวัด 2 รอบ (เช่น stability test "อบ 14 วัน") — ตั้ง field ที่เป็นตัว trigger ในรายการช่องด้านล่าง
                </p>
              </div>
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={!!form.multiEntry}
                onCheckedChange={(v) => set("multiEntry", v === true)}
                disabled={!!form.hasPhases}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <span className="text-sm font-medium">
                  กรอกได้หลายรายการ (เก็บทุกค่า)
                </span>
                <p className="text-xs text-muted-foreground">
                  เปิดเมื่อ parameter นี้ต้องกรอกได้หลายรายการ และเก็บทุกค่า (ใช้ร่วมกับโหมด 2 phase ไม่ได้)
                </p>
              </div>
            </label>
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
                label="กลุ่ม Item"
                placeholder="เลือกกลุ่ม item ที่จัดเอง"
                values={(form.itemGroups ?? []).map((id) => groupNameById.get(id) ?? id)}
                onChange={(names) =>
                  set(
                    "itemGroups",
                    names
                      .map((name) => groupIdByName.get(name))
                      .filter((id): id is string => !!id),
                  )
                }
                options={groupOptions}
                disabled={form.applyAll}
                emptyText="ยังไม่มีกลุ่ม — สร้างที่หน้า Master Item"
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
                onChange={(v) => {
                  const activeParents = new Set(
                    v.filter((c): c is SubCategoryParent =>
                      (SUB_CATEGORY_PARENTS as readonly string[]).includes(c),
                    ),
                  );
                  const allowedSubs = new Set(
                    Array.from(activeParents).flatMap((p) => subCategoryByParent[p] ?? []),
                  );
                  setForm((prev) => ({
                    ...prev,
                    categories: v,
                    subCategories: (prev.subCategories ?? []).filter((s) => allowedSubs.has(s)),
                  }));
                }}
                options={categoryOptions}
                disabled={form.applyAll}
                emptyText="ยังไม่มีหมวดหมู่"
              />
              {(() => {
                const activeParents = (form.categories ?? []).filter(
                  (c): c is SubCategoryParent =>
                    (SUB_CATEGORY_PARENTS as readonly string[]).includes(c),
                );
                if (activeParents.length === 0) return null;
                const grouped = activeParents
                  .map((parent) => ({
                    label: `${parent} — หมวดย่อยจาก code`,
                    options: subCategoryByParent[parent] ?? [],
                  }))
                  .filter((g) => g.options.length > 0);
                const flatOptions = grouped.flatMap((g) => g.options);
                return (
                  <div className="md:col-span-2 space-y-1.5">
                    <MultiSelectPopover
                      label={`หมวดหมู่ย่อย (prefix code ของ ${activeParents.join(" / ")})`}
                      placeholder="เลือก prefix เช่น F, FC, RO, RC ..."
                      values={form.subCategories ?? []}
                      onChange={(v) => set("subCategories", v)}
                      options={flatOptions}
                      groupedOptions={grouped.length > 1 ? grouped : undefined}
                      disabled={form.applyAll}
                      emptyText="ไม่พบ prefix จาก master items"
                    />
                    <p className="text-xs text-muted-foreground">
                      ครอบคลุมทุก code ที่ <span className="font-semibold">ขึ้นต้นด้วย</span> prefix ที่เลือก — เช่น เลือก <span className="font-mono">RO</span> จะรวม <span className="font-mono">ROLS</span>, <span className="font-mono">ROPH</span> ด้วย
                    </p>
                  </div>
                );
              })()}
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
                    hasPhases={!!form.hasPhases}
                    allParameters={allParameters}
                    currentParameterId={item?._id}
                    siblingFields={(form.valueFields ?? []).filter((_, idx) => idx !== i)}
                    itemNameOptions={itemNameOptions}
                    commonNameOptions={commonNameOptions}
                    productTypeOptions={productTypeOptions}
                    categoryOptions={categoryOptions}
                    subCategoryByParent={subCategoryByParent}
                    groupOptions={groupOptions}
                    groupIdByName={groupIdByName}
                    groupNameById={groupNameById}
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
  const subCategoryByParent = useMemo(() => {
    const acc: Record<SubCategoryParent, Set<string>> = { RM: new Set(), FG: new Set() };
    for (const item of masterItems) {
      const parent = getItemCategory(item).toUpperCase();
      if (parent !== "RM" && parent !== "FG") continue;
      const prefix = getItemSubCategory(item);
      if (prefix) acc[parent as SubCategoryParent].add(prefix);
    }
    return {
      RM: Array.from(acc.RM).sort((a, b) => a.localeCompare(b)),
      FG: Array.from(acc.FG).sort((a, b) => a.localeCompare(b)),
    } satisfies Record<SubCategoryParent, string[]>;
  }, [masterItems]);

  const itemGroupsQuery = useQuery({
    queryKey: ["item-groups"],
    queryFn: async () => {
      const res = await api.get<ItemGroupItem[]>("/item-groups");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const itemGroups = itemGroupsQuery.data ?? [];

  // กลุ่ม Item เก็บเป็น _id แต่ picker (MultiSelectPopover) ทำงานกับ "ชื่อ"
  // → แปลง id↔name ที่ขอบ picker. แสดงเฉพาะกลุ่ม active ใน options.
  const groupOptions = useMemo(
    () =>
      itemGroups
        .filter((g) => (g.status ?? "active") === "active")
        .map((g) => g.name)
        .sort((a, b) => a.localeCompare(b)),
    [itemGroups],
  );
  const groupIdByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of itemGroups) map.set(g.name, g._id);
    return map;
  }, [itemGroups]);
  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of itemGroups) map.set(g._id, g.name);
    return map;
  }, [itemGroups]);

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
        ...(p.subCategories ?? []),
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
      <PageHeader
        className="mb-6"
        title={
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-6 w-6" />
            พารามิเตอร์การตรวจสอบ
          </span>
        }
        description="กำหนดพารามิเตอร์ที่ต้องตรวจ — เลือกใช้กับ Item Name / ประเภท ได้พร้อมกัน และกำหนดช่องค่าที่ผู้กรอกต้องใส่"
        actions={
          <>
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
          </>
        }
      />

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
                            {pScope === "qc" && p.shareWithLab ? (
                              <Badge
                                variant="outline"
                                className="border-sky-300 bg-sky-50 text-[10px] text-sky-800"
                                title="แชร์ให้ Lab อ่านได้"
                              >
                                → Lab
                              </Badge>
                            ) : null}
                            <span className="font-medium">{p.name}</span>
                          </div>
                          {p.note ? (
                            <div className="mt-0.5 text-xs text-muted-foreground">{p.note}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <ApplyToBadges item={p} groupNameById={groupNameById} />
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
        subCategoryByParent={subCategoryByParent}
        groupOptions={groupOptions}
        groupIdByName={groupIdByName}
        groupNameById={groupNameById}
        allParameters={parameters}
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

function ApplyToBadges({
  item,
  groupNameById,
}: {
  item: ParameterItem;
  groupNameById: Map<string, string>;
}) {
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
    {
      label: "หมวดย่อย",
      values: item.subCategories ?? [],
      color: "bg-orange-50 text-orange-700",
    },
    {
      label: "กลุ่ม",
      values: (item.itemGroups ?? []).map((id) => groupNameById.get(id) ?? id),
      color: "bg-rose-50 text-rose-700",
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
              : f.type === "file"
                ? f.allowedFileTypes?.length
                  ? ` [${f.allowedFileTypes.map((t) => t.toUpperCase()).join("/")}]`
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
