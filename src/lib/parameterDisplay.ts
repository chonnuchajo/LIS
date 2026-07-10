// Shared display metadata for Parameter UI (list page + detail drawer).
import {
  Hash,
  Image as ImageIcon,
  Link2,
  List as ListIcon,
  Paperclip,
  Timer as TimerIcon,
  Type as TypeIcon,
} from "lucide-react";

import type { ParameterScope, ParameterValueFieldType } from "@/lib/api";
import { productTypeLabels } from "@/lib/productClassification";

export const SCOPE_LABEL: Record<ParameterScope, string> = {
  lab: "Lab",
  qc: "QC",
};

export const SCOPE_BADGE_CLASS: Record<ParameterScope, string> = {
  lab: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  qc: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100",
};

export const FIELD_TYPE_META: Record<
  ParameterValueFieldType,
  {
    label: string;
    Icon: typeof TypeIcon;
    accent: string;
    tint: string;
    text: string;
    iconText: string;
  }
> = {
  text: {
    label: "ข้อความ",
    Icon: TypeIcon,
    accent: "bg-slate-400",
    tint: "bg-slate-50/60",
    text: "text-slate-700",
    iconText: "text-slate-500",
  },
  number: {
    label: "จำนวนเต็ม",
    Icon: Hash,
    accent: "bg-blue-500",
    tint: "bg-blue-50/50",
    text: "text-blue-700",
    iconText: "text-blue-500",
  },
  float: {
    label: "ทศนิยม",
    Icon: Hash,
    accent: "bg-blue-500",
    tint: "bg-blue-50/50",
    text: "text-blue-700",
    iconText: "text-blue-500",
  },
  enum: {
    label: "ตัวเลือก",
    Icon: ListIcon,
    accent: "bg-violet-500",
    tint: "bg-violet-50/50",
    text: "text-violet-700",
    iconText: "text-violet-500",
  },
  timer: {
    label: "จับเวลา",
    Icon: TimerIcon,
    accent: "bg-amber-500",
    tint: "bg-amber-50/50",
    text: "text-amber-700",
    iconText: "text-amber-500",
  },
  photo: {
    label: "ภาพถ่าย",
    Icon: ImageIcon,
    accent: "bg-pink-500",
    tint: "bg-pink-50/50",
    text: "text-pink-700",
    iconText: "text-pink-500",
  },
  file: {
    label: "แนบไฟล์",
    Icon: Paperclip,
    accent: "bg-teal-500",
    tint: "bg-teal-50/50",
    text: "text-teal-700",
    iconText: "text-teal-500",
  },
  reference: {
    label: "อ้างอิง",
    Icon: Link2,
    accent: "bg-emerald-500",
    tint: "bg-emerald-50/50",
    text: "text-emerald-700",
    iconText: "text-emerald-500",
  },
};

export type OptionFilter = {
  itemNames?: string[];
  commonNames?: string[];
  productTypes?: string[];
  categories?: string[];
  subCategories?: string[];
  itemGroups?: string[];
};

export function summarizeOptionFilter(
  f: OptionFilter | undefined,
  groupNameById?: Map<string, string>,
): string {
  if (!f) return '';
  const parts: string[] = [];
  if ((f.itemNames?.length ?? 0) > 0) {
    parts.push(`item: ${(f.itemNames ?? []).slice(0, 2).join('/')}${(f.itemNames?.length ?? 0) > 2 ? `+${(f.itemNames?.length ?? 0) - 2}` : ''}`);
  }
  if ((f.commonNames?.length ?? 0) > 0) {
    parts.push(`common: ${(f.commonNames ?? []).slice(0, 3).join('/')}`);
  }
  if ((f.productTypes?.length ?? 0) > 0) {
    parts.push((f.productTypes ?? []).map((p) => productTypeLabels[p] ?? p).join('/'));
  }
  if ((f.categories?.length ?? 0) > 0) {
    parts.push((f.categories ?? []).join('/'));
  }
  if ((f.subCategories?.length ?? 0) > 0) {
    parts.push(`sub: ${(f.subCategories ?? []).slice(0, 3).join('/')}`);
  }
  if ((f.itemGroups?.length ?? 0) > 0) {
    const names = (f.itemGroups ?? []).map((id) => groupNameById?.get(id)).filter(Boolean) as string[];
    parts.push(names.length > 0 ? `กลุ่ม: ${names.slice(0, 3).join('/')}` : `กลุ่ม: ${(f.itemGroups ?? []).length}`);
  }
  return parts.join(' · ');
}
