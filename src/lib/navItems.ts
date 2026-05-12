import {
  ClipboardList,
  Database,
  Download,
  FileBarChart,
  FileText,
  FlaskConical,
  Home,
  LayoutDashboard,
  LockKeyhole,
  Package,
  Scale,
  Settings,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  icon: LucideIcon;
  label: string;
  path: string;
};

export const NAV_ITEMS: NavItem[] = [
  { icon: Home, label: "หน้าแรก", path: "/home" },
  { icon: LayoutDashboard, label: "แดชบอร์ด", path: "/" },
  { icon: FileText, label: "รายการคำร้อง", path: "/petitions" },
  { icon: Download, label: "การรับตัวอย่าง", path: "/send-sample" },
  { icon: FlaskConical, label: "การตรวจกายภาพ", path: "/physical-inspection" },
  { icon: ClipboardList, label: "ผลวิเคราะห์", path: "/record-results" },
  { icon: ClipboardList, label: "การบันทึก Standard", path: "/stock-deduction" },
  { icon: Scale, label: "Daily Check", path: "/daily-check" },
  { icon: FileBarChart, label: "รายงานสรุป", path: "/report" },
  { icon: ShieldCheck, label: "อนุมัติผล QC", path: "/qc-approval" },
  { icon: UserCheck, label: "Assign คำร้อง", path: "/petitions/assign" },
  { icon: Package, label: "Stock Management", path: "/stock" },
  { icon: Database, label: "Master Item", path: "/master-items" },
  { icon: Database, label: "Admin Data", path: "/admin-data" },
  { icon: LockKeyhole, label: "Access Control", path: "/access-control" },
  { icon: Settings, label: "ตั้งค่าระบบ", path: "/settings" },
];
