import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { type LabelToleranceRule, type ParameterValueField } from "@/lib/api";
import { productTypeLabels } from "@/lib/productClassification";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { normalizeRoles } from "@/lib/roles";
import { cn } from "@/lib/utils";

const PRODUCT_TYPE_OPTIONS = [
  { value: "water", label: productTypeLabels.water },
  { value: "sand", label: productTypeLabels.sand },
  { value: "powder", label: productTypeLabels.powder },
] as const;

type PassModeOption = "percent" | "abs" | "range";

function emptyRule(): LabelToleranceRule {
  return {
    mode: "percent",
    autoMode: "percent",
    headMode: "percent",
    substance: "",
    labelPercent: null,
    productTypes: [],
    autoPct: null,
    headPct: null,
  };
}

function normalizeRuleModes(rule: LabelToleranceRule) {
  if ((rule.mode ?? "percent") === "range") {
    return { layoutMode: "range" as const, autoMode: null, headMode: null, legacy: false };
  }
  if (rule.autoMode || rule.headMode) {
    return {
      layoutMode: "split" as const,
      autoMode: (rule.autoMode ?? "abs") as "percent" | "abs",
      headMode: (rule.headMode ?? (rule.headAbs != null || rule.headPct != null ? "abs" : "percent")) as "percent" | "abs",
      legacy: false,
    };
  }
  const mode = rule.mode ?? "percent";
  return {
    layoutMode: "split" as const,
    autoMode: (mode === "abs" ? "abs" : "percent") as "percent" | "abs",
    headMode: (mode === "abs" ? "abs" : "percent") as "percent" | "abs",
    legacy: true,
  };
}

function toggleValue(list: string[] | undefined, value: string): string[] {
  const set = new Set((list ?? []).filter(Boolean));
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return [...set];
}

function hasSelector(rule: LabelToleranceRule): boolean {
  return Boolean(String(rule.substance ?? "").trim())
    || rule.labelPercent != null
    || (rule.productTypes?.length ?? 0) > 0;
}

function isRuleInvalid(rule: LabelToleranceRule): boolean {
  if (!hasSelector(rule)) return true;
  if (rule.labelPercent != null && rule.labelPercent <= 0) return true;
  const normalized = normalizeRuleModes(rule);
  if (normalized.layoutMode === "range") {
    if ([rule.failLow, rule.passLow, rule.passHigh, rule.failHigh].some((v) => v == null)) return true;
    if (!(rule.failLow! <= rule.passLow! && rule.passLow! <= rule.passHigh! && rule.passHigh! <= rule.failHigh!)) return true;
    return false;
  }

  const headConfigured = normalized.headMode === "percent"
    ? rule.headPct != null && rule.headPct > 0
    : rule.headAbs != null && rule.headAbs > 0;
  const comparableHeadAbs = normalized.headMode === "abs"
    ? (rule.headAbs == null || rule.headAbs <= 0 ? null : rule.headAbs)
    : null;

  if (normalized.autoMode === "percent") {
    if (rule.autoPct == null || rule.autoPct <= 0) return true;
    if (!normalized.legacy && !headConfigured) return true;
    if (headConfigured && rule.autoPct > 100) return true;
  } else {
    if (rule.autoAbs == null || rule.autoAbs <= 0) return true;
    if (comparableHeadAbs != null && rule.autoAbs > comparableHeadAbs) return true;
  }
  return false;
}

function previewLine(rule: LabelToleranceRule): string {
  const selectors = [
    rule.substance?.trim() || "",
    rule.labelPercent != null ? `${rule.labelPercent}%` : "",
    (rule.productTypes ?? []).map((pt) => productTypeLabels[pt] ?? pt).join("/"),
  ].filter(Boolean).join(" ");

  const normalized = normalizeRuleModes(rule);
  if (normalized.layoutMode === "range") {
    if ([rule.failLow, rule.passLow, rule.passHigh, rule.failHigh].some((v) => v == null)) return "";
    return `${selectors || "กฎ"} -> fail < ${rule.failLow} | review ${rule.failLow}-${rule.passLow} และ ${rule.passHigh}-${rule.failHigh} | pass ${rule.passLow}-${rule.passHigh}`;
  }

  const center = rule.labelPercent ?? 1;
  const headAbs = normalized.headMode === "percent"
    ? (rule.headPct == null || rule.headPct <= 0 ? null : center * (rule.headPct / 100))
    : (rule.headAbs == null || rule.headAbs <= 0 ? null : rule.headAbs);
  const autoAbs = normalized.autoMode === "percent"
    ? normalized.legacy
      ? (rule.autoPct == null || rule.autoPct <= 0 ? null : center * (rule.autoPct / 100))
      : (rule.autoPct == null || rule.autoPct <= 0 || headAbs == null ? null : headAbs * (rule.autoPct / 100))
    : (rule.autoAbs == null || rule.autoAbs <= 0 ? null : rule.autoAbs);
  if (autoAbs == null) return "";

  const auto = `ผ่าน ${(center - autoAbs).toFixed(5)}-${(center + autoAbs).toFixed(5)}`;
  const head = headAbs != null
    ? ` | หัวหน้าตรวจสอบ ${(center - headAbs).toFixed(5)}-${(center + headAbs).toFixed(5)}`
    : "";
  return `${selectors || "กฎ"} -> ${auto}${head}`;
}

