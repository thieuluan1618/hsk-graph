// Client controller for the word-list page (/words/): filtering, VI/EN
// meanings, audio, and an inline stroke-order row per word.
import HanziWriter from 'hanzi-writer';
import { hasWordAudio, playWord } from '../lib/audio';
import { loadLang, saveLang, type Lang } from '../lib/i18n';
import { norm } from '../lib/search';

const COPY = {
  vi: {
    kicker: 'HSK Buddy · Bảng từ',
    searchPh: 'Lọc theo chữ Hán · pinyin · nghĩa…',
    all: 'Tất cả',
    empty: 'Không tìm thấy từ nào.',
    replay: 'Xem lại',
    practice: 'Luyện viết',
    stop: 'Dừng luyện',
    noData: 'Chưa có dữ liệu nét',
    collapseAll: 'Thu gọn tất cả',
    expandAll: 'Mở rộng tất cả',
  },
  en: {
    kicker: 'HSK Buddy · Word list',
    searchPh: 'Filter by hanzi · pinyin · meaning…',
    all: 'All',
    empty: 'No matching words.',
    replay: 'Replay',
    practice: 'Practice',
    stop: 'Stop practice',
    noData: 'No stroke data',
    collapseAll: 'Collapse all',
    expandAll: 'Expand all',
  },
} satisfies Record<Lang, Record<string, string>>;
type CopyKey = keyof (typeof COPY)['vi'];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const searchInput = $<HTMLInputElement>('wordsSearch');
const levelGroup = $('wordsLevels');
const langPick = $('wordsLangPick');
const empty = $('wordsEmpty');
const foldAll = $<HTMLButtonElement>('wordsFoldAll');
const table = document.querySelector<HTMLTableElement>('.words-table')!;
const groups = [...document.querySelectorAll<HTMLTableSectionElement>('.words-group')];
const rows = [...document.querySelectorAll<HTMLTableRowElement>('.word-row')];

let lang: Lang = loadLang();
let level = 'all';
const tr = (k: CopyKey) => COPY[lang][k];

// ---------- language ----------
function applyLang(): void {
  document.body.dataset.lang = lang;
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>('[data-w-i18n]').forEach((el) => {
    el.textContent = tr(el.dataset.wI18n as CopyKey);
  });
  document.querySelectorAll<HTMLInputElement>('[data-w-i18n-ph]').forEach((el) => {
    el.placeholder = tr(el.dataset.wI18nPh as CopyKey);
  });
  langPick.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  });
  if (open) syncStrokeLabels(open.detail);
}

langPick.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-lang]');
  if (!b) return;
  lang = b.dataset.lang === 'en' ? 'en' : 'vi';
  saveLang(lang);
  applyLang();
});

// ---------- filtering ----------
const flat = (s: string) => norm(s).replace(/[\s'’.-]/g, '');
const index = rows.map((r) => ({
  row: r,
  hsk: r.dataset.hsk!,
  text: norm(`${r.dataset.hz} ${r.dataset.py} ${r.dataset.en} ${r.dataset.vi}`),
  py: flat(r.dataset.py!),
}));

function applyFilter(): void {
  const q = norm(searchInput.value).trim();
  const qPy = flat(q);
  let no = 0;
  for (const it of index) {
    const show = (level === 'all' || it.hsk === level) && (!q || it.text.includes(q) || (!!qPy && it.py.includes(qPy)));
    it.row.hidden = !show;
    if (show) it.row.querySelector('.c-no')!.textContent = String(++no);
    else if (open?.row === it.row) closeStrokes();
  }
  for (const g of groups) {
    const n = g.querySelectorAll('.word-row:not([hidden])').length;
    g.hidden = n === 0;
    g.querySelector('.group-count')!.textContent = String(n);
    document.querySelector<HTMLElement>(`[data-jump="${g.dataset.theme}"]`)!.hidden = n === 0;
  }
  empty.hidden = no > 0;
  table.classList.toggle('searching', !!q);
  syncFoldAll();
}

searchInput.addEventListener('input', applyFilter);
levelGroup.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-level]');
  if (!b) return;
  level = b.dataset.level!;
  levelGroup.querySelectorAll<HTMLButtonElement>('button').forEach((x) => {
    x.setAttribute('aria-pressed', String(x === b));
  });
  applyFilter();
});

// ---------- collapse / expand ----------
const FOLD_KEY = 'hsk-words:collapsed';
const collapsed = new Set<string>();
try {
  (JSON.parse(localStorage.getItem(FOLD_KEY) ?? '[]') as string[]).forEach((c) => collapsed.add(c));
} catch {
  // storage unavailable — everything starts expanded
}

function saveFold(): void {
  try {
    localStorage.setItem(FOLD_KEY, JSON.stringify([...collapsed]));
  } catch {
    // storage unavailable — fold state just won't persist
  }
}

function setCollapsed(g: HTMLTableSectionElement, fold: boolean): void {
  const code = g.dataset.theme!;
  if (fold) collapsed.add(code);
  else collapsed.delete(code);
  g.classList.toggle('collapsed', fold);
  g.querySelector('.group-toggle')!.setAttribute('aria-expanded', String(!fold));
  if (fold && open && g.contains(open.row) && !table.classList.contains('searching')) closeStrokes();
}

function syncFoldAll(): void {
  const shown = groups.filter((g) => !g.hidden);
  const allFolded = shown.length > 0 && shown.every((g) => collapsed.has(g.dataset.theme!));
  const key: CopyKey = allFolded ? 'expandAll' : 'collapseAll';
  foldAll.dataset.wI18n = key;
  foldAll.textContent = tr(key);
  foldAll.disabled = table.classList.contains('searching');
}

