import type { Petition } from "@/types/petition.types";
import { petitionStatusSteps } from "@/lib/statusBadge";
import { cn } from "@/lib/utils";

export default function PetitionStatusTimeline({ petition, compact = false }: { petition: Petition; compact?: boolean }) {
  const steps = petitionStatusSteps(petition);
  return (
    <div className={cn("flex flex-wrap items-center", compact ? "gap-1" : "gap-1.5")}>
      {steps.map((step, index) => (
        <div key={step.key} className="flex items-center gap-1">
          {index > 0 && <span className="h-px w-2 bg-border" aria-hidden />}
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] leading-none",
              step.done
                ? "border-green-200 bg-green-50 text-green-700"
                : step.current
                  ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                  : "border-border bg-muted text-muted-foreground",
            )}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}
