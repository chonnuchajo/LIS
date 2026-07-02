import { getRoomBySlug } from "@/lib/dailyCheckRooms";
import { getRoomCatalog } from "@/lib/roomEquipment";

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

export const fmtDate = (s: string) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

export const roomLabel = (slug: string) => getRoomBySlug(slug)?.label ?? slug;

export const roomFilterLabel = (room: string) =>
  room === "all" ? "ทุกห้อง" : roomLabel(room);

export const statusFilterLabel = (status: string) =>
  status === "normal" ? "ปกติ" : status === "abnormal" ? "ผิดปกติ" : "ทั้งหมด";

export const instrumentFilterLabel = (room: string, instrumentId: string) => {
  if (instrumentId === "all") return "ทั้งหมด";
  const inst = getRoomCatalog(room)?.instruments.find((i) => i.id === instrumentId);
  return inst ? `${inst.name} (${inst.id})` : instrumentId;
};

export const dateFilterLabel = (date: string) => (date ? fmtDate(date) : "ทุกวัน");
