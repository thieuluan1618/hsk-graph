import { defineConfig } from 'astro/config';

export default defineConfig({
  // Static output; the whole app is one page plus a client-side graph island.
  output: 'static',
});
