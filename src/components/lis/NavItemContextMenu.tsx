import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Link2, Star, StarOff } from "lucide-react";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FavoriteMoveDirection } from "@/lib/favorites";

export type NavItemContextMenuProps = {
  path: string;
  isFavorite: boolean;
  /** true เมื่อ render อยู่ในกลุ่ม "รายการโปรด" — ปุ่มย้ายขึ้น/ลงโผล่เฉพาะตอนนี้ */
  inFavorites: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** ใส่เมื่อ sidebar พับเป็น rail — ไม่ใส่ = ไม่ครอบ tooltip */
  tooltip?: string;
  onToggleFavorite: () => void;
  onMove: (direction: FavoriteMoveDirection) => void;
  children: ReactNode;
};

// BASE_URL = "/" ตอน dev, "/LIS/" ตอน prod — ต่อกับ path ให้ได้ URL เต็มที่เปิด/คัดลอกได้จริง
function absoluteHref(path: string) {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  return `${base}${path}`;
}

async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // ตกไปใช้ fallback ข้างล่าง
  }
  // clipboard API ใช้ไม่ได้เมื่อไม่ใช่ secure context (เช่น http ภายในองค์กร)
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

const NavItemContextMenu = ({
  path,
  isFavorite,
  inFavorites,
  canMoveUp,
  canMoveDown,
  tooltip,
  onToggleFavorite,
  onMove,
  children,
}: NavItemContextMenuProps) => {
  const trigger = <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>;

  const handleOpenInNewTab = () => {
    window.open(absoluteHref(path), "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${absoluteHref(path)}`;
    const ok = await copyToClipboard(url);
    if (ok) toast.success("คัดลอกลิงก์แล้ว");
    else toast.error("คัดลอกลิงก์ไม่สำเร็จ");
  };

  return (
    <ContextMenu>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right">{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <ContextMenuContent className="w-56">
        <ContextMenuItem onSelect={onToggleFavorite}>
          {isFavorite ? (
            <StarOff className="mr-2 h-4 w-4" />
          ) : (
            <Star className="mr-2 h-4 w-4" />
          )}
          {isFavorite ? "เอาออกจากรายการโปรด" : "เพิ่มในรายการโปรด"}
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleOpenInNewTab}>
          <ExternalLink className="mr-2 h-4 w-4" />
          เปิดในแท็บใหม่
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleCopyLink}>
          <Link2 className="mr-2 h-4 w-4" />
          คัดลอกลิงก์
        </ContextMenuItem>
        {inFavorites && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem disabled={!canMoveUp} onSelect={() => onMove("up")}>
              <ArrowUp className="mr-2 h-4 w-4" />
              ย้ายขึ้น
            </ContextMenuItem>
            <ContextMenuItem disabled={!canMoveDown} onSelect={() => onMove("down")}>
              <ArrowDown className="mr-2 h-4 w-4" />
              ย้ายลง
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default NavItemContextMenu;
