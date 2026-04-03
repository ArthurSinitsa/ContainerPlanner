import type { PackedBox, PackedItemLayout } from "../../lib/types";

const COLOR_PALETTE = ["#5aa9ff", "#86efac", "#fca5a5", "#fcd34d", "#c4b5fd", "#67e8f9"];

function colorFromProductId(productId: number, index: number): string {
  return COLOR_PALETTE[Math.abs(Math.floor(productId)) % COLOR_PALETTE.length] ?? COLOR_PALETTE[index % COLOR_PALETTE.length];
}

function toBox(resultIndex: number, itemIndex: number, item: PackedItemLayout): PackedBox | null {
  if (!item.position || !item.dimensions) return null;

  const { x, y, z } = item.position;
  const { width, height, length } = item.dimensions;

  if ([x, y, z, width, height, length].some((v) => !Number.isFinite(v))) return null;

  return {
    id: `${resultIndex}-${item.type}-${item.product_id}-${itemIndex}`,
    label: `${item.type} ${item.product_id}`,
    x,
    y,
    z,
    width: Math.max(1, width),
    height: Math.max(1, height),
    depth: Math.max(1, length),
    color: colorFromProductId(item.product_id, resultIndex + itemIndex)
  };
}

export function extractPackedBoxes(payload: unknown): PackedBox[] {
  const detail = payload as { results?: { packing_layout: PackedItemLayout[] }[] } | null | undefined;
  const results = detail?.results;

  if (!Array.isArray(results)) return [];

  const boxes: PackedBox[] = [];

  results.forEach((result, resultIndex) => {
    const packingLayout = result?.packing_layout;
    if (!Array.isArray(packingLayout)) return;

    packingLayout.forEach((item, itemIndex) => {
      const box = toBox(resultIndex, itemIndex, item);
      if (box) boxes.push(box);
    });
  });

  return boxes;
}
