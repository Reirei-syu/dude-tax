import type {
  FloatingDialogLayout,
  NavigationModulePath,
  WorkspaceCardLayout,
  WorkspaceLayoutState,
  WorkspacePageScope,
} from "@dude-tax/core";
import { NAVIGATION_MODULE_PATHS, WORKSPACE_LAYOUT_UNIT_STEP } from "@dude-tax/core";

export const WORKSPACE_GRID_COLUMNS = 12;
export const WORKSPACE_GRID_GAP = 16;
export const WORKSPACE_ROW_HEIGHT = 32;
export const WORKSPACE_MIN_INTERACTIVE_WIDTH = 960;
export const WORKSPACE_MIN_DIALOG_WIDTH = 720;
export const WORKSPACE_MIN_DIALOG_HEIGHT = 360;
export const DEFAULT_WORKSPACE_CANVAS_ID = "root";
export const WORKSPACE_INTERACTION_THRESHOLD_PX = 6;
export const WORKSPACE_MIN_CONTENT_SCALE = 0.75;
export const WORKSPACE_MAX_CONTENT_SCALE = 1.15;
export const WORKSPACE_COLLISION_WIDTH_TOLERANCE_RATIO = 0.1;
export const WORKSPACE_TAIL_EXTENSION_STEP_ROWS = 4;
const WORKSPACE_LAYOUT_UNIT_FACTOR = 1 / WORKSPACE_LAYOUT_UNIT_STEP;
const WORKSPACE_AUTO_ARRANGE_RESIZE_RATIO = 0.1;

export type WorkspaceCardDefinition = {
  cardId: string;
  canvasId?: string;
  defaultLayout: Omit<WorkspaceCardLayout, "cardId" | "canvasId" | "z">;
  minW?: number;
  minH?: number;
  movable?: boolean;
  resizable?: boolean;
};

type WorkspaceViewport = {
  width: number;
  height: number;
};

const normalizeCanvasId = (canvasId?: string) => canvasId ?? DEFAULT_WORKSPACE_CANVAS_ID;

const buildCardKey = (cardId: string, canvasId?: string) => `${normalizeCanvasId(canvasId)}::${cardId}`;

const clamp = (value: number, minValue: number, maxValue: number) =>
  Math.min(Math.max(value, minValue), maxValue);

const roundWorkspaceUnit = (value: number) =>
  Math.round(value * WORKSPACE_LAYOUT_UNIT_FACTOR) / WORKSPACE_LAYOUT_UNIT_FACTOR;

const floorWorkspaceUnit = (value: number) =>
  Math.floor(value * WORKSPACE_LAYOUT_UNIT_FACTOR) / WORKSPACE_LAYOUT_UNIT_FACTOR;

const normalizeWorkspaceZ = (value: number | undefined) => Math.max(Math.round(value ?? 0), 0);

export const clampWorkspaceCardLayout = (
  layout: WorkspaceCardLayout,
  options?: {
    minW?: number;
    minH?: number;
  },
): WorkspaceCardLayout => {
  const minW = Math.max(roundWorkspaceUnit(options?.minW ?? WORKSPACE_LAYOUT_UNIT_STEP), WORKSPACE_LAYOUT_UNIT_STEP);
  const minH = Math.max(roundWorkspaceUnit(options?.minH ?? WORKSPACE_LAYOUT_UNIT_STEP), WORKSPACE_LAYOUT_UNIT_STEP);
  const w = roundWorkspaceUnit(clamp(layout.w, minW, WORKSPACE_GRID_COLUMNS));
  const x = roundWorkspaceUnit(clamp(layout.x, 0, Math.max(WORKSPACE_GRID_COLUMNS - w, 0)));

  return {
    ...layout,
    canvasId: normalizeCanvasId(layout.canvasId),
    x: Math.min(x, roundWorkspaceUnit(Math.max(WORKSPACE_GRID_COLUMNS - w, 0))),
    y: roundWorkspaceUnit(Math.max(layout.y, 0)),
    w,
    h: roundWorkspaceUnit(Math.max(layout.h, minH)),
    z: normalizeWorkspaceZ(layout.z),
  };
};

