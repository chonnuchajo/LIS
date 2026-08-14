import { Badge } from "@/components/ui/badge";
import { coaStatusLabel } from "@/lib/coaStatus";
import type { CoaStatus } from "@/types/coa.types";

const variantByStatus: Record<CoaStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  draft: "blue-soft",
  pendingApproval: "blue-soft",
  approved: "blue-soft",
  printed: "blue-soft",
  revisionDraft: "blue-soft",
  pendingRevisionApproval: "blue-soft",
  reissued: "blue-soft",
  cancelled: "blue-soft",
  superseded: "blue-soft",
  rejected: "blue-soft",
};

export default function CoaStatusBadge({ status }: { status: CoaStatus }) {
  return <Badge variant={variantByStatus[status]}>{coaStatusLabel(status)}</Badge>;
}
