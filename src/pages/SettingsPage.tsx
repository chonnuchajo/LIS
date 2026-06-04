import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import EnvRoomConfigCard from "@/components/lis/EnvRoomConfigCard";
import { api } from "@/lib/api";
import { useEnvRooms } from "@/hooks/useEnvRooms";
import type { EnvRoom, EnvRoomConfigInput } from "@/lib/dailyCheckEnv";

const SettingsPage = () => {
  const queryClient = useQueryClient();
  const { rooms } = useEnvRooms();

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

  return (
    <AppLayout title="ตั้งค่าระบบ">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Settings className="w-6 h-6" />
            ตั้งค่าระบบ
          </span>
        }
        description="ตั้งค่าห้องตรวจสภาพแวดล้อม (Environment) — เลือก board และเกณฑ์ temp/humidity ของแต่ละห้อง"
      />
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">ตั้งค่าห้องตรวจสภาพแวดล้อม</h2>
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
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
