import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock, FlaskConical, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ICP_LADDA_LOGO_URL } from "@/lib/branding";
import { formatPetitionWorkSections, petitionHasLabItems } from "@/lib/petitionSections";
import { usePetitionList } from "@/hooks/usePetition";
import {
  PETITION_STATUS_CONFIG,
  type Petition,
  type PetitionStatus,
} from "@/types/petition.types";
import { api, type ParameterItem, type QCProgressMap } from "@/lib/api";
import {
  computePetitionProgress,
  isSameLocalDay,
  type PetitionProgress,
} from "@/lib/qcProgress";

type QueueMode = "lab" | "qc";

type QueueGroup = {
  id: string;
  title: string;
  subtitle: string;
  statuses: PetitionStatus[];
  icon: typeof Sparkles;
  tone: string;
};

type QueueConfig = {
  title: string;
  subtitle: string;
  accent: string;
  icon: typeof FlaskConical;
  groups: QueueGroup[];
};

const REFRESH_MS = 5_000;
const MAX_ITEMS_PER_GROUP = 9;
const NEW_WORK_ALERT_MS = 10_000;
const NEW_SAMPLE_SOUND_URL = `${import.meta.env.BASE_URL}sound/new.mp3`;

const QUEUE_CONFIG: Record<QueueMode, QueueConfig> = {
  lab: {
    title: "Lab Queue",
    subtitle: "รายการคำขอสำหรับรับตัวอย่าง ตรวจสอบ และวิเคราะห์ในห้องปฏิบัติการ",
    accent: "bg-primary text-primary-foreground",
    icon: FlaskConical,
    groups: [
      {
        id: "new",
        title: "ตัวอย่างใหม่",
        subtitle: "รอรับเข้าระบบ",
        statuses: ["sampleSent"],
        icon: Sparkles,
        tone: "border-sky-200 bg-sky-50 text-sky-700",
      },
      {
        id: "progress",
        title: "กำลังดำเนินการ",
        subtitle: "รับแล้ว / อยู่ระหว่างวิเคราะห์",
        statuses: ["pendingReview", "inProgress"],
        icon: Clock,
        tone: "border-amber-200 bg-amber-50 text-amber-700",
      },
      {
        id: "done",
        title: "เรียบร้อยแล้ว",
        subtitle: "ตรวจเสร็จแล้ว",
        statuses: ["success"],
        icon: CheckCircle2,
        tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      },
    ],
  },
  qc: {
    title: "QC Queue",
    subtitle: "รายการคำขอสำหรับติดตาม ตรวจสอบ และอนุมัติผล QC",
    accent: "bg-primary-600 text-white",
    icon: ShieldCheck,
    groups: [
      {
        id: "new",
        title: "ตัวอย่างใหม่",
        subtitle: "คำขอเข้า QC",
        statuses: ["sampleSent"],
        icon: Sparkles,
        tone: "border-sky-200 bg-sky-50 text-sky-700",
      },
      {
        id: "progress",
        title: "กำลังดำเนินการ",
        subtitle: "รอตรวจสอบ / กำลังตรวจ",
        statuses: ["pendingReview", "inProgress"],
        icon: Clock,
        tone: "border-amber-200 bg-amber-50 text-amber-700",
      },
      {
        id: "done",
        title: "เรียบร้อยแล้ว",
        subtitle: "อนุมัติผลแล้ว",
        statuses: ["success"],
        icon: CheckCircle2,
        tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      },
    ],
  },
};

function formatDateTime(value: string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("th-TH", { day: "2-digit", month: "short" }),
    time: date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
  };
}

function getSampleSummary(petition: Petition) {
  const firstItem = petition.items[0];
  const name = firstItem
    ? [firstItem.sampleName, firstItem.commonName].filter(Boolean).join(" ")
    : "";

  if (!name) return `${petition.items.length} รายการตัวอย่าง`;
  if (petition.items.length <= 1) return name;
  return `${name} +${petition.items.length - 1}`;
}

