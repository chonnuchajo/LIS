import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayoutPreview from "@/components/lis/DashboardLayoutPreview";
import { api } from "@/lib/api";
import {
  DASHBOARD_IDS,
  DEFAULT_ROLE_ID,
  FORCED_SECTIONS,
  KPI_CATALOG,
  defaultLayout,
  resolveSections,
  resolveKpis,
  sectionCatalog,
  type DashboardId,
  type DashboardLayout,
  type KpiId,
  type SectionId,
} from "@/lib/dashboardLayout";

interface RoleOption {
  id: string;
  name: string;
}

interface Props {
  roles: RoleOption[];
}

export default function DashboardLayoutConfigCard({ roles }: Props) {
  const queryClient = useQueryClient();
  const [dashboard, setDashboard] = useState<DashboardId>("lab");
  const [roleId, setRoleId] = useState<string>(DEFAULT_ROLE_ID);

  const { data: configs = [] } = useQuery({
    queryKey: ["dashboard-layout", dashboard],
    queryFn: () => api.getDashboardLayouts(dashboard),
    staleTime: 60_000,
  });

  // The layout currently being edited (local, unsaved).
  const [draft, setDraft] = useState<DashboardLayout>(() => defaultLayout("lab"));

  // Reload the draft only when the selection changes or the selected role's stored
  // config actually changes by content — keying on `storedKey` (not the `configs`
  // array identity) keeps unsaved edits from being wiped by an incidental refetch.
  const stored = configs.find((c) => c.roleId === roleId) ?? null;
  const storedKey = JSON.stringify(stored);
  useEffect(() => {
    setDraft({
      sections: resolveSections(dashboard, stored),
      kpis: resolveKpis(stored),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard, roleId, storedKey]);

  const catalog = useMemo(() => sectionCatalog(dashboard), [dashboard]);
  const labelOf = (id: SectionId) => catalog.find((c) => c.id === id)?.label ?? id;
  const defOf = (id: SectionId) => catalog.find((c) => c.id === id);

  const toggleSection = (id: SectionId) => {
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    }));
  };

  const move = (id: SectionId, dir: -1 | 1) => {
    setDraft((d) => {
      const arr = [...d.sections].sort((a, b) => a.order - b.order);
      const idx = arr.findIndex((s) => s.id === id);
      const target = idx + dir;
      // header is pinned at index 0; never swap into/over it.
      if (idx <= 0 || target <= 0 || target >= arr.length) return d;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...d, sections: arr.map((s, i) => ({ ...s, order: i })) };
    });
  };

  const toggleKpi = (id: KpiId) => {
    setDraft((d) => ({ ...d, kpis: { ...d.kpis, [id]: !d.kpis[id] } }));
  };

  const saveMutation = useMutation({
    mutationFn: () => api.updateDashboardLayout(dashboard, roleId, draft),
    onSuccess: () => {
      toast.success("บันทึก layout แดชบอร์ดแล้ว");
      queryClient.invalidateQueries({ queryKey: ["dashboard-layout", dashboard] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    },
  });

  const sectionsInOrder = [...draft.sections].sort((a, b) => a.order - b.order);
  const kpiEnabled = draft.sections.find((s) => s.id === "kpi")?.enabled ?? true;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Controls */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={dashboard} onValueChange={(v) => setDashboard(v as DashboardId)}>
            <TabsList>
              {DASHBOARD_IDS.map((d) => (
                <TabsTrigger key={d} value={d}>
                  {d === "lab" ? "Lab" : "QC"}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger className="h-9 w-56">
              <SelectValue placeholder="เลือก role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_ROLE_ID}>ค่ามาตรฐาน (default)</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Section list */}
        <div className="space-y-2">
          {sectionsInOrder.map((s) => {
            const def = defOf(s.id);
            const forced = FORCED_SECTIONS.includes(s.id);
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={!def?.reorderable || s.id === "header"}
                    onClick={() => move(s.id, -1)}
                    aria-label="เลื่อนขึ้น"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={!def?.reorderable || s.id === "header"}
                    onClick={() => move(s.id, 1)}
                    aria-label="เลื่อนลง"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <span className="flex-1 text-sm">{labelOf(s.id)}</span>
                <Switch
                  checked={s.enabled}
                  disabled={forced}
                  onCheckedChange={() => toggleSection(s.id)}
                  title={forced ? "ส่วนนี้ต้องแสดงเสมอ" : undefined}
                />
              </div>
            );
          })}
        </div>

        {/* KPI sub-toggles */}
        <div className={kpiEnabled ? "" : "opacity-50 pointer-events-none"}>
          <p className="mb-2 text-xs font-medium text-muted-foreground">KPI ที่แสดง</p>
          <div className="grid grid-cols-2 gap-2">
            {KPI_CATALOG.map((k) => (
              <label key={k.id} className="flex items-center gap-2 text-sm">
                <Switch checked={draft.kpis[k.id]} onCheckedChange={() => toggleKpi(k.id)} />
                {k.label}
              </label>
            ))}
          </div>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </div>

      {/* Live wireframe */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">ตัวอย่างผังหน้าจอ</p>
        <DashboardLayoutPreview dashboard={dashboard} layout={draft} />
      </div>
    </div>
  );
}
