// One-off extraction from the original single-file demo.
// Pulls GRAPH json into src/data/graph.json and decodes the embedded
// base64 audio payload into public/audio/{w,s}/<hz>.mp3 plus a manifest.
//
// Usage: node scripts/extract.mjs [path-to-original-html]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2] ?? join(root, '..', 'HSK 1-2 Vocabulary Graph.html');
const html = readFileSync(src, 'utf8');

function extractConst(name) {
  const marker = `const ${name} = `;
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`marker not found: ${marker}`);
  const from = start + marker.length;
  const end = html.indexOf(';\n', from);
  return html.slice(from, end);
}

const graph = JSON.parse(extractConst('GRAPH'));
const buildDate = JSON.parse(extractConst('BUILD_DATE'));
const audio = JSON.parse(extractConst('AUDIO'));
const sentAudio = JSON.parse(extractConst('SENT_AUDIO'));

mkdirSync(join(root, 'src/data'), { recursive: true });
writeFileSync(join(root, 'src/data/graph.json'), JSON.stringify(graph));
writeFileSync(join(root, 'src/data/meta.json'), JSON.stringify({ buildDate }));

function writeAudio(dir, records) {
  const outDir = join(root, 'public/audio', dir);
  mkdirSync(outDir, { recursive: true });
  const keys = [];
  for (const [hz, dataUri] of Object.entries(records)) {
    const b64 = dataUri.split(',')[1];
    writeFileSync(join(outDir, `${hz}.mp3`), Buffer.from(b64, 'base64'));
    keys.push(hz);
  }
  return keys.sort();
}

const words = writeAudio('w', audio);
const sentences = writeAudio('s', sentAudio);
writeFileSync(
  join(root, 'src/data/audio-manifest.json'),
  JSON.stringify({ words, sentences }),
);

console.log(
  `graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${graph.themeEdges.length} theme edges`,
);
console.log(`audio: ${words.length} word clips, ${sentences.length} sentence clips`);
