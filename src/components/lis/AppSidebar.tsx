import { LayoutDashboard, Send, ClipboardList, FileBarChart, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "แดชบอร์ด", active: true },
  { icon: Send, label: "ส่งตัวอย่างตรวจ", active: false },
  { icon: ClipboardList, label: "บันทึกผลการทดสอบ", active: false },
  { icon: FileBarChart, label: "รายงานสรุป", active: false },
  { icon: Settings, label: "ตั้งค่าระบบ", active: false },
];

const AppSidebar = () => {
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

      {/* User */}
      <div className="p-3 mt-auto">
        <div className="flex items-center gap-3 bg-lis-sidebar text-lis-sidebar-fg rounded-lg px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-lis-sidebar-active flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">แอดมิน</p>
            <p className="text-xs opacity-80">Laboratory Manager</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