export const mergeLayoutState = (
  scope: WorkspacePageScope,
  defaultLayouts: WorkspaceCardLayout[],
  storedState: WorkspaceLayoutState | null,
): WorkspaceLayoutState => {
  const storedCards = new Map(
    (storedState?.cards ?? []).map((card) => [buildCardKey(card.cardId, card.canvasId), card]),
  );

  return {
    scope,
    cards: defaultLayouts.map((defaultLayout) =>
      clampWorkspaceCardLayout(
        {
          ...defaultLayout,
          ...storedCards.get(buildCardKey(defaultLayout.cardId, defaultLayout.canvasId)),
          z:
            storedCards.get(buildCardKey(defaultLayout.cardId, defaultLayout.canvasId))?.z ??
            defaultLayout.z,
        },
      ),
    ),
  };
};

export const bringCardToFront = (
  cards: WorkspaceCardLayout[],
  targetCardId: string,
  canvasId = DEFAULT_WORKSPACE_CANVAS_ID,
) => {
  const normalizedCanvasId = normalizeCanvasId(canvasId);
  const maxZ = cards.reduce((currentMax, card) => {
    if (normalizeCanvasId(card.canvasId) !== normalizedCanvasId) {
      return currentMax;
    }
    return Math.max(currentMax, normalizeWorkspaceZ(card.z));
  }, 0);

  return cards.map((card) =>
    card.cardId === targetCardId && normalizeCanvasId(card.canvasId) === normalizedCanvasId
      ? {
          ...card,
          z: maxZ + 1,
        }
      : card,
  );
};

export const pinCardToHorizontalEdge = (
  card: WorkspaceCardLayout,
  edge: "left" | "right",
) =>
  clampWorkspaceCardLayout({
    ...card,
    x: edge === "left" ? 0 : WORKSPACE_GRID_COLUMNS - card.w,
  });

const rectanglesOverlap = (left: WorkspaceCardLayout, right: WorkspaceCardLayout) =>
  normalizeCanvasId(left.canvasId) === normalizeCanvasId(right.canvasId) &&
  left.x < right.x + right.w &&
  left.x + left.w > right.x &&
  left.y < right.y + right.h &&
  left.y + left.h > right.y;

const getHorizontalOverlapWidth = (left: WorkspaceCardLayout, right: WorkspaceCardLayout) =>
  Math.max(0, Math.min(left.x + left.w, right.x + right.w) - Math.max(left.x, right.x));

const getVerticalOverlapHeight = (top: WorkspaceCardLayout, bottom: WorkspaceCardLayout) =>
  Math.max(0, Math.min(top.y + top.h, bottom.y + bottom.h) - Math.max(top.y, bottom.y));

const canResolveByShrinkingWidth = (
  currentCard: WorkspaceCardLayout,
  overlappingCard: WorkspaceCardLayout,
) => {
  const overlapWidth = getHorizontalOverlapWidth(currentCard, overlappingCard);
  if (overlapWidth <= 0 || getVerticalOverlapHeight(currentCard, overlappingCard) <= 0) {
    return false;
  }

  const overlapRatio = overlapWidth / Math.max(Math.max(currentCard.w, overlappingCard.w), 1);
  const nextWidth = currentCard.w - overlapWidth;
  return overlapRatio <= WORKSPACE_COLLISION_WIDTH_TOLERANCE_RATIO && nextWidth >= 1;
};

const buildInlineResolvedCard = (
  targetCard: WorkspaceCardLayout,
  anchorCard: WorkspaceCardLayout,
) => {
  const targetCenterX = targetCard.x + targetCard.w / 2;
  const anchorCenterX = anchorCard.x + anchorCard.w / 2;

  if (targetCenterX >= anchorCenterX) {
    const nextX = anchorCard.x + anchorCard.w;
    const nextWidth = Math.min(targetCard.w, WORKSPACE_GRID_COLUMNS - nextX);
    if (nextWidth < 1) {
      return null;
    }

    return clampWorkspaceCardLayout({
      ...targetCard,
      x: nextX,
      w: nextWidth,
    });
  }

  const nextWidth = anchorCard.x - targetCard.x;
  if (nextWidth < 1) {
    return null;
  }

  return clampWorkspaceCardLayout({
    ...targetCard,
    w: Math.min(targetCard.w, nextWidth),
  });
};

const compactCardUpward = (
  currentCard: WorkspaceCardLayout,
  placedCards: WorkspaceCardLayout[],
) => {
  let nextCard = currentCard;
  while (nextCard.y > 0) {
    const candidateCard = {
      ...nextCard,
      y: nextCard.y - 1,
    };
    if (placedCards.some((placedCard) => rectanglesOverlap(placedCard, candidateCard))) {
      break;
    }
    nextCard = candidateCard;
  }

  return nextCard;
};

