// Browser-side entry point for the vocabulary graph island.
// Owns the UI state and wires controls, search, detail panel, and audio
// to the D3 simulation/renderer modules.
import graphDataJson from '../data/graph.json';
import { playWord } from '../lib/audio';
import { createDetailPanel } from '../lib/detail-panel';
import { buildParetoSummary, compareFrequency } from '../lib/frequency';
import { createInteractions } from '../lib/graph-interactions';
import {
  buildScene,
  createSimulation,
  seedPositions,
} from '../lib/graph-layout';
import { createRenderer } from '../lib/graph-renderer';
import { applyTranslations, loadLang, saveLang, t, type Lang } from '../lib/i18n';
import { loadKnown, saveKnown } from '../lib/progress';
import { matchWords } from '../lib/search';
import { createState, type LevelFilter } from '../lib/state';
import type { GraphData, GraphNode } from '../lib/types';

const data = graphDataJson as unknown as GraphData;
const D = (id: string) => document.getElementById(id)!;

const cv = D('cv') as HTMLCanvasElement;
const state = createState();
state.known = loadKnown();
state.lang = loadLang();
applyTranslations(state.lang);
const scene = buildScene(data);
const { sim, updateSpread } = createSimulation(scene, state);
const renderer = createRenderer(cv, scene, state);
sim.on('tick', renderer.draw);

const interactions = createInteractions(cv, scene, state, sim, renderer.draw, {
  onSelect(n) {
    detail.open(n);
    void playWord(n.hz);
    clearSearch();
  },
  onClear() {
    detail.close();
    clearSearch();
  },
});

const detail = createDetailPanel(scene, state, {
  onNavigate(w) {
    selectNode(w);
    interactions.focusOn(w);
  },
  onClose() {
    clearSelection();
    clearSearch();
  },
  isKnown(n) {
    return state.known.has(n.hz);
  },
  onToggleKnown(n) {
    toggleKnown(n);
  },
});

function selectNode(n: GraphNode): void {
  state.selNode = n;
  interactions.setFocus(n);
  detail.open(n);
  void playWord(n.hz);
  clearSearch();
}

function clearSelection(): void {
  state.selNode = null;
  interactions.setFocus(null);
}

// ---- hanzi font switcher ----

function setHanziFont(font: string): void {
  state.hanziFont = font;
  // update all DOM elements that hardcode 'Noto Sans SC'
  document.querySelectorAll<HTMLElement>('#brand h1 .zh, #detail .zh, .ex-zh, .rel .grp .gc b, .chip .z, .search-result-hz').forEach((el) => {
    el.style.fontFamily = `'${font}', sans-serif`;
  });
  // update font picker button states
  document.querySelectorAll('#fontPicker button').forEach((b) =>
    b.classList.toggle('on', (b as HTMLButtonElement).dataset.font === font),
  );
  // re-render canvas with new font
  renderer.draw();
}

document.querySelectorAll<HTMLButtonElement>('#fontPicker button').forEach((b) =>
  b.addEventListener('click', () => setHanziFont(b.dataset.font!)),
);

// ---- named state updates ----

function setLevelFilter(lv: LevelFilter): void {
  state.levelFilter = lv;
  refreshPareto();
  sim.alpha(0.25).restart();
  renderer.draw();
}

function toggleGroup(): void {
  state.groupOn = !state.groupOn;
  D('sw-group').classList.toggle('on', state.groupOn);
  sim.alpha(0.4).restart();
  renderer.draw();
}

function toggleHubs(): void {
  state.hubsOn = !state.hubsOn;
  D('sw-hubs').classList.toggle('on', state.hubsOn);
  sim.alpha(0.2).restart();
  renderer.draw();
}

function toggleSpokes(): void {
  state.spokesOn = !state.spokesOn;
  D('sw-spokes').classList.toggle('on', state.spokesOn);
  renderer.draw();
}

function toggleHideKnown(): void {
  state.hideKnownOn = !state.hideKnownOn;
  D('sw-known').classList.toggle('on', state.hideKnownOn);
  sim.alpha(0.25).restart();
  renderer.draw();
}

