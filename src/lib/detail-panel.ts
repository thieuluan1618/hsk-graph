// Client-side controller for the detail panel markup rendered by
// DetailPanel.astro. All detail-panel DOM updates live here.
import { hasSentenceAudio, hasWordAudio, playSentence, playWord } from './audio';
import type { Scene } from './graph-layout';
import { makeNodeColor } from './graph-layout';
import type { GraphNode } from './types';
import HanziWriter from 'hanzi-writer';

export interface DetailPanelCallbacks {
  /** A related-word chip was clicked. */
  onNavigate(n: GraphNode): void;
  /** The close button was clicked. */
  onClose(): void;
}

export interface DetailPanel {
  open(n: GraphNode): void;
  close(): void;
}

interface RelatedGroup {
  ch: string;
  py: string;
  words: GraphNode[];
}

export function createDetailPanel(scene: Scene, cb: DetailPanelCallbacks): DetailPanel {
  const D = (id: string) => document.getElementById(id)!;
  const nodeColor = makeNodeColor(scene.themeMap);

  // ---- stroke order (HanziWriter) ----
  let writers: HanziWriter[] = [];

  function clearStrokes(): void {
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
        });
        writers.push(w);
        w.animateCharacter();
      } catch {
        // character not in hanzi-writer database
        cell.textContent = ch;
        cell.classList.add('fallback');
      }
    }
  }

  function replayStrokes(): void {
    writers.forEach((w) => w.animateCharacter());
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
    const col = nodeColor(n);
    D('dglow').style.background = `radial-gradient(circle at 30% 0%,${col},transparent 70%)`;
    D('d-zh').textContent = n.hz;
    D('d-zh').style.color = col;
    D('d-py').textContent = n.py || '';
    let badges = '';
    if (n.kind === 'hub') badges += '<span class="badge hub">chữ chung</span>';
    else badges += `<span class="badge hsk${n.hsk}">HSK ${n.hsk}</span>`;
    if (n.pos) badges += ` <span class="badge pos">${n.pos}</span>`;
    D('d-badges').innerHTML = badges;
    D('d-en').textContent = n.en || '';
    D('d-vi').textContent = n.vi || '';
    D('d-pos').textContent = n.pos || '—';
    D('d-hv').textContent = n.hv || '—';

    // related words
    const groups = relatedGroups(n);
    const relh = D('d-relh');
    const wrap = D('d-rel');
    wrap.innerHTML = '';
    if (!groups.length) {
      relh.textContent = 'Từ liên quan';
      wrap.innerHTML = '<div class="none">Từ này không chia sẻ chữ Hán với từ nào khác trong HSK 1–2.</div>';
    } else {
      relh.textContent = n.kind === 'hub' || n.isHub ? 'Học 1 chữ, hiểu nhiều từ' : 'Cùng chữ Hán';
      groups.forEach((g) => {
        const div = document.createElement('div');
        div.className = 'grp';
        let html = `<div class="gc">chứa <b>${g.ch}</b>${g.py ? ` <span style="color:var(--muted2)">${g.py}</span>` : ''}</div><div class="chips">`;
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
      D('d-ex-audio-t').textContent = hasS ? 'Nghe câu' : 'Nghe câu — sắp có';
      sb.onclick = hasS ? () => void playSentence(n.hz) : null;
    } else {
      ex.style.display = 'none';
    }

    // audio button
    const hasA = hasWordAudio(n.hz);
    const ab = D('d-audio');
    ab.classList.toggle('on', hasA);
    D('d-audio-t').textContent = hasA ? 'Nghe phát âm' : 'Chưa có âm thanh';
    ab.onclick = hasA ? () => void playWord(n.hz) : null;

    // stroke order
    void buildStrokes(n.hz);

    D('detail').classList.add('show');
  }

  function close(): void {
    D('detail').classList.remove('show');
    clearStrokes();
  }

  D('dclose').addEventListener('click', () => {
    close();
    cb.onClose();
  });
  D('d-stroke-play').addEventListener('click', replayStrokes);

  return { open, close };
}
