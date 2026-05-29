import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  STANDARD_UNITS,
  type InstrumentConfig,
  type StandardUnit,
} from "./types";

type Props = {
  label: string;
  value: InstrumentConfig;
  onChange: (next: InstrumentConfig) => void;
  disabled?: boolean;
};

export default function SlotEditor({ label, value, onChange, disabled }: Props) {
  const [draft, setDraft] = useState<string>("");

  const setEnabled = (enabled: boolean) => onChange({ ...value, enabled });
  const setUnit = (unit: StandardUnit) => onChange({ ...value, unit });
  const removeSlot = (idx: number) =>
    onChange({ ...value, slots: value.slots.filter((_, i) => i !== idx) });
  const addSlot = () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || n <= 0) return;
    if (value.slots.length >= 20) return;
    onChange({ ...value, slots: [...value.slots, n] });
    setDraft("");
  };
  const editSlot = (idx: number, raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const next = [...value.slots];
    next[idx] = n;
    onChange({ ...value, slots: next });
  };

  return (
    <div className={cn("flex flex-col gap-2", disabled && "opacity-60 pointer-events-none")}>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${label}-enabled`}
          checked={value.enabled}
          onCheckedChange={(v) => setEnabled(Boolean(v))}
        />
        <label htmlFor={`${label}-enabled`} className="text-sm font-medium">
          {label}
        </label>
        {value.enabled && (
          <Select value={value.unit} onValueChange={(v) => setUnit(v as StandardUnit)}>
            <SelectTrigger className="h-7 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STANDARD_UNITS.map((u) => (
                <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {value.enabled ? (
        <div className="flex flex-wrap gap-1.5 items-center">
          {value.slots.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
              <Input
                type="number"
                value={s}
                onChange={(e) => editSlot(i, e.target.value)}
                className="h-5 w-14 border-0 bg-transparent p-0 text-xs"
              />
              <button
                type="button"
                onClick={() => removeSlot(i)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`remove slot ${i + 1}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <Input
            type="number"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addSlot(); }
            }}
            placeholder="ค่า"
            className="h-6 w-16 text-xs"
          />
          <Button type="button" size="sm" variant="outline" className="h-6 px-2" onClick={addSlot}>
            <Plus className="w-3 h-3" />
          </Button>
          {value.slots.length === 0 && (
            <span className="text-xs text-amber-600">⚠ ยังไม่ตั้งค่า</span>
          )}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>
  );
}
