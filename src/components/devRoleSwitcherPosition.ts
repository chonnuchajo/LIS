export type DevSwitcherPosition = { x: number; y: number };

export function preserveDevSwitcherAnchorPosition(
  currentPos: DevSwitcherPosition | null,
  targetAnchor: DevSwitcherPosition,
  currentAnchor: DevSwitcherPosition,
): DevSwitcherPosition | null {
  if (!currentPos) return null;
  return {
    x: currentPos.x + targetAnchor.x - currentAnchor.x,
    y: currentPos.y + targetAnchor.y - currentAnchor.y,
  };
}
