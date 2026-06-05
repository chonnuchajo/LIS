// Dev mode bypasses Microsoft login and injects a hardcoded user.
// Vite sets import.meta.env.DEV to false for production builds.
export const DEV_MODE =
  import.meta.env.DEV && import.meta.env.VITE_DEV_MODE !== "false";

export const DEV_DEFAULT_ROLE = "admin";

export type DevAuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  department: string;
  position: string;
  status: "active";
};

// Mock the HR/Microsoft department per dev role (prod gets it from Microsoft sync).
// admin→IT, lab*→lab, qc*→qc, viewer→ผลิต 1.
const devDepartment = (roleId: string): string => {
  if (roleId === "admin") return "IT";
  if (roleId.startsWith("lab")) return "lab";
  if (roleId.startsWith("qc")) return "qc";
  if (roleId === "viewer") return "ผลิต 1";
  return roleId;
};

export const synthesizeDevUser = (role: { id: string; name: string }): DevAuthUser => ({
  id: `dev-${role.id}`,
  email: `${role.id}.dev@icpladda.com`,
  name: `Dev ${role.name}`,
  role: role.id,
  permissions: [],
  department: devDepartment(role.id),
  position: role.name,
  status: "active",
});

// Lab roles offered as fake assignees on /petitions/assign in dev mode. The HR
// API only returns real staff, so dev has no one to assign to — these let you
// assign a petition and then switch to that dev role to test the lab pages.
export const DEV_LAB_ROLES = [
  { id: "lab-analyst", name: "Lab Analyst" },
  { id: "lab-head", name: "Lab Head" },
  { id: "lab-inventory", name: "Lab Inventory" },
] as const;

export type DevAssignee = {
  id: number;
  employeeId: string;
  name: string;
  department: string;
  position: string;
  empType: string;
  isActive: boolean;
};

// `name` mirrors synthesizeDevUser so LabTestingPage's
// `assignedTo?.name === user?.name` filter matches after switching dev role.
export const synthesizeDevAssignees = (): DevAssignee[] =>
  DEV_LAB_ROLES.map((role, index) => ({
    id: -(index + 1),
    employeeId: `DEV-${role.id}`,
    name: synthesizeDevUser(role).name,
    department: "Lab/วิเคราะห์",
    position: role.name,
    empType: "รายเดือน",
    isActive: true,
  }));