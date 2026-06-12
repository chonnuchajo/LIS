import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Radio, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, type InstrumentSource } from "@/lib/api";

const BLANK: Partial<InstrumentSource> = {
  key: "",
  label: "",
  instrumentName: "",
  fetchUrl: "",
  method: "GET",
  authHeader: "",
  responsePath: "",
  readingAtPath: "",
  unit: "",
  decimals: null,
  timeoutMs: 5000,
  enabled: true,
};

// Manage InstrumentSource config rows: one row per result-field key, mapping it
// to a lab instrument's API endpoint so values can be pulled live. New row =
// new instrument, no code change.
export default function InstrumentSourceManager() {
  const queryClient = useQueryClient();
  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["instrument-sources"],
    queryFn: api.getInstrumentSources,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["instrument-sources"] });

  const createMutation = useMutation({
    mutationFn: () => api.createInstrumentSource(BLANK),
    onSuccess: () => { toast.success("เพิ่มเครื่องแล้ว"); invalidate(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "เพิ่มไม่สำเร็จ"),
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        ผูกค่าในผลตรวจกับ API ของเครื่องมือ — ผู้ใช้กดปุ่ม "ดึงค่า" ข้างช่องที่ <code>key</code> ตรงกับ
        ชื่อช่อง (label) ของพารามิเตอร์ แล้ว LIS จะไปดึงค่าล่าสุดจากเครื่องมาเติมให้
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((src) => (
            <InstrumentSourceCard key={src._id} source={src} onChanged={invalidate} />
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending}
        className="gap-1"
      >
        <Plus className="h-4 w-4" /> เพิ่มเครื่อง
      </Button>
    </div>
  );
}

function InstrumentSourceCard({
  source,
  onChanged,
}: {
  source: InstrumentSource;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<InstrumentSource>(source);
  const dirty = JSON.stringify(draft) !== JSON.stringify(source);

  const saveMutation = useMutation({
    mutationFn: () => api.updateInstrumentSource(source._id!, draft),
    onSuccess: () => { toast.success(`บันทึก ${draft.label || draft.key || "เครื่อง"} แล้ว`); onChanged(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteInstrumentSource(source._id!),
    onSuccess: () => { toast.success("ลบแล้ว"); onChanged(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ"),
  });

  const set = <K extends keyof InstrumentSource>(k: K, v: InstrumentSource[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const field = (
    key: keyof InstrumentSource,
    label: string,
    opts: { placeholder?: string; type?: string } = {},
  ) => (
    <div className="space-y-1">
      <Label className="text-xs text-grey-600">{label}</Label>
      <Input
        className="h-8 text-sm"
        type={opts.type ?? "text"}
        placeholder={opts.placeholder}
        value={(draft[key] ?? "") as string | number}
        onChange={(e) => {
          const raw = e.target.value;
          set(key, (opts.type === "number" ? (raw === "" ? null : Number(raw)) : raw) as InstrumentSource[typeof key]);
        }}
      />
    </div>
  );

  return (
    <Card className="border-grey-200">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-indigo-500" />
          <span className="flex-1 text-sm font-semibold text-grey-800">
            {draft.label || draft.key || "เครื่องใหม่"}
          </span>
          <Switch checked={draft.enabled ?? true} onCheckedChange={(v) => set("enabled", v)} />
        </div>

        {field("key", "key (ตรงกับชื่อช่องพารามิเตอร์)", { placeholder: "เช่น ความถ่วงจำเพาะ" })}
        {field("label", "ชื่อแสดง", { placeholder: "ความถ่วงจำเพาะ (ถ.พ.)" })}
        {field("instrumentName", "ชื่อเครื่อง", { placeholder: "DMA 4500" })}
        {field("fetchUrl", "URL ของเครื่อง", { placeholder: "http://192.168.x.x/latest" })}
        {field("responsePath", "responsePath (path ไปยังค่า)", { placeholder: "data.value" })}
        {field("readingAtPath", "readingAtPath (เวลา, ถ้ามี)", { placeholder: "measuredAt" })}
        <div className="grid grid-cols-3 gap-2">
          {field("unit", "หน่วย", { placeholder: "g/mL" })}
          {field("decimals", "ทศนิยม", { type: "number", placeholder: "3" })}
          {field("timeoutMs", "timeout(ms)", { type: "number", placeholder: "5000" })}
        </div>
        {field("authHeader", "auth header (ถ้ามี)", { placeholder: "Authorization: Bearer xxx" })}

        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            className="flex-1"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            บันทึก
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-red-500 hover:text-red-600"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
