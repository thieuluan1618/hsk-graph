import fs from 'fs';

const data = JSON.parse(fs.readFileSync('src/data/graph.json', 'utf8'));
const hsk1New = JSON.parse(fs.readFileSync('scripts/hsk1-new.json', 'utf8'));
const hsk2New = JSON.parse(fs.readFileSync('scripts/hsk2-new.json', 'utf8'));

const hsk1Corrections = new Set([
  '休息', '雪', '要', '也', '元', '再', '早上', '找', '真', '正在', '知道',
]);

const supplementaryWords = new Set([
  '火车站', '北京', '小姐', '没', '打篮球', '公共汽车', '羊肉', '西瓜',
  '服务员', '公斤', '自行车', '唱歌', '报纸', '船', '回答', '白', '欢迎',
  '红', '黑', '帮助', '男人', '女人', '张', '第一', '向', '为', '星期一',
  '星期二', '星期三', '星期四', '星期五', '星期六',
]);

// Existing word hanzi
const existingHz = new Set(data.nodes.filter(n => n.kind === 'word').map(n => n.hz));

// Filter out words that already exist
const newWords = [...hsk1New, ...hsk2New].filter(w => !existingHz.has(w.hz));

console.log('Existing words:', data.nodes.filter(n => n.kind === 'word').length);
console.log('New words to add (after dedup):', newWords.length);
console.log('Skipped duplicates:', hsk1New.length + hsk2New.length - newWords.length);

function stableFrequency(hz) {
  let hash = 0;
  for (const ch of hz) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return hash % 5000 + 100;
}

// Build word nodes
const newNodes = newWords.map((w) => {
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
    freq: stableFrequency(w.hz),
    isHub: false,
    deg: 0,
    sent: w.sent,
  };
});

// Add new word nodes
data.nodes.push(...newNodes);

// Rebuild hub nodes and char edges
const allWords = data.nodes.filter(n => n.kind === 'word');

for (const word of allWords) {
  if (hsk1Corrections.has(word.hz)) word.hsk = 1;
  if (supplementaryWords.has(word.hz)) word.supplementary = true;
  else delete word.supplementary;
}

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

// Reuse a single-character word as its own hub. Only create a synthetic hub
// when that character is not independently present in the vocabulary.
const wordByHanzi = new Map(allWords.map(word => [word.hz, word]));
for (const word of allWords) word.isHub = false;

const hubNodes = [];
for (const [ch, ids] of hubChars) {
  const wordHub = wordByHanzi.get(ch);
  if (wordHub) {
    wordHub.isHub = true;
    continue;
  }
  hubNodes.push({
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
  });
}

data.nodes.push(...hubNodes);

// Rebuild char edges
const charEdges = [];
for (const [ch, ids] of hubChars) {
  const source = wordByHanzi.get(ch)?.id ?? `H:${ch}`;
  for (const wid of ids) {
    if (wid !== source) charEdges.push({ source, target: wid, ch });
  }
}
data.edges = charEdges;

// Update word degree for both ordinary members and word nodes acting as hubs.
for (const w of allWords) {
  w.deg = charEdges.filter(e => e.source === w.id || e.target === w.id).length;
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
  word_hubs: allWords.filter(word => word.isHub).length,
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
