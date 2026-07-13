# Route Loading: Scanning Beam Design

## Goal

Replace the application-wide lazy-route fallback spinner with a full-screen
loading transition that uses the supplied laboratory artwork. The loader must
appear whenever a lazy-loaded route is pending and must not replace local
loading indicators in forms, tables, buttons, or data views.

## Visual design

- Use the supplied `Untitled design.svg` as the centered hero artwork without
  recolouring it. The artwork remains white and is displayed against a
  charcoal-to-black background.
- Place a restrained, soft white halo behind the artwork to separate it from
  the background.
- Animate the artwork with a small vertical float and a subtle glow pulse.
- Add a translucent horizontal scanning beam that travels from top to bottom.
  Its trailing blur and a faint reflected line create the primary motion.
- Add a thin orbit ring and a small number of low-contrast particles. These
  remain behind the artwork so they do not obscure its silhouette.
- Display the exact Thai status text `กำลังเตรียมสาร…` beneath the artwork.
  The existing ellipsis may pulse in opacity, but no additional punctuation is
  appended.

## Integration

- Add the supplied SVG to the source asset directory so it is bundled and
  imported normally by the React app.
- Extract the fallback into a focused `RouteLoading` component and render it
  from the existing root `Suspense` boundary in `src/App.tsx`.
- Keep the component self-contained: no interval timers, external requests,
  state, or new dependencies. All visual motion is CSS-based.

## Responsive and accessible behavior

- Cover the full viewport and preserve the current fallback's centered layout.
- Scale the artwork with a bounded responsive size so it stays prominent on
  desktop without overflowing small mobile screens.
- Provide semantic loading status through `role="status"` and an accessible
  label matching the visible status text.
- Honour `prefers-reduced-motion`: stop the scan, orbit, particles, text-dot
  animation, and artwork float; retain a static, readable composition.

## Verification

- Add a focused component test that verifies the loading status and artwork
  are rendered.
- Run the focused test and `npx tsc --noEmit` if the project configuration
  supports it. Do not run a production or development build.
