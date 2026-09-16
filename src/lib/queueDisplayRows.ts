const QUEUE_CARD_ESTIMATED_HEIGHT = 128;
const QUEUE_CARD_GAP = 12;
const QUEUE_COLUMN_BODY_VERTICAL_PADDING = 32;

export function calculateQueueItemsPerColumn(availableHeight: number) {
  const contentHeight = Math.max(0, availableHeight - QUEUE_COLUMN_BODY_VERTICAL_PADDING);
  const rowHeight = QUEUE_CARD_ESTIMATED_HEIGHT + QUEUE_CARD_GAP;
  return Math.max(1, Math.floor((contentHeight + QUEUE_CARD_GAP) / rowHeight));
}
