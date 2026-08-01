import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/lis/AppLayout";
import DashboardLayoutConfigCard from "@/components/lis/DashboardLayoutConfigCard";
import DocumentNumberConfigCard from "@/components/lis/DocumentNumberConfigCard";
import EnvRoomConfigCard from "@/components/lis/EnvRoomConfigCard";
import InstrumentSourceManager from "@/components/lis/InstrumentSourceManager";
import LineConfigCard from "@/components/lis/LineConfigCard";
import PageHeader from "@/components/lis/PageHeader";
import PrinterRegistryCard from "@/components/lis/PrinterRegistryCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccessibleTabs } from "@/hooks/useAccessibleTabs";
import { useAuth } from "@/hooks/useAuth";
import { useEnvRooms } from "@/hooks/useEnvRooms";
import { api } from "@/lib/api";
import type { EnvRoom, EnvRoomConfigInput } from "@/lib/dailyCheckEnv";
import { DOC_NUMBER_TYPES, type DocumentNumberConfig, type DocumentNumberConfigInput, type DocNumberType } from "@/lib/documentNumberConfig";
import { normalizeRoles } from "@/lib/roles";

const SettingsPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = normalizeRoles(user).includes("admin");
  const { rooms, isLoading } = useEnvRooms();

  const { data: liveReadings = [] } = useQuery({
    queryKey: ["temphum", "live"],
    queryFn: api.getLiveTempHum,
  });
  const detectedBoards = useMemo(
    () => Array.from(new Set(liveReadings.map((r) => r.board))).filter(Boolean),
    [liveReadings],
  );

  const saveMutation = useMutation({
    mutationFn: ({ slug, input }: { slug: EnvRoom["slug"]; input: EnvRoomConfigInput }) =>
      api.updateEnvRoomConfig(slug, input),
    onSuccess: (_data, vars) => {
      const label = rooms.find((r) => r.slug === vars.slug)?.label ?? vars.slug;
      toast.success(`บันทึกการตั้งค่า ${label} แล้ว`);
      queryClient.invalidateQueries({ queryKey: ["env-room-config"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    },
  });

  const { data: printerConfigs = [] } = useQuery({
    queryKey: ["printer-configs"],
    queryFn: api.getPrinterConfigs,
  });
  const createPrinterMutation = useMutation({
    mutationFn: api.createPrinterConfig,
    onSuccess: () => {
      toast.success("บันทึกการตั้งค่าเครื่องพิมพ์แล้ว");
      queryClient.invalidateQueries({ queryKey: ["printer-configs"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    },
  });
  const updatePrinterMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { label?: string; cupsPrinterUrl?: string } }) =>
      api.updatePrinterConfig(id, input),
    onSuccess: () => {
      toast.success("บันทึกการตั้งค่าเครื่องพิมพ์แล้ว");
      queryClient.invalidateQueries({ queryKey: ["printer-configs"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    },
  });
  const deletePrinterMutation = useMutation({
    mutationFn: api.deletePrinterConfig,
    onSuccess: () => {
      toast.success("ลบเครื่องพิมพ์แล้ว");
      queryClient.invalidateQueries({ queryKey: ["printer-configs"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "ลบเครื่องพิมพ์ไม่สำเร็จ");
    },
  });
  const setDefaultPrinterMutation = useMutation({
    mutationFn: api.setDefaultPrinterConfig,
    onSuccess: () => {
      toast.success("อัปเดตเครื่องพิมพ์ค่าเริ่มต้นแล้ว");
      queryClient.invalidateQueries({ queryKey: ["printer-configs"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "อัปเดตค่าเริ่มต้นไม่สำเร็จ");
    },
  });

  const { data: docNumberConfigs = [] } = useQuery({
    queryKey: ["document-number-config"],
    queryFn: api.getDocumentNumberConfigs,
  });
  const saveDocNumberMutation = useMutation({
    mutationFn: ({ docType, input }: { docType: DocNumberType; input: DocumentNumberConfigInput }) =>
      api.updateDocumentNumberConfig(docType, input),
    onSuccess: () => {
      toast.success("บันทึกรูปแบบเลขที่เอกสารแล้ว");
      queryClient.invalidateQueries({ queryKey: ["document-number-config"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    },
  });
  const docConfigByType = new Map<DocNumberType, DocumentNumberConfig>(
    docNumberConfigs.map((config: DocumentNumberConfig) => [config.docType, config]),
  );

  const { data: accessMatrix } = useQuery({
    queryKey: ["access-control-roles"],
    queryFn: async () => {
      const res = await api.get<{ roles?: { id: string; name: string }[] }>("/access-control");
      return res.data.data;
    },
  });
  const roleOptions = (accessMatrix?.roles ?? []).map((r) => ({ id: r.id, name: r.name }));

  const { tabs, isVisible, defaultKey } = useAccessibleTabs("/settings");
  const [activeTab, setActiveTab] = useState<string | undefined>(defaultKey);
  const currentTab = activeTab && isVisible(activeTab) ? activeTab : defaultKey;

  const printerSaving =
    createPrinterMutation.isPending ||
    updatePrinterMutation.isPending ||
    deletePrinterMutation.isPending ||
    setDefaultPrinterMutation.isPending;

  return (
    <AppLayout title="ตั้งค่าระบบ">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Settings className="h-6 w-6" />
            ตั้งค่าระบบ
          </span>
        }
        description="จัดการการตั้งค่าระบบ แยกตามหมวดในแต่ละแท็บ"
      />
      <Tabs value={currentTab} onValueChange={setActiveTab}>
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
              {t.icon && <t.icon className="h-4 w-4" />}
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="environment" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            เลือก board และเกณฑ์ temp/humidity ของแต่ละห้อง
          </p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rooms.map((room) => (
                <EnvRoomConfigCard
                  key={room.slug}
                  room={room}
                  detectedBoards={detectedBoards}
                  saving={saveMutation.isPending}
                  onSave={(slug, input) => saveMutation.mutate({ slug, input })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="printers" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            จัดการปลายทางเครื่องพิมพ์แยกตามชนิด A4 และ Sticker เลือกได้ว่าจะพิมพ์ผ่าน Server/CUPS หรือเปิดรายชื่อ printer local ใน print dialog ของเครื่องนี้
          </p>
          <PrinterRegistryCard
            configs={printerConfigs}
            saving={printerSaving}
            onCreate={createPrinterMutation.mutateAsync}
            onUpdate={(id, input) => updatePrinterMutation.mutateAsync({ id, input })}
            onDelete={deletePrinterMutation.mutateAsync}
            onSetDefault={setDefaultPrinterMutation.mutateAsync}
          />
        </TabsContent>

        <TabsContent value="doc-numbers" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            กำหนดรูปแบบเลขที่เอกสารที่ระบบออกอัตโนมัติ เปลี่ยนแล้วมีผลกับเลขที่ออกใหม่เท่านั้น เอกสารเดิมไม่เปลี่ยน
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {DOC_NUMBER_TYPES.map((meta) => {
              const cfg = docConfigByType.get(meta.docType);
              if (!cfg) return null;
              return (
                <DocumentNumberConfigCard
                  key={meta.docType}
                  meta={meta}
                  config={cfg}
                  saving={saveDocNumberMutation.isPending}
                  onSave={(docType, input) => saveDocNumberMutation.mutate({ docType, input })}
                />
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="instruments" className="space-y-3">
          <InstrumentSourceManager />
        </TabsContent>

        {isVisible("dashboard") && (
          <TabsContent value="dashboard" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              เลือกว่าจะแสดงส่วนไหน เรียงลำดับอย่างไร และ KPI ใบไหน แยกตาม role
            </p>
            <DashboardLayoutConfigCard roles={roleOptions} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="line" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              ผูกกลุ่ม LINE ให้รับแจ้งเตือนคำขออัตโนมัติ และให้บอทตอบสถานะเมื่อพิมพ์เลขคำขอในแชต
            </p>
            <div className="max-w-2xl">
              <LineConfigCard />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </AppLayout>
  );
};

export default SettingsPage;