export const alignCardToNearestNeighbor = (
  cards: WorkspaceCardLayout[],
  movingCard: WorkspaceCardLayout,
): WorkspaceCardLayout => {
  const candidateCards = cards.filter(
    (card) =>
      card.cardId !== movingCard.cardId &&
      normalizeCanvasId(card.canvasId) === normalizeCanvasId(movingCard.canvasId),
  );

  if (!candidateCards.length) {
    return clampWorkspaceCardLayout(movingCard);
  }

  const movingCenterX = movingCard.x + movingCard.w / 2;
  const movingCenterY = movingCard.y + movingCard.h / 2;
  const nearestCard = [...candidateCards].sort((left, right) => {
    const leftDistance =
      (left.x + left.w / 2 - movingCenterX) ** 2 + (left.y + left.h / 2 - movingCenterY) ** 2;
    const rightDistance =
      (right.x + right.w / 2 - movingCenterX) ** 2 +
      (right.y + right.h / 2 - movingCenterY) ** 2;
    return leftDistance - rightDistance;
  })[0];

  const nearestCenterX = nearestCard.x + nearestCard.w / 2;
  const nearestCenterY = nearestCard.y + nearestCard.h / 2;
  const horizontalGap =
    movingCard.x >= nearestCard.x + nearestCard.w
      ? movingCard.x - (nearestCard.x + nearestCard.w)
      : nearestCard.x >= movingCard.x + movingCard.w
        ? nearestCard.x - (movingCard.x + movingCard.w)
        : 0;
  const verticalGap =
    movingCard.y >= nearestCard.y + nearestCard.h
      ? movingCard.y - (nearestCard.y + nearestCard.h)
      : nearestCard.y >= movingCard.y + movingCard.h
        ? nearestCard.y - (movingCard.y + movingCard.h)
        : 0;
  const isHorizontalRelation =
    horizontalGap > 0 && (verticalGap === 0 || horizontalGap <= verticalGap);
  const isVerticalRelation =
    verticalGap > 0 && (horizontalGap === 0 || verticalGap < horizontalGap);

  if (isHorizontalRelation) {
    return clampWorkspaceCardLayout({
      ...movingCard,
      y: nearestCard.y,
    });
  }

  if (isVerticalRelation) {
    return clampWorkspaceCardLayout({
      ...movingCard,
      x: nearestCard.x,
    });
  }

  const horizontalDistance = Math.abs(nearestCenterX - movingCenterX);
  const verticalDistance = Math.abs(nearestCenterY - movingCenterY);

  if (horizontalDistance < verticalDistance) {
    return clampWorkspaceCardLayout({
      ...movingCard,
      x: nearestCard.x,
    });
  }

  return clampWorkspaceCardLayout({
    ...movingCard,
    y: nearestCard.y,
  });
};

export const resolveLayoutCollisions = (
  cards: WorkspaceCardLayout[],
  lockedCardId: string,
): WorkspaceCardLayout[] => {
  const nextCards = cards.map((card) => clampWorkspaceCardLayout(card));
  const orderedCards = [...nextCards].sort((left, right) => {
    if (left.cardId === lockedCardId) {
      return -1;
    }
    if (right.cardId === lockedCardId) {
      return 1;
    }
    if (left.y !== right.y) {
      return left.y - right.y;
    }
    return left.x - right.x;
  });

  const placedCards: WorkspaceCardLayout[] = [];
  orderedCards.forEach((card) => {
    let currentCard = compactCardUpward(card, placedCards);
    while (placedCards.some((placedCard) => rectanglesOverlap(placedCard, currentCard))) {
      const overlappingCard = placedCards.find((placedCard) => rectanglesOverlap(placedCard, currentCard));
      if (!overlappingCard) {
        break;
      }
      if (
        currentCard.cardId === lockedCardId &&
        canResolveByShrinkingWidth(currentCard, overlappingCard)
      ) {
        const resolvedCard = buildInlineResolvedCard(currentCard, overlappingCard);
        if (resolvedCard) {
          currentCard = resolvedCard;
          continue;
        }
      }
      if (
        overlappingCard.cardId === lockedCardId &&
        canResolveByShrinkingWidth(overlappingCard, currentCard)
      ) {
        const resolvedLockedCard = buildInlineResolvedCard(overlappingCard, currentCard);
        if (resolvedLockedCard) {
          const overlappingIndex = placedCards.findIndex(
            (placedCard) =>
              buildCardKey(placedCard.cardId, placedCard.canvasId) ===
              buildCardKey(overlappingCard.cardId, overlappingCard.canvasId),
          );
          if (overlappingIndex >= 0) {
            placedCards[overlappingIndex] = resolvedLockedCard;
            continue;
          }
        }
      }
      currentCard = {
        ...currentCard,
        y: overlappingCard.y + overlappingCard.h,
      };
    }
    placedCards.push(clampWorkspaceCardLayout(compactCardUpward(currentCard, placedCards)));
  });

  const compactedCards = [...placedCards]
    .sort((left, right) => {
      if (left.y !== right.y) {
        return left.y - right.y;
      }
      return left.x - right.x;
    })
    .reduce<WorkspaceCardLayout[]>((currentCards, card) => {
      currentCards.push(clampWorkspaceCardLayout(compactCardUpward(card, currentCards)));
      return currentCards;
    }, []);

  const placedCardMap = new Map(
    compactedCards.map((card) => [buildCardKey(card.cardId, card.canvasId), card]),
  );
  return nextCards.map(
    (card) => placedCardMap.get(buildCardKey(card.cardId, card.canvasId)) ?? card,
  );
};

