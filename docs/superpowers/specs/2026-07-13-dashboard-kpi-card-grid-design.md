# Dashboard KPI Card Grid Design

## Goal

Arrange dashboard KPI cards into predictable desktop rows based on the total
number of cards while preserving two cards per row on mobile devices.

## Card Count

The layout counts every rendered KPI card and the optional Daily Check card.
The Daily Check card follows the same grid rules as widget KPI cards.

## Responsive Rules

Mobile remains a two-column grid. At the desktop breakpoint, the layout uses
these row patterns:

| Total cards | Desktop columns | Resulting rows |
| --- | --- | --- |
| 1-4 | 4 | one row |
| 5 | 3 | 3 + 2 |
| 6 | 3 | 3 + 3 |
| 7 | 4 | 4 + 3 |
| 8 | 4 | 4 + 4 |
| 9 | 3 | 3 + 3 + 3 |
| 10 | 4 | 4 + 4 + 2 |
| 11 | 4 | 4 + 4 + 3 |

Counts above eleven use four desktop columns as the stable fallback.

## Implementation

Keep the grid decision in `KpiRow` so default KPI cards, widget KPI cards,
and the injected Daily Check card use the same count-based rule. Widget and
Daily Check card spans become responsive: one grid column on mobile and two
grid columns on desktop, allowing the mobile two-column rule to apply to every
card.

## Testing

Add focused `KpiRow` tests for each count from five through eleven, asserting
the expected grid column class. Retain coverage for the compact one-to-four
card layout and for the existing Daily Check insertion order.