function derivePassMode(rule: LabelToleranceRule): PassModeOption {
  const normalized = normalizeRuleModes(rule);
  if (normalized.layoutMode === "range") return "range";
  return normalized.autoMode === "abs" ? "abs" : "percent";
}

function patchRuleMode(
  patchAt: (index: number, patch: Partial<LabelToleranceRule>) => void,
  index: number,
  next: PassModeOption,
  headMode: "percent" | "abs",
) {
  if (next === "range") {
    patchAt(index, { mode: "range" });
    return;
  }
  if (next === "abs") {
    patchAt(index, { mode: "abs", autoMode: "abs", headMode });
    return;
  }
  patchAt(index, { mode: "percent", autoMode: "percent", headMode });
}

type Props = {
  open: boolean;
  field: ParameterValueField;
  onClose: () => void;
  onSave: (next: LabelToleranceRule[]) => void;
};

export function LabelToleranceDialog({ open, field, onClose, onSave }: Props) {
  const [list, setList] = useState<LabelToleranceRule[]>(field.labelToleranceStandards ?? []);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const { user } = useAuth();

  const canEditHeadFields = useMemo(() => {
    const roles = normalizeRoles(user);
    return roles.includes("admin") || roles.includes("qc-head");
  }, [user]);

  useEffect(() => {
    if (open) {
      setList(field.labelToleranceStandards ?? []);
      setCollapsed({});
    }
  }, [field.labelToleranceStandards, open]);

  const hasInvalid = useMemo(() => list.some(isRuleInvalid), [list]);

  const patchAt = (index: number, patch: Partial<LabelToleranceRule>) => {
    setList((prev) => prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  };

  const addRule = () => setList((prev) => [...prev, emptyRule()]);

  const removeRule = (index: number) => {
    setList((prev) => prev.filter((_, i) => i !== index));
    setCollapsed((prev) => {
      const next: Record<number, boolean> = {};
      for (const [key, value] of Object.entries(prev)) {
        const n = Number(key);
        if (n < index) next[n] = value;
        else if (n > index) next[n - 1] = value;
      }
      return next;
    });
  };

  const toggleCollapsed = (index: number) => {
    setCollapsed((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>ตั้งเกณฑ์ตาม % และประเภทสินค้า - {field.label}</DialogTitle>
          <DialogDescription className="text-xs">
            ตั้ง rule ได้จาก %ฉลาก, ประเภทสินค้า, และสารแบบไม่บังคับ ระบบจะเลือกกฎที่ตรงที่สุดให้อัตโนมัติ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <Label className="text-sm">กฎ ({list.length})</Label>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addRule}>
              <Plus className="h-4 w-4" />
              เพิ่มกฎ
            </Button>
          </div>

          {list.length === 0 ? (
            <p className="rounded border border-dashed p-4 text-sm text-muted-foreground">ยังกำหนดเกณฑ์ไว้</p>
          ) : null}

          {list.map((rule, index) => {
            const normalized = normalizeRuleModes(rule);
            const autoMode = normalized.autoMode ?? "percent";
            const headMode = normalized.headMode ?? "percent";
            const passMode = derivePassMode(rule);

            return (
              <div key={index} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(index)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={!collapsed[index]}
                  >
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${collapsed[index] ? "-rotate-90" : ""}`} />
                    <span className="text-sm font-medium">กฎที่ {index + 1}</span>
                  </button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRule(index)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>

                {collapsed[index] ? (
                  <p className="text-xs text-emerald-700">{previewLine(rule) || "ยังไม่ได้ตั้งค่าเกณฑ์"}</p>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-sm">สาร (ไม่บังคับ)</Label>
                        <Input
                          value={rule.substance ?? ""}
                          onChange={(e) => patchAt(index, { substance: e.target.value })}
                          placeholder="เช่น ABAMECTIN"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">% ฉลาก (ไม่บังคับ)</Label>
                        <Input
                          type="number"
                          value={rule.labelPercent ?? ""}
                          onChange={(e) => patchAt(index, { labelPercent: e.target.value === "" ? null : Number(e.target.value) })}
                          placeholder="เช่น 1 หรือ 0.3"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">ประเภทสินค้า (ไม่บังคับ)</Label>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {PRODUCT_TYPE_OPTIONS.map((opt) => {
                          const checked = (rule.productTypes ?? []).includes(opt.value);
                          const id = `label-tolerance-product-${index}-${opt.value}`;
                          return (
                            <div
                              key={opt.value}
                              className={cn(
                                "flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors",
                                checked && "border-primary/60 bg-primary/5 text-primary",
                              )}
                            >
                              <Checkbox
                                id={id}
                                checked={checked}
                                onCheckedChange={() => patchAt(index, { productTypes: toggleValue(rule.productTypes, opt.value) as LabelToleranceRule["productTypes"] })}
                              />
                              <Label htmlFor={id} className="flex-1 cursor-pointer text-sm font-normal">
                                {opt.label}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm">ผ่าน</Label>
                      <Select
                        value={passMode}
                        onValueChange={(value) => patchRuleMode(patchAt, index, value as PassModeOption, headMode)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">เปอร์เซ็นต์ ±</SelectItem>
                          <SelectItem value="abs">± ค่าคงที่</SelectItem>
                          <SelectItem value="range">ช่วงกำหนดเอง</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {normalized.layoutMode === "range" ? (
                      <div className="space-y-1.5">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-sm">ค่าต่ำสุดรอตรวจสอบ</Label>
                            <Input type="number" value={rule.failLow ?? ""} onChange={(e) => patchAt(index, { failLow: e.target.value === "" ? null : Number(e.target.value) })} />
                          </div>
                          {canEditHeadFields && (
                            <div className="space-y-1.5">
                              <Label className="text-sm">ต่ำสุดที่ผ่าน</Label>
                              <Input type="number" value={rule.passLow ?? ""} onChange={(e) => patchAt(index, { passLow: e.target.value === "" ? null : Number(e.target.value) })} />
                            </div>
                          )}
                          <div className="space-y-1.5 order-3 md:order-3">
                            <Label className="text-sm">ค่าสูงสุดรอตรวจสอบ</Label>
                            <Input type="number" value={rule.failHigh ?? ""} onChange={(e) => patchAt(index, { failHigh: e.target.value === "" ? null : Number(e.target.value) })} />
                          </div>
                          {canEditHeadFields && (
                            <div className="space-y-1.5 order-4 md:order-4">
                              <Label className="text-sm">สูงสุดที่ผ่าน</Label>
                              <Input type="number" value={rule.passHigh ?? ""} onChange={(e) => patchAt(index, { passHigh: e.target.value === "" ? null : Number(e.target.value) })} />
                            </div>
                          )}
                        </div>
                        {!canEditHeadFields && (
                          <p className="text-xs text-muted-foreground">ช่วง "ที่ผ่าน" กำหนดโดย ADMIN / QC Head</p>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                          <Label className="text-sm">ช่วงผ่านอัตโนมัติ</Label>
                          <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]">
                            <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                              {autoMode === "percent" ? "เปอร์เซ็นต์ ±" : "± ค่าคงที่"}
                            </div>
                            <Input
                              type="number"
                              value={autoMode === "percent" ? (rule.autoPct ?? "") : (rule.autoAbs ?? "")}
                              onChange={(e) => patchAt(
                                index,
                                autoMode === "percent"
                                  ? { autoPct: e.target.value === "" ? null : Number(e.target.value) }
                                  : { autoAbs: e.target.value === "" ? null : Number(e.target.value) },
                              )}
                              placeholder={autoMode === "percent" ? "เช่น 80" : "เช่น 0.05"}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {autoMode === "percent" ? 'ถ้าเลือก % จะคิดจากช่วง "หัวหน้าตรวจสอบ"' : "กรอกเป็นค่า ± จริงตามหน่วยของช่อง"}
                          </p>
                        </div>

                        {canEditHeadFields && (
                          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                            <Label className="text-sm">หัวหน้าตรวจสอบ</Label>
                            <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]">
                              <Select
                                value={headMode}
                                onValueChange={(value) => patchAt(index, { headMode: value as "percent" | "abs" })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percent">% ฉลาก</SelectItem>
                                  <SelectItem value="abs">± ค่าคงที่</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                value={headMode === "percent" ? (rule.headPct ?? "") : (rule.headAbs ?? "")}
                                onChange={(e) => patchAt(
                                  index,
                                  headMode === "percent"
                                    ? { headPct: e.target.value === "" ? null : Number(e.target.value) }
                                    : { headAbs: e.target.value === "" ? null : Number(e.target.value) },
                                )}
                                placeholder={headMode === "percent" ? "เช่น 15" : "เช่น 0.1"}
                              />
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground md:col-span-2">
                          ค่ากลางมาจาก %ฉลากในชื่อสาร
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-emerald-700">{previewLine(rule)}</p>
                    {isRuleInvalid(rule) ? (
                      <p className="text-xs text-red-600">ต้องกรอกตัวเลือกอย่างน้อย 1 อย่าง และกรอกค่าให้ครบตามรูปแบบที่เลือก</p>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button
            type="button"
            variant="primary"
            disabled={hasInvalid}
            onClick={() => {
              onSave(list.map((rule) => ({
                ...rule,
                substance: String(rule.substance ?? "").trim(),
                productTypes: (rule.productTypes ?? []).filter(Boolean),
              })));
              onClose();
            }}
          >
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