export const clampFloatingDialogLayout = (
  layout: FloatingDialogLayout,
  viewport: WorkspaceViewport,
): FloatingDialogLayout => {
  const width = clamp(
    layout.width,
    Math.min(WORKSPACE_MIN_DIALOG_WIDTH, viewport.width),
    viewport.width,
  );
  const height = clamp(
    layout.height,
    Math.min(WORKSPACE_MIN_DIALOG_HEIGHT, viewport.height),
    viewport.height,
  );

  return {
    ...layout,
    x: clamp(layout.x, 0, Math.max(viewport.width - width, 0)),
    y: clamp(layout.y, 0, Math.max(viewport.height - height, 0)),
    width,
    height,
  };
};

export const normalizeNavigationOrder = (order: readonly string[]): NavigationModulePath[] => {
  const validPaths = new Set<NavigationModulePath>(NAVIGATION_MODULE_PATHS);
  const normalizedOrder = order.filter(
    (path, index): path is NavigationModulePath =>
      validPaths.has(path as NavigationModulePath) && order.indexOf(path) === index,
  );

  NAVIGATION_MODULE_PATHS.forEach((path) => {
    if (!normalizedOrder.includes(path)) {
      normalizedOrder.push(path);
    }
  });

  return normalizedOrder;
};

export const autoArrangeWorkspaceCards = (
  cards: WorkspaceCardLayout[],
): WorkspaceCardLayout[] => {
  const sortedCards = [...cards]
    .map((card) => clampWorkspaceCardLayout(card))
    .sort((left, right) => {
      if (left.y !== right.y) {
        return left.y - right.y;
      }
      if (left.x !== right.x) {
        return left.x - right.x;
      }
      return left.z - right.z;
    });

  const rows: WorkspaceCardLayout[][] = [];
  sortedCards.forEach((card) => {
    const currentRow = rows.at(-1);
    if (!currentRow) {
      rows.push([card]);
      return;
    }

    const currentWidth = currentRow.reduce((sum, item) => sum + item.w, 0);
    const nextWidth = currentWidth + card.w;
    const shrinkCapacity = [...currentRow, card].reduce(
      (sum, item) =>
        sum + floorWorkspaceUnit(Math.min(item.w * WORKSPACE_AUTO_ARRANGE_RESIZE_RATIO, item.w - WORKSPACE_LAYOUT_UNIT_STEP)),
      0,
    );

    if (nextWidth <= WORKSPACE_GRID_COLUMNS || nextWidth - WORKSPACE_GRID_COLUMNS <= shrinkCapacity) {
      currentRow.push(card);
      return;
    }

    rows.push([card]);
  });

  let cursorY = 0;
  const arrangedRows = rows.flatMap((row) => {
    const baseWidth = roundWorkspaceUnit(row.reduce((sum, item) => sum + item.w, 0));
    const rowHeight = roundWorkspaceUnit(Math.max(...row.map((item) => item.h)));
    const canExpand = baseWidth < WORKSPACE_GRID_COLUMNS;
    const capacities = row.map((item) =>
      floorWorkspaceUnit(
        canExpand
          ? item.w * WORKSPACE_AUTO_ARRANGE_RESIZE_RATIO
          : Math.min(item.w * WORKSPACE_AUTO_ARRANGE_RESIZE_RATIO, item.w - WORKSPACE_LAYOUT_UNIT_STEP),
      ),
    );
    const totalCapacity = roundWorkspaceUnit(capacities.reduce((sum, item) => sum + item, 0));
    const targetWidth = canExpand
      ? Math.min(WORKSPACE_GRID_COLUMNS, roundWorkspaceUnit(baseWidth + totalCapacity))
      : Math.max(WORKSPACE_GRID_COLUMNS, roundWorkspaceUnit(baseWidth - totalCapacity));
    let remainingDelta = roundWorkspaceUnit(Math.abs(targetWidth - baseWidth));
    const nextWidths = row.map((item) => item.w);

    row.forEach((item, index) => {
      if (remainingDelta <= 0) {
        return;
      }

      const remainingCapacity = capacities
        .slice(index)
        .reduce((sum, capacity) => sum + capacity, 0);
      const suggestedDelta =
        index === row.length - 1 || remainingCapacity <= 0
          ? remainingDelta
          : roundWorkspaceUnit((capacities[index] / remainingCapacity) * remainingDelta);
      const appliedDelta = Math.min(capacities[index], remainingDelta, suggestedDelta || remainingDelta);
      nextWidths[index] = roundWorkspaceUnit(
        nextWidths[index] + (canExpand ? appliedDelta : -appliedDelta),
      );
      remainingDelta = roundWorkspaceUnit(remainingDelta - appliedDelta);
    });

    let cursorX = 0;
    const arrangedRow = row.map((item, index) => {
      const isLast = index === row.length - 1;
      const nextCard = clampWorkspaceCardLayout({
        ...item,
        x: cursorX,
        y: cursorY,
        w: isLast
          ? roundWorkspaceUnit(
              Math.max(
                WORKSPACE_LAYOUT_UNIT_STEP,
                targetWidth - cursorX,
              ),
            )
          : nextWidths[index],
        h: rowHeight,
      });
      cursorX = roundWorkspaceUnit(nextCard.x + nextCard.w);
      return nextCard;
    });

    cursorY = roundWorkspaceUnit(cursorY + rowHeight);
    return arrangedRow;
  });

  const arrangedCardMap = new Map(
    arrangedRows.map((card) => [buildCardKey(card.cardId, card.canvasId), card] as const),
  );

  return sortedCards.map(
    (card) => arrangedCardMap.get(buildCardKey(card.cardId, card.canvasId)) ?? card,
  );
};

