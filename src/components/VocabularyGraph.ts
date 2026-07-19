// Browser-side entry point for the vocabulary graph island.
// Owns the UI state and wires controls, search, detail panel, and audio
// to the D3 simulation/renderer modules.
import graphDataJson from '../data/graph.json';
import { playWord } from '../lib/audio';
import { createDetailPanel } from '../lib/detail-panel';
import { createInteractions } from '../lib/graph-interactions';
import {
  buildScene,
  createSimulation,
  seedPositions,
} from '../lib/graph-layout';
import { createRenderer } from '../lib/graph-renderer';
import { matchWords } from '../lib/search';
import { createState, type LevelFilter } from '../lib/state';
import type { GraphData, GraphNode } from '../lib/types';

const data = graphDataJson as unknown as GraphData;
const D = (id: string) => document.getElementById(id)!;

const cv = D('cv') as HTMLCanvasElement;
const state = createState();
const scene = buildScene(data);
const { sim, updateSpread } = createSimulation(scene, state);
const renderer = createRenderer(cv, scene, state);
sim.on('tick', renderer.draw);

const interactions = createInteractions(cv, scene, state, sim, renderer.draw, {
  onSelect(n) {
    detail.open(n);
    void playWord(n.hz);
  },
  onClear() {
    detail.close();
  },
});

const detail = createDetailPanel(scene, {
  onNavigate(w) {
    selectNode(w);
    interactions.focusOn(w);
  },
  onClose() {
    clearSelection();
  },
});

function selectNode(n: GraphNode): void {
  state.selNode = n;
  interactions.setFocus(n);
  detail.open(n);
  void playWord(n.hz);
}

function clearSelection(): void {
  state.selNode = null;
  interactions.setFocus(null);
}

// ---- named state updates ----

function setLevelFilter(lv: LevelFilter): void {
  state.levelFilter = lv;
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

function setSearch(query: string): void {
  if (!query) {
    state.searchMatch = null;
    scEl.textContent = '';
    renderer.draw();
    return;
  }
  const list = matchWords(scene.nodes, query);
  state.searchMatch = new Set(list.map((n) => n.id));
  scEl.textContent = list.length ? `${list.length} từ khớp` : 'không tìm thấy';
  renderer.draw();
  if (list.length) {
    const sorted = [...list].sort((a, b) => b.freq - a.freq);
    interactions.focusOn(sorted[0]!);
  }
}

// ---- controls ----

// level segment
document.querySelectorAll<HTMLButtonElement>('#segLevel button').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll('#segLevel button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    setLevelFilter(b.dataset.lv as LevelFilter);
  }),
);

// toggles
const toggleActions: Record<string, () => void> = {
  group: toggleGroup,
  hubs: toggleHubs,
  spokes: toggleSpokes,
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
searchEl.addEventListener('input', () => {
  searchClear.style.display = searchEl.value ? 'block' : 'none';
  setSearch(searchEl.value.trim());
});
searchClear.addEventListener('click', () => {
  searchEl.value = '';
  searchClear.style.display = 'none';
  setSearch('');
  searchEl.focus();
});
searchEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && state.searchMatch && state.searchMatch.size) {
    const first = scene.nodes
      .filter((n) => state.searchMatch!.has(n.id))
      .sort((a, b) => b.freq - a.freq)[0];
    if (first) {
      selectNode(first);
      interactions.focusOn(first);
    }
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
