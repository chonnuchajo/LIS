import { Beaker, FileDown, FlaskConical, Microscope, Scale, Thermometer } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface DailyCheckRoom {
  /** URL segment under /daily-check */
  slug: string;
  /** Full route path */
  route: string;
  /** Thai room name (matches the Forms/ folder) */
  label: string;
  icon: LucideIcon;
  /** Form names shown as a faint "coming soon" preview on placeholder pages */
  forms: string[];
  /** true once the room has real content; false while it is a placeholder */
  ready: boolean;
}

export const DAILY_CHECK_BASE = "/daily-check";

const room = (
  slug: string,
  label: string,
  icon: LucideIcon,
  forms: string[],
  ready = false,
): DailyCheckRoom => ({
  slug,
  route: `${DAILY_CHECK_BASE}/${slug}`,
  label,
  icon,
  forms,
  ready,
});

export const DAILY_CHECK_ROOMS: DailyCheckRoom[] = [
  room(
    "balance",
    "ห้องเครื่องชั่ง",
    Scale,
    [
      "อุณหภูมิ/ความชื้น (ห้องชั่งสาร)",
      "Dry cabinet",
      "เครื่องชั่ง 2 ตำแหน่ง",
      "เครื่องชั่ง 4 ตำแหน่ง",
      "เครื่องชั่ง 5 ตำแหน่ง",
      "Hood",
    ],
    true,
  ),
  room("sample-prep", "ห้องเตรียมตัวอย่าง", Beaker, [
    "อุณหภูมิ/ความชื้น",
    "Ultrasonic / Ultrasonic Cleaner",
    "Asirator pump",
    "Desiccator",
    "Hotplate",
    "Magnetic stirrer",
    "Oven",
    "pH Meter",
    "Water bath",
    "milli-Q",
    "Hood",
    "Density",
  ], true),
  room("analysis", "ห้องวิเคราะห์", Microscope, [
    "อุณหภูมิ/ความชื้น (ห้องวิเคราะห์)",
    "GC 7890A",
    "GC 8850",
    "GC 8890",
    "HPLC 1260 Infinity III",
    "HPLC Agilent 1260",
  ]),
  room("extraction", "ห้องสกัด", FlaskConical, [
    "Asirator pump",
    "Cooling",
    "Desiccator",
    "Heating mantle",
    "Magnetic stirrer",
  ]),
];

export const getRoomBySlug = (slug: string): DailyCheckRoom | undefined =>
  DAILY_CHECK_ROOMS.find((r) => r.slug === slug);

export interface DailyCheckTab {
  route: string;
  label: string;
  icon: LucideIcon;
}

// ลำดับแท็บ: อุณหภูมิ/ความชื้น (รวมทุกห้อง) → ห้องแยก → โหลดเอกสาร
export const DAILY_CHECK_TABS: DailyCheckTab[] = [
  { route: `${DAILY_CHECK_BASE}/environment`, label: "อุณหภูมิ/ความชื้น", icon: Thermometer },
  ...DAILY_CHECK_ROOMS.map((r) => ({ route: r.route, label: r.label, icon: r.icon })),
  { route: `${DAILY_CHECK_BASE}/documents`, label: "โหลดเอกสาร", icon: FileDown },
];