foldAll.addEventListener('click', () => {
  const fold = foldAll.dataset.wI18n === 'collapseAll';
  groups.forEach((g) => setCollapsed(g, fold));
  saveFold();
  syncFoldAll();
});

document.querySelector('.words-jump')!.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLElement>('[data-jump]');
  const g = a && groups.find((x) => x.dataset.theme === a.dataset.jump);
  if (!g || !collapsed.has(g.dataset.theme!)) return;
  setCollapsed(g, false);
  saveFold();
  syncFoldAll();
});

// ---------- stroke order ----------
interface OpenRow {
  row: HTMLTableRowElement;
  detail: HTMLTableRowElement;
  writers: HanziWriter[];
  practicing: boolean;
}
let open: OpenRow | null = null;

function syncStrokeLabels(detail: HTMLElement): void {
  detail.querySelector('[data-s="replay"] span')!.textContent = tr('replay');
  detail.querySelector('[data-s="practice"] span')!.textContent = open?.practicing ? tr('stop') : tr('practice');
  detail.querySelectorAll('.stroke-missing').forEach((el) => (el.textContent = tr('noData')));
}

function animateAll(o: OpenRow): void {
  o.practicing = false;
  o.writers.forEach((w) => {
    w.cancelQuiz();
    w.showOutline();
    void w.loopCharacterAnimation();
  });
  syncStrokeLabels(o.detail);
}

function practiceAll(o: OpenRow): void {
  o.practicing = true;
  o.writers.forEach((w) => {
    w.hideCharacter({ duration: 0 });
    void w.quiz({ showHintAfterMisses: 2 });
  });
  syncStrokeLabels(o.detail);
}

function closeStrokes(): void {
  if (!open) return;
  open.writers.forEach((w) => {
    w.cancelQuiz();
    void w.hideCharacter({ duration: 0 }).catch(() => {});
  });
  open.row.setAttribute('aria-expanded', 'false');
  open.row.classList.remove('open');
  open.detail.remove();
  open = null;
}

function openStrokes(row: HTMLTableRowElement): void {
  const same = open?.row === row;
  closeStrokes();
  if (same) return;

  const hz = row.dataset.hz!;
  const detail = document.createElement('tr');
  detail.className = 'stroke-row';
  detail.innerHTML = `<td colspan="5"><div class="stroke-wrap">
    <div class="stroke-chars"></div>
    <div class="stroke-actions">
      <button type="button" class="stroke-btn" data-s="replay">↻ <span></span></button>
      <button type="button" class="stroke-btn" data-s="practice">✎ <span></span></button>
    </div></div></td>`;
  row.after(detail);
  row.setAttribute('aria-expanded', 'true');
  row.classList.add('open');

  const o: OpenRow = { row, detail, writers: [], practicing: false };
  open = o;
  const box = detail.querySelector<HTMLElement>('.stroke-chars')!;
  const size = window.innerWidth < 520 ? 84 : 112;

  for (const ch of hz) {
    const cell = document.createElement('div');
    cell.className = 'stroke-cell-lg';
    box.appendChild(cell);
    const target = document.createElement('div');
    cell.appendChild(target);
    const w = HanziWriter.create(target, ch, {
      width: size,
      height: size,
      padding: 6,
      strokeColor: '#eef1fa',
      radicalColor: '#ffd166',
      outlineColor: 'rgba(255,255,255,.1)',
      drawingColor: '#8be8dd',
      highlightColor: '#8be8dd',
      showOutline: true,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 140,
      delayBetweenLoops: 900,
      onLoadCharDataError: () => {
        cell.classList.add('fallback');
        cell.innerHTML = `<b lang="zh-Hans">${ch}</b><small class="stroke-missing"></small>`;
        syncStrokeLabels(detail);
      },
    });
    o.writers.push(w);
    void w.loopCharacterAnimation();
  }

  detail.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-s]');
    if (!b) return;
    if (b.dataset.s === 'replay') animateAll(o);
    else if (o.practicing) animateAll(o);
    else practiceAll(o);
  });
  syncStrokeLabels(detail);
  if (hasWordAudio(hz)) void playWord(hz, '');
}

// ---------- row interaction ----------
for (const r of rows) {
  const audioBtn = r.querySelector<HTMLButtonElement>('[data-act="audio"]')!;
  if (!hasWordAudio(r.dataset.hz!)) audioBtn.disabled = true;
}

table.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const toggle = target.closest('.group-toggle');
  if (toggle) {
    const g = toggle.closest<HTMLTableSectionElement>('.words-group')!;
    setCollapsed(g, !collapsed.has(g.dataset.theme!));
    saveFold();
    syncFoldAll();
    return;
  }
  const row = target.closest<HTMLTableRowElement>('.word-row');
  if (!row) return;
  if (target.closest('[data-act="audio"]')) {
    void playWord(row.dataset.hz!, '');
    return;
  }
  openStrokes(row);
});

document.addEventListener('keydown', (e) => {
  const row = (e.target as HTMLElement).closest?.('.word-row') as HTMLTableRowElement | null;
  if (e.key === 'Escape') {
    closeStrokes();
    return;
  }
  if (!row || (e.target as HTMLElement).tagName === 'BUTTON') return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openStrokes(row);
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const visible = rows.filter((x) => x.offsetParent !== null);
    const next = visible[visible.indexOf(row) + (e.key === 'ArrowDown' ? 1 : -1)];
    next?.focus();
  }
});

groups.forEach((g) => setCollapsed(g, collapsed.has(g.dataset.theme!)));
applyLang();
applyFilter();
