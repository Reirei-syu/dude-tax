import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NODE_SIZE,
  clearUserDefaultLayout,
  defaultBoardNodes,
  ensureBoardHasAllCards,
  getDefaultBoardLayout,
  saveUserDefaultLayout,
} from './repository';

describe('board card free resize sizes', () => {
  it('default nodes include all-staff-tax summary card', () => {
    const nodes = defaultBoardNodes();
    expect(nodes.some((n) => n.type === 'all-staff-tax')).toBe(true);
  });

  it('ensureBoardHasAllCards appends missing types', () => {
    const partial = defaultBoardNodes().filter((n) => n.type !== 'all-staff-tax');
    const fixed = ensureBoardHasAllCards(partial);
    expect(fixed.some((n) => n.type === 'all-staff-tax')).toBe(true);
    expect(fixed.length).toBe(partial.length + 1);
  });

  it('default nodes carry integer pixel width/height', () => {
    const nodes = defaultBoardNodes();
    expect(nodes.length).toBeGreaterThanOrEqual(6);
    for (const n of nodes) {
      expect(typeof n.width).toBe('number');
      expect(typeof n.height).toBe('number');
      expect(n.width!).toBeGreaterThanOrEqual(220);
      expect(n.height!).toBeGreaterThanOrEqual(160);
      expect(Number.isInteger(n.width)).toBe(true);
      expect(Number.isInteger(n.height)).toBe(true);
      expect(DEFAULT_NODE_SIZE[n.type]).toBeDefined();
    }
  });

  it('defaults allow independent width and height (no forced aspect)', () => {
    const n = defaultBoardNodes().find((x) => x.type === 'roster')!;
    expect(n.width).not.toBe(n.height);
  });

  it('saveUserDefaultLayout is used by getDefaultBoardLayout', () => {
    clearUserDefaultLayout();
    const custom = {
      nodes: [
        {
          id: 'node_roster',
          type: 'roster' as const,
          position: { x: 77, y: 88 },
          width: 300,
          height: 300,
          data: { label: '员工花名册' },
        },
      ],
      viewport: { x: 1, y: 2, zoom: 0.9 },
    };
    // jsdom/node may lack localStorage in some envs
    if (typeof localStorage === 'undefined') {
      // provide a minimal polyfill for this test
      const map = new Map<string, string>();
      // @ts-expect-error test polyfill
      globalThis.localStorage = {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => {
          map.set(k, v);
        },
        removeItem: (k: string) => {
          map.delete(k);
        },
      };
    }
    clearUserDefaultLayout();
    saveUserDefaultLayout(custom);
    const got = getDefaultBoardLayout();
    const roster = got.nodes.find((n) => n.id === 'node_roster');
    expect(roster?.position).toEqual({ x: 77, y: 88 });
    expect(got.viewport).toEqual({ x: 1, y: 2, zoom: 0.9 });
    // missing cards still appended
    expect(got.nodes.some((n) => n.type === 'salary-input')).toBe(true);
    clearUserDefaultLayout();
  });
});
