import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { type LabelToleranceRule, type ParameterValueField } from "@/lib/api";
import { productTypeLabels } from "@/lib/productClassification";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { normalizeRoles } from "@/lib/roles";

const PRODUCT_TYPE_OPTIONS = [
  { value: "water", label: productTypeLabels.water },
  { value: "sand", label: productTypeLabels.sand },
  { value: "powder", label: productTypeLabels.powder },
] as const;

function emptyRule(): LabelToleranceRule {
  return {
    mode: "percent",
    substance: "",
    labelPercent: null,
    productTypes: [],
    autoPct: null,
    headPct: null,
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
  if ((rule.mode ?? "percent") === "range") {
    if ([rule.failLow, rule.passLow, rule.passHigh, rule.failHigh].some((v) => v == null)) return true;
    if (!(rule.failLow! <= rule.passLow! && rule.passLow! <= rule.passHigh! && rule.passHigh! <= rule.failHigh!)) return true;
  } else {
    if (rule.autoPct == null || rule.autoPct <= 0) return true;
    if (rule.headPct != null && rule.headPct < rule.autoPct) return true;
  }
  return false;
}

function previewLine(rule: LabelToleranceRule): string {
  const selectors = [
    rule.substance?.trim() || "",
    rule.labelPercent != null ? `${rule.labelPercent}%` : "",
    (rule.productTypes ?? []).map((pt) => productTypeLabels[pt] ?? pt).join("/"),
  ].filter(Boolean).join(" ");

  if ((rule.mode ?? "percent") === "range") {
    if ([rule.failLow, rule.passLow, rule.passHigh, rule.failHigh].some((v) => v == null)) return "";
    return `${selectors || "กฎ"} -> fail < ${rule.failLow} | review ${rule.failLow}-${rule.passLow} และ ${rule.passHigh}-${rule.failHigh} | pass ${rule.passLow}-${rule.passHigh}`;
  }

  if (rule.autoPct == null || rule.autoPct <= 0) return "";
  const center = rule.labelPercent ?? 1;
  const autoAbs = center * (rule.autoPct / 100);
  const headAbs = rule.headPct != null ? center * (rule.headPct / 100) : autoAbs;
  const auto = `ผ่าน ${(center - autoAbs).toFixed(5)}-${(center + autoAbs).toFixed(5)}`;
  const head = rule.headPct != null
    ? ` | หัวหน้าตรวจสอบ ${(center - headAbs).toFixed(5)}-${(center + headAbs).toFixed(5)}`
    : "";
  return `${selectors || "กฎ"} -> ${auto}${head}`;
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
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>ตั้งเกณฑ์ตาม % และประเภทสินค้า - {field.label}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            ตั้ง rule ได้จาก %ฉลาก, ประเภทสินค้า, และสารแบบไม่บังคับ ระบบจะเลือกกฎที่ตรงที่สุดให้อัตโนมัติ
          </p>
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

          {list.map((rule, index) => (
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

                  <div className="space-y-1.5">
                    <Label className="text-sm">โหมดเกณฑ์</Label>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={(rule.mode ?? "percent") === "percent"}
                          onChange={() => patchAt(index, { mode: "percent" })}
                        />
                        เปอร์เซ็นต์ ±
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={(rule.mode ?? "percent") === "range"}
                          onChange={() => patchAt(index, { mode: "range" })}
                        />
                        ช่วงกำหนดเอง
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">ประเภทสินค้า (ไม่บังคับ)</Label>
                    <div className="flex flex-wrap gap-3">
                      {PRODUCT_TYPE_OPTIONS.map((opt) => {
                        const checked = (rule.productTypes ?? []).includes(opt.value);
                        return (
                          <label key={opt.value} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => patchAt(index, { productTypes: toggleValue(rule.productTypes, opt.value) as LabelToleranceRule["productTypes"] })}
                            />
                            {opt.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {(rule.mode ?? "percent") === "range" ? (
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
                        <p className="text-xs text-muted-foreground">ช่วง "ที่ผ่าน" (ต่ำสุด/สูงสุด) กำหนดโดย ADMIN / QC Head</p>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-sm">ผ่าน</Label>
                        <Input
                          type="number"
                          value={rule.autoPct ?? ""}
                          onChange={(e) => patchAt(index, { autoPct: e.target.value === "" ? null : Number(e.target.value) })}
                          placeholder="เช่น 11.25"
                        />
                      </div>
                      {canEditHeadFields && (
                        <div className="space-y-1.5">
                          <Label className="text-sm">หัวหน้าตรวจสอบ</Label>
                          <Input
                            type="number"
                            value={rule.headPct ?? ""}
                            onChange={(e) => patchAt(index, { headPct: e.target.value === "" ? null : Number(e.target.value) })}
                            placeholder="เช่น 15"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-emerald-700">{previewLine(rule)}</p>
                  {isRuleInvalid(rule) ? (
                    <p className="text-xs text-red-600">ต้องกรอกตัวเลือกอย่างน้อย 1 อย่าง และกรอกค่าตามโหมดให้ครบ โดยช่วงต้องเรียงจากต่ำไปสูง</p>
                  ) : null}
                </>
              )}
            </div>
          ))}
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
