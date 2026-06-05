import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import EnvRoomConfigCard from "@/components/lis/EnvRoomConfigCard";
import PrintConfigCard from "@/components/lis/PrintConfigCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useEnvRooms } from "@/hooks/useEnvRooms";
import type { EnvRoom, EnvRoomConfigInput } from "@/lib/dailyCheckEnv";
import type { PrintConfig, PrintConfigInput } from "@/lib/printConfig";

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
      <Tabs defaultValue="environment">
        <TabsList>
          <TabsTrigger value="environment">ห้องตรวจสภาพแวดล้อม</TabsTrigger>
          <TabsTrigger value="printers">เครื่องพิมพ์เอกสาร</TabsTrigger>
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
            เลือกเครื่องพิมพ์ปลายทางของเอกสารแต่ละชนิด
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
      </Tabs>
    </AppLayout>
  );
};

export default SettingsPage;