export const clampWorkspaceContentScale = (input: {
  width: number;
  height: number;
  defaultWidth: number;
  defaultHeight: number;
}) => {
  if (input.width <= 0 || input.height <= 0 || input.defaultWidth <= 0 || input.defaultHeight <= 0) {
    return 1;
  }

  const widthRatio = input.width / input.defaultWidth;
  const heightRatio = input.height / input.defaultHeight;
  const scale = Math.min(widthRatio, heightRatio);
  return Number(clamp(scale, WORKSPACE_MIN_CONTENT_SCALE, WORKSPACE_MAX_CONTENT_SCALE).toFixed(3));
};

export const getWorkspaceCanvasHeight = (cards: WorkspaceCardLayout[]) => {
  if (!cards.length) {
    return WORKSPACE_ROW_HEIGHT;
  }

  const totalRows = Math.max(...cards.map((card) => card.y + card.h));
  return totalRows * (WORKSPACE_ROW_HEIGHT + WORKSPACE_GRID_GAP) - WORKSPACE_GRID_GAP;
};

export const getWorkspaceCardStyle = (
  layout: WorkspaceCardLayout,
  canvasWidth: number,
): {
  left: number;
  top: number;
  width: number;
  height: number;
} => {
  const columnWidth =
    (canvasWidth - WORKSPACE_GRID_GAP * (WORKSPACE_GRID_COLUMNS - 1)) / WORKSPACE_GRID_COLUMNS;

  return {
    left: layout.x * (columnWidth + WORKSPACE_GRID_GAP),
    top: layout.y * (WORKSPACE_ROW_HEIGHT + WORKSPACE_GRID_GAP),
    width: layout.w * columnWidth + Math.max(layout.w - 1, 0) * WORKSPACE_GRID_GAP,
    height: layout.h * WORKSPACE_ROW_HEIGHT + Math.max(layout.h - 1, 0) * WORKSPACE_GRID_GAP,
  };
};

export const createWorkspaceCardLayout = (
  definition: WorkspaceCardDefinition,
  index = 0,
): WorkspaceCardLayout => ({
  cardId: definition.cardId,
  canvasId: normalizeCanvasId(definition.canvasId),
  ...definition.defaultLayout,
  z: index,
});

export const getWorkspaceCardKey = (card: Pick<WorkspaceCardLayout, "cardId" | "canvasId">) =>
  buildCardKey(card.cardId, card.canvasId);
