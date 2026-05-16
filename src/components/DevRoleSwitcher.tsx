import { useEffect, useRef, useState } from "react";
import { DEV_MODE } from "@/config/dev";
import { useAuth } from "@/context/AuthContext";

const STORAGE_KEY = "dev-role-switcher-pos";
const DRAG_THRESHOLD = 4;

type Pos = { x: number; y: number };

const loadPos = (): Pos | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.x === "number" && typeof p?.y === "number") return p;
  } catch {
    /* ignore */
  }
  return null;
};

const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), max);

export const DevRoleSwitcher = () => {
  const { devRole, devRoles, switchDevRole } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<Pos | null>(() => loadPos());
  const dragState = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!pos) return;
    const onResize = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos((prev) =>
        prev
          ? {
              x: clamp(prev.x, 0, window.innerWidth - rect.width),
              y: clamp(prev.y, 0, window.innerHeight - rect.height),
            }
          : prev,
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos]);

  if (!DEV_MODE || !switchDevRole || !devRole || !devRoles || devRoles.length === 0) return null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    setIsDragging(true);
    const el = containerRef.current;
    const rect = el?.getBoundingClientRect();
    const w = rect?.width ?? 0;
    const h = rect?.height ?? 0;
    setPos({
      x: clamp(drag.originX + dx, 0, window.innerWidth - w),
      y: clamp(drag.originY + dy, 0, window.innerHeight - h),
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    dragState.current = null;
    setIsDragging(false);
    if (drag?.moved && pos) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } catch {
        /* ignore */
      }
    }
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const positionStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : { right: 16, bottom: 16 };

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        ...positionStyle,
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
        userSelect: "none",
      }}
      className="fixed z-[9999] flex flex-col items-end gap-1 print:hidden"
    >
      <div
        title="ลากเพื่อย้ายตำแหน่ง"
        className="rounded-md border border-orange-400 bg-orange-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-600 shadow"
      >
        DEV MODE
      </div>
      <div className="flex gap-1 rounded-md border border-orange-300 bg-white p-1 shadow-md">
        {devRoles.map((role) => (
          <button
            key={role.id}
            onClick={() => switchDevRole(role.id)}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              devRole === role.id
                ? "bg-orange-500 text-white"
                : "text-gray-600 hover:bg-orange-100"
            }`}
          >
            {role.name}
          </button>
        ))}
      </div>
    </div>
  );
};
