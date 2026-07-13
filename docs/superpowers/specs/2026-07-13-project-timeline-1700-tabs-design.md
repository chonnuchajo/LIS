# Project Timeline 17:00 Default and Day Tabs Design

## Goal

Update the petition detail Project Timeline so a single-day timeline defaults to 17:00 instead of 20:00, expands only when actual timeline data goes past 17:00, and uses one tab per day when the timeline spans more than one day.

## Scope

- Applies to `Project Timeline` on `/petition-timeline/:id`.
- Keeps existing task, activity, document, header, and permission behavior unchanged.
- Does not run build commands.

## Behavior

- Same-day open work uses 17:00 as the estimated end time.
- Same-day completed work uses the actual final timestamp.
- Same-day timeline rendering expands beyond 17:00 when any displayed stage or actual end timestamp is after 17:00.
- Multi-day timeline exposes one tab per local day.
- Each day tab has its own start, end, ticks, and visible stage positions.
- Each day starts at the normal 08:00 workday baseline so the existing scale remains consistent.
- Middle days show the normal work window from 08:00 to 17:00.
- The final day ends at the actual end/current time when it is after 17:00; otherwise it ends at 17:00.

## Implementation Shape

- Extend `TimelineDetailModel.timeline` with `days`, where each day includes `key`, `label`, `startAt`, `endAt`, `ticks`, and the existing timeline stages filtered to the stages visible in that day window.
- Keep the existing top-level `timeline.startAt`, `timeline.endAt`, `timeline.ticks`, and `timeline.stages` fields for compatibility while the page migrates to `timeline.days`.
- Add focused unit tests in `src/lib/petitionTimelineDetail.test.ts` before production changes.
- Add page tests in `src/pages/PetitionTimelineDetailPage.test.tsx` for multi-day tabs.
- Render tab buttons only when there is more than one day.

## Testing

- Run focused model tests: `npx vitest run src/lib/petitionTimelineDetail.test.ts`.
- Run focused page tests: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx`.
- Optionally run TypeScript validation with `npx tsc --noEmit`.