function refreshPareto(): void {
  const words = scene.nodes.filter(
    (n) => n.kind === 'word'
      && (state.levelFilter === 'all' || n.hsk === +state.levelFilter),
  );
  const summary = buildParetoSummary(words, state.paretoRatio);
  state.paretoIds = summary.ids;
  const percent = Math.round(state.paretoRatio * 100);
  D('frequencyValue').textContent = state.paretoOn
    ? t(state.lang, 'topPercent', { percent })
    : t(state.lang, 'all');
  D('frequencySummary').textContent = t(state.lang, 'frequencySummary', {
    focus: summary.focusWords,
    total: summary.totalWords,
    coverage: summary.occurrenceCoverage.toFixed(1),
  });
  detail.refreshFrequency();
}

function toggleKnown(n: GraphNode): void {
  if (state.known.has(n.hz)) state.known.delete(n.hz);
  else state.known.add(n.hz);
  saveKnown(state.known);
  refreshProgress();
  if (state.hideKnownOn) sim.alpha(0.2).restart();
  renderer.draw();
}

// ---- progress bars (markup rendered by ControlDock.astro) ----

const progRows = document.querySelectorAll<HTMLElement>('#progress .prog');
function refreshProgress(): void {
  progRows.forEach((row) => {
    const lv = +row.dataset.lv!;
    const words = scene.nodes.filter((x) => x.kind === 'word' && x.hsk === lv);
    const done = words.filter((x) => state.known.has(x.hz)).length;
    row.querySelector<HTMLElement>('.pfill')!.style.width = `${((done / (words.length || 1)) * 100).toFixed(1)}%`;
    row.querySelector<HTMLElement>('.pct')!.textContent = `${done}/${words.length}`;
  });
}
refreshProgress();

function setSpread(mul: number): void {
  state.spreadMul = mul;
  updateSpread();
  sim.alpha(0.5).restart();
}

function setThemeSolo(code: string | null): void {
  state.soloTheme = code;
  state.offThemes.clear();
  refreshLegend();
  sim.alpha(0.25).restart();
  renderer.draw();
}

// ---- language ----

function setLang(lang: Lang): void {
  state.lang = lang;
  saveLang(lang);
  applyTranslations(lang);
  refreshPareto();
  document.querySelectorAll<HTMLButtonElement>('#langPick button').forEach((b) =>
    b.classList.toggle('on', b.dataset.lang === lang),
  );
  if (searchEl.value.trim()) {
    scEl.textContent = state.searchMatch?.size
      ? t(state.lang, 'matches', { n: state.searchMatch.size })
      : t(state.lang, 'noMatch');
    renderSearchResults();
  }
  if (state.selNode) detail.open(state.selNode); // re-render open panel strings
  renderer.draw(); // theme anchor labels on canvas
}
document.querySelectorAll<HTMLButtonElement>('#langPick button').forEach((b) =>
  b.addEventListener('click', () => setLang(b.dataset.lang as Lang)),
);
document.querySelectorAll<HTMLButtonElement>('#langPick button').forEach((b) =>
  b.classList.toggle('on', b.dataset.lang === state.lang),
);

// ---- controls ----

// level slider (0 = all, 1–3 = exact HSK level)
const LEVELS: readonly LevelFilter[] = ['all', '1', '2', '3'];
const lvEl = D('lvSlider') as HTMLInputElement;
const lvLabels = document.querySelectorAll<HTMLElement>('#lvLabs span');
function applyLevelSlider(): void {
  const idx = +lvEl.value;
  lvEl.style.setProperty('--fill', `${(idx / 3) * 100}%`);
  lvLabels.forEach((s, i) => s.classList.toggle('on', i === idx));
  setLevelFilter(LEVELS[idx]!);
}
lvEl.style.setProperty('--fill', '0%');
lvEl.addEventListener('input', applyLevelSlider);
lvLabels.forEach((s, i) =>
  s.addEventListener('click', () => {
    lvEl.value = String(i);
    applyLevelSlider();
  }),
);

