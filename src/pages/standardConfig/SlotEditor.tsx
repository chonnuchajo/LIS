import { useEffect, useState } from "react";
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

function SlotChip({
  value, onCommit, onRemove,
}: {
  value: number;
  onCommit: (n: number) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(String(value));
  // re-sync if value changes externally
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && n > 0) onCommit(n);
    else setDraft(String(value)); // revert visual
  };
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
      <Input
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur(); }
        }}
        className="h-5 w-14 border-0 bg-transparent p-0 text-xs"
      />
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive"
        aria-label="remove slot"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

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
            <SlotChip
              key={i}
              value={s}
              onCommit={(n) => {
                const next = [...value.slots];
                next[i] = n;
                onChange({ ...value, slots: next });
              }}
              onRemove={() => removeSlot(i)}
            />
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
