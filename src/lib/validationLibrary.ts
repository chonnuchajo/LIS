import { readValidationProject, type ValidationProject } from "./validationProject";

export type ValidationSavedWork = {
  id: string;
  savedAt: string;
  sections: Record<string, string>;
  project: ValidationProject;
};
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
  const work: ValidationSavedWork = { id, savedAt, sections: { ...entries.find(entry => entry.id === id)?.sections, [section]: savedAt }, project };
  storage.setItem(key(owner), JSON.stringify([work, ...entries.filter(entry => entry.id !== id)]));
  return work;
}
