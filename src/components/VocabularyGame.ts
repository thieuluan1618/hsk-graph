import graphDataJson from '../data/graph.json';
import { hasWordAudio, playWord } from '../lib/audio';
import { applyGameTranslations, gameT } from '../lib/game-i18n';
import { loadLang, saveLang, type Lang } from '../lib/i18n';
import type { GraphData, NodeDatum } from '../lib/types';

type GameStatus = 'ready' | 'playing' | 'paused' | 'over';
type GameLevel = 'all' | 1 | 2 | 3;
type FeedbackResult = 'idle' | 'correct' | 'wrong';
type LinkKind = 'character' | 'theme' | null;

interface RisingCard {
  word: NodeDatum;
  x: number;
  y: number;
  element: HTMLButtonElement;
}

interface FeedbackState {
  result: FeedbackResult;
  word: NodeDatum | null;
  typed: string;
  points: number;
  linkKind: LinkKind;
}

const data = graphDataJson as unknown as GraphData;
const DANGER_Y = 17;
const CARD_COUNT = 8;
const BEST_KEY = 'hsk-rush:best';
const RECENT_LIMIT = 36;
const themeColors = new Map(data.themes.map((theme) => [theme.code, theme.color]));

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing game element: #${id}`);
  return element as T;
}

const gameApp = byId<HTMLElement>('gameApp');
const gameBoard = byId<HTMLElement>('gameBoard');
const wordField = byId<HTMLElement>('wordField');
const overlay = byId<HTMLElement>('gameOverlay');
const scoreElement = byId<HTMLElement>('gameScore');
const streakElement = byId<HTMLElement>('gameStreak');
const bestElement = byId<HTMLElement>('gameBest');
const activeLevelLabel = byId<HTMLElement>('activeLevelLabel');
const promptLevel = byId<HTMLElement>('promptLevel');
const promptMeaning = byId<HTMLElement>('promptMeaning');
const pressureFill = byId<HTMLElement>('pressureFill');
const answerForm = byId<HTMLFormElement>('answerForm');
const answerInput = byId<HTMLInputElement>('gameAnswer');
const submitAnswer = byId<HTMLButtonElement>('submitAnswer');
const audioButton = byId<HTMLButtonElement>('gameAudio');
const pauseButton = byId<HTMLButtonElement>('pauseGame');
const startButton = byId<HTMLButtonElement>('startGame');
const resumeButton = byId<HTMLButtonElement>('resumeGame');
const restartButton = byId<HTMLButtonElement>('restartGame');
const playAgainButton = byId<HTMLButtonElement>('playAgain');
const finalScore = byId<HTMLElement>('finalScore');
const finalCorrect = byId<HTMLElement>('finalCorrect');
const newBest = byId<HTMLElement>('newBest');
const feedbackBox = byId<HTMLElement>('answerFeedback');
const feedbackLabel = feedbackBox.querySelector<HTMLElement>('.feedback-label')!;
const feedbackHanzi = byId<HTMLElement>('feedbackHanzi');
const feedbackPinyin = byId<HTMLElement>('feedbackPinyin');
const feedbackMeaning = byId<HTMLElement>('feedbackMeaning');
const announcement = byId<HTMLElement>('gameAnnouncement');

let lang: Lang = loadLang();
let status: GameStatus = 'ready';
let selectedLevel: GameLevel = 1;
let wordPool: NodeDatum[] = [];
let cards: RisingCard[] = [];
let selectedCard: RisingCard | null = null;
let lastSolvedWord: NodeDatum | null = null;
let score = 0;
let streak = 0;
let correctCount = 0;
let best = loadBest();
let speed = 1;
let lastFrame = performance.now();
let lastLane = -1;
let recentWordIds: string[] = [];
let feedbackState: FeedbackState = {
  result: 'idle',
  word: null,
  typed: '',
  points: 0,
  linkKind: null,
};

