import { useEffect, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiKeyInput, ApiKeyItem, ApiScope, CreatedApiKey } from "@/lib/apiKeys";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopes: ApiScope[];
  editing?: ApiKeyItem | null;
  saving: boolean;
  onSubmit: (input: ApiKeyInput) => Promise<CreatedApiKey | ApiKeyItem>;
}

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export default function ApiKeyFormDialog({
  open,
  onOpenChange,
  scopes,
  editing,
  saving,
  onSubmit,
}: Props) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [rateLimit, setRateLimit] = useState("120");
  const [rawKey, setRawKey] = useState("");
  const [copied, setCopied] = useState(false);

  // รีเซ็ตฟอร์มทุกครั้งที่เปิด (deps = [open] เท่านั้น ไม่งั้น refetch ระหว่าง
  // กรอกจะล้างสิ่งที่พิมพ์ไว้)
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setSelected(editing?.scopes ?? []);
    setExpiresAt(toDateInput(editing?.expiresAt ?? null));
    setRateLimit(String(editing?.rateLimitPerMinute ?? 120));
    setRawKey("");
    setCopied(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleScope = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("ต้องตั้งชื่อ key");
      return;
    }
    if (selected.length === 0) {
      toast.error("ต้องเลือกอย่างน้อย 1 scope");
      return;
    }
    const input: ApiKeyInput = {
      name: name.trim(),
      scopes: selected,
      expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
      rateLimitPerMinute: Number(rateLimit) || 0,
    };
    const result = await onSubmit(input);
    if (!editing && "rawKey" in result) {
      setRawKey(result.rawKey); // โชว์ค่าเต็มครั้งเดียว
      return;
    }
    handleDialogOpenChange(false);
  };

  // Clipboard with fallback pattern (from NavItemContextMenu.tsx)
  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // ตกไปใช้ fallback ข้างล่าง
    }
    // clipboard API ใช้ไม่ได้เมื่อไม่ใช่ secure context (เช่น http ภายในองค์กร)
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      // finally เพื่อไม่ให้ el ค้างใน DOM ถ้า select()/execCommand throw (เช่น browser บล็อก)
      try {
        el.select();
        return document.execCommand("copy");
      } finally {
        document.body.removeChild(el);
      }
    } catch {
      return false;
    }
  };

  const copyKey = async () => {
    const success = await copyToClipboard(rawKey);
    if (success) {
      setCopied(true);
      toast.success("คัดลอก key แล้ว");
    } else {
      toast.error("คัดลอกไม่ได้ — กรุณาเลือกและคัดลอกเอง");
    }
  };

  // Intercept dialog close to protect rawKey display
  const handleDialogOpenChange = (newOpen: boolean) => {
    // If showing rawKey and trying to close without copying, prevent it
    if (rawKey && !newOpen && !copied) {
      toast.warning("ต้องคัดลอก key ก่อน — ปิดแล้วจะดูค่าไม่ได้อีก");
      return;
    }
    onOpenChange(newOpen);
  };

  // Explicit close button on reveal screen (deliberate exit path)
  const handleRevealClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {rawKey ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                สร้าง key แล้ว
              </DialogTitle>
              <DialogDescription>
                คัดลอกเก็บไว้ตอนนี้เลย — ระบบเก็บแค่ค่าเข้ารหัส ปิดหน้าต่างนี้แล้วจะดูค่าเต็มไม่ได้อีก
                ถ้าทำหายต้องสร้างใบใหม่
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
              <code className="flex-1 break-all text-xs">{rawKey}</code>
              <Button size="sm" variant="outline" onClick={copyKey}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              วิธีใช้: ส่ง header <code>X-API-Key: {"<key>"}</code> ไปกับทุก request
            </p>
            <DialogFooter>
              <Button onClick={handleRevealClose}>คัดลอกแล้ว ปิดหน้าต่าง</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{editing ? "แก้ไข API key" : "สร้าง API key"}</DialogTitle>
              <DialogDescription>
                ตั้งชื่อให้รู้ว่าใบนี้ของระบบไหน แล้วเลือกว่าให้เข้าถึงอะไรได้บ้าง
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="api-key-name">ชื่อ</Label>
                <Input
                  id="api-key-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น Node-RED ห้อง QC"
                />
              </div>
              <div className="space-y-2">
                <Label>เข้าถึงอะไรได้บ้าง (scope)</Label>
                {scopes.map((scope) => (
                  <label key={scope.id} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={selected.includes(scope.id)}
                      onCheckedChange={() => toggleScope(scope.id)}
                    />
                    <span>
                      {scope.label}
                      <span className="ml-1 text-xs text-muted-foreground">({scope.id})</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="api-key-exp">วันหมดอายุ</Label>
                  <Input
                    id="api-key-exp"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">เว้นว่าง = ไม่หมดอายุ</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="api-key-rate">โควตา (ครั้ง/นาที)</Label>
                  <Input
                    id="api-key-rate"
                    type="number"
                    min={0}
                    value={rateLimit}
                    onChange={(e) => setRateLimit(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">0 = ไม่จำกัด</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={saving}>
                ยกเลิก
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {editing ? "บันทึก" : "สร้าง key"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
