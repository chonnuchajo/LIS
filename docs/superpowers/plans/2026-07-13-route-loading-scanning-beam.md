# Scanning-Beam Route Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Replace the global lazy-route spinner with a full-screen, accessible scanning-beam loading transition based on the supplied laboratory artwork.

**Architecture:** A self-contained RouteLoading component owns the asset, semantic loading status, and visual layers. Its CSS file provides all motion with no JavaScript timers or dependencies. App.tsx consumes that component at the existing root Suspense boundary, so local spinners remain unchanged.

**Tech Stack:** React 18, TypeScript, Vite static asset imports, CSS keyframes, Vitest, Testing Library.

## Global Constraints

- Use the supplied SVG unchanged, at src/assets/route-loading-lab.svg.
- Display the exact copy กำลังเตรียมสาร…; do not append any extra punctuation.
- Apply the loader only to the existing lazy-route Suspense fallback; do not change local loading states.
- Use CSS-only motion; add no dependencies, timers, requests, or component state.
- Respect prefers-reduced-motion by stopping decorative animation.
- Do not run npm run build, npm run build:dev, npm run build:watch, vite build, or a command that triggers a build/postbuild workflow.

---

## File structure

- src/assets/route-loading-lab.svg — unchanged supplied laboratory artwork, packaged as a Vite static asset.
- src/components/RouteLoading.tsx — semantic route-transition loading component and decorative layer markup.
- src/components/RouteLoading.css — isolated charcoal background, scan beam, orbit, particles, responsive sizing, and reduced-motion rules.
- src/components/RouteLoading.test.tsx — focused rendering and accessibility assertions.
- src/App.tsx — replaces the inline RouteFallback with RouteLoading at the global Suspense boundary.

### Task 1: Route loading component and root fallback integration

**Files:**

- Create: src/assets/route-loading-lab.svg
- Create: src/components/RouteLoading.tsx
- Create: src/components/RouteLoading.css
- Create: src/components/RouteLoading.test.tsx
- Modify: src/App.tsx:1-2,68-72,105

**Interfaces:**

- Consumes: Vite's existing static SVG import support and the existing root Suspense boundary.
- Produces: RouteLoading(): JSX.Element, rendered as fallback={<RouteLoading />} for lazy route transitions.

- [ ] **Step 1: Write the focused failing component test**

Create src/components/RouteLoading.test.tsx:

~~~tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouteLoading } from "./RouteLoading";

describe("RouteLoading", () => {
  it("renders the route transition status and supplied laboratory artwork", () => {
    render(<RouteLoading />);

    expect(
      screen.getByRole("status", { name: "กำลังเตรียมสาร…" }),
    ).toBeInTheDocument();
    expect(screen.getByText("กำลังเตรียมสาร…")).toBeInTheDocument();
    expect(screen.getByTestId("route-loading-artwork")).toHaveAttribute(
      "src",
      expect.stringContaining("route-loading-lab.svg"),
    );
    expect(screen.getByTestId("route-loading-scan")).toBeInTheDocument();
  });
});
~~~

- [ ] **Step 2: Run the test to prove the component does not exist yet**

Run:

~~~powershell
npx vitest run src/components/RouteLoading.test.tsx
~~~

Expected: FAIL because ./RouteLoading cannot be resolved.

- [ ] **Step 3: Add the approved source artwork as a bundled asset**

Run:

~~~powershell
Copy-Item -LiteralPath 'C:\Users\it6ic\OneDrive\Desktop\Untitled design.svg' -Destination 'src\assets\route-loading-lab.svg'
~~~

Expected: src/assets/route-loading-lab.svg exists and is an unchanged copy of the user-supplied SVG.

- [ ] **Step 4: Implement the semantic component markup**

Create src/components/RouteLoading.tsx:

~~~tsx
import artworkUrl from "@/assets/route-loading-lab.svg";
import "./RouteLoading.css";

export function RouteLoading() {
  return (
    <main
      className="route-loading"
      role="status"
      aria-live="polite"
      aria-label="กำลังเตรียมสาร…"
    >
      <div className="route-loading__scene" aria-hidden="true">
        <span className="route-loading__halo" />
        <span className="route-loading__orbit" />
        <span className="route-loading__scan" data-testid="route-loading-scan" />
        <span className="route-loading__particle route-loading__particle--one" />
        <span className="route-loading__particle route-loading__particle--two" />
        <span className="route-loading__particle route-loading__particle--three" />
        <span className="route-loading__particle route-loading__particle--four" />
        <span className="route-loading__particle route-loading__particle--five" />
        <img
          className="route-loading__artwork"
          data-testid="route-loading-artwork"
          src={artworkUrl}
          alt=""
        />
      </div>
      <p className="route-loading__label">กำลังเตรียมสาร…</p>
    </main>
  );
}
~~~

- [ ] **Step 5: Implement the isolated visual treatment and reduced-motion fallback**

Create src/components/RouteLoading.css:

~~~css
.route-loading {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  min-height: 100dvh;
  place-content: center;
  gap: 1.5rem;
  overflow: hidden;
  isolation: isolate;
  color: #ffffff;
  background:
    radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.12), transparent 28rem),
    radial-gradient(circle at 50% 50%, #20252d 0%, #0b0e13 48%, #050608 100%);
}

.route-loading::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  content: "";
  opacity: 0.18;
  background-image: radial-gradient(rgba(255, 255, 255, 0.42) 0.65px, transparent 0.8px);
  background-size: 6px 6px;
  mask-image: radial-gradient(circle at center, black, transparent 75%);
}

