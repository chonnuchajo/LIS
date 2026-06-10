import {
  sectionCatalog,
  resolveSections,
  KPI_CATALOG,
  type DashboardId,
  type DashboardLayout,
} from "@/lib/dashboardLayout";

interface Props {
  dashboard: DashboardId;
  layout: DashboardLayout;
}

// Box wireframe of the dashboard. Mirrors the real render rule:
// rightRail enabled AND immediately after primaryTable → side column;
// otherwise full-width stacked. header always pinned top.
export default function DashboardLayoutPreview({ dashboard, layout }: Props) {
  const catalog = sectionCatalog(dashboard);
  const labelOf = (id: string) => catalog.find((c) => c.id === id)?.label ?? id;
  const ordered = resolveSections(dashboard, layout).filter((s) => s.enabled);

  const rows: JSX.Element[] = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const s = ordered[i];
    if (s.id === "rightRail") {
      // Side column when immediately after primaryTable (rendered in that row);
      // otherwise a full-width block at its own order position.
      if (ordered[i - 1]?.id === "primaryTable") continue;
      rows.push(
        <div
          key="rightRail"
          className="rounded-md border border-dashed border-slate-300 bg-slate-100 px-3 py-3 text-center text-xs text-slate-500"
        >
          {labelOf("rightRail")}
        </div>,
      );
      continue;
    }

    if (s.id === "primaryTable") {
      const next = ordered[i + 1];
      const railAdjacent = next?.id === "rightRail";
      rows.push(
        <div key="primaryTable" className="flex gap-2">
          <div className="flex-1 rounded-md border border-dashed border-slate-300 bg-slate-100 px-3 py-6 text-center text-xs text-slate-500">
            {labelOf("primaryTable")}
          </div>
          {railAdjacent && (
            <div className="w-24 rounded-md border border-dashed border-slate-300 bg-slate-100 px-2 py-6 text-center text-[10px] text-slate-500">
              {labelOf("rightRail")}
            </div>
          )}
        </div>,
      );
      continue;
    }

    if (s.id === "kpi") {
      rows.push(
        <div key="kpi" className="grid grid-cols-4 gap-2">
          {KPI_CATALOG.map((k) => {
            const on = layout.kpis[k.id];
            return (
              <div
                key={k.id}
                className={`rounded-md border border-dashed px-2 py-3 text-center text-[10px] ${
                  on
                    ? "border-slate-300 bg-slate-100 text-slate-500"
                    : "border-slate-200 bg-slate-50 text-slate-300 line-through"
                }`}
              >
                {k.label}
              </div>
            );
          })}
        </div>,
      );
      continue;
    }

    // header, completed, or a non-adjacent rightRail → full-width block
    rows.push(
      <div
        key={s.id}
        className="rounded-md border border-dashed border-slate-300 bg-slate-100 px-3 py-3 text-center text-xs text-slate-500"
      >
        {labelOf(s.id)}
      </div>,
    );
  }

  return <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">{rows}</div>;
}
