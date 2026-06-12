import { useMemo } from "react";
import { useCanAccessPath } from "./useCanAccessPath";
import { isRestrictedTab, tabPath } from "@/lib/tabItems";

/**
 * Filters in-component tabs by access. A tab key not registered in RESTRICTED_TABS
 * for `parentPath` is always visible (open tab). A registered (restricted) tab is
 * visible only if the user is granted its virtual path `${parentPath}/${key}`.
 * `defaultKey` is the first visible key — use it to seed/guard the active tab so a
 * user never lands on a hidden tab.
 */
export function useAccessibleTabs(parentPath: string, tabKeys: string[]) {
  const canAccess = useCanAccessPath();

  return useMemo(() => {
    const isVisible = (key: string) =>
      !isRestrictedTab(parentPath, key) || canAccess(tabPath(parentPath, key));
    const visibleKeys = tabKeys.filter(isVisible);
    return { isVisible, visibleKeys, defaultKey: visibleKeys[0] };
  }, [canAccess, parentPath, tabKeys]);
}
