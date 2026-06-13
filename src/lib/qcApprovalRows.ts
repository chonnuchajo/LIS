import type { ParameterItem } from "@/lib/api";
import type { Petition, QCTestResult } from "@/types/petition.types";
import { matchParametersForItem } from "@/lib/petitionTestItems";
import {
  expandFieldForItem,
  fieldValueList,
  getEntryValues,
  isFieldAbnormal,
  resolveFieldStandard,
  resolveStandard,
  type ConditionContext,
} from "@/lib/parameterValidation";
import { describeResolvedStandard, describeStandard } from "@/lib/standardOperators";

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
  scope: "lab" | "qc";
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
  // Cross-parameter conditional context uses each result's primary (entry-0) values.
  const v1: Record<string, Record<string, unknown>> = {};
  const v2: Record<string, Record<string, unknown>> = {};
  // Full result by key — lets us iterate multiEntry `entries` for the current param.
  const resultByKey: Record<string, QCTestResult> = {};
  results.forEach((r) => {
    const k = resultKey(r.itemSeq, r.parameterId);
    resultByKey[k] = r;
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
        // multiEntry parameters repeat their whole field set per entry; normal
        // parameters collapse to a single entry equal to the phase value-object.
        // Phase-2 has no separate entries store; multiEntry repeats live in phase-1 `entries`.
        const phaseResult = phase === 2
          ? { values: v2[k] ?? {}, entries: undefined }
          : { values: v1[k] ?? {}, entries: resultByKey[k]?.entries };
        const entryList = getEntryValues(phaseResult, param);
        entryList.forEach((entryValues, ei) => {
          const entryLabel = param.multiEntry ? `รายการที่ ${ei + 1}` : "";
          (param.valueFields ?? []).forEach((field) => {
            const fPhase = field.phase ?? "both";
            if (phase === 1 && fPhase === "after") return;
            if (phase === 2 && fPhase === "before") return;
            // reference fields are auto-resolved from substance standards elsewhere and intentionally omitted from approval rows
            if (field.type === "reference") return;
            expandFieldForItem(field, item.commonName).forEach((unit) => {
              const effectiveField = unit.field.conditionalMode
                ? resolveFieldStandard(unit.field, ctx)
                : unit.field;
              const resolved = unit.field.conditionalMode
                ? resolveStandard(unit.field, ctx)
                : null;
              const standardText = resolved
                ? describeResolvedStandard(resolved, unit.field.unit ?? "")
                : describeStandard(effectiveField);
              const note = asStr(entryValues[noteLabelFor(unit.key)]);
              // Substance units store a per-substance scalar under unit.key; plain
              // units (incl. `multiple`) read their value list via fieldValueList.
              const valueList = unit.substanceName !== undefined
                ? [entryValues[unit.key]]
                : fieldValueList(entryValues, unit.field);
              valueList.forEach((raw, vi) => {
                const valueLabel = unit.field.multiple ? `ค่าที่ ${vi + 1}` : "";
                const labelParts = [unit.field.label, valueLabel, entryLabel].filter(Boolean);
                rows.push({
                  key: `${k}__${unit.key}__p${phase}__e${ei}__v${vi}`,
                  label: labelParts.join(" · "),
                  unit: unit.field.unit,
                  value: asStr(raw),
                  standardText,
                  abnormal: isFieldAbnormal(effectiveField, raw),
                  note,
                  phase,
                });
              });
            });
          });
        });
      };

      pushFields(1);
      if (param.hasPhases) pushFields(2);

      return {
        parameterId: String(param._id),
        parameterName: param.name,
        scope: (param.scope ?? "qc") === "lab" ? "lab" : "qc",
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
