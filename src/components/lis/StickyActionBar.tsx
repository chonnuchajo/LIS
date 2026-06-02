import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StickyActionBarProps {
  onCancel?: () => void;
  onSave?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  isSaving?: boolean;
  saveDisabled?: boolean;
  /** When the form is a real <form>, omit onSave and set type="submit" via formId. */
  formId?: string;
  extra?: ReactNode;
  className?: string;
}

/** Sticky save/cancel bar pinned to the bottom of a form. Prevents double-submit while saving. */
export function StickyActionBar({
  onCancel,
  onSave,
  saveLabel = "บันทึก",
  cancelLabel = "ยกเลิก",
  isSaving = false,
  saveDisabled = false,
  formId,
  extra,
  className,
}: StickyActionBarProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 mt-6 flex items-center justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6",
        className,
      )}
    >
      {extra && <div className="mr-auto">{extra}</div>}
      {onCancel && (
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          {cancelLabel}
        </Button>
      )}
      <Button
        type={formId ? "submit" : "button"}
        form={formId}
        variant="primary"
        onClick={onSave}
        disabled={isSaving || saveDisabled}
      >
        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
        {isSaving ? "กำลังบันทึก..." : saveLabel}
      </Button>
    </div>
  );
}

export default StickyActionBar;
