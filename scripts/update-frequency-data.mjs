// Update word-frequency fields from the official SUBTLEX-CH word-frequency
// table (the raw `SUBTLEX-CH-WF` file is encoded as GB18030).
//
// Usage:
//   node scripts/update-frequency-data.mjs /path/to/SUBTLEX-CH-WF
//
// Dataset: https://doi.org/10.1371/journal.pone.0010729.s002
import fs from 'node:fs';

const graphPath = 'src/data/graph.json';
const sourcePath = process.argv[2];

if (!sourcePath) {
  throw new Error('Pass the path to the raw SUBTLEX-CH-WF file.');
}

const data = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const source = new TextDecoder('gb18030', { fatal: true }).decode(
  fs.readFileSync(sourcePath),
);
const lines = source.split(/\r?\n/);
const headerIndex = lines.findIndex((line) => line.startsWith('Word\tWCount\t'));

if (headerIndex < 0) {
  throw new Error('SUBTLEX-CH-WF header not found. Is this the raw word table?');
}

const frequencyByWord = new Map();
lines.slice(headerIndex + 1).forEach((line, index) => {
  if (!line) return;
  const [word, count, perMillion] = line.split('\t');
  if (!word || frequencyByWord.has(word)) return;
  frequencyByWord.set(word, {
    rank: index + 1,
    count: Number(count),
    perMillion: Number(perMillion),
  });
});

const missing = [];
let rankedWords = 0;
for (const node of data.nodes) {
  if (node.kind !== 'word') continue;
  const frequency = frequencyByWord.get(node.hz);
  if (!frequency) {
    node.freq = null;
    node.freqCount = null;
    node.freqPerMillion = null;
    missing.push(node.hz);
    continue;
  }
  node.freq = frequency.rank;
  node.freqCount = frequency.count;
  node.freqPerMillion = frequency.perMillion;
  rankedWords += 1;
}

data.meta.frequency_source = 'SUBTLEX-CH';
data.meta.frequency_corpus_words = 33_546_516;
data.meta.frequency_ranked_words = rankedWords;

fs.writeFileSync(graphPath, `${JSON.stringify(data, null, 2)}\n`);

console.log(`Updated ${rankedWords}/${data.meta.total_words} word frequencies.`);
console.log(`Not ranked (${missing.length}): ${missing.join(', ')}`);
