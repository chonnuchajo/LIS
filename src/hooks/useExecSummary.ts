import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ExecPeriod, ExecSummary } from "@/lib/execSummary";

const API_BASE = import.meta.env.BASE_URL + "api";

export function useExecSummary() {
  const [period, setPeriod] = useState<ExecPeriod>(30);

  const query = useQuery<ExecSummary>({
    queryKey: ["exec-summary", period],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/petitions/exec-summary?days=${period}`, { cache: "no-store" });
      if (!res.ok) throw new Error("exec-summary failed");
      return (await res.json()) as ExecSummary;
    },
    staleTime: 60_000,
  });

  return { ...query, period, setPeriod };
}
