// Canvas rendering. Pure drawing from scene + state; no DOM markup here.
import type { Scene } from './graph-layout';
import { makeNodeColor, nchars, radius, layoutHomes } from './graph-layout';
import { activeAlpha, visible, type GraphState } from './state';
import type { GraphLink, GraphNode } from './types';

export interface Renderer {
  draw(): void;
  /** Resize the canvas to the window and recompute theme homes. */
  resize(): void;
}

export function createRenderer(cv: HTMLCanvasElement, scene: Scene, state: GraphState): Renderer {
  const ctx = cv.getContext('2d')!;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const nodeColor = makeNodeColor(scene.themeMap);

  const linkVisible = (e: GraphLink) => visible(state, e.source) && visible(state, e.target);

  function draw(): void {
    const { W, H, transform, focusSet, searchMatch, selNode, soloTheme, offThemes } = state;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);
    const k = transform.k;

    // theme spokes
    if (state.spokesOn && state.groupOn) {
      ctx.lineWidth = 0.6 / k;
      for (const e of scene.themeLinks) {
        if (!linkVisible(e)) continue;
        ctx.strokeStyle = `rgba(150,160,190,${0.06 * Math.min(activeAlpha(state, e.target), 1)})`;
        ctx.beginPath();
        ctx.moveTo(e.source.x, e.source.y);
        ctx.lineTo(e.target.x, e.target.y);
        ctx.stroke();
      }
    }

    // char links
    ctx.lineCap = 'round';
    for (const e of scene.charLinks) {
      const s = e.source;
      const t = e.target;
      if (!linkVisible(e)) continue;
      const foc = focusSet && focusSet.has(s.id) && focusSet.has(t.id);
      const al = Math.min(activeAlpha(state, s), activeAlpha(state, t));
      ctx.strokeStyle = foc
        ? `rgba(139,232,221,${0.9 * al + 0.1})`
        : `rgba(176,196,232,${0.22 * al})`;
      ctx.lineWidth = (foc ? 2.1 : 1.05) / k;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
    }

    // theme anchor labels
    if (state.groupOn) {
      for (const n of scene.nodes) {
        if (n.kind !== 'theme' || !visible(state, n)) continue;
        const col = scene.themeMap[n.theme]?.color ?? '#fff';
        ctx.globalAlpha = soloTheme
          ? n.theme === soloTheme ? 0.95 : 0.25
          : offThemes.has(n.theme) ? 0.25 : 0.8;
        ctx.font = `700 ${14 / k}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 14 / k;
        ctx.fillText(scene.themeMap[n.theme]?.vi ?? n.en, n.x, n.y);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }

    // nodes — the word/character sits INSIDE the circle
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of scene.nodes) {
      if (n.kind === 'theme' || !visible(state, n)) continue;
      const r = radius(n);
      const col = nodeColor(n);
      const al = activeAlpha(state, n);
      const isFoc = !!(focusSet && focusSet.has(n.id));
      const isSel = !!(selNode && selNode.id === n.id);
      const isHub = n.kind === 'hub';
      ctx.globalAlpha = al;
      // circle
      ctx.shadowColor = col;
      ctx.shadowBlur = isFoc || isSel ? 20 : isHub ? 11 : 7;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, 6.2832);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.shadowBlur = 0;
      if (isHub) {
        ctx.lineWidth = 1.6 / k;
        ctx.strokeStyle = 'rgba(255,255,255,.7)';
        ctx.stroke();
      }
      if (isSel) {
        ctx.lineWidth = 2.6 / k;
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 3 / k, 0, 6.2832);
        ctx.stroke();
      }
      // characters inside
      const c = nchars(n);
      const fs = Math.min(isHub ? 26 : 24, (2 * r - 10) / c);
      ctx.font = `600 ${fs}px "${state.hanziFont}", sans-serif`;
      if (isHub) {
        ctx.fillStyle = `rgba(16,18,28,${al})`;
        ctx.fillText(n.hz, n.x, n.y + fs * 0.04);
      } else {
        ctx.lineWidth = Math.max(2, fs / 5);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = `rgba(8,10,18,${0.5 * al})`;
        ctx.strokeText(n.hz, n.x, n.y + fs * 0.04);
        ctx.fillStyle = `rgba(255,255,255,${al})`;
        ctx.fillText(n.hz, n.x, n.y + fs * 0.04);
      }
      // pinyin below, revealed when zoomed in or focused
      if ((k > 1.5 || isFoc || isSel) && n.py) {
        const ps = 11 / k;
        ctx.font = `500 ${ps}px Inter, sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,.92)';
        ctx.shadowBlur = 3;
        ctx.fillStyle = `rgba(255,255,255,${0.74 * al})`;
        ctx.fillText(n.py, n.x, n.y + r + ps * 0.95);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function resize(): void {
    state.W = window.innerWidth;
    state.H = window.innerHeight;
    cv.width = state.W * DPR;
    cv.height = state.H * DPR;
    cv.style.width = `${state.W}px`;
    cv.style.height = `${state.H}px`;
    layoutHomes(scene, state);
    draw();
  }

  return { draw, resize };
}
