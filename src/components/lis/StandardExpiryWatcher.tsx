// Poll standard ที่กำลังใช้งานทุกนาที แล้ว sync เข้ากระดิ่ง:
// - ใกล้ครบกำหนด/หมดอายุ → push (id เดิมซ้ำไม่ถูก push ซ้ำ)
// - id ของกลุ่มนี้ที่ไม่อยู่ในรอบล่าสุดแล้ว → dismiss
// การ dismiss คือกลไก "คนเบิกกดรับทราบแล้วหายจากกระดิ่งของทุกคน" — แถวที่ปิดแล้ว
// จะหลุดจาก endpoint เอง ไม่ต้องเก็บสถานะอ่านแล้วรายคนที่ server
//
// ⚠️ ต้องใช้ ref เก็บ id ที่เคย push แล้ว แทนการอ่าน `notifications` จาก context ตรงๆ:
// ถ้า deps ผูกกับ `notifications`, กด X หรือ "ลบทั้งหมด" บนกระดิ่ง (NotificationBell) จะทำให้
// effect รันใหม่ทั้งที่ data เดิม → แถวยังหมดอายุอยู่ → planInUseNotifications คำนวณ push
// อันเดิมกลับมาอีก (มันหลุดจาก notifications ไปแล้วก็จริง แต่ผ่าน push() แล้วจะถูกเพิ่มกลับเข้า
// context อีกรอบ กลายเป็น unread ใหม่) — ปิดแจ้งเตือนไม่ได้เลยตราบใดที่แถวยังไม่ resolve
// ref นี้แยกอิสระจาก context: ลบออกจาก ref เฉพาะตอน reconcile บอกว่าแถวนั้นไม่ live แล้ว
// (หมดอายุ→resolve, หรือเปลี่ยนสถานะเป็น id อื่น) ไม่ใช่ตอนผู้ใช้กด dismiss เอง
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { api } from "@/lib/api";
import { IN_USE_NOTIFICATION_GROUP, planInUseNotifications } from "@/lib/standardInUse";

const StandardExpiryWatcher = () => {
  const { user } = useAuth();
  const { push, dismiss } = useNotifications();
  // id ที่ watcher นี้เคย push ไปแล้วและยังถือว่า "ยัง live" — ไม่ใช่สถานะอ่าน/ลบของผู้ใช้
  const pushedIdsRef = useRef<Set<string>>(new Set());

  const { data } = useQuery({
    queryKey: ["stock", "in-use"],
    queryFn: api.getStandardsInUse,
    refetchInterval: 60_000,
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (!data) return;
    const now = new Date(data.serverTime || Date.now());
    const plan = planInUseNotifications(data.items, now, [...pushedIdsRef.current]);
    for (const n of plan.push) {
      if (pushedIdsRef.current.has(n.id)) continue; // เคย push แล้ว ไม่ push ซ้ำ (กันชุบชีวิตอันที่ผู้ใช้ dismiss ไปแล้ว)
      pushedIdsRef.current.add(n.id);
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
    for (const id of plan.dismiss) {
      pushedIdsRef.current.delete(id); // หลุดจาก live แล้ว — ถ้าเกิดใหม่ภายหลังต้อง push ได้อีก
      dismiss(id);
    }
  }, [data, push, dismiss]);

  return null;
};

export default StandardExpiryWatcher;
