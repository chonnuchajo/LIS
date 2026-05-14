<<<<<<< HEAD
=======
// Dev mode bypasses Microsoft login and injects a hardcoded user.
// Keep VITE_DEV_MODE unset or set it to "false" outside local development.
export const DEV_MODE =
  import.meta.env.MODE === "development" &&
  import.meta.env.VITE_DEV_MODE !== "false";

export const DEV_DEFAULT_ROLE = "admin";

<<<<<<< HEAD
=======
export const DEV_USERS: Record<string, DevUser> = {
  admin: {
    id: "dev-admin",
    email: "admin.dev@example.local",
    name: "Dev Admin",
    role: "admin",
    permissions: ALL_PERMISSIONS,
    department: "Development",
=======
>>>>>>> b48f25bb388837cc8c1bae6ab1c97f958e5728aa
// Dev mode bypasses Microsoft login and injects a hardcoded user.
// Driven by Vite's build mode: true under `npm run dev`, false under
// `npm run build`. Never hardcode this — a tracked literal causes endless
// merge conflicts and risks shipping a dev-mode production build.
export const DEV_MODE = import.meta.env.DEV;

export const DEV_DEFAULT_ROLE = "admin";

>>>>>>> 7e35d8613802ed082a264cc2d38b6b82103b13c2
type DevUser = {
  id?: string;
  email: string;
  name?: string;
  role?: string;
  permissions?: string[];
  department?: string;
  position?: string;
  status?: "active" | "inactive";
};

export const DEV_USERS: Record<string, DevUser> = {
  admin: {
    id: "dev-admin",
    email: "dev@icpladda.com",
    name: "Dev Admin",
    role: "admin",
    permissions: [],
    department: "IT",
    position: "Administrator",
    status: "active",
  },
  lab: {
    id: "dev-lab",
    email: "lab.dev@icpladda.com",
    name: "Dev Lab",
    role: "lab",
    permissions: [],
    department: "Lab",
    position: "Lab Technician",
    status: "active",
  },
  qc: {
    id: "dev-qc",
    email: "qc.dev@icpladda.com",
    name: "Dev QC",
    role: "qc",
    permissions: [],
    department: "QC",
    position: "QC Officer",
    status: "active",
  },
  viewer: {
    id: "dev-viewer",
    email: "viewer.dev@icpladda.com",
    name: "Dev Viewer",
    role: "viewer",
    permissions: [],
    department: "Office",
    position: "Viewer",
    status: "active",
  },
};
