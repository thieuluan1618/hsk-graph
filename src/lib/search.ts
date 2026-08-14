import type { GraphNode } from './types';

/** Diacritic-insensitive normalization (also folds Vietnamese đ → d). */
export function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function normPinyin(s: string): string {
  return norm(s).replace(/[\s'’.-]/g, '');
}

function pinyinVariants(s: string): string[] {
  return s.split(/[;,/]/).map(normPinyin).filter(Boolean);
}

/**
 * Words matching the query by hanzi, pinyin, English, or Vietnamese.
 * Pinyin is prioritized so a shared pronunciation such as "de" returns its
 * homophones instead of dozens of incidental matches from the definitions.
 */
export function matchWords(nodes: GraphNode[], query: string): GraphNode[] {
  const q = norm(query).trim();
  if (!q) return [];

  const words = nodes.filter((n) => n.kind === 'word');
  const pinyinQuery = normPinyin(q);
  const exactPinyin = pinyinQuery
    ? words.filter((n) => pinyinVariants(n.py).includes(pinyinQuery))
    : [];
  if (exactPinyin.length) return exactPinyin;

  return words.filter((n) =>
    norm(n.hz).includes(q)
      || (pinyinQuery && pinyinVariants(n.py).some((py) => py.includes(pinyinQuery)))
      || norm(n.en).includes(q)
      || norm(n.vi).includes(q),
  );
}
