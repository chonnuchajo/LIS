import type { ApprovalItemGroup } from "@/lib/qcApprovalRows";
import type { LabRequest } from "@/types/labRequest.types";
import type { Petition } from "@/types/petition.types";

export type LaLisIssue = { level: "ok" | "warn" | "danger"; text: string };

export function buildLaLisAssistant(
  petition: Petition,
  labRequests: LabRequest[] | undefined,
  groups: ApprovalItemGroup[],
) {
  const rows = groups.flatMap((g) => g.params.flatMap((p) => p.rows.map((r) => ({ group: g, param: p, row: r }))));
  const abnormal = rows.filter((x) => x.row.abnormal);
  const missingResults = rows.filter((x) => !String(x.row.value ?? "").trim());
  const missingSamples = petition.items.filter((item) => !item.sampleId);
  const missingReportCustomer = !(labRequests ?? []).some((lr) => String(lr.reportCustomerName ?? lr.requester?.fullName ?? "").trim());

  const readiness: LaLisIssue[] = [
    missingSamples.length
      ? { level: "danger", text: `ยังไม่มีเลขตัวอย่าง ${missingSamples.length} รายการ` }
      : { level: "ok", text: "เลขตัวอย่างครบ" },
    missingResults.length
      ? { level: "danger", text: `ยังมีช่องผลว่าง ${missingResults.length} ช่อง` }
      : { level: "ok", text: "ผลทดสอบครบตาม parameter ที่ match ได้" },
    missingReportCustomer
      ? { level: "warn", text: "ยังไม่พบชื่อที่ใช้ในรายงานผลจาก Lab Request" }
      : { level: "ok", text: "ข้อมูลผู้รับรายงานพร้อม" },
    petition.status === "approved"
      ? { level: "ok", text: "Final Report พร้อมออก" }
      : { level: "warn", text: "Final Report ควรรออนุมัติขั้นสุดท้าย" },
  ];

  const oos: LaLisIssue[] = abnormal.length
    ? abnormal.slice(0, 8).map(({ group, param, row }) => ({
        level: "danger",
        text: `${group.seq}. ${param.parameterName} / ${row.label}: ${row.value || "-"} เกินเกณฑ์ ${row.standardText || "-"}`,
      }))
    : [{ level: "ok", text: "ไม่พบค่า OOS/Deviation จากเกณฑ์ที่ตั้งไว้" }];

  const draft = abnormal.length
    ? `พบผลนอกเกณฑ์ ${abnormal.length} รายการ จาก ${petition.items.length} ตัวอย่าง แนะนำให้ QC review และระบุเหตุผลก่อนออก Final Report`
    : `ผลทดสอบ ${petition.items.length} ตัวอย่างไม่พบค่าออกนอกเกณฑ์จากข้อมูลที่บันทึก สามารถใช้ร่าง COA/Final Report ได้เมื่ออนุมัติครบ`;

  return { readiness, oos, draft, abnormalCount: abnormal.length, missingResultCount: missingResults.length };
}
