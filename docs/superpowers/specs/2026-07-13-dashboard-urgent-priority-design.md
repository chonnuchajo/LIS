# Dashboard Urgent Priority Design

## Goal

Show user-submitted urgent work consistently on every role dashboard. A
petition with `priority === 1` is urgent; `priority === 0` and a missing
legacy value are normal.

## Data Contract

The API already serializes the Mongoose `Petition.priority` value. Add the
optional `priority` field to the frontend petition type so dashboard code can
use that persisted value without inferring urgency from abnormal results,
returned work, or work age.

## Dashboard Presentation

Add an `urgentTotal` KPI to every dashboard profile as the first KPI. It uses
the existing red alert presentation and counts all loaded petitions with
`priority === 1`.

Every dashboard work table derives its urgent IDs from the same condition.
Urgent rows display the existing urgent label and visual treatment. Rows sort
by urgency first, then by the existing oldest-work-first ordering inside each
priority group. Age of 48 hours or more remains a separate visual warning and
does not make a petition urgent.

## Scope

No new API route, form field, standalone urgent-work table, or list-page query
filter is added. The change only exposes and presents the `priority` field
that is already stored with each petition.

## Tests

Add focused metric tests for the urgent KPI and component tests proving that
the action table prioritizes `priority === 1` rows. Preserve existing dashboard
and worklist behavior for normal-priority petitions.
