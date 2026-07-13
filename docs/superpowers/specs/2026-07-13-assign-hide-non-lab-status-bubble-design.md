# Assign: hide status bubble for non-Lab petitions

## Goal

Keep the status bubble on Assign petition cards only when the petition has one or more items that belong to the Lab track. Hide it for QC-only petitions.

## Scope

- Reuse the existing Lab-track rule: a petition has a Lab track when its items include a `batchNo` ending in `1` or `6`, or it has an existing Lab receipt, completion, or approval timestamp.
- On the Assign page, render the existing status bubble only for a petition with a Lab track.
- Preserve the current status label and colour for Lab-track petitions.
- Do not change status bubbles or status rules on any other page.

## Implementation outline

1. Expose the existing Lab-track predicate from the shared status helper, so the Assign page and workflow status logic use the same rule.
2. In `PetitionCard` on the Assign page, conditionally render the status badge with that predicate.
3. Add focused tests proving that QC-only petitions do not qualify for the Lab-track condition and Lab petitions do.

## Error handling and compatibility

Missing `items` or Lab timestamps are treated as no Lab track. Existing Lab timestamps continue to classify older records as Lab-track petitions even if their item data is incomplete.

## Verification

Run the focused unit test suite for the status helper and TypeScript type checking. No build command will be run.
