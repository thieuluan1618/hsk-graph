import graphDataJson from '../data/graph.json';
import { hasWordAudio, playWord } from '../lib/audio';
import { applyListenTranslations, formatListenT, listenT } from '../lib/listen-i18n';
import { loadLang, saveLang, type Lang } from '../lib/i18n';
import type { GraphData, NodeDatum } from '../lib/types';

type GameStatus = 'ready' | 'playing' | 'paused' | 'over';
type GameLevel = 'all' | 1 | 2 | 3;
type Result = 'idle' | 'correct' | 'wrong';

interface Round {
  word: NodeDatum;
  choices: NodeDatum[];
}

const data = graphDataJson as unknown as GraphData;
const ROUND_COUNT = 10;
const ROUND_DURATION_MS = 15_000;
const REVEAL_DURATION_MS = 1_250;
const BEST_KEY = 'hsk-echo:best';

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing listening game element: #${id}`);
  return element as T;
}

const app = byId<HTMLElement>('listenApp');
const scoreElement = byId<HTMLElement>('listenScore');
const streakElement = byId<HTMLElement>('listenStreak');
const bestElement = byId<HTMLElement>('listenBest');
const roundLabel = byId<HTMLElement>('listenRoundLabel');
const progressFill = byId<HTMLElement>('listenProgressFill');
const timerElement = byId<HTMLElement>('listenTimer');
const levelLabel = byId<HTMLElement>('listenLevelLabel');
const audioButton = byId<HTMLButtonElement>('listenAudio');
const pauseButton = byId<HTMLButtonElement>('pauseListen');
const choicesElement = byId<HTMLElement>('listenChoices');
const reveal = byId<HTMLElement>('listenReveal');
const resultMark = byId<HTMLElement>('listenResultMark');
const resultLabel = byId<HTMLElement>('listenResultLabel');
const revealTitle = byId<HTMLElement>('listenRevealTitle');
const hanzi = byId<HTMLElement>('listenHanzi');
const pinyin = byId<HTMLElement>('listenPinyin');
const meaning = byId<HTMLElement>('listenMeaning');
const nextButton = byId<HTMLButtonElement>('listenNext');
const overlay = byId<HTMLElement>('listenOverlay');
const startButton = byId<HTMLButtonElement>('startListen');
const resumeButton = byId<HTMLButtonElement>('resumeListen');
const restartButton = byId<HTMLButtonElement>('restartListen');
const playAgainButton = byId<HTMLButtonElement>('playListenAgain');
const finalScore = byId<HTMLElement>('listenFinalScore');
const correctCountElement = byId<HTMLElement>('listenCorrectCount');
const newBest = byId<HTMLElement>('listenNewBest');
const announcement = byId<HTMLElement>('listenAnnouncement');

let lang: Lang = loadLang();
let status: GameStatus = 'ready';
let selectedLevel: GameLevel = 1;
let activeWords: NodeDatum[] = [];
let round: Round | null = null;
let roundIndex = 0;
let score = 0;
let streak = 0;
let correctCount = 0;
let best = loadBest();
let answered = false;
let selectedAnswer: NodeDatum | null = null;
let timedOut = false;
let usedWords = new Set<string>();
let timerHandle: number | null = null;
let timerStartedAt = 0;
let timerRemainingMs = ROUND_DURATION_MS;
let autoAdvanceHandle: number | null = null;

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
    // Scores are a bonus, not a reason to break the game.
  }
}

function formatNumber(value: number): string {
  return value.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US');
}

function levelText(level: GameLevel): string {
  return level === 'all' ? listenT(lang, 'levelAll') : `HSK ${level}`;
}

function meaningFor(word: NodeDatum): string {
  return (lang === 'vi' ? word.vi : word.en) || word.en || word.vi;
}

function optionKey(word: NodeDatum): string {
  return meaningFor(word).trim().toLocaleLowerCase();
}

function updateStats(): void {
  scoreElement.textContent = formatNumber(score);
  streakElement.textContent = String(streak);
  bestElement.textContent = formatNumber(best);
}

