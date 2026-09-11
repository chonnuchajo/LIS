import { getPwaAssetUrl } from "./pwa";

type BuildRefreshWatcherOptions = {
  enabled?: boolean;
  baseUrl?: string;
  intervalMs?: number;
  documentRef?: Document;
  fetcher?: typeof fetch;
  reload?: () => void;
};

const BUILD_ASSET_PATTERN = /\b(?:src|href)=(['"])(.*?)\1/gi;
const DEFAULT_INTERVAL_MS = 5_000;

function normalizeAssetUrl(rawUrl: string, entryUrl: string) {
  try {
    const url = new URL(rawUrl, entryUrl);
    return `${url.pathname}${url.search}`;
  } catch {
    return rawUrl;
  }
}

function isBuildAsset(path: string) {
  return /(?:^|\/)assets\//.test(path);
}

export function extractBuildSignature(html: string, entryUrl = getPwaAssetUrl("app.html")) {
  const assets: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = BUILD_ASSET_PATTERN.exec(html)) !== null) {
    const assetPath = normalizeAssetUrl(match[2], entryUrl);
    if (isBuildAsset(assetPath)) assets.push(assetPath);
  }

  return assets.join("\n");
}

function toAssetSet(signature: string) {
  return new Set(signature.split("\n").filter(Boolean));
}

function readCurrentBuildSignature(documentRef: Document) {
  const entryUrl = documentRef.baseURI || getPwaAssetUrl("app.html");
  return Array.from(documentRef.querySelectorAll<HTMLLinkElement | HTMLScriptElement>("link[href],script[src]"))
    .map((element) => element.getAttribute("href") || element.getAttribute("src") || "")
    .map((assetUrl) => normalizeAssetUrl(assetUrl, entryUrl))
    .filter(isBuildAsset)
    .join("\n");
}

function buildEntryCheckUrl(baseUrl: string) {
  const url = new URL(getPwaAssetUrl("app.html", baseUrl), window.location.origin);
  url.searchParams.set("lisBuildCheck", String(Date.now()));
  return `${url.pathname}${url.search}`;
}

export function startBuildRefreshWatcher(options: BuildRefreshWatcherOptions = {}) {
  const {
    enabled = import.meta.env.PROD,
    baseUrl = import.meta.env.BASE_URL || "/",
    intervalMs = DEFAULT_INTERVAL_MS,
    documentRef = typeof document === "undefined" ? undefined : document,
    fetcher = typeof fetch === "undefined" ? undefined : fetch.bind(globalThis),
    reload = () => window.location.reload(),
  } = options;

  if (!enabled || !documentRef || !fetcher || typeof window === "undefined") return () => {};

  const currentSignature = readCurrentBuildSignature(documentRef);
  if (!currentSignature) return () => {};
  const currentAssets = toAssetSet(currentSignature);

  let checking = false;
  let stopped = false;

  const checkForNewBuild = async () => {
    if (checking || stopped) return;
    checking = true;
    try {
      const entryUrl = buildEntryCheckUrl(baseUrl);
      const response = await fetcher(entryUrl, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!response.ok) return;

      const latestSignature = extractBuildSignature(await response.text(), new URL(entryUrl, window.location.origin).toString());
      const latestAssets = toAssetSet(latestSignature);
      if (latestAssets.size > 0 && [...latestAssets].some((asset) => !currentAssets.has(asset))) {
        stopped = true;
        reload();
      }
    } catch (error) {
      console.error("[build-refresh] latest build check failed", error);
    } finally {
      checking = false;
    }
  };

  const intervalId = window.setInterval(checkForNewBuild, intervalMs);
  return () => {
    stopped = true;
    window.clearInterval(intervalId);
  };
}
