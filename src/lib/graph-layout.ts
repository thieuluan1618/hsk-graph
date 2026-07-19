// Scene construction, node sizing/coloring, theme home positions, and the
// force simulation. Ported from the original single-file demo unchanged
// except that link endpoints are resolved to node references up front.
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
} from 'd3';
import type { GraphData, GraphLink, GraphNode, ThemeDef } from './types';
import type { GraphState } from './state';

export interface ThemeHome {
  a: number;
  x: number;
  y: number;
}

/** Static graph structures derived once from the data. */
export interface Scene {
  nodes: GraphNode[];
  byId: Record<string, GraphNode>;
  charLinks: GraphLink[];
  themeLinks: GraphLink[];
  /** Adjacency over char links, for highlight + related-words panel. */
  charAdj: Record<string, Set<string>>;
  themeMap: Record<string, ThemeDef>;
  themeCodes: string[];
  themeHome: Record<string, ThemeHome>;
}

export function buildScene(data: GraphData): Scene {
  const nodes = data.nodes.map((n) => ({ ...n })) as GraphNode[];
  const byId: Record<string, GraphNode> = {};
  nodes.forEach((n) => (byId[n.id] = n));

  const charLinks: GraphLink[] = data.edges.map((e) => ({
    source: byId[e.source]!,
    target: byId[e.target]!,
    ch: e.ch,
    kind: 'char',
  }));
  const themeLinks: GraphLink[] = data.themeEdges.map((e) => ({
    source: byId[e.source]!,
    target: byId[e.target]!,
    kind: 'theme',
  }));

  const charAdj: Record<string, Set<string>> = {};
  nodes.forEach((n) => (charAdj[n.id] = new Set()));
  charLinks.forEach((e) => {
    charAdj[e.source.id]!.add(e.target.id);
    charAdj[e.target.id]!.add(e.source.id);
  });

  const themeMap: Record<string, ThemeDef> = {};
  data.themes.forEach((t) => (themeMap[t.code] = t));

  // Theme home positions sit on an ellipse around the viewport center.
  const themeCodes = data.themes
    .filter((t) => t.code !== 'HUB' && nodes.some((n) => n.kind === 'theme' && n.theme === t.code))
    .map((t) => t.code);
  const themeHome: Record<string, ThemeHome> = {};
  themeCodes.forEach((c, i) => {
    const a = (i / themeCodes.length) * Math.PI * 2 - Math.PI / 2;
    themeHome[c] = { a, x: 0, y: 0 };
  });

  return { nodes, byId, charLinks, themeLinks, charAdj, themeMap, themeCodes, themeHome };
}

/** Recompute theme home positions for the current viewport and pin anchors. */
export function layoutHomes(scene: Scene, state: GraphState): void {
  const { W, H } = state;
  const rx = Math.min(W, H) * 0.40 + Math.max(0, W - H) * 0.20;
  const ry = Math.min(W, H) * 0.40;
  scene.themeCodes.forEach((c) => {
    const h = scene.themeHome[c]!;
    h.x = W / 2 + Math.cos(h.a) * rx * 1.15;
    h.y = H / 2 + Math.sin(h.a) * ry * 1.05;
  });
  scene.nodes.forEach((n) => {
    if (n.kind === 'theme') {
      const h = scene.themeHome[n.theme];
      if (h) {
        n.fx = h.x;
        n.fy = h.y;
      }
    }
  });
}

export function nchars(n: GraphNode): number {
  return [...n.hz].length;
}

/** Node radius, sized to fit the characters inside the circle. */
export function radius(n: GraphNode): number {
  if (n.kind === 'theme') return 0;
  if (n.kind === 'hub') return Math.max(15, 13 + Math.min(n.deg, 8) * 1.35);
  const c = nchars(n);
  const rFit = 11 + c * 7.2; // 1→18, 2→25, 3→33, 4→40
  return rFit + Math.min(n.deg, 6) * 1.3 + (n.isHub ? 2 : 0);
}

export function makeNodeColor(themeMap: Record<string, ThemeDef>) {
  return (n: GraphNode): string => {
    if (n.kind === 'hub') return themeMap.HUB!.color;
    return themeMap[n.theme]?.color ?? '#8d99ae';
  };
}

export interface Layout {
  sim: Simulation<GraphNode, GraphLink>;
  /** Re-apply charge/link parameters after the spacing slider changes. */
  updateSpread(): void;
}

export function createSimulation(scene: Scene, state: GraphState): Layout {
  const chargeStrength = (n: GraphNode) =>
    n.kind === 'theme' ? 0 : -(radius(n) * (n.kind === 'hub' ? 11 : 9)) * state.spreadMul;
  const linkDistance = (d: GraphLink) =>
    (radius(d.source) + radius(d.target) + 24) * state.spreadMul;

  // Pull word nodes toward their theme's home position while grouping is on.
  function groupForce() {
    let ns: GraphNode[] = [];
    const force = (alpha: number) => {
      if (!state.groupOn) return;
      const k = alpha * 0.5;
      for (const n of ns) {
        if (n.kind === 'theme') continue;
        const code = n.kind === 'hub' ? null : n.theme;
        if (!code) {
          // hub: no single theme — mild pull toward the center
          n.vx! += (state.W / 2 - n.x) * k * 0.15;
          n.vy! += (state.H / 2 - n.y) * k * 0.15;
          continue;
        }
        const h = scene.themeHome[code];
        if (!h) continue;
        n.vx! += (h.x - n.x) * k;
        n.vy! += (h.y - n.y) * k;
      }
    };
    force.initialize = (_: GraphNode[]) => {
      ns = _;
    };
    return force;
  }

  const charge = forceManyBody<GraphNode>().strength(chargeStrength);
  const link = forceLink<GraphNode, GraphLink>(scene.charLinks).distance(linkDistance).strength(0.85);
  const sim = forceSimulation<GraphNode>(scene.nodes)
    .force('charge', charge)
    .force('link', link)
    .force('group', groupForce())
    .force('collide', forceCollide<GraphNode>((n) => radius(n) + 4).strength(0.9))
    .alpha(1)
    .alphaDecay(0.026);

  return {
    sim: sim as Simulation<GraphNode, GraphLink>,
    updateSpread() {
      charge.strength(chargeStrength);
      link.distance(linkDistance);
    },
  };
}

/** Seed node positions near their theme homes before the first tick. */
export function seedPositions(scene: Scene, state: GraphState): void {
  scene.nodes.forEach((n) => {
    if (n.kind === 'theme') {
      const h = scene.themeHome[n.theme];
      if (h) {
        n.x = h.x;
        n.y = h.y;
        n.fx = h.x;
        n.fy = h.y;
      }
    } else {
      const h = scene.themeHome[n.theme];
      if (h) {
        n.x = h.x + (Math.random() - 0.5) * 150;
        n.y = h.y + (Math.random() - 0.5) * 150;
      } else {
        n.x = state.W / 2 + (Math.random() - 0.5) * 320;
        n.y = state.H / 2 + (Math.random() - 0.5) * 320;
      }
    }
  });
}