function updateRoundChrome(): void {
  const current = Math.min(roundIndex + 1, ROUND_COUNT);
  roundLabel.textContent = status === 'ready' ? '—' : `${listenT(lang, 'question')} ${String(current).padStart(2, '0')} / ${ROUND_COUNT}`;
  progressFill.style.width = `${status === 'ready' ? 0 : (roundIndex / ROUND_COUNT) * 100}%`;
  levelLabel.textContent = levelText(selectedLevel);
}

function updateTimer(): void {
  const seconds = Math.max(0, Math.ceil(timerRemainingMs / 1000));
  timerElement.querySelector('b')!.textContent = String(seconds);
  timerElement.classList.toggle('urgent', seconds <= 5 && status === 'playing');
}

function stopTimer(): void {
  if (timerHandle !== null) {
    window.clearInterval(timerHandle);
    timerHandle = null;
  }
}

function cancelAutoAdvance(): void {
  if (autoAdvanceHandle !== null) {
    window.clearTimeout(autoAdvanceHandle);
    autoAdvanceHandle = null;
  }
}

function scheduleAutoAdvance(): void {
  cancelAutoAdvance();
  autoAdvanceHandle = window.setTimeout(() => {
    autoAdvanceHandle = null;
    nextRound();
  }, REVEAL_DURATION_MS);
}

function pauseTimer(): void {
  if (timerHandle === null) return;
  timerRemainingMs = Math.max(0, timerRemainingMs - (performance.now() - timerStartedAt));
  stopTimer();
  updateTimer();
}

function startTimer(): void {
  if (status !== 'playing' || timerRemainingMs <= 0 || timerHandle !== null) return;
  timerStartedAt = performance.now();
  timerHandle = window.setInterval(() => {
    timerRemainingMs = Math.max(0, timerRemainingMs - (performance.now() - timerStartedAt));
    timerStartedAt = performance.now();
    updateTimer();
    if (timerRemainingMs <= 0) timeExpired();
  }, 100);
  updateTimer();
}

function announce(message: string): void {
  announcement.textContent = '';
  window.setTimeout(() => { announcement.textContent = message; }, 20);
}

function setStatus(nextStatus: GameStatus): void {
  status = nextStatus;
  app.dataset.listenState = status;
  const playing = status === 'playing';
  audioButton.disabled = !playing || !round;
  pauseButton.disabled = !playing;
  choicesElement.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.disabled = !playing || answered;
  });
  nextButton.disabled = !playing || !answered;
}

function showOverlay(view: 'ready' | 'paused' | 'over'): void {
  overlay.dataset.view = view;
  overlay.classList.remove('hidden');
}

