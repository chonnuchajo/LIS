import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { audiencesForUser, readSeeAll, SEE_ALL_EVENT } from "@/lib/petitionAudience";
import { cursorKey, effectiveSeeAll, nextCursor, readCursor } from "@/lib/petitionFlowWatcher";
import ApprovalQrPopup from "@/components/petition/ApprovalQrPopup";
import {
  APPROVAL_QR_ALERT_EVENT,
  APPROVAL_QR_POPUP_MS,
  type ApprovalQrAlertDetail,
  approvalQrAlertDetailFromNotification,
  playApprovalQrAlertSound,
  stopApprovalQrAlertSound,
} from "@/lib/approvalQrAlert";
import type { Petition } from "@/types/petition.types";

/**
 * Poll ความเคลื่อนไหวของคำขอทุกนาทีแล้วยิงเข้ากระดิ่ง
 * cursor เดินหน้าเฉพาะตอน query สำเร็จ — เน็ตกระตุกแล้วต้องไม่กลืน event ที่ยังไม่เคยแสดง
 */
const PetitionFlowWatcher = () => {
  const { user } = useAuth();
  const { push } = useNotifications();
  const [seeAllRaw, setSeeAllRaw] = useState(() => readSeeAll());
  const [approvalPopupPetition, setApprovalPopupPetition] = useState<Petition | null>(null);
  const approvalTimerRef = useRef<number | null>(null);
  const approvalAudioRef = useRef<HTMLAudioElement | null>(null);
  const watcherMountedAtRef = useRef(Date.now());
  const shownApprovalPetitionIdsRef = useRef<Set<string>>(new Set());
  const pendingApprovalPetitionIdsRef = useRef<Set<string>>(new Set());
  const seeAll = effectiveSeeAll(user, seeAllRaw);

  const closeApprovalPopup = useCallback(() => {
    if (approvalTimerRef.current) {
      window.clearTimeout(approvalTimerRef.current);
      approvalTimerRef.current = null;
    }
    stopApprovalQrAlertSound(approvalAudioRef.current);
    approvalAudioRef.current = null;
    setApprovalPopupPetition(null);
  }, []);

  const showApprovalPopup = useCallback(async (detail: ApprovalQrAlertDetail) => {
    const petitionId = detail.petition?._id || detail.petitionId;
    if (!petitionId) return;
    if (shownApprovalPetitionIdsRef.current.has(petitionId) || pendingApprovalPetitionIdsRef.current.has(petitionId)) return;

    pendingApprovalPetitionIdsRef.current.add(petitionId);
    try {
      const petition = detail.petition ?? await api.getPetition(petitionId);
      if (petition.status !== "approved") return;

      shownApprovalPetitionIdsRef.current.add(petitionId);
      closeApprovalPopup();
      approvalAudioRef.current = playApprovalQrAlertSound();
      setApprovalPopupPetition(petition);
      approvalTimerRef.current = window.setTimeout(closeApprovalPopup, APPROVAL_QR_POPUP_MS);
    } catch {
      return;
    } finally {
      pendingApprovalPetitionIdsRef.current.delete(petitionId);
    }
  }, [closeApprovalPopup]);

  useEffect(() => {
    const sync = () => setSeeAllRaw(readSeeAll());
    window.addEventListener(SEE_ALL_EVENT, sync);
    return () => window.removeEventListener(SEE_ALL_EVENT, sync);
  }, []);

  useEffect(() => {
    const handleApprovalQrAlert = (event: Event) => {
      const detail = (event as CustomEvent<ApprovalQrAlertDetail>).detail;
      if (detail?.petitionId) void showApprovalPopup(detail);
    };
    window.addEventListener(APPROVAL_QR_ALERT_EVENT, handleApprovalQrAlert);
    return () => window.removeEventListener(APPROVAL_QR_ALERT_EVENT, handleApprovalQrAlert);
  }, [showApprovalPopup]);

  useEffect(() => () => closeApprovalPopup(), [closeApprovalPopup]);

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
    const approvalAlerts: ApprovalQrAlertDetail[] = [];
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
      const approvalAlert = approvalQrAlertDetailFromNotification(item);
      if (approvalAlert) approvalAlerts.push(approvalAlert);
    }
    approvalAlerts.forEach((detail) => {
      const createdAtMs = Date.parse(detail.createdAt ?? "");
      if (!Number.isNaN(createdAtMs) && createdAtMs < watcherMountedAtRef.current - 5_000) return;
      void showApprovalPopup(detail);
    });
    try {
      const key = cursorKey(employeeId);
      const stored = localStorage.getItem(key);
      localStorage.setItem(key, nextCursor(stored, data.serverTime));
    } catch {
      // private mode — รอบหน้าจะดึงย้อนหลัง 24 ชม.ใหม่ ซึ่ง push กันซ้ำด้วย id อยู่แล้ว
    }
  }, [data, employeeId, push, showApprovalPopup]);

  return (
    <ApprovalQrPopup
      open={!!approvalPopupPetition}
      petition={approvalPopupPetition}
      onOpenChange={(open) => { if (!open) closeApprovalPopup(); }}
    />
  );
};

export default PetitionFlowWatcher;