function loadBest(): number {
  try {
    const value = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

function saveBest(value: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Local high scores are optional when storage is unavailable.
  }
}

function formatNumber(value: number): string {
  return value.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US');
}

function levelLabel(level: GameLevel): string {
  return level === 'all' ? gameT(lang, 'levelAll') : `HSK ${level}`;
}

function meaningFor(word: NodeDatum): string {
  return (lang === 'vi' ? word.vi : word.en) || word.en || word.vi;
}

function normalizeHanzi(value: string): string {
  return value.trim().replace(/[\s·・.,!?;:'"“”‘’()-]/g, '');
}

function normalizePinyin(value: string): string {
  return value
    .toLowerCase()
    .replace(/u:/g, 'v')
    .replace(/[üǖǘǚǜ]/g, 'v')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s'’·._-]/g, '')
    .replace(/[1-5]/g, '');
}

function isCorrectAnswer(value: string, word: NodeDatum): boolean {
  const hanzi = normalizeHanzi(value);
  if (hanzi && hanzi === normalizeHanzi(word.hz)) return true;

  const answer = normalizePinyin(value);
  if (!answer) return false;
  return word.py
    .split(/[;,/]/)
    .map(normalizePinyin)
    .filter(Boolean)
    .some((variant) => variant === answer || variant.replace(/v/g, 'u') === answer.replace(/v/g, 'u'));
}

function linkKindBetween(first: NodeDatum | null, second: NodeDatum): LinkKind {
  if (!first) return null;
  if ([...first.hz].some((character) => second.hz.includes(character))) return 'character';
  return first.theme === second.theme ? 'theme' : null;
}

function updateStats(): void {
  scoreElement.textContent = formatNumber(score);
  streakElement.textContent = String(streak);
  bestElement.textContent = formatNumber(best);
}

function updateLevelLabels(): void {
  const label = levelLabel(selectedLevel);
  activeLevelLabel.textContent = label;
  if (!selectedCard) promptLevel.textContent = label;
}

function applyLanguage(nextLang: Lang): void {
  lang = nextLang;
  saveLang(lang);
  applyGameTranslations(lang);
  document.querySelectorAll<HTMLButtonElement>('#gameLangPick button').forEach((button) => {
    const active = button.dataset.lang === lang;
    button.classList.toggle('on', active);
    button.setAttribute('aria-pressed', String(active));
  });
  updateStats();
  updateLevelLabels();
  renderPinnedClue();
  renderFeedback();
  updateComboHints();
}

function setStatus(nextStatus: GameStatus): void {
  status = nextStatus;
  gameApp.dataset.gameState = status;
  const playing = status === 'playing';
  answerInput.disabled = !playing;
  submitAnswer.disabled = !playing;
  pauseButton.disabled = !playing;
  cards.forEach((card) => {
    card.element.disabled = !playing;
  });
  audioButton.disabled = !playing || !selectedCard || !hasWordAudio(selectedCard.word.hz);
}

function showOverlay(view: 'ready' | 'paused' | 'over'): void {
  overlay.dataset.view = view;
  overlay.classList.remove('hidden');
}

function hideOverlay(): void {
  overlay.classList.add('hidden');
}

function chooseWord(): NodeDatum {
  const activeIds = new Set(cards.map((card) => card.word.id));
  let candidates = wordPool.filter(
    (word) => !activeIds.has(word.id) && !recentWordIds.includes(word.id),
  );
  if (!candidates.length) {
    recentWordIds = [];
    candidates = wordPool.filter((word) => !activeIds.has(word.id));
  }
  const word = candidates[Math.floor(Math.random() * candidates.length)]!;
  recentWordIds.push(word.id);
  if (recentWordIds.length > RECENT_LIMIT) recentWordIds.shift();
  return word;
}

function pickLane(): number {
  const lanes = gameBoard.clientWidth < 520 ? [22, 50, 78] : [13, 31, 50, 69, 87];
  const available = lanes.map((_, index) => index).filter((index) => index !== lastLane);
  const lane = available[Math.floor(Math.random() * available.length)]!;
  lastLane = lane;
  return lanes[lane]!;
}

function createCardElement(word: NodeDatum): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'word-card';
  button.style.setProperty('--card-color', themeColors.get(word.theme) ?? '#8be8dd');
  button.setAttribute('aria-label', `${word.hz}, HSK ${word.hsk}`);

  const hanzi = document.createElement('span');
  hanzi.className = 'word-card-hanzi';
  hanzi.lang = 'zh-Hans';
  hanzi.textContent = word.hz;

  const meta = document.createElement('span');
  meta.className = 'word-card-meta';
  meta.textContent = `HSK ${word.hsk}`;

  button.append(hanzi, meta);
  return button;
}

function spawnCard(y: number): RisingCard {
  const word = chooseWord();
  const element = createCardElement(word);
  const card: RisingCard = { word, x: pickLane(), y, element };
  positionCard(card);
  element.addEventListener('click', () => handleCardTap(card));
  wordField.append(element);
  cards.push(card);
  updateComboHints();
  return card;
}

function positionCard(card: RisingCard): void {
  card.element.style.setProperty('--card-x', card.x.toFixed(2));
  card.element.style.setProperty('--card-y', card.y.toFixed(2));
}

function findDangerCard(): RisingCard | null {
  return cards.reduce<RisingCard | null>(
    (nearest, card) => (!nearest || card.y < nearest.y ? card : nearest),
    null,
  );
}

function renderPinnedClue(): void {
  cards.forEach((card) => {
    const selected = card === selectedCard;
    card.element.classList.toggle('selected', selected);
    card.element.setAttribute('aria-pressed', String(selected));
  });
  if (!selectedCard) {
    promptMeaning.textContent = '—';
    audioButton.disabled = true;
    return;
  }
  const word = selectedCard.word;
  const meaning = meaningFor(word);
  promptMeaning.textContent = meaning;
  promptMeaning.title = meaning;
  promptLevel.textContent = `HSK ${word.hsk}`;
  audioButton.disabled = status !== 'playing' || !hasWordAudio(word.hz);
}

function updateComboHints(): void {
  cards.forEach((card) => {
    const linkKind = linkKindBetween(lastSolvedWord, card.word);
    card.element.classList.toggle('combo-option', linkKind !== null);
    card.element.dataset.linkKind = linkKind ?? '';
    const linkLabel = linkKind
      ? `, ${gameT(lang, linkKind === 'character' ? 'characterCombo' : 'themeCombo')}`
      : '';
    card.element.setAttribute('aria-label', `${card.word.hz}, HSK ${card.word.hsk}${linkLabel}`);
  });
}

function renderFeedback(): void {
  feedbackBox.dataset.result = feedbackState.result;
  if (feedbackState.result === 'idle') {
    feedbackLabel.textContent = gameT(lang, 'lastAnswer');
    feedbackHanzi.textContent = '加油';
    feedbackPinyin.textContent = 'jiāyóu';
    feedbackMeaning.textContent = gameT(lang, 'gameTagline');
    return;
  }

  if (feedbackState.result === 'correct') {
    const linkLabel = feedbackState.linkKind
      ? ` · ${gameT(lang, feedbackState.linkKind === 'character' ? 'characterCombo' : 'themeCombo')}`
      : '';
    feedbackLabel.textContent = `${gameT(lang, 'correct')} · +${feedbackState.points}${linkLabel}`;
  } else {
    feedbackLabel.textContent = gameT(lang, 'wrong');
  }
  if (feedbackState.word) {
    feedbackHanzi.textContent = feedbackState.word.hz;
    feedbackPinyin.textContent = feedbackState.word.py;
    feedbackMeaning.textContent = meaningFor(feedbackState.word);
  } else {
    feedbackHanzi.textContent = '?';
    feedbackPinyin.textContent = feedbackState.typed;
    feedbackMeaning.textContent = gameT(lang, 'wrong');
  }
}

function updatePressure(): void {
  const dangerCard = findDangerCard();
  cards.forEach((card) => card.element.classList.toggle(
    'danger-card',
    card === dangerCard && card.y < DANGER_Y + 8,
  ));
  if (!dangerCard) {
    pressureFill.style.width = '0%';
    return;
  }
  const safeRange = 15;
  const percent = Math.max(0, Math.min(100, ((dangerCard.y - DANGER_Y) / safeRange) * 100));
  pressureFill.style.width = `${percent.toFixed(1)}%`;
  pressureFill.classList.toggle('critical', percent < 30);
}

function announce(message: string): void {
  announcement.textContent = '';
  window.setTimeout(() => {
    announcement.textContent = message;
  }, 20);
}

function baseSpeed(): number {
  if (selectedLevel === 1) return .95;
  if (selectedLevel === 2) return 1.02;
  if (selectedLevel === 3) return 1.08;
  return 1.04;
}

function startGame(): void {
  wordPool = data.nodes.filter(
    (node) => node.kind === 'word' && (selectedLevel === 'all' || node.hsk === selectedLevel),
  );
  if (wordPool.length < CARD_COUNT) return;

  cards.forEach((card) => card.element.remove());
  cards = [];
  selectedCard = null;
  lastSolvedWord = null;
  wordField.replaceChildren();
  recentWordIds = [];
  lastLane = -1;
  score = 0;
  streak = 0;
  correctCount = 0;
  speed = baseSpeed();
  feedbackState = {
    result: 'idle',
    word: null,
    typed: '',
    points: 0,
    linkKind: null,
  };
  answerInput.value = '';
  newBest.hidden = true;

  setStatus('playing');
  for (let index = 0; index < CARD_COUNT; index += 1) {
    spawnCard(28 + index * 8.5);
  }
  selectedCard = findDangerCard();
  lastFrame = performance.now();
  updateStats();
  updateLevelLabels();
  renderPinnedClue();
  renderFeedback();
  updatePressure();
  hideOverlay();
  answerInput.focus({ preventScroll: true });
  announce(`${gameT(lang, 'freeOrderStart')}. ${gameT(lang, 'findWord')}: ${selectedCard ? meaningFor(selectedCard.word) : ''}`);
}

function correctAnswer(card: RisingCard): void {
  if (status !== 'playing' || !cards.includes(card)) return;
  const solvedWord = card.word;
  const linkKind = linkKindBetween(lastSolvedWord, solvedWord);
  streak = linkKind ? streak + 1 : 1;
  correctCount += 1;
  const riskRatio = Math.max(0, Math.min(1, (94 - card.y) / (94 - DANGER_Y)));
  const riskBonus = Math.round(riskRatio * 150);
  const linkBonus = linkKind === 'character'
    ? 70 + Math.min(streak, 8) * 12
    : linkKind === 'theme'
      ? 40 + Math.min(streak, 8) * 8
      : 0;
  const comboBonus = Math.min(Math.max(0, streak - 1), 10) * 15;
  const earnedPoints = 100 + riskBonus + linkBonus + comboBonus;
  score += earnedPoints;
  speed = Math.min(2.35, baseSpeed() + correctCount * .035);

  const solvedPinnedCard = card === selectedCard;
  card.element.disabled = true;
  card.element.classList.add('correct');
  cards = cards.filter((item) => item !== card);
  window.setTimeout(() => card.element.remove(), 220);

  lastSolvedWord = solvedWord;
  const bottomY = cards.length ? Math.max(...cards.map((item) => item.y)) : 84;
  spawnCard(Math.min(94, bottomY + 8.5));
  if (solvedPinnedCard || !selectedCard || !cards.includes(selectedCard)) {
    selectedCard = findDangerCard();
  }
  updateComboHints();
  feedbackState = {
    result: 'correct',
    word: solvedWord,
    typed: '',
    points: earnedPoints,
    linkKind,
  };
  answerInput.value = '';
  updateStats();
  renderFeedback();
  renderPinnedClue();
  updatePressure();
  void playWord(solvedWord.hz, 'gameAudio');
  const linkAnnouncement = linkKind
    ? ` ${gameT(lang, linkKind === 'character' ? 'characterCombo' : 'themeCombo')}.`
    : '';
  announce(`${gameT(lang, 'correct')} ${solvedWord.hz}, ${solvedWord.py}. +${earnedPoints}.${linkAnnouncement}`);
}

function wrongAnswer(word: NodeDatum | null, typed: string): void {
  if (status !== 'playing') return;
  streak = 0;
  lastSolvedWord = null;
  score = Math.max(0, score - 25);
  cards.forEach((card) => {
    card.y -= 2.5;
    positionCard(card);
  });
  feedbackState = {
    result: 'wrong',
    word,
    typed,
    points: 0,
    linkKind: null,
  };
  gameBoard.classList.remove('board-wrong');
  void gameBoard.offsetWidth;
  gameBoard.classList.add('board-wrong');
  window.setTimeout(() => gameBoard.classList.remove('board-wrong'), 280);
  updateStats();
  updateComboHints();
  renderFeedback();
  updatePressure();
  announce(gameT(lang, 'wrong'));
}

function submitTypedAnswer(): void {
  if (status !== 'playing' || !cards.length) return;
  const value = answerInput.value.trim();
  if (!value) {
    announce(gameT(lang, 'enterAnswer'));
    answerInput.focus();
    return;
  }
  const matchingCards = cards.filter((card) => isCorrectAnswer(value, card.word));
  if (!matchingCards.length) {
    wrongAnswer(null, value);
    answerInput.select();
    return;
  }
  const matchedCard = selectedCard && matchingCards.includes(selectedCard)
    ? selectedCard
    : matchingCards.reduce((nearest, card) => (card.y < nearest.y ? card : nearest));
  correctAnswer(matchedCard);
}

function handleCardTap(card: RisingCard): void {
  if (status !== 'playing' || !cards.includes(card)) return;
  selectedCard = card;
  renderPinnedClue();
  announce(`${gameT(lang, 'pinCard')}: ${meaningFor(card.word)}.`);
  answerInput.focus({ preventScroll: true });
}

function pauseGame(): void {
  if (status !== 'playing') return;
  setStatus('paused');
  showOverlay('paused');
  resumeButton.focus({ preventScroll: true });
}

function resumeGame(): void {
  if (status !== 'paused') return;
  setStatus('playing');
  lastFrame = performance.now();
  hideOverlay();
  answerInput.focus({ preventScroll: true });
}

function endGame(): void {
  if (status !== 'playing') return;
  const isNewBest = score > best;
  if (isNewBest) {
    best = score;
    saveBest(best);
  }
  setStatus('over');
  updateStats();
  finalScore.textContent = formatNumber(score);
  finalCorrect.textContent = String(correctCount);
  newBest.hidden = !isNewBest;
  showOverlay('over');
  playAgainButton.focus({ preventScroll: true });
  announce(`${gameT(lang, 'gameOverTitle')} ${gameT(lang, 'finalScore')}: ${formatNumber(score)}.`);
}

function updateFrame(now: number): void {
  const deltaSeconds = Math.min(.12, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  if (status === 'playing') {
    cards.forEach((card) => {
      card.y -= speed * deltaSeconds;
      positionCard(card);
    });
    updatePressure();
    const dangerCard = findDangerCard();
    if (dangerCard && dangerCard.y <= DANGER_Y) endGame();
  }
  requestAnimationFrame(updateFrame);
}

answerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  submitTypedAnswer();
});

answerInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.isComposing) event.preventDefault();
});

