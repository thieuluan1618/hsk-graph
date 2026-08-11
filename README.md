# HSK 1–3 Vocabulary Graph

**Live demo:** https://main.d1ve9js1shhxc6.amplifyapp.com/

Astro + D3 refactor of the single-file demo `../HSK 1-2 Vocabulary Graph.html`,
since expanded to cover HSK 1–3.
An interactive force-directed graph of HSK 1–3 vocabulary with search, theme
filters, a word detail panel, and pronunciation audio (word + example sentence).

## Commands

- `pnpm install` — install dependencies (build-script approval for esbuild is
  preconfigured in `pnpm-workspace.yaml`)
- `pnpm dev` — dev server at `localhost:4321`
- `pnpm build` — static production build into `dist/`
- `pnpm preview` — serve the production build
- `pnpm extract` — re-extract graph data and audio from the original HTML
  (only needed if the original file changes; expects it at `../HSK 1-2 Vocabulary Graph.html`)
- `pnpm frequency /path/to/SUBTLEX-CH-WF` — refresh corpus rank and occurrence
  metrics from the raw SUBTLEX-CH word table

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
- Spoken-language frequency rank and occurrences-per-million come from
  [SUBTLEX-CH](https://doi.org/10.1371/journal.pone.0010729), a 33.5-million-word
  film and television subtitle corpus. Words absent from the corpus remain
  explicitly unranked. The frequency slider shows the most common 10–100%
  within the selected HSK level and reports their share of measured occurrences.
- Audio provenance:
  - The 232 added word and sentence clips use Microsoft Azure Neural TTS voice
    `zh-CN-XiaoxiaoNeural` (Xiaoxiao / 晓晓). Word rate is `-12%`; example
    sentence rate is `-5%`. Output is mono MP3 at 24 kHz and about 48 kbps.
  - The 297 original clips are a female Mainland Mandarin neural voice, likely
    Xiaoxiao or a similar voice, but the embedded source audio contains no
    provider or voice ID, so its exact identity is unconfirmed.
- The "Đường nối chủ đề" (theme spokes) toggle drew nothing in the original
  because theme links were never resolved to node references; this is fixed.
