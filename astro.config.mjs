import { defineConfig } from 'astro/config';

export default defineConfig({
  // Static output; both the graph and game are client-side islands.
  output: 'static',
  site: process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://hsk-graph.vercel.app',
});
