import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * เมื่อ navigate มาหน้านี้พร้อม `state: { flash: true }` จะ wash พื้นหลัง container
 * เป็นสีฟ้าแปปหนึ่ง แล้วค่อย ๆ จางกลับมาปกติภายใน 3 วินาที
 * คืน className สำหรับ spread ไปที่ container ของหน้า
 */
export function useArrivalFlash() {
  const location = useLocation();
  const [flashing, setFlashing] = useState<boolean>(
    () => Boolean((location.state as { flash?: boolean } | null)?.flash),
  );

  useEffect(() => {
    if (!flashing) return;
    // เคลียร์ nav state กัน refresh/back แล้ว flash ซ้ำ
    window.history.replaceState({ ...window.history.state, usr: null }, "");
    // เริ่ม flash สีฟ้าทันทีตอน paint แรก แล้วเฟรมถัดไปสั่งให้จางกลับ (transition 3s)
    const id = window.setTimeout(() => setFlashing(false), 50);
    return () => window.clearTimeout(id);
  }, [flashing]);

  return cn(
    "transition-colors [transition-duration:3000ms] ease-out rounded-lg",
    flashing ? "bg-sky-100" : "bg-transparent",
  );
}

/**
 * เวอร์ชันสำหรับหน้า list: navigate มาพร้อม `state: { flashId }` แล้วคืน id ของแถว
 * ที่ต้อง flash สีฟ้า (ใช้คู่กับ animate-flash-bg) — ไฮไลต์แถวคำร้องที่เพิ่งคลิกมา
 * เพื่อให้ผู้ใช้รู้ว่าต้องสแกนรับอันไหน animation เริ่มตอนแถวถูก render จริง
 * จึงไม่พลาดแม้ข้อมูลจะโหลดทีหลัง
 */
export function useArrivalFlashId(): string | null {
  const location = useLocation();
  const [flashId] = useState<string | null>(
    () => (location.state as { flashId?: string } | null)?.flashId ?? null,
  );

  useEffect(() => {
    if (!flashId) return;
    // เคลียร์ nav state กัน refresh/back แล้ว flash ซ้ำ
    window.history.replaceState({ ...window.history.state, usr: null }, "");
  }, [flashId]);

  return flashId;
}
