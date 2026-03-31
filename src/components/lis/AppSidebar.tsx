import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Send, Download, ClipboardList, FileBarChart, Settings, User, LogOut, Package, ShieldCheck, Database, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const navItems = [
  { icon: LayoutDashboard, label: "แดชบอร์ด", path: "/" },
  { icon: Send, label: "การส่งตัวอย่าง", path: "/sending-sample" },
  { icon: FlaskConical, label: "การตรวจกายภาพ", path: "/physical-inspection" },
  { icon: Download, label: "การรับตัวอย่าง", path: "/send-sample" },
  { icon: ClipboardList, label: "การบันทึก Standard", path: "/stock-deduction" },
  { icon: ClipboardList, label: "บันทึกผลการทดสอบ", path: "/record-results" },
  { icon: ShieldCheck, label: "อนุมัติผล QC", path: "/qc-approval" },
  { icon: FileBarChart, label: "รายงานสรุป", path: "/report" },
  { icon: Package, label: "Stock Management", path: "/stock" },
  { icon: Database, label: "Admin Data", path: "/admin-data" },
  { icon: Settings, label: "ตั้งค่าระบบ", path: "/settings" },
];

const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    toast.success("ออกจากระบบสำเร็จ");
    navigate("/login");
  };

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-card border-r border-border">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">ICP</span>
        </div>
        <div>
          <h1 className="font-bold text-foreground text-lg leading-tight">LIS</h1>
          <p className="text-[10px] text-muted-foreground leading-tight tracking-wider">
            LAB INFORMATION<br />SYSTEM
          </p>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-3 mt-auto space-y-2">
        <div className="flex items-center gap-3 bg-accent rounded-lg px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <User className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">แอดมิน</p>
            <p className="text-xs text-muted-foreground">Laboratory Manager</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
