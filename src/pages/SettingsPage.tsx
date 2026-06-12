import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import EnvRoomConfigCard from "@/components/lis/EnvRoomConfigCard";
import PrintConfigCard from "@/components/lis/PrintConfigCard";
import DocumentNumberConfigCard from "@/components/lis/DocumentNumberConfigCard";
import DashboardLayoutConfigCard from "@/components/lis/DashboardLayoutConfigCard";
import InstrumentSourceManager from "@/components/lis/InstrumentSourceManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useEnvRooms } from "@/hooks/useEnvRooms";
import type { EnvRoom, EnvRoomConfigInput } from "@/lib/dailyCheckEnv";
import type { PrintConfig, PrintConfigInput } from "@/lib/printConfig";
import { DOC_NUMBER_TYPES, type DocumentNumberConfig, type DocumentNumberConfigInput, type DocNumberType } from "@/lib/documentNumberConfig";
import { useAccessibleTabs } from "@/hooks/useAccessibleTabs";

const SettingsPage = () => {
  const queryClient = useQueryClient();
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

  const { data: printConfigs = [] } = useQuery({
    queryKey: ["print-config"],
    queryFn: api.getPrintConfigs,
  });
  const { data: printers = [] } = useQuery({
    queryKey: ["printers"],
    queryFn: api.getPrinters,
  });
  const savePrintMutation = useMutation({
    mutationFn: ({ slug, input }: { slug: PrintConfig["slug"]; input: PrintConfigInput }) =>
      api.updatePrintConfig(slug, input),
    onSuccess: () => {
      toast.success("บันทึกการตั้งค่าเครื่องพิมพ์แล้ว");
      queryClient.invalidateQueries({ queryKey: ["print-config"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
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
    docNumberConfigs.map((c: DocumentNumberConfig) => [c.docType, c])
  );

  // Distinct key (not the shared ["access-control"] used by useCanAccessPath) so this
  // read can't overwrite the app-wide access-control cache with a narrower shape.
  const { data: accessMatrix } = useQuery({
    queryKey: ["access-control-roles"],
    queryFn: async () => {
      const res = await api.get<{ roles?: { id: string; name: string }[] }>("/access-control");
      return res.data.data;
    },
  });
  const roleOptions = (accessMatrix?.roles ?? []).map((r) => ({ id: r.id, name: r.name }));

  const TAB_KEYS = ["environment", "printers", "doc-numbers", "instruments", "dashboard"];
  const { isVisible, defaultKey } = useAccessibleTabs("/settings", TAB_KEYS);
  const [activeTab, setActiveTab] = useState<string | undefined>(defaultKey);
  // If the chosen tab becomes hidden (or default resolves late), snap to a visible one.
  const currentTab = activeTab && isVisible(activeTab) ? activeTab : defaultKey;

  return (
    <AppLayout title="ตั้งค่าระบบ">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Settings className="w-6 h-6" />
            ตั้งค่าระบบ
          </span>
        }
        description="จัดการการตั้งค่าระบบ — แยกตามหมวดในแต่ละแท็บ"
      />
      <Tabs value={currentTab} onValueChange={setActiveTab}>
        <TabsList>
          {isVisible("environment") && (
            <TabsTrigger value="environment">ห้องตรวจสภาพแวดล้อม</TabsTrigger>
          )}
          {isVisible("printers") && (
            <TabsTrigger value="printers">เครื่องพิมพ์เอกสาร</TabsTrigger>
          )}
          {isVisible("doc-numbers") && (
            <TabsTrigger value="doc-numbers">รหัสเอกสาร</TabsTrigger>
          )}
          {isVisible("instruments") && (
            <TabsTrigger value="instruments">เครื่องมือ/API</TabsTrigger>
          )}
          {isVisible("dashboard") && (
            <TabsTrigger value="dashboard">แดชบอร์ด</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="environment" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            เลือก board และเกณฑ์ temp/humidity ของแต่ละห้อง
          </p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
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
            เลือกเครื่องพิมพ์ปลายทางของเอกสารแต่ละชนิด หรือกำหนด CUPS printer URL จาก https://192.168.0.237:631/
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {printConfigs.map((cfg) => (
              <PrintConfigCard
                key={cfg.slug}
                config={cfg}
                printers={printers}
                saving={savePrintMutation.isPending}
                onSave={(slug, input) => savePrintMutation.mutate({ slug, input })}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="doc-numbers" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            กำหนดรูปแบบเลขที่เอกสารที่ระบบออกอัตโนมัติ — เปลี่ยนแล้วมีผลกับเลขที่ออกใหม่เท่านั้น เอกสารเดิมไม่เปลี่ยน
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
              เลือกว่าจะแสดงส่วนไหน เรียงลำดับอย่างไร และ KPI ใบไหน — แยกตาม role (ค่ามาตรฐานใช้เมื่อ role นั้นยังไม่ตั้งค่า)
            </p>
            <DashboardLayoutConfigCard roles={roleOptions} />
          </TabsContent>
        )}
      </Tabs>
    </AppLayout>
  );
};

export default SettingsPage;
