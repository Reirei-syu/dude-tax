import type { NavigationModulePath } from "@dude-tax/core";
import { normalizeNavigationOrder } from "../layout/workspace-layout";

const getNormalizedIndex = (order: readonly string[], path: string) =>
  normalizeNavigationOrder(order).findIndex((itemPath) => itemPath === path);

export const canMoveNavItem = (order: readonly string[], path: string, step: -1 | 1) => {
  const currentIndex = getNormalizedIndex(order, path);
  if (currentIndex < 0) {
    return false;
  }

  const targetIndex = currentIndex + step;
  return targetIndex >= 0 && targetIndex < normalizeNavigationOrder(order).length;
};

export const moveNavItemByStep = (
  order: readonly string[],
  path: string,
  step: -1 | 1,
): NavigationModulePath[] => {
  const normalizedOrder = normalizeNavigationOrder(order);
  const currentIndex = normalizedOrder.findIndex((itemPath) => itemPath === path);
  if (currentIndex < 0) {
    return normalizedOrder;
  }

  const targetIndex = currentIndex + step;
  if (targetIndex < 0 || targetIndex >= normalizedOrder.length) {
    return normalizedOrder;
  }

  const nextOrder = [...normalizedOrder];
  const [itemPath] = nextOrder.splice(currentIndex, 1);
  nextOrder.splice(targetIndex, 0, itemPath);
  return nextOrder;
};
