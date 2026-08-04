import { Badge } from "@/components/ui/badge";
import { coaStatusLabel } from "@/lib/coaStatus";
import type { CoaStatus } from "@/types/coa.types";

const variantByStatus: Record<CoaStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  draft: "gray-soft",
  pendingApproval: "yellow-soft",
  approved: "green-soft",
  printed: "blue-soft",
  revisionDraft: "yellow-soft",
  pendingRevisionApproval: "yellow-soft",
  reissued: "green-soft",
  cancelled: "red-soft",
  superseded: "gray-soft",
  rejected: "red-soft",
};

export default function CoaStatusBadge({ status }: { status: CoaStatus }) {
  return <Badge variant={variantByStatus[status]}>{coaStatusLabel(status)}</Badge>;
}
