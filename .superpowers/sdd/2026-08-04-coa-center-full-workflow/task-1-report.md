# Task 1 Report: Backend COA Core Models, Numbering, And Lifecycle

## Status

DONE

## Implemented

- Added `server/models/CoaCounter.js` with one counter per Gregorian year and atomic sequence increment support.
- Added `server/models/CoaDocument.js` with the required lifecycle status enum, petition references, immutable customer/sample/result snapshots, revision relationships, approval/rejection metadata, cancellation metadata, print metadata, timestamps, and indexes.
- Added `server/models/CoaAuditLog.js` with the required lifecycle event enum, actor, note, metadata, timestamps, and audit indexes.
- Added `server/lib/coaNumber.js` with `formatCoaNo(sequence, year)` and atomic `nextCoaNumber(now)`.
- Added `server/lib/coaLifecycle.js` with `COA_STATUSES`, QC Head detection, transition validation, printable status set, and actor extraction.
- Added `server/lib/coaLifecycle.test.js` covering numbering, QC Head signals, valid/invalid transitions, and printable statuses.

## TDD Evidence

1. Added the required tests before production implementation.
2. Ran `node --test server/lib/coaLifecycle.test.js`; it failed with the expected missing `./coaNumber` module.
3. Added the minimal production implementation from the approved brief.
4. Ran `node --test server/lib/coaLifecycle.test.js`; 4 tests passed and 0 failed.

## Verification

- `node --test server/lib/coaLifecycle.test.js`: PASS, 4/4 tests.
- Mongoose model load check: PASS; all three models load and the document model exposes 10 statuses.
- `git diff --check`: PASS.
- No build command was run.

## Commits

- `a58c8a54 feat: add coa lifecycle core`

## Concerns

- No concerns identified within Task 1 scope. Database-backed behavior of `nextCoaNumber` remains dependent on the application’s configured MongoDB connection and is intentionally covered by the helper implementation rather than a live database test here.
