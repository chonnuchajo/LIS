// Tabs that live INSIDE a page (no React Router route of their own) but should be
// lockable per role/group via the Access Control matrix. Each entry maps to a
// "virtual path" `${parent}/${key}` used as a permission key — it is never a real
// route. Add an entry here to make a tab restricted; remove it to leave the tab
// open to anyone who can access the parent page.
export type RestrictedTab = {
  parent: string; // parent nav page path, e.g. "/settings"
  key: string; // Radix Tabs value, e.g. "dashboard"
  label: string; // shown in the Access Control matrix
};

export const RESTRICTED_TABS: RestrictedTab[] = [
  { parent: "/settings", key: "dashboard", label: "ตั้งค่าระบบ — แดชบอร์ด" },
];

export const tabPath = (parent: string, key: string) => `${parent}/${key}`;

export const RESTRICTED_TAB_PATHS = RESTRICTED_TABS.map((t) => tabPath(t.parent, t.key));

export const restrictedTabsFor = (parent: string) =>
  RESTRICTED_TABS.filter((t) => t.parent === parent);

// True if `${parent}/${key}` is a registered restricted tab.
export const isRestrictedTab = (parent: string, key: string) =>
  RESTRICTED_TABS.some((t) => t.parent === parent && t.key === key);
