# Lab Status Label Simplification — Design

**Date:** 2026-07-13  
**Status:** Approved for implementation  
**Author:** Codex

## Goal

Simplify the two Lab workflow labels requested by the user without changing any
workflow state, routing, permissions, notification trigger, or badge styling.

| Current label | New label |
| --- | --- |
| `Lab ตรวจครบ · รอออกผล` | `รอออกผล` |
| `ตรวจครบแล้ว · รอหัวหน้า Lab ออกผล` | `รอตรวจ` |

## Scope

Update the exact label values produced by the status helpers and the LINE
notification formatter. Update their focused unit tests to assert the new
values. Text with different wording or a different UI purpose is out of scope.

## Design

Keep the existing status-branch order and conditions unchanged. Replace only
the returned string in these producers:

- `src/lib/statusBadge.ts`
- `src/lib/receiveStatus.ts`
- `server/lib/lineNotify.js`

Tests in the matching `*.test.ts` files will be revised in the same change.
This preserves the mapping between the existing Lab state and its presentation
while ensuring the browser UI and LINE notification use the requested labels.

## Validation

Run the focused status tests and TypeScript checking. Do not run a production
build, in accordance with the repository policy.

## Non-goals

- Renaming related but non-identical explanatory text.
- Changing approval or completion logic.
- Changing dashboard KPI names or navigation.
