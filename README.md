# HSK 1–2 Vocabulary Graph

Astro + D3 refactor of the single-file demo `../HSK 1-2 Vocabulary Graph.html`.
An interactive force-directed graph of HSK 1–2 vocabulary with search, theme
filters, a word detail panel, and pronunciation audio (word + example sentence).

## Commands

- `pnpm install` — install dependencies (build-script approval for esbuild is
  preconfigured in `pnpm-workspace.yaml`)
- `pnpm dev` — dev server at `localhost:4321`
- `pnpm build` — static production build into `dist/`
- `pnpm preview` — serve the production build
- `pnpm extract` — re-extract graph data and audio from the original HTML
  (only needed if the original file changes; expects it at `../HSK 1-2 Vocabulary Graph.html`)

## Structure

- `src/data/` — graph nodes/edges/themes (`graph.json`) and the audio
  availability manifest, extracted from the original demo
- `public/audio/{w,s}/` — per-word and per-sentence MP3 clips, decoded from the
  original inline base64 payload; fetched lazily on first play
- `src/pages/index.astro` — the single page; static shell rendered by Astro
- `src/layouts/BaseLayout.astro` — document head, fonts, global CSS
- `src/components/` — `Header`, `ControlDock` (legend is data-driven),
  `DetailPanel` (static shell), and `VocabularyGraph.ts` (the client island
  entry point that owns UI state and wiring)
- `src/lib/` — graph modules: `graph-layout` (scene + force simulation),
  `graph-renderer` (canvas drawing), `graph-interactions` (zoom/drag/hover/hit
  testing), `detail-panel` (panel DOM updates), `search`, `audio`, `state`
  (single typed UI-state store), `types`

## Notes

- The original embedded ~6.2 MB of base64 audio inline; it now lives as static
  files loaded on demand, so the initial page is ~200 KB of JS (gzip ~59 KB).
- The "Đường nối chủ đề" (theme spokes) toggle drew nothing in the original
  because theme links were never resolved to node references; this is fixed.
