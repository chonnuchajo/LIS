import { useMemo, useState } from "react";
import { Monitor, Pencil, Plus, Server, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PAPER_SIZES,
  PRINT_DOC_TYPES,
  PRINTER_KINDS,
  docTypeToKind,
  getPrintOutputMode,
  normalizeDepartment,
  setPrintOutputMode,
  validatePrinterUrl,
  type PaperSize,
  type PrintDocType,
  type PrintOutputMode,
  type PrinterAssignment,
  type PrinterConfig,
  type PrinterConfigInput,
  type PrinterKind,
} from "@/lib/printConfig";

type Draft = {
  label: string;
  cupsPrinterUrl: string;
  department: string;
  paperSize: PaperSize;
  docTypes: PrintDocType[];
};

interface Props {
  configs: PrinterConfig[];
  departmentOptions?: string[];
  saving?: boolean;
  onCreate: (input: PrinterConfigInput) => Promise<unknown>;
  onUpdate: (id: string, input: Partial<PrinterConfigInput>) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onSetDefault: (id: string) => Promise<unknown>;
  onTestPrint: (id: string) => Promise<unknown>;
}

function docOptionsForKind(kind: PrinterKind) {
  return PRINT_DOC_TYPES.filter((docType) => docTypeToKind(docType.slug) === kind);
}

function emptyDraft(kind: PrinterKind): Draft {
  const firstDoc = docOptionsForKind(kind)[0];
  return { label: "", cupsPrinterUrl: "", department: "", paperSize: firstDoc?.defaultPaper ?? "A4", docTypes: [] };
}

function draftFromConfig(config: PrinterConfig): Draft {
  const assignment = config.assignments?.[0];
  return {
    label: config.label ?? "",
    cupsPrinterUrl: config.cupsPrinterUrl ?? "",
    department: assignment?.department ?? "",
    paperSize: assignment?.paperSize ?? docOptionsForKind(config.kind)[0]?.defaultPaper ?? "A4",
    docTypes: assignment?.docTypes ?? [],
  };
}

function assignmentFromDraft(draft: Draft): PrinterAssignment[] {
  if (draft.docTypes.length === 0) return [];
  return [{ department: normalizeDepartment(draft.department), paperSize: draft.paperSize, docTypes: draft.docTypes }];
}

function printerName(config: PrinterConfig): string {
  return config.label?.trim() || config.cupsPrinterUrl;
}

function docLabel(docType: PrintDocType): string {
  return PRINT_DOC_TYPES.find((doc) => doc.slug === docType)?.label ?? docType;
}