function QueueCard({
  petition,
  progress,
}: {
  petition: Petition;
  progress?: PetitionProgress;
}) {
  const updated = formatDateTime(petition.updatedAt);
  const statusCfg = PETITION_STATUS_CONFIG[petition.status] ?? {
    label: petition.status,
    variant: "gray-soft" as const,
  };

  const showBar = progress && progress.total > 0;
  const barColor = showBar
    ? progress.percent >= 100
      ? "bg-emerald-500"
      : progress.percent > 0
        ? "bg-primary-500"
        : "bg-slate-300"
    : "";

  return (
    <article className="rounded-lg border border-primary-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-2xl font-bold text-primary-700">{petition.petitionNo}</div>
          <div className="mt-1 truncate text-base font-medium text-slate-700">
            {getSampleSummary(petition)}
          </div>
        </div>
        <Badge variant={statusCfg.variant} className="shrink-0 px-3 py-1 text-sm">
          {statusCfg.label}
        </Badge>
      </div>
<<<<<<< HEAD
      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-500">ส่วนงาน</span>
        <Badge variant="primary-soft" className="px-3 py-1 text-sm">
          {formatPetitionWorkSections(petition)}
        </Badge>
      </div>
=======

>>>>>>> d1bdc1d7f523319a67c643490821323511c0a0d9
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-slate-100 pt-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">{petition.submittedBy?.name ?? '-'}</div>
          <div className="truncate text-sm text-slate-500">{petition.dept || "-"}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-primary-700">{updated.time}</div>
          <div className="text-xs text-slate-500">{updated.date}</div>
        </div>
      </div>

      {showBar && (
        <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
          <div
            className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn("h-full transition-all duration-500", barColor)}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span
            className={cn(
              "shrink-0 text-base font-bold tabular-nums",
              progress.percent >= 100 ? "text-emerald-600" : "text-primary-700",
            )}
          >
            {progress.percent}%
          </span>
        </div>
      )}
    </article>
  );
}

