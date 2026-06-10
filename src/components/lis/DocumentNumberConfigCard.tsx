import { useState } from "react";
import { Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  buildPreview,
  validateDocNumberConfig,
  type DocumentNumberConfig,
  type DocumentNumberConfigInput,
  type DocNumberTypeMeta,
  type YearFormat,
} from "@/lib/documentNumberConfig";

interface Props {
  meta: DocNumberTypeMeta;
  config: DocumentNumberConfig;
  saving: boolean;
  onSave: (docType: DocumentNumberConfig["docType"], input: DocumentNumberConfigInput) => void;
}

const DocumentNumberConfigCard = ({ meta, config, saving, onSave }: Props) => {
  const [prefix, setPrefix] = useState<string>(config.prefix);
  const [yearFormat, setYearFormat] = useState<YearFormat>(config.yearFormat);
  const [includeMonth, setIncludeMonth] = useState<boolean>(config.includeMonth);
  const [seqPadding, setSeqPadding] = useState<string>(String(config.seqPadding));
  const [separator, setSeparator] = useState<string>(config.separator);

  const draft: DocumentNumberConfigInput = {
    prefix,
    yearFormat,
    includeMonth,
    seqPadding: Number(seqPadding),
    separator,
  };
  const error = validateDocNumberConfig(draft);
  const preview = error ? null : buildPreview(draft);
  const prefixEmpty = prefix.trim() === "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Hash className="w-4 h-4 text-primary" />
          {meta.label}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{meta.hint}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Prefix</label>
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="เช่น P" className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">ตัวคั่น</label>
            <Input value={separator} onChange={(e) => setSeparator(e.target.value)} placeholder="เช่น -" className="h-9 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">ปี</label>
            <Select value={yearFormat} onValueChange={(v) => setYearFormat(v as YearFormat)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ไม่มีปี</SelectItem>
                <SelectItem value="yy">2 หลัก (26)</SelectItem>
                <SelectItem value="yyyy">4 หลัก (2026)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">จำนวนหลัก running</label>
            <Input type="number" min={1} max={10} value={seqPadding} onChange={(e) => setSeqPadding(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">ใส่เดือน (รีเซ็ตรายเดือน)</label>
          <Switch checked={includeMonth} onCheckedChange={setIncludeMonth} />
        </div>

        {/* Live preview */}
        <div className="rounded-md bg-muted px-3 py-2">
          <span className="text-xs text-muted-foreground">ตัวอย่างเลขถัดไป: </span>
          {preview ? (
            <span className="font-mono text-sm font-semibold">{preview}</span>
          ) : (
            <span className="text-xs text-red-600">{error}</span>
          )}
        </div>

        {!error && prefixEmpty && (
          <p className="text-xs text-amber-600">⚠ ไม่มี prefix — จะมองแยกประเภทเอกสารด้วยตายากขึ้น</p>
        )}

        <div className="flex justify-end">
          <Button size="sm" disabled={saving || !!error} onClick={() => onSave(config.docType, draft)}>
            บันทึก
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DocumentNumberConfigCard;
