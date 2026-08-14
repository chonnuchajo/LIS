import type { CoaAuditLogEntry } from "@/types/coa.types";

export default function CoaAuditTimeline({ audit = [] }: { audit?: CoaAuditLogEntry[] }) {
  if (!audit.length) {
    return <div className="rounded-md border border-sky-100 bg-white/90 p-4 text-sm text-sky-600">ยังไม่มีประวัติเอกสาร</div>;
  }

  return (
    <div className="rounded-md border border-sky-100 bg-white/90">
      {audit.map((entry) => (
        <div key={entry._id} className="border-b border-sky-50 p-3 text-sm last:border-b-0">
          <div className="font-medium text-sky-950">{entry.event}</div>
          <div className="text-xs text-sky-600">
            {entry.actor?.name || entry.actor?.email || "system"} - {entry.createdAt ? new Date(entry.createdAt).toLocaleString("th-TH") : "-"}
          </div>
          {entry.note && <div className="mt-1 text-sky-700">{entry.note}</div>}
        </div>
      ))}
    </div>
  );
}
