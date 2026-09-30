import { readValidationProject, type ValidationProject } from "./validationProject";

export type ValidationSavedWork = {
  id: string;
  savedAt: string;
  sections: Record<string, string>;
  project: ValidationProject;
};
export const validationDrugKey = (name: string) => name.trim().normalize("NFKC").toLowerCase();
const key = (owner: string) => `lis-validation-library-v1:${owner.trim().toLowerCase()}`;

export function loadValidationLibrary(owner: string, storage: Storage = localStorage): ValidationSavedWork[] {
  const source = storage.getItem(key(owner));
  if (!source) return [];
  const entries: unknown = JSON.parse(source);
  if (!Array.isArray(entries)) throw new Error("คลังงานไม่ถูกต้อง");
  return entries.map(entry => {
    if (!entry || typeof entry.id !== "string" || typeof entry.savedAt !== "string" || !entry.sections ||
      Object.values(entry.sections).some(value => typeof value !== "string")) throw new Error("รายการงานไม่ถูกต้อง");
    return { ...entry, project: readValidationProject(JSON.stringify(entry.project)) };
  });
}

// Each save is one atomic snapshot, retaining all related inputs and section save times.
// Do not silently overwrite an unreadable library or report success on quota failure.
export function saveValidationWork(owner: string, id: string, section: string, source: unknown, storage: Storage = localStorage) {
  const project = readValidationProject(JSON.stringify(source));
  const entries = loadValidationLibrary(owner, storage);
  const savedAt = new Date().toISOString();
  if (!validationDrugKey(project.analyte)) throw new Error("กรุณาระบุชื่อยา");
  const matching = entries.filter(entry => validationDrugKey(entry.project.analyte) === validationDrugKey(project.analyte));
  const existing = matching[0] ?? entries.find(entry => entry.id === id);
  const work: ValidationSavedWork = { id: existing?.id ?? id, savedAt, sections: { ...existing?.sections, ...Object.assign({}, ...matching.map(entry => entry.sections)), [section]: savedAt }, project };
  storage.setItem(key(owner), JSON.stringify([work, ...entries.filter(entry => entry.id !== work.id && validationDrugKey(entry.project.analyte) !== validationDrugKey(project.analyte))]));
  return work;
}

export function clearValidationLibrary(owner: string, storage: Storage = localStorage) {
  const source = storage.getItem(key(owner));
  if (!source || !loadValidationLibrary(owner, storage).length) return;
  storage.setItem(`${key(owner)}:recovery`, source);
  storage.removeItem(key(owner));
}
export function restoreValidationLibrary(owner: string, storage: Storage = localStorage) {
  const source = storage.getItem(`${key(owner)}:recovery`);
  if (!source) return false;
  if (loadValidationLibrary(owner, storage).length) throw new Error("คลังงานต้องว่างก่อนกู้คืน");
  storage.setItem(key(owner), source);
  storage.removeItem(`${key(owner)}:recovery`);
  return true;
}
