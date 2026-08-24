import { afterEach, describe, expect, it, vi } from "vitest";
import { extractBuildSignature, startBuildRefreshWatcher } from "./buildRefresh";

describe("build refresh watcher", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.head.innerHTML = "";
  });

  it("extracts a normalized signature from built asset references", () => {
    const html = `
      <link rel="modulepreload" crossorigin href="./assets/vendor-react.js">
      <script type="module" crossorigin src="./assets/index.js"></script>
    `;

    expect(extractBuildSignature(html, "https://example.test/LIS/app.html")).toBe(
      "/LIS/assets/vendor-react.js\n/LIS/assets/index.js",
    );
  });

  it("reloads the page when the latest app entry points change", async () => {
    vi.useFakeTimers();
    document.head.innerHTML = `<script type="module" crossorigin src="/LIS/assets/index-old.js"></script>`;
    const fetcher = vi.fn().mockResolvedValue(
      new Response(`<script type="module" crossorigin src="./assets/index-new.js"></script>`),
    );
    const reload = vi.fn();

    const stop = startBuildRefreshWatcher({
      enabled: true,
      baseUrl: "/LIS/",
      intervalMs: 1_000,
      fetcher,
      reload,
    });

    await vi.advanceTimersByTimeAsync(1_000);

    expect(fetcher).toHaveBeenCalledWith(
      expect.stringMatching(/^\/LIS\/app\.html\?lisBuildCheck=\d+$/),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(reload).toHaveBeenCalledTimes(1);

    stop();
  });

  it("keeps the page open when the app entry points are unchanged", async () => {
    vi.useFakeTimers();
    document.head.innerHTML = `<script type="module" crossorigin src="/LIS/assets/index-same.js"></script>`;
    const fetcher = vi.fn().mockResolvedValue(
      new Response(`<script type="module" crossorigin src="./assets/index-same.js"></script>`),
    );
    const reload = vi.fn();

    const stop = startBuildRefreshWatcher({
      enabled: true,
      baseUrl: "/LIS/",
      intervalMs: 1_000,
      fetcher,
      reload,
    });

    await vi.advanceTimersByTimeAsync(1_000);

    expect(reload).not.toHaveBeenCalled();

    stop();
  });
});
