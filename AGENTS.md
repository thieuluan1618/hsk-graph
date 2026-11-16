# AGENTS.md — hsk-graph

## Live
- **Demo:** https://hsk-graph.vercel.app/
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
- **Listening page:** `src/pages/listen.astro` renders HSK Echo at `/listen/`;
  `src/components/ListeningGame.ts` owns its rounds, choices, timer, and scoring.
  It reuses graph word nodes with audio listed in the manifest, the audio
  helpers, and the saved VI/EN preference. Copy lives in `src/lib/listen-i18n.ts`
  and styles in `src/styles/listen.css`. Best score uses localStorage key
  `hsk-echo:best`, separate from Rush and graph learner progress.
- **Listening rules:** 10 questions, 15 seconds each, four meaning choices;
  answers/timeouts reveal the word and advance after 1.25 seconds. Correct
  answers earn 100 plus a streak bonus of 20 per preceding consecutive correct
  answer, capped at 180. Wrong answers/timeouts reset the streak. `1`–`4` answer,
  `R` replays without resetting the timer, and `Escape` pauses/resumes. Hiding
  the tab pauses the countdown and cancels pending auto-advance; resuming
  continues the countdown or schedules the next question after a reveal.
- **Word list page:** `src/pages/words.astro` renders `/words/` as a static
  table (No · Chinese · Pinyin · VI/EN meaning) grouped by theme, words sorted
  by HSK level then frequency. `src/components/WordTable.ts` handles HSK/text
  filtering (row numbers recount over visible rows), the shared VI/EN
  preference, word audio, per-topic collapse/expand (persisted in localStorage
  key `hsk-words:collapsed`; ignored while a text filter is active), and an
  inline stroke-order row (Hanzi Writer loop
  animation + quiz-mode practice). Styles live in `src/styles/words.css`.
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
- Static site; `pnpm build` outputs to `dist/`. Deployed on Vercel
  (auto-deploy from `main` via the connected GitHub repository). Build settings
  live in `vercel.json`; `vercel deploy --prod` deploys from the CLI.
- Canonical URLs use `VERCEL_PROJECT_PRODUCTION_URL` during Vercel builds,
  with the production URL above as the local fallback.
- Data changes: edit `src/data/graph.json` directly, or re-run `pnpm extract`
  against the original HTML if the source changes.

## Notes
- The original embedded ~6.2 MB of base64 audio inline; it now lives as static
  files loaded on demand. The current client bundle is ~645 KB of JS
  (gzip ~170 KB), while audio is fetched only when played.
- The "Đường nối chủ đề" (theme spokes) toggle drew nothing in the original
  because theme links were never resolved to node references; this is fixed.