// frequency slider (10% = tight focus, 100% = all words)
const frequencyEl = D('frequencySlider') as HTMLInputElement;
function applyFrequencySlider(): void {
  const percent = +frequencyEl.value;
  state.paretoRatio = percent / 100;
  state.paretoOn = percent < 100;
  frequencyEl.style.setProperty('--fill', `${((percent - 10) / 90) * 100}%`);
  refreshPareto();
  sim.alpha(0.3).restart();
  renderer.draw();
}
frequencyEl.style.setProperty('--fill', '100%');
frequencyEl.addEventListener('input', applyFrequencySlider);

// toggles
const toggleActions: Record<string, () => void> = {
  group: toggleGroup,
  hubs: toggleHubs,
  spokes: toggleSpokes,
  known: toggleHideKnown,
};
document.querySelectorAll<HTMLElement>('.tog').forEach((t) =>
  t.addEventListener('click', () => toggleActions[t.dataset.tog!]?.()),
);

// spacing slider
const spreadEl = D('spread') as HTMLInputElement;
function setSpreadFill(): void {
  spreadEl.style.setProperty('--fill', `${(((state.spreadMul - 0.45) / (2.4 - 0.45)) * 100).toFixed(1)}%`);
}
setSpreadFill();
spreadEl.addEventListener('input', () => {
  setSpread(+spreadEl.value);
  setSpreadFill();
});

// legend (markup rendered by ControlDock.astro)
const legEl = D('legend');
function refreshLegend(): void {
  legEl.querySelectorAll<HTMLElement>('.lg').forEach((el) => {
    const c = el.dataset.code!;
    el.classList.toggle('off', state.soloTheme ? c !== state.soloTheme : state.offThemes.has(c));
  });
}
legEl.querySelectorAll<HTMLElement>('.lg').forEach((el) =>
  el.addEventListener('click', () => {
    const code = el.dataset.code!;
    setThemeSolo(state.soloTheme === code ? null : code);
  }),
);
D('legReset').addEventListener('click', () => setThemeSolo(null));

// search
const searchEl = D('search') as HTMLInputElement;
const scEl = D('searchCount');
const searchClear = D('searchClear');
const searchResultsEl = D('searchResults');
const MAX_SEARCH_RESULTS = 8;
let searchResultNodes: GraphNode[] = [];
let activeSearchResult = -1;

function chooseSearchResult(n: GraphNode): void {
  selectNode(n);
  interactions.focusOn(n);
}

function setActiveSearchResult(index: number): void {
  if (!searchResultNodes.length) return;
  activeSearchResult = (index + searchResultNodes.length) % searchResultNodes.length;
  searchResultsEl.querySelectorAll<HTMLElement>('.search-result').forEach((el, i) => {
    const active = i === activeSearchResult;
    el.classList.toggle('active', active);
    el.setAttribute('aria-selected', String(active));
    if (active) {
      searchEl.setAttribute('aria-activedescendant', el.id);
      el.scrollIntoView({ block: 'nearest' });
    }
  });
}

function renderSearchResults(): void {
  searchResultsEl.replaceChildren();
  activeSearchResult = -1;
  searchEl.removeAttribute('aria-activedescendant');

  for (const [i, n] of searchResultNodes.entries()) {
    const result = document.createElement('button');
    result.type = 'button';
    result.id = `search-result-${i}`;
    result.className = 'search-result';
    result.setAttribute('role', 'option');
    result.setAttribute('aria-selected', 'false');

    const hanzi = document.createElement('span');
    hanzi.className = 'search-result-hz';
    hanzi.textContent = n.hz;
    hanzi.style.fontFamily = `'${state.hanziFont}', sans-serif`;

    const copy = document.createElement('span');
    copy.className = 'search-result-copy';
    const pinyin = document.createElement('span');
    pinyin.className = 'search-result-py';
    pinyin.textContent = n.py;
    const meaning = document.createElement('span');
    meaning.className = 'search-result-meaning';
    meaning.textContent = state.lang === 'vi' ? n.vi : n.en;
    copy.append(pinyin, meaning);

    const level = document.createElement('span');
    level.className = 'search-result-level';
    level.textContent = `HSK ${n.hsk}`;

    result.append(hanzi, copy, level);
    result.addEventListener('pointerdown', (e) => e.preventDefault());
    result.addEventListener('click', () => chooseSearchResult(n));
    searchResultsEl.append(result);
  }

  const show = document.activeElement === searchEl && !!searchEl.value.trim() && searchResultNodes.length > 0;
  searchResultsEl.classList.toggle('show', show);
  searchEl.setAttribute('aria-expanded', String(show));
}

