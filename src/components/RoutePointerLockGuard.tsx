import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { releaseBodyPointerLock } from "@/context/ConfirmDialog";

/**
 * Safety net for the Radix dialog pointer-lock race (Radix #1241 / #2122).
 *
 * Radix locks the page while a modal is open via `document.body.style.
 * pointerEvents = "none"` and only restores it once the close animation
 * finishes. If the app navigates while a dialog is closing, the next page can
 * mount inside that window with the whole body — sidebar nav included — still
 * unclickable ("dead window"). `ConfirmDialog` clears it synchronously on its
 * own close, but raw Radix `Dialog`s (e.g. RevisionRequestDialog) rely on
 * Radix's own restore, which loses the race intermittently.
 *
 * Clearing the lock on every route change guarantees a freshly navigated page
 * is never born locked, whichever dialog leaked it. It is a no-op when nothing
 * is stuck. The extra rAF pass covers Radix re-applying the lock mid-animation
 * right after the navigation commits.
 */
export default function RoutePointerLockGuard() {
  const { pathname } = useLocation();
  useEffect(() => {
    releaseBodyPointerLock();
    const raf = requestAnimationFrame(releaseBodyPointerLock);
    return () => cancelAnimationFrame(raf);
  }, [pathname]);
  return null;
}