audioButton.addEventListener('click', async () => {
  if (status !== 'playing' || !selectedCard) return;
  const played = await playWord(selectedCard.word.hz, 'gameAudio');
  if (!played) announce(gameT(lang, 'audioUnavailable'));
});

pauseButton.addEventListener('click', pauseGame);
startButton.addEventListener('click', startGame);
resumeButton.addEventListener('click', resumeGame);
restartButton.addEventListener('click', startGame);
playAgainButton.addEventListener('click', startGame);

document.querySelectorAll<HTMLButtonElement>('.level-picker button').forEach((button) => {
  button.addEventListener('click', () => {
    const level = button.dataset.level;
    selectedLevel = level === 'all' ? 'all' : Number(level) as 1 | 2 | 3;
    document.querySelectorAll<HTMLButtonElement>('.level-picker button').forEach((item) => {
      const active = item === button;
      item.classList.toggle('selected', active);
      item.setAttribute('aria-pressed', String(active));
    });
    updateLevelLabels();
  });
});

document.querySelectorAll<HTMLButtonElement>('#gameLangPick button').forEach((button) => {
  button.addEventListener('click', () => applyLanguage(button.dataset.lang as Lang));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (status === 'playing') pauseGame();
    else if (status === 'paused') resumeGame();
    return;
  }
  const activeElement = document.activeElement;
  const inControl = activeElement instanceof HTMLInputElement
    || activeElement instanceof HTMLButtonElement
    || activeElement instanceof HTMLAnchorElement;
  if (event.key === 'Enter' && !inControl) {
    if (status === 'ready' || status === 'over') startGame();
    else if (status === 'paused') resumeGame();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && status === 'playing') pauseGame();
});

applyLanguage(lang);
setStatus('ready');
updateStats();
updateLevelLabels();
renderFeedback();
showOverlay('ready');
requestAnimationFrame(updateFrame);
