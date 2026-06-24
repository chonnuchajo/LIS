import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiRouteInfo } from "@/lib/api";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-700",
  POST: "bg-blue-100 text-blue-700",
  PUT: "bg-amber-100 text-amber-700",
  PATCH: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
};

export default function ApiRoutesCard() {
  const { data: routes = [], isLoading, isError } = useQuery({
    queryKey: ["api-routes"],
    queryFn: api.getApiRoutes,
  });
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter(
      (r) => r.path.toLowerCase().includes(q) || r.method.toLowerCase().includes(q),
    );
  }, [routes, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, ApiRouteInfo[]>();
    for (const r of filtered) {
      const seg = r.path.replace(/^\/api\//, "").split("/")[0] || "(root)";
      if (!map.has(seg)) map.set(seg, []);
      map.get(seg)!.push(r);
    }
    return Array.from(map.entries());
  }, [filtered]);

  if (isLoading) return <p className="text-sm text-muted-foreground">กำลังโหลด…</p>;
  if (isError) return <p className="text-sm text-red-600">โหลดรายการ API ไม่สำเร็จ</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        รายการ API endpoint ทั้งหมดของ backend (read-only) — สำหรับ admin
      </p>
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="ค้นหา path หรือ method…"
          className="w-full max-w-sm rounded-md border px-3 py-1.5 text-sm"
        />
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {filtered.length} / {routes.length} endpoint
        </span>
      </div>
      <div className="space-y-4">
        {groups.map(([seg, items]) => (
          <div key={seg}>
            <h3 className="mb-1 text-sm font-semibold text-foreground">{seg}</h3>
            <ul className="divide-y rounded-md border">
              {items.map((r) => (
                <li
                  key={`${r.method} ${r.path}`}
                  className="flex items-center gap-3 px-3 py-1.5"
                >
                  <span
                    className={`inline-block w-16 rounded px-2 py-0.5 text-center text-xs font-semibold ${
                      METHOD_COLORS[r.method] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {r.method}
                  </span>
                  <code className="text-sm">{r.path}</code>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground">ไม่พบ endpoint ที่ตรงกับการค้นหา</p>
        )}
      </div>
    </div>
  );
}
