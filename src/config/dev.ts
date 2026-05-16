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

export const synthesizeDevUser = (role: { id: string; name: string }): DevAuthUser => ({
  id: `dev-${role.id}`,
  email: `${role.id}.dev@icpladda.com`,
  name: `Dev ${role.name}`,
  role: role.id,
  permissions: [],
  department: role.name,
  position: role.name,
  status: "active",
});
