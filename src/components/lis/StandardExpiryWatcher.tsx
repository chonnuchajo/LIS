// Poll standard ที่กำลังใช้งานทุกนาที แล้ว sync เข้ากระดิ่ง:
// - ใกล้ครบกำหนด/หมดอายุ → push (id เดิมซ้ำไม่ถูก push ซ้ำ)
// - id ของกลุ่มนี้ที่ไม่อยู่ในรอบล่าสุดแล้ว → dismiss
// การ dismiss คือกลไก "คนเบิกกดรับทราบแล้วหายจากกระดิ่งของทุกคน" — แถวที่ปิดแล้ว
// จะหลุดจาก endpoint เอง ไม่ต้องเก็บสถานะอ่านแล้วรายคนที่ server
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { api } from "@/lib/api";
import { IN_USE_NOTIFICATION_GROUP, planInUseNotifications } from "@/lib/standardInUse";

const StandardExpiryWatcher = () => {
  const { user } = useAuth();
  const { notifications, push, dismiss } = useNotifications();

  const { data } = useQuery({
    queryKey: ["stock", "in-use"],
    queryFn: api.getStandardsInUse,
    refetchInterval: 60_000,
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (!data) return;
    const now = new Date(data.serverTime || Date.now());
    const plan = planInUseNotifications(data.items, now, notifications.map((n) => n.id));
    for (const n of plan.push) {
      push({
        id: n.id,
        title: n.title,
        message: n.message,
        level: n.level,
        link: "/stock-deduction",
        persistent: true,
        group: IN_USE_NOTIFICATION_GROUP,
      });
    }
    for (const id of plan.dismiss) dismiss(id);
  }, [data, notifications, push, dismiss]);

  return null;
};

export default StandardExpiryWatcher;
