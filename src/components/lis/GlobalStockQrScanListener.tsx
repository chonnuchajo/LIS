import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { parseScannedQrId } from "@/lib/stockUnit";

const SCANNER_IDLE_MS = 80;

function isStockBottleQr(raw: string) {
  const text = raw.trim();
  if (!text) return false;

  try {
    const url = new URL(text);
    const path = url.pathname;
    return path.endsWith("/stock/view") || path.includes("/stock/scan/") || path.endsWith("/stock-deduction");
  } catch {
    return false;
  }
}

export default function GlobalStockQrScanListener() {
  const navigate = useNavigate();
  const location = useLocation();
  const bufferRef = useRef("");
  const lastKeyAtRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;

      const now = Date.now();
      if (now - lastKeyAtRef.current > SCANNER_IDLE_MS) bufferRef.current = "";
      lastKeyAtRef.current = now;

      if (event.key === "Enter") {
        const raw = bufferRef.current;
        bufferRef.current = "";
        if (!isStockBottleQr(raw)) return;

        const qrId = parseScannedQrId(raw);
        if (!qrId) return;

        event.preventDefault();
        const search = "?qrId=" + encodeURIComponent(qrId);
        if (location.pathname === "/stock-deduction" && location.search === search) return;
        navigate({ pathname: "/stock-deduction", search });
        return;
      }

      if (event.key.length === 1) bufferRef.current += event.key;
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [location.pathname, location.search, navigate]);

  return null;
}
