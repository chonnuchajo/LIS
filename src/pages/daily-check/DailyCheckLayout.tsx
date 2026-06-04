import { Outlet, useLocation, useNavigate } from "react-router-dom";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { cn } from "@/lib/utils";
import { DAILY_CHECK_TABS } from "@/lib/dailyCheckRooms";

const TABS = DAILY_CHECK_TABS;

const DailyCheckLayout = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <AppLayout title="Daily Check">
      <PageHeader
        className="mb-4"
        title="Daily Check"
        description="ตรวจเช็กประจำวันแยกตามห้องปฏิบัติการ"
      />

      <div
        role="tablist"
        aria-label="ห้องปฏิบัติการ"
        className="mb-6 flex flex-wrap gap-1.5 border-b border-border pb-3"
      >
        {TABS.map((tab) => {
          const active = pathname === tab.route;
          return (
            <button
              key={tab.route}
              role="tab"
              aria-selected={active}
              onClick={() => navigate(tab.route)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <Outlet />
    </AppLayout>
  );
};

export default DailyCheckLayout;
