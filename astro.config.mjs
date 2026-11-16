import { defineConfig } from 'astro/config';

export default defineConfig({
  // Static output; both the graph and game are client-side islands.
  output: 'static',
  site: process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://hsk-graph.vercel.app',
  vite: {
    // Pre-bundle every client dependency up front. Otherwise opening /words/
    // first (hanzi-writer only) and then / (d3) makes Vite re-optimize mid-session,
    // and the stale d3 URL 504s ("Outdated Optimize Dep"), freezing the graph loader.
    optimizeDeps: { include: ['d3', 'hanzi-writer'] },
  },
});