function AssignmentSummary({ config }: { config: PrinterConfig }) {
  const assignments = config.assignments ?? [];
  if (assignments.length === 0) {
    return <p className="text-xs text-muted-foreground">ยังไม่ได้กำหนดแผนก/เอกสาร — จะใช้เป็น fallback เมื่อไม่มี rule เฉพาะ</p>;
  }

  return (
    <div className="space-y-2">
      {assignments.map((assignment, index) => (
        <div key={`${assignment.department}-${assignment.paperSize}-${index}`} className="rounded-md bg-muted/40 p-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">แผนก: {normalizeDepartment(assignment.department) || "ทุกแผนก"}</Badge>
            <Badge variant="outline">{assignment.paperSize}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {assignment.docTypes.map((docType) => (
              <Badge key={docType} variant="gray-soft">{docLabel(docType)}</Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AssignmentFields({
  kind,
  scope,
  draft,
  departmentOptions,
  disabled,
  onChange,
}: {
  kind: PrinterKind;
  scope: string;
  draft: Draft;
  departmentOptions: string[];
  disabled?: boolean;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const options = docOptionsForKind(kind);
  const departmentId = `printer-department-${scope}`;
  const paperId = `printer-paper-${scope}`;

  function toggleDoc(docType: PrintDocType, checked: boolean) {
    const next = checked
      ? [...draft.docTypes, docType]
      : draft.docTypes.filter((value) => value !== docType);
    onChange({ docTypes: Array.from(new Set(next)) });
  }

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-3">
      <div className="space-y-1">
        <Label className="text-xs" htmlFor={departmentId}>แผนกประจำเครื่อง</Label>
        <select
          id={departmentId}
          aria-label="แผนกประจำเครื่อง"
          value={draft.department}
          onChange={(event) => onChange({ department: event.target.value })}
          disabled={disabled}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">ทุกแผนก</option>
          {departmentOptions.map((department) => (
            <option key={department} value={department}>{department}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">เลือกทุกแผนกเป็นค่า fallback หรือเลือกแผนกเฉพาะเพื่อให้ระบบใช้เมื่อผู้พิมพ์อยู่แผนกนั้น</p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs" htmlFor={paperId}>ขนาดกระดาษ</Label>
        <select
          id={paperId}
          aria-label="ขนาดกระดาษ"
          value={draft.paperSize}
          onChange={(event) => onChange({ paperSize: event.target.value as PaperSize })}
          disabled={disabled}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {PAPER_SIZES.map((paperSize) => (
            <option key={paperSize} value={paperSize}>{paperSize}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">ใช้กับเอกสาร</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((docType) => (
            <label key={docType.slug} className="flex items-start gap-2 rounded-md border bg-background/60 p-2 text-sm">
              <Checkbox
                aria-label={docType.label}
                checked={draft.docTypes.includes(docType.slug)}
                onCheckedChange={(checked) => toggleDoc(docType.slug, checked === true)}
                disabled={disabled}
              />
              <span className="leading-tight">{docType.label}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">เลือกได้มากกว่า 1 เอกสาร เครื่องนี้จะถูกเลือกอัตโนมัติเมื่อแผนกตรงกัน</p>
      </div>
    </div>
  );
}

export default function PrinterRegistryCard({
  configs,
  departmentOptions = [],
  saving,
  onCreate,
  onUpdate,
  onDelete,
  onSetDefault,
  onTestPrint,
}: Props) {
  const [addingKind, setAddingKind] = useState<PrinterKind | null>(null);
  const [addDraft, setAddDraft] = useState<Draft>(() => emptyDraft("a4"));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(() => emptyDraft("a4"));
  const [outputModes, setOutputModes] = useState<Record<PrinterKind, PrintOutputMode>>(() => ({
    a4: getPrintOutputMode("a4"),
    sticker: getPrintOutputMode("sticker"),
  }));
  const groupByKind = useMemo(
    () => new Map(PRINTER_KINDS.map((meta) => [meta.kind, configs.filter((config) => config.kind === meta.kind)])),
    [configs],
  );

  function startAdd(kind: PrinterKind) {
    setEditingId(null);
    setAddingKind(kind);
    setAddDraft(emptyDraft(kind));
  }

  function startEdit(config: PrinterConfig) {
    setAddingKind(null);
    setEditingId(config.id);
    setEditDraft(draftFromConfig(config));
  }

  function validateDraft(draft: Draft): boolean {
    const err = validatePrinterUrl(draft.cupsPrinterUrl);
    if (err) {
      toast.error(err);
      return false;
    }
    if (draft.docTypes.length === 0) {
      toast.error("ต้องเลือกเอกสารอย่างน้อย 1 รายการ");
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
      assignments: assignmentFromDraft(addDraft),
    });
    setAddingKind(null);
    setAddDraft(emptyDraft(kind));
  }

  async function handleUpdate(config: PrinterConfig) {
    if (!validateDraft(editDraft)) return;
    await onUpdate(config.id, {
      label: editDraft.label.trim() || undefined,
      cupsPrinterUrl: editDraft.cupsPrinterUrl.trim(),
      assignments: assignmentFromDraft(editDraft),
    });
    setEditingId(null);
    setEditDraft(emptyDraft(config.kind));
  }

  async function handleDelete(config: PrinterConfig) {
    if (!window.confirm(`ลบเครื่องพิมพ์ ${printerName(config)} ?`)) return;
    await onDelete(config.id);
    if (editingId === config.id) {
      setEditingId(null);
      setEditDraft(emptyDraft(config.kind));
    }
  }

  async function handleTestPrint(config: PrinterConfig) {
    try {
      await onTestPrint(config.id);
      toast.success(`ส่งพิมพ์ทดสอบไปยัง ${printerName(config)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "พิมพ์ทดสอบไม่สำเร็จ");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {PRINTER_KINDS.map((meta) => {
        const group = groupByKind.get(meta.kind) ?? [];
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
                <p className="text-xs text-muted-foreground">โหมดเครื่องนี้จะเปิด print dialog ของ Windows/Browser ทันที โดยรายชื่อ printer local จะแสดงใน dialog นั้น</p>
              </div>

              {group.length === 0 ? (
                <div className="rounded-md border border-dashed px-4 py-5 text-sm text-muted-foreground">ยังไม่มีเครื่องพิมพ์ในกลุ่มนี้</div>
              ) : (
                group.map((config) => {
                  const isEditing = editingId === config.id;
                  return (
                    <div key={config.id} className="rounded-lg border p-3">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs" htmlFor={`printer-label-${config.id}`}>ชื่อเรียก</Label>
                            <Input
                              id={`printer-label-${config.id}`}
                              aria-label="ชื่อเรียก"
                              value={editDraft.label}
                              onChange={(event) => setEditDraft((prev) => ({ ...prev, label: event.target.value }))}
                              placeholder="เช่น HP LaserJet ชั้น 2"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs" htmlFor={`printer-url-${config.id}`}>Printer IP / URL</Label>
                            <Input
                              id={`printer-url-${config.id}`}
                              aria-label="Printer IP / URL"
                              value={editDraft.cupsPrinterUrl}
                              onChange={(event) => setEditDraft((prev) => ({ ...prev, cupsPrinterUrl: event.target.value }))}
                              placeholder="192.168.1.50 หรือ http://192.168.1.10:631/printers/Zebra"
                            />
                            <p className="text-xs text-muted-foreground">ใส่ IP เครื่องปริ้นโดยตรงได้ถ้าเครื่องรองรับ IPP หรือใส่ CUPS URL เต็มได้เหมือนเดิม</p>
                          </div>
                          <AssignmentFields
                            kind={config.kind}
                            scope={config.id}
                            draft={editDraft}
                            departmentOptions={departmentOptions}
                            disabled={saving}
                            onChange={(patch) => setEditDraft((prev) => ({ ...prev, ...patch }))}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => void handleUpdate(config)} disabled={saving}>บันทึก</Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingId(null);
                                setEditDraft(emptyDraft(config.kind));
                              }}
                              disabled={saving}
                            >
                              ยกเลิก
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">{printerName(config)}</p>
                                {config.isDefault && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                    <Star className="h-3 w-3" />
                                    ค่าเริ่มต้น
                                  </span>
                                )}
                              </div>
                              <p className="break-all text-sm text-muted-foreground">{config.cupsPrinterUrl}</p>
                            </div>
                          </div>
                          <AssignmentSummary config={config} />
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" variant={config.isDefault ? "secondary" : "outline"} size="sm" onClick={() => void onSetDefault(config.id)} disabled={saving || config.isDefault}>ใช้เป็นค่าเริ่มต้น</Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => void handleTestPrint(config)} disabled={saving}>พิมพ์ทดสอบ</Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => startEdit(config)} disabled={saving}>
                              <Pencil className="h-4 w-4" />
                              แก้ไข
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => void handleDelete(config)} disabled={saving}>
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
                      <Label className="text-xs" htmlFor={`new-printer-label-${meta.kind}`}>ชื่อเรียก</Label>
                      <Input
                        id={`new-printer-label-${meta.kind}`}
                        aria-label="ชื่อเรียก"
                        value={addDraft.label}
                        onChange={(event) => setAddDraft((prev) => ({ ...prev, label: event.target.value }))}
                        placeholder="เช่น Zebra Label Printer"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor={`new-printer-url-${meta.kind}`}>Printer IP / URL</Label>
                      <Input
                        id={`new-printer-url-${meta.kind}`}
                        aria-label="Printer IP / URL"
                        value={addDraft.cupsPrinterUrl}
                        onChange={(event) => setAddDraft((prev) => ({ ...prev, cupsPrinterUrl: event.target.value }))}
                        placeholder="192.168.1.50 หรือ http://192.168.1.10:631/printers/Zebra"
                      />
                      <p className="text-xs text-muted-foreground">ใส่ IP เครื่องปริ้นโดยตรงได้ถ้าเครื่องรองรับ IPP หรือใส่ CUPS URL เต็มได้เหมือนเดิม</p>
                    </div>
                    <AssignmentFields
                      kind={meta.kind}
                      scope={`new-${meta.kind}`}
                      draft={addDraft}
                      departmentOptions={departmentOptions}
                      disabled={saving}
                      onChange={(patch) => setAddDraft((prev) => ({ ...prev, ...patch }))}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void handleCreate(meta.kind)} disabled={saving}>บันทึก</Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAddingKind(null);
                          setAddDraft(emptyDraft(meta.kind));
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
