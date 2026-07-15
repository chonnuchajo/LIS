import { useState } from "react";
import { Monitor, Pencil, Plus, Server, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PRINTER_KINDS,
  getPrintOutputMode,
  setPrintOutputMode,
  validatePrinterUrl,
  type PrintOutputMode,
  type PrinterConfig,
  type PrinterConfigInput,
  type PrinterKind,
} from "@/lib/printConfig";
import { toast } from "sonner";

type Draft = {
  label: string;
  cupsPrinterUrl: string;
};

interface Props {
  configs: PrinterConfig[];
  saving: boolean;
  onCreate: (input: PrinterConfigInput) => Promise<unknown>;
  onUpdate: (id: string, input: { label?: string; cupsPrinterUrl?: string }) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onSetDefault: (id: string) => Promise<unknown>;
}

function emptyDraft(): Draft {
  return { label: "", cupsPrinterUrl: "" };
}

export default function PrinterRegistryCard({
  configs,
  saving,
  onCreate,
  onUpdate,
  onDelete,
  onSetDefault,
}: Props) {
  const [addingKind, setAddingKind] = useState<PrinterKind | null>(null);
  const [addDraft, setAddDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [outputModes, setOutputModes] = useState<Record<PrinterKind, PrintOutputMode>>(() => ({
    a4: getPrintOutputMode("a4"),
    sticker: getPrintOutputMode("sticker"),
  }));

  function startAdd(kind: PrinterKind) {
    setAddingKind(kind);
    setAddDraft(emptyDraft());
  }

  function startEdit(config: PrinterConfig) {
    setEditingId(config.id);
    setEditDraft({
      label: config.label ?? "",
      cupsPrinterUrl: config.cupsPrinterUrl ?? "",
    });
  }

  function validateDraft(draft: Draft): boolean {
    const err = validatePrinterUrl(draft.cupsPrinterUrl);
    if (err) {
      toast.error(err);
      return false;
    }
    return true;
  }

  function handleOutputModeChange(kind: PrinterKind, mode: PrintOutputMode) {
    setPrintOutputMode(kind, mode);
    setOutputModes((prev) => ({ ...prev, [kind]: mode }));
    toast.success(mode === "local" ? "ตั้งค่าให้พิมพ์จากเครื่องนี้แล้ว" : "ตั้งค่าให้พิมพ์ผ่าน Server/CUPS แล้ว");
  }

  async function handleCreate(kind: PrinterKind) {
    if (!validateDraft(addDraft)) return;
    await onCreate({
      kind,
      label: addDraft.label.trim() || undefined,
      cupsPrinterUrl: addDraft.cupsPrinterUrl.trim(),
    });
    setAddingKind(null);
    setAddDraft(emptyDraft());
  }

  async function handleUpdate(id: string) {
    if (!validateDraft(editDraft)) return;
    await onUpdate(id, {
      label: editDraft.label.trim() || undefined,
      cupsPrinterUrl: editDraft.cupsPrinterUrl.trim(),
    });
    setEditingId(null);
    setEditDraft(emptyDraft());
  }

  async function handleDelete(config: PrinterConfig) {
    const name = config.label?.trim() || config.cupsPrinterUrl;
    if (!window.confirm(`ลบเครื่องพิมพ์ ${name} ?`)) return;
    await onDelete(config.id);
    if (editingId === config.id) {
      setEditingId(null);
      setEditDraft(emptyDraft());
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {PRINTER_KINDS.map((meta) => {
        const group = configs.filter((config) => config.kind === meta.kind);
        const isAdding = addingKind === meta.kind;

        return (
          <Card key={meta.kind}>
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{meta.label}</CardTitle>
                  <CardDescription>{meta.hint}</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => startAdd(meta.kind)}
                  disabled={saving}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  เพิ่มเครื่องพิมพ์
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">แหล่งพิมพ์เริ่มต้น</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={outputModes[meta.kind] === "server" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleOutputModeChange(meta.kind, "server")}
                    >
                      <Server className="h-4 w-4" />
                      Server/CUPS
                    </Button>
                    <Button
                      type="button"
                      variant={outputModes[meta.kind] === "local" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleOutputModeChange(meta.kind, "local")}
                    >
                      <Monitor className="h-4 w-4" />
                      เครื่องนี้
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  โหมดเครื่องนี้จะเปิด print dialog ของ Windows/Browser ทันที โดยรายชื่อ printer local จะแสดงใน dialog นั้น
                </p>
              </div>
              {group.length === 0 ? (
                <div className="rounded-md border border-dashed px-4 py-5 text-sm text-muted-foreground">
                  ยังไม่มีเครื่องพิมพ์ในกลุ่มนี้
                </div>
              ) : (
                group.map((config) => {
                  const isEditing = editingId === config.id;
                  return (
                    <div key={config.id} className="rounded-lg border p-3">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs">ชื่อเรียก</Label>
                            <Input
                              value={editDraft.label}
                              onChange={(e) => setEditDraft((prev) => ({ ...prev, label: e.target.value }))}
                              placeholder="เช่น HP LaserJet ชั้น 2"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">CUPS printer URL</Label>
                            <Input
                              value={editDraft.cupsPrinterUrl}
                              onChange={(e) => setEditDraft((prev) => ({ ...prev, cupsPrinterUrl: e.target.value }))}
                              placeholder="https://192.168.0.237:631/printers/PRINTER_NAME"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => void handleUpdate(config.id)} disabled={saving}>
                              บันทึก
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingId(null);
                                setEditDraft(emptyDraft());
                              }}
                              disabled={saving}
                            >
                              ยกเลิก
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{config.label?.trim() || "ไม่ได้ตั้งชื่อ"}</p>
                              {config.isDefault && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                  <Star className="h-3 w-3" />
                                  ค่าเริ่มต้น
                                </span>
                              )}
                            </div>
                            <p className="break-all text-sm text-muted-foreground">{config.cupsPrinterUrl}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant={config.isDefault ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => void onSetDefault(config.id)}
                              disabled={saving || config.isDefault}
                            >
                              ใช้เป็นค่าเริ่มต้น
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => startEdit(config)}
                              disabled={saving}
                            >
                              <Pencil className="h-4 w-4" />
                              แก้ไข
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleDelete(config)}
                              disabled={saving}
                            >
                              <Trash2 className="h-4 w-4" />
                              ลบ
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {isAdding && (
                <div className="rounded-lg border border-dashed p-3">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">ชื่อเรียก</Label>
                      <Input
                        value={addDraft.label}
                        onChange={(e) => setAddDraft((prev) => ({ ...prev, label: e.target.value }))}
                        placeholder="เช่น Zebra Label Printer"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CUPS printer URL</Label>
                      <Input
                        value={addDraft.cupsPrinterUrl}
                        onChange={(e) => setAddDraft((prev) => ({ ...prev, cupsPrinterUrl: e.target.value }))}
                        placeholder="https://192.168.0.237:631/printers/PRINTER_NAME"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void handleCreate(meta.kind)} disabled={saving}>
                        บันทึก
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAddingKind(null);
                          setAddDraft(emptyDraft());
                        }}
                        disabled={saving}
                      >
                        ยกเลิก
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
