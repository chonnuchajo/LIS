# Petition `status_log` — Derived Human-Readable Status Timeline

**Date:** 2026-06-10
**Branch:** develop
**Status:** Design approved, pending spec review

## Problem

`Petition.status` is a coarse enum (`deliveringQC → sampleSent → pendingReview → inProgress → success → approved/rejected`). It does not convey:

- Which side (Lab / QC) has received the sample when only one has.
- Live QC testing progress (which parameters entered, overall %).
- The two distinct end-of-job confirmation steps (waiting for Lab results, then waiting for the QC head to sign off).

We want a richer, human-readable **`status_log`** — both a *current* detailed status and a *timeline* — exposed by the petitions API.

## Decisions (from brainstorming)

1. **Derive on read** — no new DB field. The API computes `status_log` from existing data (`Petition`, `PetitionAuditLog`, `QCTestResult`, `Parameter`). Keeps a single source of truth, no data drift, live QC %.
2. **Timeline from `PetitionAuditLog`** — map each existing audit event to a Thai label. `current` is computed live from petition state (so the QC % is fresh between events).
3. **QC % = lightweight server heuristic** — do NOT port the heavy frontend `matchParametersForItem` / `expandFieldForItem` / simple-method logic. Approximate at the (item × parameter) granularity. Acceptable that it may differ slightly from the QC page's field/unit-level bar.
4. **QC label shows parameter names + %** — e.g. `QC กำลังตรวจ — pH, ความชื้น (45%)`.
5. **QC-centric** — Lab appears only as received / waiting milestones, not full Lab testing detail.
6. **End-of-job ordering** — Lab finishes first, then waits for the QC head to confirm/close: `รอ QC ยืนยันผล` (per-sample) → `success` = `เสร็จสิ้น — รอหัวหน้า QC ยืนยัน` → `approved` = `หัวหน้า QC อนุมัติ — ปิดงาน`.

## Architecture

No schema change. New pure-function module + one read endpoint.

### `server/lib/petitionStatusLog.js`

```
buildStatusLog(petition, auditLogs, qcResults, parameters, labDone) → { current, timeline }
computeQcHeuristic(petition, qcResults, parameters)                 → { filled, total, percent }
```

All pure (no DB access) so they are unit-testable. The route loads the inputs and calls them.

### Endpoint

`GET /api/petitions/:id/status-log` — mounted twice (`/api` + `/LIS/api`) automatically via `mountApi()` like every other route. `:id` resolves by `_id` (when a valid ObjectId) else by `petitionNo`, matching the existing `GET /:id` pattern.

Route handler:
1. Load petition (404 if missing).
2. Load `PetitionAuditLog.find({ petitionId }).sort({ createdAt: 1 })`.
3. Load `QCTestResult.find({ petitionId })` and active `Parameter.find({ status: 'active' })` (only needed when status is in the testing range; may be skipped for terminal/pre-testing states as an optimization, but correctness does not depend on it).
4. Compute `labDone` (see Rule 5 predicate): load `PhysicalResult.find({ sampleId: { $in: labSampleIds } })` for the petition's lab sampleIds.
5. `res.json(buildStatusLog(petition, auditLogs, qcResults, parameters, labDone))`.

**Ordering note:** this route must be declared alongside the other specific `GET /:id/...` routes (e.g. `/:id/audit-logs`) — i.e. *before* the generic `GET /:id` — so Express does not swallow `status-log` as an `:id`.

### Response shape

```jsonc
{
  "current": { "label": "QC กำลังตรวจ — pH, ความชื้น (45%)", "side": "qc", "percent": 45 },
  "timeline": [
    { "label": "ยื่นคำขอ", "at": "2026-06-10T...", "actor": "..." },
    { "label": "QC รับตัวอย่าง", "at": "...", "actor": "...", "side": "qc" },
    { "label": "QC บันทึกผล — pH", "at": "...", "actor": "..." }
  ]
}
```

- `current.side` ∈ `qc | lab | undefined`. `current.percent` present only during QC testing.
- timeline entries: `{ label, at, actor, side? }`, ascending by `at`.

## Timeline derivation (audit event → label)

| audit `event` (+ context) | label |
|---|---|
| `created` | `ยื่นคำขอ` |
| `statusChanged` → `sampleSent` | `ส่งตัวอย่าง` |
| `received`, `metadata.side === 'qc'` | `QC รับตัวอย่าง` (`side: 'qc'`) |
| `received`, `metadata.side === 'lab'` | `Lab รับตัวอย่าง` (`side: 'lab'`) |
| `assigned` | `มอบหมายให้ {petition.assignedTo.name}` (fall back to audit note) |
| `resultEntered` | `QC บันทึกผล — {param}` (param from `metadata`/note) |
| `resultUpdated` | `QC แก้ไขผล — {param}` |
| `statusChanged` → `success` | `เสร็จสิ้น — รอหัวหน้า QC ยืนยัน` |
| `statusChanged` → `approved` | `หัวหน้า QC อนุมัติ — ปิดงาน` |
| `statusChanged` → `rejected` | `ส่งกลับให้แก้ไข` |
| `reviewed` / `updated` / other | omit from timeline (or pass through audit `note`) — these are not status milestones |

