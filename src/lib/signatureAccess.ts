import type { RoleHolder } from "@/lib/roles";
import { normalizeRoles } from "@/lib/roles";

export const SIGNATURE_DEVICE_UNSUPPORTED_MESSAGE = "โปรดเข้าใน Tablet, iPad หรือโทรศัพท์ของคุณ อุปกรณ์นี้ไม่รองรับ";

const SIGNATURE_ROLE_IDS = new Set(["admin", "lab-head", "qc-head"]);

export function canManageSignature(userOrRoles: RoleHolder | string[] | null | undefined): boolean {
  const roles = Array.isArray(userOrRoles) ? userOrRoles : normalizeRoles(userOrRoles);
  return roles.some((role) => SIGNATURE_ROLE_IDS.has(role));
}

export function isSignatureDeviceSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const ipadDesktopMode = platform === "MacIntel" && maxTouchPoints > 1;
  const mobileOrTabletUserAgent = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(userAgent);
  const coarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const touchCapable = maxTouchPoints > 0 || "ontouchstart" in window;

  return ipadDesktopMode || mobileOrTabletUserAgent || (coarsePointer && touchCapable);
}
