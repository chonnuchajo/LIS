import type { ParameterItem, ParameterValueField } from "./api";
import type { PetitionPhase } from "@/types/petition.types";

export function isPhaseTriggerParameter(
  parameter: Pick<ParameterItem, "_id" | "valueFields">,
  triggerParameterId?: string | null,
): boolean {
  if (triggerParameterId) {
    return String(parameter._id ?? "") === String(triggerParameterId);
  }
  return (parameter.valueFields ?? []).some((field) => field.triggersPhase2);
}

export function visibleFieldsForPhase(
  parameter: ParameterItem,
  phase: PetitionPhase,
  triggerParameterId?: string | null,
): ParameterValueField[] {
  const fields = parameter.valueFields ?? [];

  if (phase === 2 && isPhaseTriggerParameter(parameter, triggerParameterId)) {
    return [];
  }

  if (!parameter.hasPhases) {
    return fields;
  }

  return fields.filter((field) => {
    const fieldPhase = field.phase ?? "both";
    if (fieldPhase === "both") return true;
    return phase === 1 ? fieldPhase === "before" : fieldPhase === "after";
  });
}
