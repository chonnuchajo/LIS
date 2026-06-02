import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** When provided, renders a ghost back button to the left of the title. */
  onBack?: () => void;
  backLabel?: string;
  className?: string;
}

/** Standard page heading: optional back button + title + description on the left, actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  onBack,
  backLabel = "กลับ",
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export default PageHeader;
