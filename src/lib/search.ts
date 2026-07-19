import type { GraphNode } from './types';

/** Diacritic-insensitive normalization (also folds Vietnamese đ → d). */
export function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

/** Words matching the query by hanzi, pinyin, English, or Vietnamese. */
export function matchWords(nodes: GraphNode[], query: string): GraphNode[] {
  const q = norm(query);
  const out: GraphNode[] = [];
  for (const n of nodes) {
    if (n.kind !== 'word') continue;
    if (norm(n.hz).includes(q) || norm(n.py).includes(q) || norm(n.en).includes(q) || norm(n.vi).includes(q)) {
      out.push(n);
    }
  }
  return out;
}
