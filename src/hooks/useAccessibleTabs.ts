import { useMemo } from "react";
import { useEffectivePermissions } from "./useEffectivePermissions";
import { tabsFor, isTabDenied, type TabDef } from "@/lib/tabRegistry";

/**
 * Deny-model gating for in-page tabs. A tab from the registry is visible unless the
 * user's effective permissions deny it (`deny:${parent}/${key}`). `adminOnly` tabs
 * are visible only to admin; admin is never denied; a key not in the registry is
 * always visible (pages that opt out of control). Render the returned `tabs` as the
 * TabsList and seed the active tab with `defaultKey` so a user never lands on a
 * hidden tab.
 */
export function useAccessibleTabs(parentPath: string) {
  const { permissions, isAdmin } = useEffectivePermissions();

  return useMemo(() => {
    const registry = tabsFor(parentPath);
    const byKey = new Map(registry.map((t) => [t.key, t]));
    const isVisible = (key: string) => {
      const def = byKey.get(key);
      if (!def) return true; // unregistered → always visible
      if (def.adminOnly) return isAdmin;
      if (isAdmin) return true;
      return !isTabDenied(permissions, parentPath, key);
    };
    const tabs: TabDef[] = registry.filter((t) => isVisible(t.key));
    const visibleKeys = tabs.map((t) => t.key);
    return { tabs, isVisible, visibleKeys, defaultKey: visibleKeys[0] };
  }, [permissions, isAdmin, parentPath]);
}
