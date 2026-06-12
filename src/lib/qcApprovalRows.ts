import type { ParameterItem, ParameterValueField } from "@/lib/api";
import type { Petition, QCTestResult } from "@/types/petition.types";
import { matchParametersForItem } from "@/lib/petitionTestItems";
import {
  expandFieldForItem,
  isFieldAbnormal,
  resolveFieldStandard,
  resolveStandard,
  type ConditionContext,
} from "@/lib/parameterValidation";
import { describeResolvedStandard } from "@/lib/standardOperators";

export interface ApprovalFieldRow {
  key: string;
  label: string;
  unit?: string;
  value: string;
  standardText: string;
  abnormal: boolean;
  note: string;
  phase: 1 | 2;
}

export interface ApprovalParamGroup {
  parameterId: string;
  parameterName: string;
  hasPhases: boolean;
  rows: ApprovalFieldRow[];
}

export interface ApprovalItemGroup {
  seq: number;
  sampleName: string;
  batchNo?: string;
  sampleId?: string;
  commonName?: string;
  params: ApprovalParamGroup[];
  unmatched: boolean;
}

const resultKey = (itemSeq: number, parameterId: string) => `${itemSeq}__${parameterId}`;
const noteLabelFor = (unitKey: string) => `${unitKey}__note`;

function describeStandard(field: ParameterValueField): string {
  const op = field.standardOperator;
  const v1 = field.standardValue;
  const v2 = field.standardValue2;
  const unit = field.unit ? ` ${field.unit}` : "";
  switch (op) {
    case "lt": return `< ${v1}${unit}`;
    case "lte": return `≤ ${v1}${unit}`;
    case "eq": return `= ${v1}${unit}`;
    case "gte": return `≥ ${v1}${unit}`;
    case "gt": return `> ${v1}${unit}`;
    case "between": return `${v1} - ${v2}${unit}`;
    case "tolerance": return `${v1} ± ${v2}%${unit}`;
    default: return "";
  }
}

const asStr = (v: unknown) => (v == null ? "" : String(v));

/**
 * แปลง petition + parameters (scope qc) + ผลที่บันทึก → โครงสร้างแถวสรุปแบบ read-only
 * สำหรับหน้าอนุมัติ. คงตรรกะ match/expand/abnormal/conditional ให้ตรงกับหน้ากรอกผล.
 */
export function buildApprovalGroups(
  petition: Petition,
  parameters: ParameterItem[],
  results: QCTestResult[],
  groupMembership: Map<string, string[]>,
): ApprovalItemGroup[] {
  const v1: Record<string, Record<string, unknown>> = {};
  const v2: Record<string, Record<string, unknown>> = {};
  results.forEach((r) => {
    const k = resultKey(r.itemSeq, r.parameterId);
    v1[k] = { ...((r.values ?? {}) as Record<string, unknown>) };
    v2[k] = { ...((r.valuesPhase2 ?? {}) as Record<string, unknown>) };
  });

  const idsFor = (sampleId?: string) =>
    groupMembership.get(String(sampleId ?? "").trim()) ?? [];

  return (petition.items ?? []).map((item) => {
    const matched = matchParametersForItem(item, parameters, idsFor(item.sampleId));

    const params: ApprovalParamGroup[] = matched.map((param) => {
      const k = resultKey(item.seq, param._id!);
      const buildCtx = (phaseVals: Record<string, Record<string, unknown>>): ConditionContext => ({
        sameParam: phaseVals[k] ?? {},
        otherParams: (() => {
          const out: Record<string, Record<string, unknown>> = {};
          matched.forEach((p) => {
            if (!p._id || p._id === param._id) return;
            out[String(p._id)] = phaseVals[resultKey(item.seq, p._id)] ?? {};
          });
          return out;
        })(),
      });

      const rows: ApprovalFieldRow[] = [];
      const pushFields = (phase: 1 | 2) => {
        const phaseVals = phase === 2 ? v2 : v1;
        const ctx = buildCtx(phaseVals);
        (param.valueFields ?? []).forEach((field) => {
          const fPhase = field.phase ?? "both";
          if (phase === 1 && fPhase === "after") return;
          if (phase === 2 && fPhase === "before") return;
          if (field.type === "reference") return;
          expandFieldForItem(field, item.commonName).forEach((unit) => {
            const raw = phaseVals[k]?.[unit.key];
            const effectiveField = unit.field.conditionalMode
              ? resolveFieldStandard(unit.field, ctx)
              : unit.field;
            const resolved = unit.field.conditionalMode
              ? resolveStandard(unit.field, ctx)
              : null;
            const standardText = resolved
              ? describeResolvedStandard(resolved, unit.field.unit ?? "")
              : describeStandard(effectiveField);
            rows.push({
              key: `${k}__${unit.key}__p${phase}`,
              label: unit.field.label,
              unit: unit.field.unit,
              value: asStr(raw),
              standardText,
              abnormal: isFieldAbnormal(effectiveField, raw),
              note: asStr(phaseVals[k]?.[noteLabelFor(unit.key)]),
              phase,
            });
          });
        });
      };

      pushFields(1);
      if (param.hasPhases) pushFields(2);

      return {
        parameterId: String(param._id),
        parameterName: param.name,
        hasPhases: !!param.hasPhases,
        rows,
      };
    });

    return {
      seq: item.seq,
      sampleName: item.sampleName || "-",
      batchNo: item.batchNo,
      sampleId: item.sampleId,
      commonName: item.commonName,
      params,
      unmatched: matched.length === 0,
    };
  });
}