Unknown/unmapped events are skipped (timeline shows milestones only, not every audit row).

## Current-status derivation (first matching rule wins)

Inputs: `petition.status`, `sampleSentAt`, `labReceivedAt`, `qcReceivedAt`, `assignedTo`, the QC heuristic `{ filled, total, percent }`, and whether the petition has any **lab item** (a `petition.items` entry whose `batchNo` ends in 1 or 6 — the existing `isLabBatch` rule; replicate the digit check server-side).

| order | condition | `label` | `side` |
|---|---|---|---|
| 1 | `status === 'approved'` | `หัวหน้า QC อนุมัติ — ปิดงาน` | — |
| 2 | `status === 'rejected'` | `ส่งกลับให้แก้ไข` | — |
| 3 | `status === 'success'` | `เสร็จสิ้น — รอหัวหน้า QC ยืนยัน` | qc |
| 4 | testing & `0 < filled < total` (partial) | `QC กำลังตรวจ — {entered param names} ({percent}%)` | qc |
| 5 | has lab item & `labDone === false` | `รอผลตรวจจาก Lab` | lab |
| 6 | testing & `total > 0` & `filled >= total` (100%) | `รอ QC ยืนยันผล` | qc |
| 7 | both sides received | `Lab & QC รับแล้ว` | — |
| 8 | one side received | `{ฝั่งที่รับ} รับแล้ว · {อีกฝั่ง} รอรับ` | — |
| 9 | `status === 'sampleSent'` | `ส่งตัวอย่างแล้ว — รอรับ` | — |
| 10 | else (`deliveringQC`) | `กำลังนำส่ง QC` | — |

Ordering rationale: **active QC entry (rule 4) shows before lab-waiting**, so a petition mid-entry reads `QC กำลังตรวจ` rather than masking it. Once QC has nothing left to enter, **lab must finish (rule 5) before the final per-sample QC confirm (rule 6)** — matching "Lab เสร็จก่อน → ค่อยรอ QC ยืนยัน". Concretely: QC 100% + lab pending → rule 5 (`รอผลตรวจจาก Lab`); QC 100% + lab done → rule 6 (`รอ QC ยืนยันผล`).

Notes:
- "testing" = `status === 'inProgress'` (assigned and/or first result in).
- Rule 5 predicate (decided): the petition has ≥ 1 lab item **and** not every lab sampleId has a completed `PhysicalResult`. Concretely: derive lab sampleIds via the existing `sampleIdsFromPetition` rule restricted to items whose `batchNo` ends in 1/6; `labDone` = every such sampleId has a `PhysicalResult` with `status === 'completed'`. Rule 5 fires when a lab item exists and `labDone` is false. The route therefore also loads `PhysicalResult.find({ sampleId: { $in: labSampleIds } })` and passes a `labDone` boolean into `buildStatusLog` (keeps the pure function DB-free).
- Rule 6 param names: distinct parameter names that have at least one filled value, ordered by first `enteredAt`.

## QC heuristic (`computeQcHeuristic`)

- **filled** = count of distinct `(itemSeq, parameterId)` in `qcResults` where `values` has ≥ 1 non-empty entry.
- **total** = for each `petition.items[i]` × each active QC parameter `p` (`p.status === 'active'`, `(p.scope ?? 'qc') !== 'lab'`), count `p` when it applies to the item under the **lightweight** predicate:
  - `p.applyAll`, **or**
  - `p.commonNames` contains `item.commonName` (case-insensitive, trimmed), **or**
  - `p.itemNames` contains `item.sampleName` (trimmed), **or**
  - `item.testItems` (comma-split, lowercased) contains `p.name`.
  - Deliberately **omits** productType/subCategory/itemGroup/simple-method dimensions — that is the approximation.
- **percent** = `total > 0 ? round(filled / total * 100) : 0`.

`filled` is capped at `total` for display so percent never exceeds 100 even if the heuristic denominator under-counts.

## Testing

`server/lib/petitionStatusLog.test.js` — uses Node's built-in `node:test` + `node:assert` (CommonJS `require`), matching every existing `server/lib/*.test.js`. Run with `node --test lib/petitionStatusLog.test.js` from `server/`. (The root Vitest config only includes `src/**`, so server libs are tested with the Node runner, not Vitest.)

- Each `current` rule 1–10 returns the expected label/side given a crafted petition + inputs.
- `computeQcHeuristic`: filled/total/percent for applyAll, commonName match, testItems match, no-match (total 0 → 0%), partial, 100%, over-count cap.
- Timeline: event→label mapping for every mapped event; unmapped events skipped; ascending order; `side` propagated for `received`.
- Edge cases: only-one-side received (both orders), lab batch present vs absent, success/approved/rejected terminal labels.

Pure functions only — no DB, no HTTP. Route wiring verified manually / by a lightweight existing-pattern smoke check.

## Out of scope

- No frontend rendering in this spec (API only). A consumer (petition detail timeline UI) can be a follow-up.
- No changes to existing `status` enum, audit logging, or approval flow.
- Exact field/unit-level QC % parity with the QC page (intentionally approximate).
