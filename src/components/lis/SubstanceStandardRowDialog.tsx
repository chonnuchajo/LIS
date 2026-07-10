import { useEffect, useState } from "react";
import type { StandardOperator, SubstanceStandard } from "@/lib/api";
import { OPERATOR_OPTIONS } from "@/lib/standardOperators";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";

type EditableSubstanceStandard = SubstanceStandard & { headOnly?: boolean };

type Props = {
  open: boolean;
  substance: EditableSubstanceStandard;
  parameterName: string;
  fieldLabel: string;
  unit?: string;
  onClose: () => void;
  onSave: (next: EditableSubstanceStandard) => void;
};

function parseNumberInput(raw: string): number | null {
  return raw === "" || !Number.isFinite(Number(raw)) ? null : Number(raw);
}

export function SubstanceStandardRowDialog({
  open, substance, parameterName, fieldLabel, unit, onClose, onSave,
}: Props) {
  const [operator, setOperator] = useState<StandardOperator>(substance.operator);
  const [value, setValue] = useState<number | null>(substance.value ?? null);
  const [value2, setValue2] = useState<number | null>(substance.value2 ?? null);
  const [headOnly, setHeadOnly] = useState(substance.headOnly === true);

  useEffect(() => {
    if (open) {
      setOperator(substance.operator);
      setValue(substance.value ?? null);
      setValue2(substance.value2 ?? null);
      setHeadOnly(substance.headOnly === true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const needsValue2 = operator === "between" || operator === "tolerance";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="break-words">{substance.substance}</DialogTitle>
          <DialogDescription>{parameterName} · {fieldLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="substance-row-operator" className="text-sm">เงื่อนไข</Label>
            <NativeSelect
              id="substance-row-operator"
              value={operator}
              onChange={(e) => setOperator(e.target.value as StandardOperator)}
              className="h-10"
            >
              {OPERATOR_OPTIONS.filter((o) => o.value !== "none").map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="substance-row-value" className="text-sm">
                {operator === "tolerance" ? "ค่ามาตรฐาน" : operator === "between" ? "ตั้งแต่" : "ค่า"}
              </Label>
              <Input
                id="substance-row-value"
                type="number"
                value={value ?? ""}
                onChange={(e) => setValue(parseNumberInput(e.target.value))}
                className="h-10"
              />
            </div>
            {needsValue2 && (
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="substance-row-value2" className="text-sm">
                  {operator === "tolerance" ? "+/- %" : "ถึง"}
                </Label>
                <Input
                  id="substance-row-value2"
                  type="number"
                  value={value2 ?? ""}
                  onChange={(e) => setValue2(parseNumberInput(e.target.value))}
                  className="h-10"
                />
              </div>
            )}
            {unit ? <span className="pb-2.5 text-sm text-muted-foreground">{unit}</span> : null}
          </div>

          <label className="flex items-center gap-2 text-sm text-amber-700">
            <input
              type="checkbox"
              checked={headOnly}
              onChange={(e) => setHeadOnly(e.target.checked)}
            />
            ให้หัวหน้า QC พิจารณาเท่านั้น
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              onSave({ ...substance, operator, value, value2, headOnly });
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
