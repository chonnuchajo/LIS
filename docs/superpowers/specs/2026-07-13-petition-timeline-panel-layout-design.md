# Petition Timeline Panel Layout Design

## Goal

Separate the task list from the activity feed and place the document actions beside the activity feed on the petition timeline detail page.

## Layout

At `xl` and wider, the content below the petition header is a two-column grid:

- Main column: `Project Timeline`, then a separate `Tasks` card.
- Side column: `Recent Activity`, then a separate `Documents` card.

The activity and document cards remain independent panels. Documents are not nested inside Recent Activity.

Below `xl`, all four panels stack in this order: Timeline, Tasks, Recent Activity, Documents.

## Behavior

The change is presentational only. Existing task progress, activity expansion and retry, document eligibility, loading, error, and print-preview behavior remain unchanged.

## Verification

Update the timeline detail page test to assert the four labeled panels render. Run the focused detail test and TypeScript check; do not run a production build.
