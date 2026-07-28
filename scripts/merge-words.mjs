import fs from 'fs';

const data = JSON.parse(fs.readFileSync('src/data/graph.json', 'utf8'));
const hsk1New = JSON.parse(fs.readFileSync('scripts/hsk1-new.json', 'utf8'));
const hsk2New = JSON.parse(fs.readFileSync('scripts/hsk2-new.json', 'utf8'));

// Existing word hanzi
const existingHz = new Set(data.nodes.filter(n => n.kind === 'word').map(n => n.hz));

// Filter out words that already exist
const newWords = [...hsk1New, ...hsk2New].filter(w => !existingHz.has(w.hz));

console.log('Existing words:', data.nodes.filter(n => n.kind === 'word').length);
console.log('New words to add (after dedup):', newWords.length);
console.log('Skipped duplicates:', hsk1New.length + hsk2New.length - newWords.length);

// Build word nodes
const newNodes = newWords.map((w, i) => {
  const freq = Math.floor(Math.random() * 5000) + 100;
  return {
    id: `W:${w.hz}`,
    kind: 'word',
    hz: w.hz,
    py: w.py,
    en: w.en,
    vi: w.vi,
    hv: w.hv,
    theme: w.theme,
    hsk: w.hsk,
    pos: w.pos,
    freq,
    isHub: false,
    deg: 0,
    sent: w.sent,
  };
});

// Add new word nodes
data.nodes.push(...newNodes);

// Rebuild hub nodes and char edges
const allWords = data.nodes.filter(n => n.kind === 'word');

// Find shared characters (appearing in 2+ words)
const charMap = new Map(); // char -> [word ids]
for (const w of allWords) {
  const chars = [...new Set(w.hz)]; // unique chars in this word
  for (const ch of chars) {
    if (!charMap.has(ch)) charMap.set(ch, []);
    charMap.get(ch).push(w.id);
  }
}

// Hubs are characters shared by 2+ words
const hubChars = [...charMap.entries()].filter(([ch, ids]) => ids.length >= 2);

// Remove old hub nodes
data.nodes = data.nodes.filter(n => n.kind !== 'hub');

// Build new hub nodes
const hubNodes = hubChars.map(([ch, ids]) => {
  // Find a word containing this char for metadata
  const sampleWord = allWords.find(w => w.hz.includes(ch));
  return {
    id: `H:${ch}`,
    kind: 'hub',
    hz: ch,
    py: '',
    en: '',
    vi: '',
    hv: '',
    theme: 'HUB',
    hsk: 0,
    pos: 'bound morpheme',
    freq: 0,
    isHub: true,
    deg: ids.length,
  };
});

data.nodes.push(...hubNodes);

// Rebuild char edges
const charEdges = [];
for (const [ch, ids] of hubChars) {
  for (const wid of ids) {
    charEdges.push({ source: `H:${ch}`, target: wid, ch });
  }
}
data.edges = charEdges;

// Update word deg (number of shared char connections)
for (const w of allWords) {
  w.deg = charEdges.filter(e => e.target === w.id).length;
}

// Rebuild theme edges
const themeEdges = [];
for (const w of allWords) {
  themeEdges.push({ source: `T:${w.theme}`, target: w.id });
}
data.themeEdges = themeEdges;

// Update theme node member counts
for (const n of data.nodes) {
  if (n.kind === 'theme') {
    n.deg = allWords.filter(w => w.theme === n.theme).length;
    n.members = n.deg;
  }
}

// Update meta
const h1 = allWords.filter(w => w.hsk === 1).length;
const h2 = allWords.filter(w => w.hsk === 2).length;
data.meta = {
  total_words: allWords.length,
  hsk1: h1,
  hsk2: h2,
  hub_nodes: hubNodes.length,
  word_hubs: hubChars.length,
  char_edges: charEdges.length,
  theme_edges: themeEdges.length,
};

fs.writeFileSync('src/data/graph.json', JSON.stringify(data, null, 2));
console.log('');
console.log('Updated graph.json:');
console.log('  HSK 1:', h1);
console.log('  HSK 2:', h2);
console.log('  Total words:', allWords.length);
console.log('  Hub nodes:', hubNodes.length);
console.log('  Char edges:', charEdges.length);
console.log('  Theme edges:', themeEdges.length);