export default function QueueDisplay({ mode }: { mode: QueueMode }) {
  const config = QUEUE_CONFIG[mode];
  const HeaderIcon = config.icon;
  const { data, loading, error, refresh } = usePetitionList({ page: 1, limit: 200 });
  const [now, setNow] = useState(() => new Date());
  const [newWorkPopup, setNewWorkPopup] = useState<{ count: number; petitionNos: string[] } | null>(null);
  const previousNewIdsRef = useRef<Set<string>>(new Set());
  const initializedNewIdsRef = useRef(false);
  const popupTimerRef = useRef<number | null>(null);
  const alertAudioRef = useRef<HTMLAudioElement | null>(null);

  // "Today" is bound at mount and refreshed at midnight so the board auto-clears
  // when the local day rolls over.
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const next = new Date(today);
    next.setHours(24, 0, 0, 5);
    const ms = Math.max(next.getTime() - Date.now(), 1000);
    const t = window.setTimeout(() => setToday(new Date()), ms);
    return () => window.clearTimeout(t);
  }, [today]);

  // Parameters drive the denominator for the QC progress bar.
  const [parameters, setParameters] = useState<ParameterItem[]>([]);
  useEffect(() => {
    if (mode !== "qc") return;
    api
      .getParameters()
      .then((all) => setParameters(all.filter((p) => (p.scope ?? "qc") === "qc")))
      .catch(() => {});
  }, [mode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
      refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const allItems = useMemo(() => {
    const groupStatuses = config.groups.flatMap((group) => group.statuses);
    return (data?.items ?? [])
      .filter((petition) => groupStatuses.includes(petition.status))
      .filter((petition) => (mode === "lab" ? petitionHasLabItems(petition) : true))
      .filter((petition) =>
        // Only show petitions that entered today's queue. completedAt is
        // preferred for finished rows so a sample sent yesterday and finished
        // today still appears under "done" today.
        petition.status === "success"
          ? isSameLocalDay(petition.completedAt ?? petition.updatedAt, today)
          : isSameLocalDay(
              petition.sampleSentAt ?? petition.receivedAt ?? petition.createdAt,
              today,
            ),
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [config.groups, data?.items, mode, today]);

  // Fetch how many values each visible petition has filled so far. Re-fetches
  // on the same cadence as the petition list, plus when the visible set changes.
  const [progressMap, setProgressMap] = useState<QCProgressMap>({});
  const visibleProgressIds = useMemo(
    () =>
      mode === "qc"
        ? allItems
            .filter((p) => p.status === "pendingReview" || p.status === "inProgress" || p.status === "sampleSent")
            .map((p) => p._id)
            .join(",")
        : "",
    [allItems, mode],
  );
  useEffect(() => {
    if (!visibleProgressIds) {
      setProgressMap({});
      return;
    }
    let cancelled = false;
    const fetchOnce = () =>
      api
        .getQCProgress(visibleProgressIds.split(","))
        .then((map) => { if (!cancelled) setProgressMap(map); })
        .catch(() => {});
    fetchOnce();
    const interval = window.setInterval(fetchOnce, REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [visibleProgressIds]);

  const itemsByGroup = useMemo(() => {
    return config.groups.map((group) => ({
      ...group,
      items: allItems.filter((petition) => group.statuses.includes(petition.status)),
    }));
  }, [allItems, config.groups]);

  const newGroupItems = useMemo(() => {
    return itemsByGroup.find((group) => group.id === "new")?.items ?? [];
  }, [itemsByGroup]);

  useEffect(() => {
    if (loading || error) return;

    const currentNewIds = new Set(newGroupItems.map((petition) => petition._id));

    if (!initializedNewIdsRef.current) {
      previousNewIdsRef.current = currentNewIds;
      initializedNewIdsRef.current = true;
      return;
    }

    const incomingItems = newGroupItems.filter((petition) => !previousNewIdsRef.current.has(petition._id));
    previousNewIdsRef.current = currentNewIds;

    if (incomingItems.length === 0) return;

    if (alertAudioRef.current) {
      alertAudioRef.current.pause();
      alertAudioRef.current.currentTime = 0;
    }

    const audio = new Audio(`${NEW_SAMPLE_SOUND_URL}?v=${Date.now()}`);
    audio.loop = true;
    alertAudioRef.current = audio;
    audio.play().catch(() => {
      // Browsers may block autoplay until the TV/browser session has interacted once.
    });

    setNewWorkPopup({
      count: incomingItems.length,
      petitionNos: incomingItems.slice(0, 3).map((petition) => petition.petitionNo),
    });

    if (popupTimerRef.current) {
      window.clearTimeout(popupTimerRef.current);
    }
    popupTimerRef.current = window.setTimeout(() => {
      if (alertAudioRef.current) {
        alertAudioRef.current.pause();
        alertAudioRef.current.currentTime = 0;
        alertAudioRef.current = null;
      }
      setNewWorkPopup(null);
      popupTimerRef.current = null;
    }, NEW_WORK_ALERT_MS);
  }, [error, loading, newGroupItems]);

  useEffect(() => {
    return () => {
      if (popupTimerRef.current) {
        window.clearTimeout(popupTimerRef.current);
      }
      if (alertAudioRef.current) {
        alertAudioRef.current.pause();
        alertAudioRef.current = null;
      }
    };
  }, []);

  const currentTime = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const currentDate = now.toLocaleDateString("th-TH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="min-h-screen bg-primary-50 text-slate-800">
      {newWorkPopup && (
        <div className="fixed inset-x-0 top-8 z-50 flex justify-center px-6">
          <div className="flex min-w-[420px] max-w-[720px] items-center gap-5 rounded-lg border border-primary-200 bg-white px-7 py-5 shadow-xl">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-9 w-9" />
            </div>
            <div className="min-w-0">
              <div className="text-3xl font-bold text-primary-700">มีงานใหม่</div>
              <div className="mt-1 truncate text-xl text-slate-600">
                {config.title}: {newWorkPopup.count} รายการ
                {newWorkPopup.petitionNos.length > 0 ? ` (${newWorkPopup.petitionNos.join(", ")})` : ""}
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-primary-100 bg-white px-10 py-6 shadow-sm">
        <div className="flex items-center justify-between gap-8">
        <div className="flex min-w-0 items-center gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-primary-100 bg-white p-2 shadow-sm">
            <img
              src={ICP_LADDA_LOGO_URL}
              alt="ICP Ladda"
              className="h-full w-full object-contain"
            />
          </div>
          <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-lg", config.accent)}>
            <HeaderIcon className="h-9 w-9" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-5xl font-bold tracking-normal text-primary-700">{config.title}</h1>
            <p className="mt-2 truncate text-2xl text-slate-600">{config.subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-5xl font-bold leading-none text-primary-700">{currentTime}</div>
          <div className="mt-2 text-xl text-slate-600">{currentDate}</div>
        </div>
        </div>
      </header>

      <section className="flex items-center justify-between border-b border-primary-100 bg-white px-10 py-5">
        <div className="rounded-lg bg-primary-50 px-5 py-3">
          <div className="text-lg text-slate-500">คิววันนี้</div>
          <div className="text-4xl font-bold text-primary-700">{allItems.length}</div>
        </div>
        <div className="flex items-center gap-2 text-xl text-slate-600">
          <RefreshCw className="h-5 w-5" />
          อัปเดตอัตโนมัติทุก 5 วินาที
        </div>
      </section>

      <section className="px-10 py-6">
        {loading ? (
          <div className="flex min-h-[520px] items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white text-3xl text-slate-500">
            <Clock className="h-8 w-8 animate-pulse" />
            กำลังโหลดรายการคิว...
          </div>
        ) : error ? (
          <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-red-200 bg-white text-3xl font-semibold text-red-600">
            โหลดรายการคิวไม่สำเร็จ: {error}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5">
            {itemsByGroup.map((group) => {
              const GroupIcon = group.icon;
              const visibleItems = group.items.slice(0, MAX_ITEMS_PER_GROUP);
              const hiddenCount = Math.max(group.items.length - visibleItems.length, 0);

              return (
                <section key={group.id} className="min-h-[620px] rounded-lg border border-primary-100 bg-white/70">
                  <div className={cn("flex items-center justify-between border-b px-5 py-4", group.tone)}>
                    <div className="flex min-w-0 items-center gap-3">
                      <GroupIcon className="h-7 w-7 shrink-0" />
                      <div className="min-w-0">
                        <h2 className="truncate text-3xl font-bold">{group.title}</h2>
                        <p className="truncate text-base opacity-80">{group.subtitle}</p>
                      </div>
                    </div>
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white/80 text-3xl font-bold">
                      {group.items.length}
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    {visibleItems.length === 0 ? (
                      <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/70 text-2xl font-semibold text-slate-400">
                        ไม่มีรายการ
                      </div>
                    ) : (
                      visibleItems.map((petition) => {
                        // Bar is only meaningful for QC mode rows that QC is
                        // actively (or about to be) filling. "Done" rows are
                        // implicitly 100% and would add visual noise.
                        const showProgress =
                          mode === "qc" &&
                          (petition.status === "sampleSent" ||
                            petition.status === "pendingReview" ||
                            petition.status === "inProgress");
                        const progress = showProgress
                          ? computePetitionProgress(petition, parameters, progressMap[petition._id])
                          : undefined;
                        return (
                          <QueueCard key={petition._id} petition={petition} progress={progress} />
                        );
                      })
                    )}
                    {hiddenCount > 0 && (
                      <div className="rounded-lg bg-primary px-4 py-3 text-center text-xl font-semibold text-primary-foreground">
                        อีก {hiddenCount} รายการ
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
