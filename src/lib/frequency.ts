import type { GraphNode } from './types';

export interface ParetoSummary {
  ids: Set<string>;
  totalWords: number;
  rankedWords: number;
  focusWords: number;
  occurrenceCoverage: number;
}

/** Sort corpus-ranked words from most to least common; unranked words last. */
export function compareFrequency(a: GraphNode, b: GraphNode): number {
  const byRank = (a.freq ?? Number.POSITIVE_INFINITY) - (b.freq ?? Number.POSITIVE_INFINITY);
  return byRank || a.hz.localeCompare(b.hz, 'zh-Hans');
}

/** Build a frequency-first study set for the currently selected HSK curriculum. */
export function buildParetoSummary(words: GraphNode[], ratio: number): ParetoSummary {
  const ranked = words
    .filter((word) => word.freq !== null && word.freqPerMillion !== null && word.freqPerMillion !== undefined)
    .sort(compareFrequency);
  const showAll = ratio >= 1;
  const focusWords = showAll
    ? words.length
    : Math.min(Math.ceil(words.length * ratio), ranked.length);
  const focus = ranked.slice(0, focusWords);
  const allOccurrences = ranked.reduce((sum, word) => sum + word.freqPerMillion!, 0);
  const focusOccurrences = focus.reduce((sum, word) => sum + word.freqPerMillion!, 0);

  return {
    ids: new Set((showAll ? words : focus).map((word) => word.id)),
    totalWords: words.length,
    rankedWords: ranked.length,
    focusWords,
    occurrenceCoverage: allOccurrences ? (focusOccurrences / allOccurrences) * 100 : 0,
  };
}
