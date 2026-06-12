import { useState } from "react";
import { Loader2, Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, type InstrumentReading } from "@/lib/api";

interface InstrumentFetchButtonProps {
  /** Param key, matches an InstrumentSource.key (e.g. "density"). */
  paramKey: string;
  /** Called with the normalized reading on a successful pull. */
  onPulled: (reading: InstrumentReading) => void;
  /** Tooltip hint, usually the instrument name. */
  instrumentName?: string;
  disabled?: boolean;
}

/**
 * Pull the latest reading for `paramKey` from its configured lab instrument via
 * the LIS backend proxy. Auto-fill + provenance handling live in the parent
 * (see TestField) — this button only triggers the fetch and surfaces errors.
 */
export default function InstrumentFetchButton({
  paramKey,
  onPulled,
  instrumentName,
  disabled = false,
}: InstrumentFetchButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const reading = await api.fetchInstrumentReading(paramKey);
      if (reading.ok) {
        onPulled(reading);
        toast.success(`ดึงค่าจาก ${reading.instrument || "เครื่อง"} แล้ว`, {
          description: `${reading.value}${reading.unit ? ` ${reading.unit}` : ""}`,
        });
      } else {
        toast.error("ดึงค่าจากเครื่องไม่ได้", {
          description: reading.error || "ลองใหม่อีกครั้ง หรือกรอกค่าด้วยมือ",
        });
      }
    } catch (err) {
      toast.error("ดึงค่าจากเครื่องไม่ได้", {
        description: err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรอกค่าด้วยมือได้",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 shrink-0 gap-1 px-2 text-xs"
      onClick={handleClick}
      disabled={disabled || loading}
      title={instrumentName ? `ดึงค่าล่าสุดจาก ${instrumentName}` : "ดึงค่าล่าสุดจากเครื่อง"}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Radio className="h-3.5 w-3.5" />
      )}
      ดึงค่า
    </Button>
  );
}