function hideOverlay(): void {
  overlay.classList.add('hidden');
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

function chooseRound(): Round {
  const fresh = activeWords.filter((word) => !usedWords.has(word.id));
  const source = fresh.length ? fresh : activeWords;
  const word = source[Math.floor(Math.random() * source.length)]!;
  usedWords.add(word.id);

  const optionKeys = new Set([optionKey(word)]);
  const distractors = shuffled(activeWords).filter((candidate) => {
    if (candidate.id === word.id || optionKeys.has(optionKey(candidate))) return false;
    optionKeys.add(optionKey(candidate));
    return true;
  }).slice(0, 3);
  return { word, choices: shuffled([word, ...distractors]) };
}

function renderChoices(): void {
  choicesElement.replaceChildren();
  if (!round) return;
  round.choices.forEach((choice, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'listen-choice';
    button.dataset.wordId = choice.id;
    button.disabled = status !== 'playing' || answered;
    button.innerHTML = `<span class="listen-choice-index">${index + 1}</span><span class="listen-choice-copy">${escapeHtml(meaningFor(choice))}</span>`;
    button.setAttribute('aria-label', `${index + 1}. ${meaningFor(choice)}`);
    button.addEventListener('click', () => answer(choice));
    choicesElement.append(button);
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]!);
}

function renderReveal(result: Result = 'idle'): void {
  reveal.dataset.result = result;
  if (!round) {
    hanzi.textContent = '耳朵';
    pinyin.textContent = 'ěrduo';
    meaning.textContent = 'ear';
    resultMark.textContent = '◌';
    resultLabel.textContent = listenT(lang, 'waiting');
    revealTitle.textContent = listenT(lang, 'answerReveal');
    return;
  }

  const word = round.word;
  if (result === 'idle') {
    hanzi.textContent = '？';
    pinyin.textContent = '—';
    meaning.textContent = listenT(lang, 'replayHint');
    resultMark.textContent = '◌';
    resultLabel.textContent = listenT(lang, 'waiting');
    revealTitle.textContent = listenT(lang, 'answerReveal');
    return;
  }
  hanzi.textContent = word.hz;
  pinyin.textContent = word.py;
  meaning.textContent = meaningFor(word);
  revealTitle.textContent = listenT(lang, 'answerReveal');
  if (result === 'correct') {
    resultMark.textContent = '✓';
    resultLabel.textContent = listenT(lang, 'correct');
  } else if (result === 'wrong') {
    resultMark.textContent = '×';
    resultLabel.textContent = listenT(lang, 'wrong');
  }
}

async function playCurrent(): Promise<void> {
  if (status !== 'playing' || !round) return;
  const played = await playWord(round.word.hz, 'listenAudio');
  if (!played) announce(listenT(lang, 'audioUnavailable'));
}

function prepareRound(): void {
  round = chooseRound();
  answered = false;
  selectedAnswer = null;
  timedOut = false;
  stopTimer();
  timerRemainingMs = ROUND_DURATION_MS;
  setStatus('playing');
  renderChoices();
  renderReveal();
  updateRoundChrome();
  setStatus('playing');
  startTimer();
  void playCurrent();
  announce(formatListenT(lang, 'roundAnnouncement', { current: roundIndex + 1, total: ROUND_COUNT }));
}

function startGame(): void {
  activeWords = data.nodes.filter((node) => (
    node.kind === 'word'
    && hasWordAudio(node.hz)
    && (selectedLevel === 'all' || node.hsk === selectedLevel)
  ));
  if (activeWords.length < 4) return;
  roundIndex = 0;
  score = 0;
  streak = 0;
  correctCount = 0;
  usedWords = new Set();
  stopTimer();
  cancelAutoAdvance();
  newBest.hidden = true;
  updateStats();
  hideOverlay();
  prepareRound();
}

function answer(choice: NodeDatum): void {
  if (status !== 'playing' || answered || !round) return;
  answered = true;
  timedOut = false;
  pauseTimer();
  selectedAnswer = choice;
  const isCorrect = choice.id === round.word.id;
  const result: Result = isCorrect ? 'correct' : 'wrong';
  if (isCorrect) {
    streak += 1;
    correctCount += 1;
    score += 100 + Math.min(streak - 1, 9) * 20;
  } else {
    streak = 0;
  }
  choicesElement.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    const isChoice = button.dataset.wordId === choice.id;
    const isAnswer = button.dataset.wordId === round!.word.id;
    button.disabled = true;
    button.classList.toggle('correct', isAnswer);
    button.classList.toggle('wrong', isChoice && !isCorrect);
    if (isChoice) button.setAttribute('aria-label', `${button.getAttribute('aria-label') ?? ''}. ${listenT(lang, 'selected')}`);
  });
  updateStats();
  renderReveal(result);
  nextButton.disabled = false;
  nextButton.querySelector('span')!.textContent = roundIndex === ROUND_COUNT - 1 ? listenT(lang, 'finish') : listenT(lang, 'next');
  announce(formatListenT(lang, isCorrect ? 'correctAnnouncement' : 'wrongAnnouncement', { word: round.word.hz, pinyin: round.word.py }));
  scheduleAutoAdvance();
}

