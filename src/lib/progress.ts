// Learner progress ("known" words) persisted to localStorage.
// Keyed by hanzi so progress survives graph regeneration (node ids may change).
const KEY = 'hsk-graph:known';

export function loadKnown(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr: unknown = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveKnown(known: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...known]));
  } catch {
    // storage unavailable — progress just won't persist
  }
}
