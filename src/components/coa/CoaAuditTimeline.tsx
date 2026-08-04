import type { CoaAuditLogEntry } from "@/types/coa.types";

export default function CoaAuditTimeline({ audit = [] }: { audit?: CoaAuditLogEntry[] }) {
  if (!audit.length) {
    return <div className="rounded-md border p-4 text-sm text-muted-foreground">ยังไม่มีประวัติเอกสาร</div>;
  }

  return (
    <div className="rounded-md border bg-white">
      {audit.map((entry) => (
        <div key={entry._id} className="border-b p-3 text-sm last:border-b-0">
          <div className="font-medium">{entry.event}</div>
          <div className="text-xs text-muted-foreground">
            {entry.actor?.name || entry.actor?.email || "system"} - {entry.createdAt ? new Date(entry.createdAt).toLocaleString("th-TH") : "-"}
          </div>
          {entry.note && <div className="mt-1 text-muted-foreground">{entry.note}</div>}
        </div>
      ))}
    </div>
  );
}