function timeExpired(): void {
  if (status !== 'playing' || answered || !round) return;
  stopTimer();
  timerRemainingMs = 0;
  updateTimer();
  answered = true;
  timedOut = true;
  streak = 0;
  choicesElement.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.disabled = true;
    button.classList.toggle('correct', button.dataset.wordId === round!.word.id);
  });
  updateStats();
  renderReveal('wrong');
  resultLabel.textContent = listenT(lang, 'timeUp');
  nextButton.disabled = false;
  nextButton.querySelector('span')!.textContent = roundIndex === ROUND_COUNT - 1 ? listenT(lang, 'finish') : listenT(lang, 'next');
  announce(formatListenT(lang, 'timeUpAnnouncement', { word: round.word.hz, pinyin: round.word.py }));
  scheduleAutoAdvance();
}

function nextRound(): void {
  if (status !== 'playing' || !answered) return;
  roundIndex += 1;
  if (roundIndex >= ROUND_COUNT) {
    endGame();
    return;
  }
  prepareRound();
}

function pauseGame(): void {
  if (status !== 'playing') return;
  pauseTimer();
  cancelAutoAdvance();
  setStatus('paused');
  showOverlay('paused');
  resumeButton.focus({ preventScroll: true });
}

function resumeGame(): void {
  if (status !== 'paused') return;
  setStatus('playing');
  hideOverlay();
  if (answered) scheduleAutoAdvance();
  else startTimer();
}

function endGame(): void {
  stopTimer();
  cancelAutoAdvance();
  const isNewBest = score > best;
  if (isNewBest) {
    best = score;
    saveBest(best);
  }
  setStatus('over');
  updateStats();
  progressFill.style.width = '100%';
  finalScore.textContent = formatNumber(score);
  correctCountElement.textContent = String(correctCount);
  newBest.hidden = !isNewBest;
  showOverlay('over');
  playAgainButton.focus({ preventScroll: true });
}

function applyLanguage(nextLang: Lang): void {
  lang = nextLang;
  saveLang(lang);
  applyListenTranslations(lang);
  document.querySelectorAll<HTMLButtonElement>('#listenLangPick button').forEach((button) => {
    const active = button.dataset.lang === lang;
    button.classList.toggle('on', active);
    button.setAttribute('aria-pressed', String(active));
  });
  updateStats();
  updateRoundChrome();
  updateTimer();
  renderChoices();
  renderReveal(answered ? (selectedAnswer?.id === round?.word.id ? 'correct' : 'wrong') : 'idle');
  if (timedOut) resultLabel.textContent = listenT(lang, 'timeUp');
  nextButton.querySelector('span')!.textContent = roundIndex === ROUND_COUNT - 1 && answered ? listenT(lang, 'finish') : listenT(lang, 'next');
}

audioButton.addEventListener('click', () => { void playCurrent(); });
pauseButton.addEventListener('click', pauseGame);
startButton.addEventListener('click', startGame);
resumeButton.addEventListener('click', resumeGame);
restartButton.addEventListener('click', startGame);
playAgainButton.addEventListener('click', startGame);
nextButton.addEventListener('click', nextRound);

document.querySelectorAll<HTMLButtonElement>('.listen-level-picker button').forEach((button) => {
  button.addEventListener('click', () => {
    const value = button.dataset.level;
    selectedLevel = value === 'all' ? 'all' : Number(value) as 1 | 2 | 3;
    document.querySelectorAll<HTMLButtonElement>('.listen-level-picker button').forEach((item) => {
      const active = item === button;
      item.classList.toggle('selected', active);
      item.setAttribute('aria-pressed', String(active));
    });
    updateRoundChrome();
  });
});

document.querySelectorAll<HTMLButtonElement>('#listenLangPick button').forEach((button) => {
  button.addEventListener('click', () => applyLanguage(button.dataset.lang as Lang));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (status === 'playing') pauseGame();
    else if (status === 'paused') resumeGame();
    return;
  }
  if (status !== 'playing') return;
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    void playCurrent();
    return;
  }
  const choiceIndex = Number(event.key) - 1;
  if (!answered && choiceIndex >= 0 && choiceIndex < 4) {
    const choice = round?.choices[choiceIndex];
    if (choice) answer(choice);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && status === 'playing') pauseGame();
});

applyLanguage(lang);
setStatus('ready');
updateStats();
updateRoundChrome();
renderReveal();