function setSearch(query: string): void {
  if (!query) {
    state.searchMatch = null;
    searchResultNodes = [];
    scEl.textContent = '';
    renderSearchResults();
    renderer.draw();
    return;
  }
  const list = matchWords(scene.nodes, query).sort(compareFrequency);
  state.searchMatch = new Set(list.map((n) => n.id));
  searchResultNodes = list.slice(0, MAX_SEARCH_RESULTS);
  scEl.textContent = list.length ? t(state.lang, 'matches', { n: list.length }) : t(state.lang, 'noMatch');
  renderSearchResults();
  renderer.draw();
  if (list.length) interactions.focusOn(list[0]!);
}

/** Clear any active search match + its UI. Called when a node is selected
 *  so the search fade-out doesn't persist on top of the focus highlight. */
function clearSearch(): void {
  if (!state.searchMatch && !searchEl.value) return;
  state.searchMatch = null;
  searchResultNodes = [];
  searchEl.value = '';
  scEl.textContent = '';
  searchClear.style.display = 'none';
  renderSearchResults();
  renderer.draw();
}

searchEl.addEventListener('input', () => {
  searchClear.style.display = searchEl.value ? 'block' : 'none';
  setSearch(searchEl.value.trim());
});
searchEl.addEventListener('focus', renderSearchResults);
searchEl.addEventListener('blur', () => {
  searchResultsEl.classList.remove('show');
  searchEl.setAttribute('aria-expanded', 'false');
});
searchClear.addEventListener('click', () => {
  searchEl.value = '';
  searchClear.style.display = 'none';
  setSearch('');
  searchEl.focus();
});
searchEl.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' && searchResultNodes.length) {
    e.preventDefault();
    setActiveSearchResult(activeSearchResult + 1);
  }
  if (e.key === 'ArrowUp' && searchResultNodes.length) {
    e.preventDefault();
    setActiveSearchResult(activeSearchResult < 0 ? searchResultNodes.length - 1 : activeSearchResult - 1);
  }
  if (e.key === 'Enter' && searchResultNodes.length) {
    e.preventDefault();
    chooseSearchResult(searchResultNodes[Math.max(activeSearchResult, 0)]!);
  }
  if (e.key === 'Escape') searchClear.click();
});

// buttons
D('btnReset').addEventListener('click', interactions.resetView);
D('btnShuffle').addEventListener('click', () => {
  scene.nodes.forEach((n) => {
    if (n.kind !== 'theme') {
      n.x = state.W / 2 + (Math.random() - 0.5) * state.W * 0.5;
      n.y = state.H / 2 + (Math.random() - 0.5) * state.H * 0.5;
      n.vx = 0;
      n.vy = 0;
    }
  });
  sim.alpha(0.9).restart();
});

// hint
D('hintX').addEventListener('click', () => {
  const h = D('hint');
  h.style.opacity = '0';
  setTimeout(() => h.remove(), 400);
});
setTimeout(() => {
  const h = document.getElementById('hint');
  if (h) {
    h.style.opacity = '0';
    setTimeout(() => h.remove(), 500);
  }
}, 9000);

// mobile dock
D('dockToggle').addEventListener('click', () => D('dock').classList.toggle('open'));

// ---- boot ----
refreshPareto();
window.addEventListener('resize', () => {
  renderer.resize();
  sim.alpha(0.3).restart();
});
renderer.resize();
seedPositions(scene, state);

(document.fonts?.ready ?? Promise.resolve()).then(() => {
  sim.alpha(1).restart();
  setTimeout(() => {
    const l = document.getElementById('loading');
    if (l) {
      l.classList.add('hide');
      setTimeout(() => l.remove(), 600);
    }
  }, 750);
  // gentle initial zoom-to-fit after settle
  setTimeout(interactions.fitView, 1400);
});
