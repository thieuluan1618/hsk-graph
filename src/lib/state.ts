import { zoomIdentity, type ZoomTransform } from 'd3';
import type { Lang } from './i18n';
import type { GraphNode } from './types';

export type LevelFilter = 'all' | '1' | '2' | '3';

/** Single source of truth for all interactive UI state. */
export interface GraphState {
  /** Viewport size in CSS pixels. */
  W: number;
  H: number;
  levelFilter: LevelFilter;
  groupOn: boolean;
  hubsOn: boolean;
  spokesOn: boolean;
  /** Spacing slider multiplier. */
  spreadMul: number;
  /** Themes toggled off in the legend. */
  offThemes: Set<string>;
  /** Isolate a single theme (legend click). */
  soloTheme: string | null;
  /** Node ids matching the current search, or null when no query. */
  searchMatch: Set<string> | null;
  selNode: GraphNode | null;
  hoverNode: GraphNode | null;
  /** Ids of the focused node + neighbors (hover/selection highlight). */
  focusSet: Set<string> | null;
  /** Current zoom/pan transform. */
  transform: ZoomTransform;
  /** Font family for Chinese characters (canvas + DOM). */
  hanziFont: string;
  /** Hanzi of words the learner marked as known (persisted via progress.ts). */
  known: Set<string>;
  /** Hide known words from the graph. */
  hideKnownOn: boolean;
  /** Show only the frequency-slider study set when below 100%. */
  paretoOn: boolean;
  /** Fraction of the selected HSK vocabulary shown by the frequency slider. */
  paretoRatio: number;
  /** Word ids in the current level-aware frequency study set. */
  paretoIds: Set<string>;
  /** UI language (persisted via i18n.ts). */
  lang: Lang;
}

export function createState(): GraphState {
  return {
    W: 0,
    H: 0,
    levelFilter: 'all',
    groupOn: true,
    hubsOn: true,
    spokesOn: false,
    spreadMul: 1,
    offThemes: new Set(),
    soloTheme: null,
    searchMatch: null,
    selNode: null,
    hoverNode: null,
    focusSet: null,
    transform: zoomIdentity,
    hanziFont: 'Noto Sans SC',
    known: new Set(),
    hideKnownOn: false,
    paretoOn: false,
    paretoRatio: 1,
    paretoIds: new Set(),
    lang: 'vi',
  };
}

/** Whether a node is currently visible under filters/toggles. */
export function visible(state: GraphState, n: GraphNode): boolean {
  if (n.kind === 'theme') return state.groupOn; // anchors shown when grouping
  if (n.kind === 'hub' && !state.hubsOn) return false;
  if (state.levelFilter !== 'all' && n.kind === 'word' && n.hsk !== +state.levelFilter) return false;
  if (n.kind === 'word') {
    if (state.paretoOn && !state.paretoIds.has(n.id)) return false;
    if (state.hideKnownOn && state.known.has(n.hz)) return false;
    if (state.soloTheme && n.theme !== state.soloTheme) return false;
    if (state.offThemes.has(n.theme)) return false;
  }
  return true;
}

/** Focus (hover/sel) dims non-neighbors; search dims non-matches. */
export function activeAlpha(state: GraphState, n: GraphNode): number {
  let a = 1;
  if (state.focusSet && !state.focusSet.has(n.id)) a = Math.min(a, 0.24);
  if (state.searchMatch && n.kind === 'word' && !state.searchMatch.has(n.id)) a = Math.min(a, 0.26);
  if (state.searchMatch && n.kind !== 'word') a = Math.min(a, 0.5);
  return a;
}
