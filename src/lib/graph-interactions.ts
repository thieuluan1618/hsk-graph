// Zoom, drag, hover, hit testing, and view transitions for the canvas.
// Importing from the `d3` metapackage also registers selection.transition().
import { drag as d3drag, pointer, select, zoom as d3zoom, zoomIdentity } from 'd3';
import type { Scene } from './graph-layout';
import { radius } from './graph-layout';
import { visible, type GraphState } from './state';
import type { GraphNode } from './types';
import type { Simulation } from 'd3';

export interface InteractionCallbacks {
  /** A node was clicked. */
  onSelect(n: GraphNode): void;
  /** Empty canvas was clicked. */
  onClear(): void;
}

export interface Interactions {
  /** Set the highlight neighborhood for a node (or clear with null). */
  setFocus(n: GraphNode | null): void;
  /** Pan/zoom so the node is centered. */
  focusOn(n: GraphNode): void;
  resetView(): void;
  /** Zoom to fit all visible nodes. */
  fitView(): void;
}

export function createInteractions(
  cv: HTMLCanvasElement,
  scene: Scene,
  state: GraphState,
  sim: Simulation<GraphNode, never>,
  draw: () => void,
  cb: InteractionCallbacks,
): Interactions {
  const zoom = d3zoom<HTMLCanvasElement, unknown>()
    .scaleExtent([0.18, 7])
    .on('zoom', (ev) => {
      state.transform = ev.transform;
      draw();
    });

  function pickAt(px: number, py: number): GraphNode | null {
    const x = state.transform.invertX(px);
    const y = state.transform.invertY(py);
    let best: GraphNode | null = null;
    let bd = 1e9;
    for (const n of scene.nodes) {
      if (n.kind === 'theme' || !visible(state, n)) continue;
      const dx = n.x - x;
      const dy = n.y - y;
      const d = dx * dx + dy * dy;
      const rr = radius(n) + 7 / state.transform.k;
      if (d < rr * rr && d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  const drag = d3drag<HTMLCanvasElement, unknown, { node: GraphNode } | null>()
    .subject((ev) => {
      const n = pickAt(ev.x, ev.y);
      return n ? { node: n } : null;
    })
    .on('start', (ev) => {
      if (!ev.active) sim.alphaTarget(0.18).restart();
      const n = (ev.subject as { node: GraphNode }).node;
      n.fx = n.x;
      n.fy = n.y;
      cv.classList.add('grabbing');
    })
    .on('drag', (ev) => {
      const n = (ev.subject as { node: GraphNode }).node;
      n.fx = state.transform.invertX(ev.x);
      n.fy = state.transform.invertY(ev.y);
    })
    .on('end', (ev) => {
      if (!ev.active) sim.alphaTarget(0);
      const n = (ev.subject as { node: GraphNode }).node;
      if (n.kind !== 'theme') {
        n.fx = null;
        n.fy = null;
      }
      cv.classList.remove('grabbing');
    });

  select(cv).call(drag).call(zoom);

  function setFocus(n: GraphNode | null): void {
    if (!n) {
      state.focusSet = null;
      draw();
      return;
    }
    const s = new Set<string>([n.id]);
    scene.charAdj[n.id]!.forEach((id) => s.add(id));
    state.focusSet = s;
    draw();
  }

  // hover
  cv.addEventListener('mousemove', (ev) => {
    const [px, py] = pointer(ev, cv);
    const n = pickAt(px!, py!);
    cv.classList.toggle('pointing', !!n);
    if (n !== state.hoverNode) {
      state.hoverNode = n;
      if (!state.selNode) setFocus(n);
    }
  });
  cv.addEventListener('mouseleave', () => {
    state.hoverNode = null;
    if (!state.selNode) setFocus(null);
  });

  // click / tap
  select(cv).on('click', (ev: MouseEvent) => {
    const [px, py] = pointer(ev, cv);
    const n = pickAt(px!, py!);
    if (n) {
      state.selNode = n;
      setFocus(n);
      cb.onSelect(n);
    } else {
      state.selNode = null;
      setFocus(null);
      cb.onClear();
    }
  });

  function focusOn(n: GraphNode): void {
    const k = 1.6;
    const tx = state.W / 2 - n.x * k;
    const ty = state.H / 2 - n.y * k;
    select(cv)
      .transition()
      .duration(600)
      .call(zoom.transform, zoomIdentity.translate(tx, ty).scale(k));
  }

  function resetView(): void {
    select(cv).transition().duration(600).call(zoom.transform, zoomIdentity);
  }

  function fitView(): void {
    const vis = scene.nodes.filter((n) => n.kind !== 'theme' && visible(state, n));
    if (!vis.length) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    vis.forEach((n) => {
      x0 = Math.min(x0, n.x);
      y0 = Math.min(y0, n.y);
      x1 = Math.max(x1, n.x);
      y1 = Math.max(y1, n.y);
    });
    const pad = 100;
    const bw = x1 - x0 + pad * 2;
    const bh = y1 - y0 + pad * 2;
    const k = Math.min(1.7, Math.max(0.2, Math.min(state.W / bw, state.H / bh)));
    const tx = state.W / 2 - ((x0 + x1) / 2) * k;
    const ty = state.H / 2 - ((y0 + y1) / 2) * k;
    select(cv)
      .transition()
      .duration(800)
      .call(zoom.transform, zoomIdentity.translate(tx, ty).scale(k));
  }

  return { setFocus, focusOn, resetView, fitView };
}
