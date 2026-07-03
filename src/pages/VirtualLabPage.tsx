import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, FlaskConical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type MachineItem, type VirtualLabInstrument, type VirtualLabStatus } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const STATUS: Record<VirtualLabStatus, { label: string; className: string }> = {
  idle: { label: "Idle", className: "bg-slate-100 text-slate-700 border-slate-200" },
  running: { label: "Running", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  error: { label: "Error", className: "bg-red-100 text-red-700 border-red-200" },
  maintenance: { label: "Maintenance", className: "bg-amber-100 text-amber-700 border-amber-200" },
  offline: { label: "Offline", className: "bg-zinc-200 text-zinc-700 border-zinc-300" },
};

const STATUS_KEYS = Object.keys(STATUS) as VirtualLabStatus[];

const machineLabel = (machine: MachineItem) =>
  [machine.code, machine.name].filter(Boolean).join(" - ");

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "-";

export default function VirtualLabPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [roomId, setRoomId] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [machineId, setMachineId] = useState("");

  const roomsQuery = useQuery({
    queryKey: ["virtual-lab", "rooms"],
    queryFn: api.getVirtualLabRooms,
  });
  const machinesQuery = useQuery({
    queryKey: ["machines"],
    queryFn: api.getMachines,
  });

  const rooms = roomsQuery.data ?? [];
  const room = rooms.find((r) => r._id === roomId) ?? rooms[0];

  useEffect(() => {
    if (!roomId && rooms[0]?._id) setRoomId(rooms[0]._id);
  }, [roomId, rooms]);

  const logsQuery = useQuery({
    queryKey: ["virtual-lab", "logs", room?._id],
    queryFn: () => api.getVirtualLabLogs(room!._id),
    enabled: !!room?._id,
  });

  const refreshRoom = () => {
    queryClient.invalidateQueries({ queryKey: ["virtual-lab"] });
  };

  const createRoom = useMutation({
    mutationFn: api.createVirtualLabRoom,
    onSuccess: (created) => {
      setRoomId(created._id);
      setNewRoomName("");
      refreshRoom();
      toast.success("สร้างห้องแล้ว");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addInstrument = useMutation({
    mutationFn: ({ targetRoomId, targetMachineId }: { targetRoomId: string; targetMachineId: string }) =>
      api.addVirtualLabInstrument(targetRoomId, targetMachineId),
    onSuccess: () => {
      setMachineId("");
      refreshRoom();
      toast.success("เพิ่มเครื่องเข้าห้องแล้ว");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateInstrument = useMutation({
    mutationFn: ({
      instrument,
      patch,
    }: {
      instrument: VirtualLabInstrument;
      patch: Partial<Pick<VirtualLabInstrument, "x" | "y" | "status" | "note">>;
    }) => api.updateVirtualLabInstrument(room!._id, instrument._id, { ...patch, actor: user?.name ?? "system" }),
    onSuccess: refreshRoom,
    onError: (err: Error) => toast.error(err.message),
  });

  const removeInstrument = useMutation({
    mutationFn: (instrumentId: string) => api.deleteVirtualLabInstrument(room!._id, instrumentId),
    onSuccess: refreshRoom,
    onError: (err: Error) => toast.error(err.message),
  });

  const availableMachines = useMemo(() => {
    const used = new Set((room?.instruments ?? []).map((i) => i.machine?._id).filter(Boolean));
    return (machinesQuery.data ?? []).filter((m) => m._id && !used.has(m._id) && m.status !== "retired");
  }, [machinesQuery.data, room?.instruments]);

  const counts = useMemo(() => {
    const base = Object.fromEntries(STATUS_KEYS.map((s) => [s, 0])) as Record<VirtualLabStatus, number>;
    for (const item of room?.instruments ?? []) base[item.status] += 1;
    return base;
  }, [room?.instruments]);

  const busy = createRoom.isPending || addInstrument.isPending || updateInstrument.isPending || removeInstrument.isPending;

  return (
    <AppLayout title="Virtual Lab">
      <PageHeader
        className="mb-5"
        title="Virtual Lab"
        description="จำลองห้องและสถานะเครื่องมือจากรายการเครื่องจริงในระบบ"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="ชื่อห้อง"
              className="h-9 w-44"
            />
            <Button
              className="h-9 gap-2"
              disabled={busy || !newRoomName.trim()}
              onClick={() => createRoom.mutate(newRoomName)}
            >
              <Plus className="h-4 w-4" />
              สร้างห้อง
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={room?._id ?? ""}
            onChange={(e) => setRoomId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {rooms.map((r) => (
              <option key={r._id} value={r._id}>{r.name}</option>
            ))}
          </select>
          <select
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            className="h-9 min-w-64 rounded-md border border-input bg-background px-3 text-sm"
            disabled={!room || availableMachines.length === 0}
          >
            <option value="">เลือกเครื่องมือ</option>
            {availableMachines.map((machine) => (
              <option key={machine._id} value={machine._id}>{machineLabel(machine)}</option>
            ))}
          </select>
          <Button
            variant="outline"
            className="h-9 gap-2"
            disabled={!room || !machineId || busy}
            onClick={() => addInstrument.mutate({ targetRoomId: room!._id, targetMachineId: machineId })}
          >
            <Plus className="h-4 w-4" />
            เพิ่มเครื่อง
          </Button>
        </div>

        {room && (
          <div className="flex flex-wrap gap-2">
            {STATUS_KEYS.map((status) => (
              <Badge key={status} variant="outline" className={cn("gap-1", STATUS[status].className)}>
                {STATUS[status].label}: {counts[status]}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {roomsQuery.isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">กำลังโหลด Virtual Lab...</div>
      ) : !room ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          สร้างห้องแรกเพื่อเริ่มวางเครื่องมือ
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-h-[520px] rounded-md border bg-muted/20 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">{room.name}</h2>
              <span className="text-sm text-muted-foreground">{room.instruments.length} เครื่อง</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              {room.instruments.map((item) => (
                <article
                  key={item._id}
                  className="rounded-md border bg-background p-3 shadow-sm"
                  style={{ order: item.y * 10 + item.x }}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 shrink-0 text-primary" />
                        <h3 className="truncate text-sm font-semibold">{item.machine?.name ?? "Unknown machine"}</h3>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.machine?.code}{item.machine?.location ? ` · ${item.machine.location}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      disabled={busy}
                      onClick={() => removeInstrument.mutate(item._id)}
                      aria-label="นำเครื่องออก"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <Badge variant="outline" className={cn("mb-3", STATUS[item.status].className)}>
                    <Activity className="mr-1 h-3 w-3" />
                    {STATUS[item.status].label}
                  </Badge>

                  <div className="mb-3 grid grid-cols-2 gap-2">
                    {STATUS_KEYS.map((status) => (
                      <Button
                        key={status}
                        variant={item.status === status ? "default" : "outline"}
                        className="h-8 px-2 text-xs"
                        disabled={busy}
                        onClick={() => updateInstrument.mutate({ instrument: item, patch: { status } })}
                      >
                        {STATUS[status].label}
                      </Button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-muted-foreground">
                      Col
                      <Input
                        type="number"
                        min={1}
                        defaultValue={item.x}
                        className="mt-1 h-8"
                        onBlur={(e) => updateInstrument.mutate({ instrument: item, patch: { x: Number(e.target.value) } })}
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Row
                      <Input
                        type="number"
                        min={1}
                        defaultValue={item.y}
                        className="mt-1 h-8"
                        onBlur={(e) => updateInstrument.mutate({ instrument: item, patch: { y: Number(e.target.value) } })}
                      />
                    </label>
                  </div>

                  <Input
                    className="mt-2 h-8 text-xs"
                    defaultValue={item.note ?? ""}
                    placeholder="หมายเหตุ"
                    onBlur={(e) => updateInstrument.mutate({ instrument: item, patch: { note: e.target.value } })}
                  />
                  <p className="mt-2 text-[11px] text-muted-foreground">อัปเดตล่าสุด: {fmt(item.updatedAt)}</p>
                </article>
              ))}
            </div>
          </section>

          <aside className="rounded-md border bg-background p-4">
            <h2 className="mb-3 text-base font-semibold">Status Log</h2>
            <div className="space-y-3">
              {(logsQuery.data ?? []).length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มี log</p>
              )}
              {(logsQuery.data ?? []).map((log) => (
                <div key={log._id} className="border-b pb-3 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{log.machine?.code ?? ""} {log.machine?.name ?? ""}</p>
                    <Badge variant="outline" className={STATUS[log.newStatus].className}>
                      {STATUS[log.newStatus].label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {log.oldStatus || "-"} → {log.newStatus} · {fmt(log.createdAt)}
                  </p>
                  {log.actor && <p className="text-xs text-muted-foreground">โดย {log.actor}</p>}
                  {log.note && <p className="mt-1 text-xs">{log.note}</p>}
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </AppLayout>
  );
}
