import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";

const REMINDER_HOUR = 8;
const EXPECTED_SCALES = 5;
const STORAGE_PREFIX = "lis.dailyCheck.reminderShown.";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * เช็คทุกนาที — ถ้าเลย 8:00 และยังบันทึก Daily Check ไม่ครบ
 * push notification ครั้งเดียวต่อวัน (กันซ้ำด้วย localStorage)
 */
const DailyCheckReminderWatcher = () => {
  const { user } = useAuth();
  const { push, dismiss, notifications } = useNotifications();

  const { data: summary } = useQuery({
    queryKey: ["daily-checks", "today-summary"],
    queryFn: api.getDailyCheckTodaySummary,
    refetchInterval: 60_000,
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    if (!summary) return;

    const tick = () => {
      const now = new Date();
      const date = todayStr();
      const flagKey = `${STORAGE_PREFIX}${date}`;

      // วันนี้บันทึกครบแล้ว → ปลดแจ้งเตือน (ถ้ามี)
      if ((summary.scaleIds?.length ?? 0) >= EXPECTED_SCALES) {
        if (notifications.some(n => n.id === "daily-check-reminder")) {
          dismiss("daily-check-reminder");
        }
        return;
      }
      // ยังไม่ถึง 8:00
      if (now.getHours() < REMINDER_HOUR) return;
      // เคยแจ้งวันนี้แล้ว และผู้ใช้ลบทิ้งไปแล้ว → ไม่ rerun
      if (localStorage.getItem(flagKey) === "1") return;

      const exists = notifications.some(n => n.id === "daily-check-reminder");
      if (exists) return;

      push({
        id: "daily-check-reminder",
        title: "ถึงเวลา Daily Check",
        message: `กรุณาบันทึกผล Calibrate เครื่องชั่งประจำวัน (${summary.scaleIds?.length ?? 0}/${EXPECTED_SCALES} แล้ว)`,
        level: "warning",
        link: "/daily-check",
        persistent: true,
      });

      localStorage.setItem(flagKey, "1");
    };

    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [user, summary, notifications, push, dismiss]);

  return null;
};

export default DailyCheckReminderWatcher;
