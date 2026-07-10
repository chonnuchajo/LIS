# Card Open Prop Design

## Goal

Make navigation-style cards easier to open by allowing a whole card to open with either a single click or a double click, while keeping ordinary form, settings, and display cards unchanged.

## Scope

This change applies only to cards that explicitly opt in through a new `Card` prop. Existing cards without the prop keep their current behavior.

Target card types include dashboard menu cards, petition list cards, assignment petition cards, KPI/stat cards, and compact waiting/pending sample cards that already have a clear navigation or open-detail action.

Form cards, configuration cards, report panels, empty/loading states, and cards containing primary editing controls will not become clickable unless a specific caller opts in.

## Component API

Extend `src/components/ui/card.tsx` with an optional prop:

```tsx
onOpen?: () => void
```

When `onOpen` is provided, `Card` becomes an accessible interactive container:

- `onClick` calls `onOpen`.
- `onDoubleClick` also calls `onOpen`.
- `Enter` and `Space` call `onOpen`.
- `role="button"` and `tabIndex={0}` are applied if the caller did not provide their own role/tab index.
- Interactive descendants such as buttons, links, inputs, selects, textareas, Radix triggers, and elements with their own click handlers do not bubble into the card open action.

If the caller also passes `onClick`, `onDoubleClick`, or `onKeyDown`, the card will run the caller handler first and then run `onOpen` only if the event was not prevented.

## Migration Pattern

Callers that currently wrap the whole card in a `button`, attach navigation to a custom card-like `div`, or only put the open action on a small title/button can switch to:

```tsx
<Card onOpen={() => navigate(path)}>
  ...
</Card>
```

Rows and list items that are not `Card` components can remain as they are unless they are visually presented as cards and can safely be migrated.

## Event Safety

The card open handler must ignore events that begin inside an interactive descendant. This prevents accidental navigation when users click controls inside cards, such as:

- Button actions
- Links
- Inputs and textareas
- Select, dropdown, popover, checkbox, radio, and switch triggers
- Elements marked with `data-card-open-ignore`

This opt-out attribute gives callers a simple escape hatch for complex nested controls.

## Testing

Add unit coverage for `Card` behavior:

- Calls `onOpen` on click.
- Calls `onOpen` on double click.
- Calls `onOpen` on `Enter` and `Space`.
- Does not call `onOpen` when clicking an interactive child.
- Preserves existing `onClick` and does not call `onOpen` if the event is prevented.

Add focused component tests for at least one migrated navigation card or list card to prove the full card opens the expected route/action.

## Risks

Because `Card` is a shared primitive, the main risk is accidental navigation from nested interactive controls. The opt-in `onOpen` API and descendant ignore logic keep the default behavior unchanged and localize this risk to migrated cards.
