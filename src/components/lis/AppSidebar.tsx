import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Send, ClipboardList, FileBarChart, Settings, User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const navItems = [
  { icon: LayoutDashboard, label: "แดชบอร์ด", active: true, action: "dashboard" },
  { icon: Send, label: "ส่งตัวอย่างตรวจ", active: false, action: "send" },
  { icon: ClipboardList, label: "บันทึกผลการทดสอบ", active: false, action: "record" },
  { icon: FileBarChart, label: "รายงานสรุป", active: false, action: "report" },
  { icon: Settings, label: "ตั้งค่าระบบ", active: false, action: "settings" },
];

const AppSidebar = () => {
  const navigate = useNavigate();

  const handleNav = (action: string) => {
    if (action === "dashboard") return;
    toast.info(`เปิดหน้า: ${navItems.find(i => i.action === action)?.label}`);
  };

  const handleLogout = () => {
    toast.success("ออกจากระบบสำเร็จ");
    navigate("/login");
  };

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-card border-r border-border">
      {/* Logo */}
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

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => handleNav(item.action)}
            className={cn(
              "flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors",
              item.active
                ? "bg-lis-sidebar text-lis-sidebar-fg shadow-md"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="p-3 mt-auto space-y-2">
        <div className="flex items-center gap-3 bg-lis-sidebar text-lis-sidebar-fg rounded-lg px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-lis-sidebar-active flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">แอดมิน</p>
            <p className="text-xs opacity-80">Laboratory Manager</p>
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
