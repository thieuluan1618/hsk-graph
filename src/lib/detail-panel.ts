// Client-side controller for the detail panel markup rendered by
// DetailPanel.astro. All detail-panel DOM updates live here.
import { hasSentenceAudio, hasWordAudio, playSentence, playWord } from './audio';
import type { Scene } from './graph-layout';
import { makeNodeColor } from './graph-layout';
import { t } from './i18n';
import type { GraphState } from './state';
import type { GraphNode } from './types';
import HanziWriter from 'hanzi-writer';

export interface DetailPanelCallbacks {
  /** A related-word chip was clicked. */
  onNavigate(n: GraphNode): void;
  /** The close button was clicked. */
  onClose(): void;
  /** Whether this word is marked as known. */
  isKnown(n: GraphNode): boolean;
  /** The "known" toggle was clicked. */
  onToggleKnown(n: GraphNode): void;
}

export interface DetailPanel {
  open(n: GraphNode): void;
  close(): void;
  refreshFrequency(): void;
}

interface RelatedGroup {
  ch: string;
  py: string;
  words: GraphNode[];
}

export function createDetailPanel(scene: Scene, state: GraphState, cb: DetailPanelCallbacks): DetailPanel {
  const D = (id: string) => document.getElementById(id)!;
  const nodeColor = makeNodeColor(scene.themeMap);
  let currentNode: GraphNode | null = null;

  function formatNumber(value: number, maximumFractionDigits = 0): string {
    return new Intl.NumberFormat(state.lang === 'vi' ? 'vi-VN' : 'en-US', {
      maximumFractionDigits,
    }).format(value);
  }

  function syncFrequency(n: GraphNode): void {
    const card = D('d-frequency');
    if (n.kind !== 'word') {
      card.style.display = 'none';
      return;
    }

    card.style.display = '';
    const ranked = n.freq !== null && n.freqCount != null && n.freqPerMillion != null;
    card.classList.toggle('unranked', !ranked);
    D('d-freq-rank').textContent = ranked ? `#${formatNumber(n.freq!)}` : '—';
    D('d-freq-rate').textContent = ranked
      ? t(state.lang, 'frequencyRate', {
          rate: formatNumber(n.freqPerMillion!, 2),
          count: formatNumber(n.freqCount!),
        })
      : t(state.lang, 'frequencyUnavailable');
  }

  // ---- stroke order (HanziWriter) ----
  let writers: HanziWriter[] = [];

  function clearStrokes(): void {
    writers.forEach((w) => {
      void w.hideCharacter({ duration: 0 }).catch(() => {});
    });
    writers = [];
    D('d-stroke-grid').innerHTML = '';
  }

  async function buildStrokes(hz: string): Promise<void> {
    clearStrokes();
    const grid = D('d-stroke-grid');
    for (const ch of hz) {
      const cell = document.createElement('div');
      cell.className = 'stroke-cell';
      const target = document.createElement('div');
      target.className = 'stroke-target';
      cell.appendChild(target);
      grid.appendChild(cell);
      try {
        const w = HanziWriter.create(target, ch, {
          width: 72,
          height: 72,
          padding: 4,
          strokeColor: '#eef1fa',
          outlineColor: 'rgba(255,255,255,.08)',
          drawingColor: '#8be8dd',
          showOutline: true,
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 120,
          delayBetweenLoops: 800,
        });
        writers.push(w);
        void w.loopCharacterAnimation();
      } catch {
        // character not in hanzi-writer database
        cell.textContent = ch;
        cell.classList.add('fallback');
      }
    }
  }

  /** Group sibling words by shared hub character. */
  function relatedGroups(n: GraphNode): RelatedGroup[] {
    const groups: RelatedGroup[] = [];
    const neighbors = [...scene.charAdj[n.id]!].map((id) => scene.byId[id]!);
    if (n.kind === 'hub' || n.isHub) {
      // it's a hub itself: list all member words
      const words = neighbors.filter((x) => x.kind === 'word' && x.id !== n.id);
      if (words.length) groups.push({ ch: n.hz, py: n.py, words });
    }
    const myHubs = neighbors.filter((x) => x.kind === 'hub' || x.isHub);
    myHubs.forEach((h) => {
      const words = [...scene.charAdj[h.id]!]
        .map((id) => scene.byId[id]!)
        .filter((x) => x.kind === 'word' && x.id !== n.id);
      if (words.length) groups.push({ ch: h.hz, py: h.py, words });
    });
    return groups;
  }

  function open(n: GraphNode): void {
    currentNode = n;
    const col = nodeColor(n);
    D('dglow').style.background = `radial-gradient(circle at 30% 0%,${col},transparent 70%)`;
    D('d-zh').textContent = n.hz;
    D('d-zh').style.color = col;
    D('d-py').textContent = n.py || '';
    let badges = '';
    if (n.kind === 'hub') badges += `<span class="badge hub">${t(state.lang, 'hubBadge')}</span>`;
    else badges += `<span class="badge hsk${n.hsk}">HSK ${n.hsk}</span>`;
    if (n.supplementary) badges += ` <span class="badge supplementary">${t(state.lang, 'suppBadge')}</span>`;
    if (n.pos) badges += ` <span class="badge pos">${n.pos}</span>`;
    D('d-badges').innerHTML = badges;
    D('d-en').textContent = n.en || '';
    D('d-vi').textContent = n.vi || '';
    D('d-pos').textContent = n.pos || '—';
    D('d-hv').textContent = n.hv || '—';
    syncFrequency(n);

    // related words
    const groups = relatedGroups(n);
    const relh = D('d-relh');
    const wrap = D('d-rel');
    wrap.innerHTML = '';
    if (!groups.length) {
      relh.textContent = t(state.lang, 'related');
      wrap.innerHTML = `<div class="none">${t(state.lang, 'noRelated')}</div>`;
    } else {
      relh.textContent = n.kind === 'hub' || n.isHub ? t(state.lang, 'relHub') : t(state.lang, 'relShared');
      groups.forEach((g) => {
        const div = document.createElement('div');
        div.className = 'grp';
        let html = `<div class="gc">${t(state.lang, 'contains')} <b>${g.ch}</b>${g.py ? ` <span style="color:var(--muted2)">${g.py}</span>` : ''}</div><div class="chips">`;
        g.words.forEach((w) => {
          html += `<span class="chip" data-id="${w.id}"><span class="z">${w.hz}</span><span class="p">${w.py}</span></span>`;
        });
        html += '</div>';
        div.innerHTML = html;
        wrap.appendChild(div);
      });
      wrap.querySelectorAll<HTMLElement>('.chip').forEach((c) =>
        c.addEventListener('click', () => {
          const w = scene.byId[c.dataset.id!];
          if (w) cb.onNavigate(w);
        }),
      );
    }

    // example sentence
    const ex = D('d-ex');
    if (n.sent) {
      ex.style.display = '';
      const s = n.sent;
      D('d-ex-zh').innerHTML = s.zh.replace(n.hz, `<span class="hl">${n.hz}</span>`);
      D('d-ex-py').textContent = s.py;
      D('d-ex-en').textContent = s.en;
      D('d-ex-vi').textContent = s.vi;
      const hasS = hasSentenceAudio(n.hz);
      const sb = D('d-ex-audio');
      sb.classList.toggle('on', hasS);
      D('d-ex-audio-t').textContent = t(state.lang, hasS ? 'playSent' : 'playSentSoon');
      sb.onclick = hasS ? () => void playSentence(n.hz) : null;
    } else {
      ex.style.display = 'none';
    }

    // audio button
    const hasA = hasWordAudio(n.hz);
    const ab = D('d-audio');
    ab.classList.toggle('on', hasA);
    D('d-audio-t').textContent = t(state.lang, hasA ? 'playWord' : 'noAudio');
    ab.onclick = hasA ? () => void playWord(n.hz) : null;

    // known toggle (words only; hubs aren't study items)
    const kb = D('d-known');
    if (n.kind === 'word') {
      kb.style.display = '';
      const syncKnown = () => {
        const on = cb.isKnown(n);
        kb.classList.toggle('on', on);
        D('d-known-t').textContent = t(state.lang, on ? 'knownOn' : 'markKnown');
      };
      syncKnown();
      kb.onclick = () => {
        cb.onToggleKnown(n);
        syncKnown();
      };
    } else {
      kb.style.display = 'none';
      kb.onclick = null;
    }

    // stroke order
    void buildStrokes(n.hz);

    D('detail').classList.add('show');
  }

  function close(): void {
    currentNode = null;
    D('detail').classList.remove('show');
    clearStrokes();
  }

  D('dclose').addEventListener('click', () => {
    close();
    cb.onClose();
  });

  return {
    open,
    close,
    refreshFrequency() {
      if (currentNode) syncFrequency(currentNode);
    },
  };
}
