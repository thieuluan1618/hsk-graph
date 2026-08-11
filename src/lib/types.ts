import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

export interface ThemeDef {
  code: string;
  en: string;
  vi: string;
  color: string;
}

export interface Sentence {
  zh: string;
  py: string;
  en: string;
  vi: string;
}

export type NodeKind = 'word' | 'hub' | 'theme';

/** A node as stored in graph.json (no simulation fields). */
export interface NodeDatum {
  id: string;
  kind: NodeKind;
  hz: string;
  py: string;
  en: string;
  vi: string;
  hv: string;
  theme: string;
  hsk: number;
  pos: string;
  /** SUBTLEX-CH corpus rank (lower is more common); null when absent. */
  freq: number | null;
  /** Raw occurrences in the 33.5-million-word SUBTLEX-CH corpus. */
  freqCount?: number | null;
  /** Normalized SUBTLEX-CH occurrences per million words. */
  freqPerMillion?: number | null;
  isHub: boolean;
  deg: number;
  sent?: Sentence;
  members?: number;
  /** Useful vocabulary retained outside the referenced HSK 1–3 lists. */
  supplementary?: boolean;
}

/** A live simulation node. Positions exist once the simulation initializes. */
export interface GraphNode extends NodeDatum, SimulationNodeDatum {
  x: number;
  y: number;
}

export interface GraphMeta {
  total_words: number;
  hsk1: number;
  hsk2: number;
  hsk3: number;
  hub_nodes: number;
  word_hubs: number;
  char_edges: number;
  theme_edges: number;
  frequency_source: string;
  frequency_corpus_words: number;
  frequency_ranked_words: number;
}

export interface RawEdge {
  source: string;
  target: string;
  ch?: string;
}

export interface GraphData {
  meta: GraphMeta;
  themes: ThemeDef[];
  nodes: NodeDatum[];
  edges: RawEdge[];
  themeEdges: RawEdge[];
}

/** Link with node references resolved (both char links and theme spokes). */
export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: GraphNode;
  target: GraphNode;
  ch?: string;
  kind: 'char' | 'theme';
}
