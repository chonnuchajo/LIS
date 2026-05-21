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
  Monitor,
  Package,
  Pencil,
  Scale,
  ScanLine,
  Settings,
  SlidersHorizontal,
  ShieldCheck,
  UserCheck,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  icon: LucideIcon;
  label: string;
  path: string;
};

export const NAV_ITEMS: NavItem[] = [
  { icon: Home, label: "หน้าแรก", path: "/home" },
  { icon: LayoutDashboard, label: "Lab Dashboard", path: "/dashboard/lab" },
  { icon: LayoutDashboard, label: "QC Dashboard", path: "/dashboard/qc" },
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
  { icon: FlaskConical, label: "Simple Method", path: "/simple-method" },
  { icon: Wrench, label: "รายการเครื่อง", path: "/machines" },
  { icon: Database, label: "Admin Data", path: "/admin-data" },
  { icon: SlidersHorizontal, label: "พารามิเตอร์ตรวจสอบ", path: "/parameter-settings" },
  { icon: LockKeyhole, label: "Access Control", path: "/access-control" },
  { icon: Settings, label: "ตั้งค่าระบบ", path: "/settings" },
];

export const PAGE_ITEMS: NavItem[] = [
  ...NAV_ITEMS,
  { icon: FileText, label: "New Petition", path: "/petitions/new" },
  { icon: FileText, label: "Petition Detail", path: "/petitions/:id" },
  { icon: Pencil, label: "Edit Petition", path: "/petitions/:id/edit" },
  { icon: ScanLine, label: "Scanner", path: "/scanner" },
  { icon: Monitor, label: "Lab Queue TV", path: "/queue/lab" },
  { icon: Monitor, label: "QC Queue TV", path: "/queue/qc" },
];
