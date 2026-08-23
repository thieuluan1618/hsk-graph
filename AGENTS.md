# AGENTS.md — hsk-graph

## Live
- **Demo:** https://main.d1ve9js1shhxc6.amplifyapp.com/
- **Source:** https://github.com/thieuluan1618/hsk-graph

## Commands
- `pnpm install` — install dependencies (build-script approval for esbuild is
  preconfigured in `pnpm-workspace.yaml`)
- `pnpm dev` — dev server at `localhost:4321`
- `pnpm build` — static production build into `dist/`
- `pnpm preview` — serve the production build
- `pnpm extract` — re-extract graph data and audio from the original HTML
  (only needed if the original file changes; expects it at
  `../HSK 1-2 Vocabulary Graph.html`)
- `pnpm exec tsc --noEmit` — typecheck (no test runner configured)

## Architecture
- **Stack:** Astro (static island) + TypeScript + D3 force simulation + Canvas 2D
- **Data:** `src/data/graph.json` is the single source of truth for nodes
  (word/hub/theme), char edges, theme edges, and `meta`. Audio availability is
  listed in `src/data/audio-manifest.json`; clips live under `public/audio/{w,s}/`.
- **Graph page:** `src/pages/index.astro` renders the shell; the client island
  entry point is `src/components/VocabularyGraph.ts`, which owns UI state and
  wires controls, search, keyboard navigation, detail panel, and audio to the
  graph modules.
- **Game page:** `src/pages/play.astro` renders HSK Rush at `/play/`; its client
  entry point is `src/components/VocabularyGame.ts`. The game reuses
  `graph.json`, audio helpers, and the saved VI/EN language preference. Scores
  are device-local and do not mutate graph learner progress.
- **Graph modules** in `src/lib/`:
  - `graph-layout` — scene + D3 force simulation + node radius/color helpers
  - `graph-renderer` — pure Canvas drawing driven by scene + state
  - `graph-interactions` — zoom/drag/hover/click hit-testing and view transitions
  - `detail-panel` — word detail panel DOM updates, compact audio controls, and
    Hanzi Writer stroke animations with radical strokes highlighted
  - `search` — diacritic-insensitive match by hanzi/pinyin/en/vi, prioritizing
    exact pinyin matches
  - `audio` — lazy per-word and per-sentence MP3 playback
  - `state` — single typed UI-state store (`GraphState`); `activeAlpha` /
    `visible` drive dimming and filtering
  - `types` — shared types for graph data
- **State invariants:** selection (`selNode`), hover, `focusSet`, and
  `searchMatch` are all kept in `state`. Selecting a node clears any active
  search match (and its UI) so dimming doesn't stack on top of focus highlight.
- **Keyboard invariants:** `/` and `Ctrl/Cmd + K` focus search. Outside form
  controls, arrow keys select the nearest visible node in that spatial direction,
  `Enter` plays its word audio, and `Escape` closes it. Arrow navigation opens
  details without auto-playing audio and respects all visibility filters.

## Code Style
- TypeScript strict; Canvas drawing is imperative, DOM wiring is in
  `VocabularyGraph.ts`. Match the patterns in neighboring files.
- Keep graph modules pure where they already are: the renderer reads state but
  does not mutate it; interactions mutate state via the callbacks in
  `VocabularyGraph.ts`.
- No tests configured. Validate with `pnpm exec tsc --noEmit` and `pnpm build`.

## Deploy
- Static site; `pnpm build` outputs to `dist/`. Deployed on AWS Amplify
  (auto-deploy from `main`). The live demo URL above is the Amplify main branch.
- Data changes: edit `src/data/graph.json` directly, or re-run `pnpm extract`
  against the original HTML if the source changes.

## Notes
- The original embedded ~6.2 MB of base64 audio inline; it now lives as static
  files loaded on demand. The current client bundle is ~645 KB of JS
  (gzip ~170 KB), while audio is fetched only when played.
- The "Đường nối chủ đề" (theme spokes) toggle drew nothing in the original
  because theme links were never resolved to node references; this is fixed.