.route-loading__scene {
  position: relative;
  display: grid;
  width: clamp(13rem, min(32vw, 45vh), 21rem);
  aspect-ratio: 1;
  place-items: center;
}

.route-loading__halo,
.route-loading__orbit,
.route-loading__scan,
.route-loading__particle {
  position: absolute;
  pointer-events: none;
}

.route-loading__halo {
  inset: 12%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0) 68%);
  filter: blur(10px);
  animation: route-loading-breathe 2.8s ease-in-out infinite;
}

.route-loading__orbit {
  width: 116%;
  aspect-ratio: 1;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 50%;
  box-shadow: inset 0 0 24px rgba(255, 255, 255, 0.08), 0 0 24px rgba(255, 255, 255, 0.08);
  animation: route-loading-orbit 9s linear infinite;
}

.route-loading__scan {
  z-index: 1;
  inset-inline: -20%;
  top: -28%;
  height: 20%;
  opacity: 0;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(255, 255, 255, 0.1) 24%,
    rgba(255, 255, 255, 0.86) 48%,
    rgba(255, 255, 255, 0.12) 72%,
    transparent
  );
  filter: blur(2px);
  mix-blend-mode: screen;
  animation: route-loading-scan 3.8s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}

.route-loading__artwork {
  z-index: 2;
  width: 88%;
  height: 88%;
  object-fit: contain;
  filter: drop-shadow(0 0 18px rgba(255, 255, 255, 0.3));
  animation: route-loading-float 2.8s ease-in-out infinite;
}

.route-loading__particle {
  z-index: 1;
  width: 0.32rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.9);
  animation: route-loading-particle 3.2s ease-in-out infinite;
}

.route-loading__particle--one { top: 17%; left: 4%; animation-delay: -0.4s; }
.route-loading__particle--two { top: 8%; right: 18%; animation-delay: -1.3s; }
.route-loading__particle--three { top: 62%; left: -2%; animation-delay: -2.1s; }
.route-loading__particle--four { right: 1%; bottom: 18%; animation-delay: -0.9s; }
.route-loading__particle--five { right: 22%; bottom: 4%; animation-delay: -2.6s; }

.route-loading__label {
  margin: 0;
  color: rgba(255, 255, 255, 0.88);
  font-size: clamp(0.95rem, 1.4vw, 1.15rem);
  font-weight: 500;
  letter-spacing: 0.04em;
  text-align: center;
  text-shadow: 0 0 18px rgba(255, 255, 255, 0.2);
}

@keyframes route-loading-breathe {
  0%, 100% { transform: scale(0.92); opacity: 0.62; }
  50% { transform: scale(1.08); opacity: 1; }
}

@keyframes route-loading-orbit {
  to { transform: rotate(360deg); }
}

@keyframes route-loading-scan {
  0%, 8% { transform: translateY(0); opacity: 0; }
  16%, 76% { opacity: 0.95; }
  88%, 100% { transform: translateY(780%); opacity: 0; }
}

@keyframes route-loading-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-0.65rem); }
}

@keyframes route-loading-particle {
  0%, 100% { transform: translateY(0) scale(0.7); opacity: 0.25; }
  50% { transform: translateY(-0.75rem) scale(1); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .route-loading *,
  .route-loading::before {
    animation: none !important;
    transition: none !important;
  }
}
~~~

- [ ] **Step 6: Replace the inline fallback at the root Suspense boundary**

In src/App.tsx, add this import after the existing component imports:

~~~tsx
import { RouteLoading } from "@/components/RouteLoading";
~~~

Delete the existing RouteFallback declaration:

~~~tsx
const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
  </div>
);
~~~

Replace the root fallback usage:

~~~tsx
<Suspense fallback={<RouteLoading />}>
~~~

Expected: the only global lazy-route fallback now renders RouteLoading; all existing page- and control-level loaders are untouched.

- [ ] **Step 7: Run verification without building**

Run:

~~~powershell
npx vitest run src/components/RouteLoading.test.tsx
~~~

Expected: PASS with one test passing.

Run:

~~~powershell
npx tsc --noEmit
~~~

Expected: exit code 0. If it fails on pre-existing diagnostics outside these files, record them separately and do not change unrelated code.

Run:

~~~powershell
git diff --check
~~~

Expected: no output.

- [ ] **Step 8: Review the scoped diff and commit only this feature**

Run:

~~~powershell
git diff -- src/App.tsx src/components/RouteLoading.tsx src/components/RouteLoading.css src/components/RouteLoading.test.tsx src/assets/route-loading-lab.svg
~~~

Expected: only the global route fallback, the new component/test/style files, and the supplied artwork are present.

Run:

~~~powershell
git add src/App.tsx src/components/RouteLoading.tsx src/components/RouteLoading.css src/components/RouteLoading.test.tsx src/assets/route-loading-lab.svg
git commit -m "feat: add scanning route loader"
~~~

Expected: one feature commit containing only the route-loading change.

## Plan self-review

- Spec coverage: Task 1 covers the unchanged artwork, full-screen charcoal backdrop, halo, scan beam, orbit, particles, exact Thai copy, root-only integration, responsive bounds, semantic status, reduced motion, and focused verification.
- Placeholder scan: no TBD, TODO, deferred implementation, or unspecified test instructions remain.
- Type consistency: the component export is consistently named RouteLoading, imported by App.tsx, and rendered without props.

