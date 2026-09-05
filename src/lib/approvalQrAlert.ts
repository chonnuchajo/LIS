import type { PetitionFlowNotification } from "@/lib/api";
import type { Petition } from "@/types/petition.types";

export const APPROVAL_QR_POPUP_MS = 30_000;
export const APPROVAL_QR_ALERT_EVENT = "lis:approval-qr-alert";
const APPROVAL_QR_SOUND_URL = `${import.meta.env.BASE_URL}sound/new.mp3`;

export interface ApprovalQrAlertDetail {
  notificationId?: string;
  petitionId: string;
  petitionNo?: string;
  createdAt?: string;
  petition?: Petition;
}

export function isFinalApprovalNotification(notification: Pick<PetitionFlowNotification, "event" | "toStatus" | "petitionId">): boolean {
  return notification.event === "statusChanged" && notification.toStatus === "approved" && !!notification.petitionId;
}

export function approvalQrAlertDetailFromNotification(notification: PetitionFlowNotification): ApprovalQrAlertDetail | null {
  if (!isFinalApprovalNotification(notification) || !notification.petitionId) return null;
  return {
    notificationId: notification.id,
    petitionId: notification.petitionId,
    petitionNo: notification.petitionNo,
    createdAt: notification.createdAt,
  };
}

export function dispatchApprovalQrAlert(detail: ApprovalQrAlertDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ApprovalQrAlertDetail>(APPROVAL_QR_ALERT_EVENT, { detail }));
}

export function playApprovalQrAlertSound(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  const audio = new Audio(`${APPROVAL_QR_SOUND_URL}?v=${Date.now()}`);
  audio.loop = true;
  audio.play().catch(() => undefined);
  return audio;
}

export function stopApprovalQrAlertSound(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}
