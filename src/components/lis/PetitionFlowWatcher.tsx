import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { audiencesForUser, readSeeAll, SEE_ALL_EVENT } from "@/lib/petitionAudience";
import { cursorKey, effectiveSeeAll, nextCursor, readCursor } from "@/lib/petitionFlowWatcher";

const FIRST_POLL_SOUND_GRACE_MS = 65_000;
const SAMPLE_ARRIVAL_SOUND_URL = `${import.meta.env.BASE_URL}sound/sample-arrival.mp3`;
const SAMPLE_ARRIVAL_PLAY_COUNT = 3;
const SAMPLE_ARRIVAL_TONE_COUNT = 3;
const SAMPLE_ARRIVAL_TONE_INTERVAL_SEC = 0.27;
const SAMPLE_ARRIVAL_TONE_DURATION_SEC = 0.22;
const SAMPLE_ARRIVAL_TONE_ATTACK_SEC = 0.03;
const SAMPLE_ARRIVAL_TONE_PEAK_GAIN = 0.55;

const isFreshOnFirstPoll = (createdAt: string | undefined, serverTime: string | undefined) => {
  const createdAtMs = Date.parse(createdAt || "");
  const serverTimeMs = Date.parse(serverTime || "");
  if (Number.isNaN(createdAtMs) || Number.isNaN(serverTimeMs)) return false;
  return serverTimeMs - createdAtMs <= FIRST_POLL_SOUND_GRACE_MS && createdAtMs <= serverTimeMs + 5_000;
};

const playSampleArrivalFallbackTone = () => {
  if (typeof window === "undefined") return;
  const AudioContextCtor =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const audioContext = new AudioContextCtor();
    const start = audioContext.currentTime;

    for (let toneIndex = 0; toneIndex < SAMPLE_ARRIVAL_TONE_COUNT; toneIndex += 1) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const toneStart = start + toneIndex * SAMPLE_ARRIVAL_TONE_INTERVAL_SEC;
      const toneEnd = toneStart + SAMPLE_ARRIVAL_TONE_DURATION_SEC;

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(1046.5, toneStart);
      oscillator.frequency.exponentialRampToValueAtTime(1760, toneStart + 0.08);
      gain.gain.setValueAtTime(0.0001, toneStart);
      gain.gain.exponentialRampToValueAtTime(SAMPLE_ARRIVAL_TONE_PEAK_GAIN, toneStart + SAMPLE_ARRIVAL_TONE_ATTACK_SEC);
      gain.gain.setValueAtTime(SAMPLE_ARRIVAL_TONE_PEAK_GAIN, toneEnd - 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(toneStart);
      oscillator.stop(toneEnd);

      if (toneIndex === SAMPLE_ARRIVAL_TONE_COUNT - 1) {
        oscillator.onended = () => {
          if (audioContext.state !== "closed") void audioContext.close().catch(() => undefined);
        };
      }
    }
  } catch {
    return;
  }
};

const playSampleArrivalSound = () => {
  if (typeof window === "undefined") return;
  if (typeof window.Audio !== "function") {
    playSampleArrivalFallbackTone();
    return;
  }

  try {
    const audio = new window.Audio(SAMPLE_ARRIVAL_SOUND_URL);
    let playCount = 0;
    const playCurrentRound = () => {
      playCount += 1;
      audio.currentTime = 0;
      void audio.play().catch(() => playSampleArrivalFallbackTone());
    };

    audio.preload = "auto";
    audio.volume = 1;
    audio.addEventListener("ended", () => {
      if (playCount < SAMPLE_ARRIVAL_PLAY_COUNT) playCurrentRound();
    });
    playCurrentRound();
  } catch {
    playSampleArrivalFallbackTone();
  }
};

/**
 * Poll ความเคลื่อนไหวของคำขอทุกนาทีแล้วยิงเข้ากระดิ่ง
 * cursor เดินหน้าเฉพาะตอน query สำเร็จ — เน็ตกระตุกแล้วต้องไม่กลืน event ที่ยังไม่เคยแสดง
 */
const PetitionFlowWatcher = () => {
  const { user } = useAuth();
  const { push } = useNotifications();
  const playedSoundIdsRef = useRef<Set<string>>(new Set());
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
    let shouldPlaySound = false;
    let hasExistingCursor = false;
    const key = cursorKey(employeeId);
    try {
      hasExistingCursor = !!localStorage.getItem(key);
    } catch {
      hasExistingCursor = false;
    }

    // server เรียงใหม่→เก่า; push ทีละอันแบบกลับด้าน เพื่อให้อันใหม่สุดไปอยู่หัวลิสต์
    for (const item of [...data.items].reverse()) {
      if (item.playSound && !playedSoundIdsRef.current.has(item.id)) {
        playedSoundIdsRef.current.add(item.id);
        shouldPlaySound = shouldPlaySound || hasExistingCursor || isFreshOnFirstPoll(item.createdAt, data.serverTime);
      }
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
    if (shouldPlaySound) playSampleArrivalSound();
    try {
      const stored = localStorage.getItem(key);
      localStorage.setItem(key, nextCursor(stored, data.serverTime));
    } catch {
      // private mode — รอบหน้าจะดึงย้อนหลัง 24 ชม.ใหม่ ซึ่ง push กันซ้ำด้วย id อยู่แล้ว
    }
  }, [data, employeeId, push]);

  return null;
};

export default PetitionFlowWatcher;
