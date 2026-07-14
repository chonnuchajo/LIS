import { useEffect, useState, type ReactNode } from "react";
import { RouteLoading } from "./RouteLoading";

interface StartupLoadingGateProps {
  children: ReactNode;
  minimumDurationMs?: number;
}

export function StartupLoadingGate({
  children,
  minimumDurationMs = 0,
}: StartupLoadingGateProps): JSX.Element {
  const [ready, setReady] = useState(() => minimumDurationMs <= 0);

  useEffect(() => {
    if (minimumDurationMs <= 0) {
      setReady(true);
      return;
    }

    const timerId = window.setTimeout(() => {
      setReady(true);
    }, minimumDurationMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [minimumDurationMs]);

  return ready ? <>{children}</> : <RouteLoading />;
}
