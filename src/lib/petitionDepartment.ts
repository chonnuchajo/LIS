import { PETITION_DEPT_LABELS, type PetitionDept } from '@/types/petition.types';

interface PetitionDepartmentSource {
  dept: PetitionDept;
  submittedBy?: {
    department?: string | null;
  } | null;
}

export function petitionDepartmentLabel(petition: PetitionDepartmentSource): string {
  return petition.submittedBy?.department?.trim() || PETITION_DEPT_LABELS[petition.dept];
}
