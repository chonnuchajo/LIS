import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { audiencesForUser, readSeeAll, SEE_ALL_EVENT } from "@/lib/petitionAudience";
import { cursorKey, effectiveSeeAll, nextCursor, readCursor } from "@/lib/petitionFlowWatcher";

/**
 * Poll ความเคลื่อนไหวของคำขอทุกนาทีแล้วยิงเข้ากระดิ่ง
 * cursor เดินหน้าเฉพาะตอน query สำเร็จ — เน็ตกระตุกแล้วต้องไม่กลืน event ที่ยังไม่เคยแสดง
 */
const PetitionFlowWatcher = () => {
  const { user } = useAuth();
  const { push } = useNotifications();
  const [seeAllRaw, setSeeAllRaw] = useState(() => readSeeAll());
  const seeAll = effectiveSeeAll(user, seeAllRaw);

  useEffect(() => {
    const sync = () => setSeeAllRaw(readSeeAll());
    window.addEventListener(SEE_ALL_EVENT, sync);
    return () => window.removeEventListener(SEE_ALL_EVENT, sync);
  }, []);

  const audiences = useMemo(() => audiencesForUser(user), [user]);
  const employeeId = user?.employeeId;
  const enabled = !!user && (audiences.length > 0 || !!employeeId || seeAll);

  const { data } = useQuery({
    queryKey: ["petition-notifications", employeeId ?? "", audiences.join(","), seeAll],
    queryFn: () =>
      api.getPetitionNotifications({
        since: readCursor(employeeId),
        audiences,
        employeeId,
        all: seeAll,
      }),
    refetchInterval: 60_000,
    enabled,
  });

  useEffect(() => {
    if (!data) return;
    // server เรียงใหม่→เก่า; push ทีละอันแบบกลับด้าน เพื่อให้อันใหม่สุดไปอยู่หัวลิสต์
    for (const item of [...data.items].reverse()) {
      push({
        id: item.id,
        title: item.title,
        message: item.message,
        level: item.level,
        link: item.link,
        createdAt: new Date(item.createdAt).getTime(),
        persistent: true,
        group: "petition",
      });
    }
    try {
      const key = cursorKey(employeeId);
      const stored = localStorage.getItem(key);
      localStorage.setItem(key, nextCursor(stored, data.serverTime));
    } catch {
      // private mode — รอบหน้าจะดึงย้อนหลัง 24 ชม.ใหม่ ซึ่ง push กันซ้ำด้วย id อยู่แล้ว
    }
  }, [data, employeeId, push]);

  return null;
};

export default PetitionFlowWatcher;
