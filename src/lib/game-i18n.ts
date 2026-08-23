import type { Lang } from './i18n';

const vi = {
  backToGraph: 'Về đồ thị',
  gameKicker: 'HSK Buddy · Trò chơi',
  gameTagline: 'Đọc nhanh. Nhớ lâu. Đừng để từ chạm vạch.',
  score: 'Điểm',
  streak: 'Combo',
  best: 'Kỷ lục',
  pause: 'Tạm dừng',
  level: 'Cấp độ',
  danger: 'Vạch nguy hiểm',
  findWord: 'Gợi ý đang ghim',
  answerPlaceholder: 'Nhập chữ Hán hoặc pinyin…',
  answer: 'Trả lời',
  answerHint: 'Xóa bất kỳ thẻ nào: gõ chữ Hán hoặc pinyin. Chạm thẻ để ghim nghĩa.',
  hearWord: 'Nghe phát âm',
  lastAnswer: 'Đáp án gần nhất',
  warmup: 'Khởi động trí nhớ',
  readyTitle: 'Sẵn sàng chạy từ?',
  readyBody: 'Xóa từ theo bất kỳ thứ tự nào. Cứu thẻ gần vạch để lấy nhiều điểm hoặc nối từ liên quan để tăng combo.',
  chooseLevel: 'Chọn bộ từ',
  mixed: 'Trộn 1–3',
  start: 'Bắt đầu',
  howToPlay: 'Cách chơi',
  howToPlayBody: 'Gõ chữ Hán hoặc pinyin của bất kỳ thẻ nào. Chạm thẻ để ghim nghĩa; thẻ phát sáng nối được combo. Đáp án sai đẩy cả bảng gần vạch hơn.',
  pausedTitle: 'Đã tạm dừng',
  pausedBody: 'Hít thở đi. Đám từ vẫn đang đợi để hành bạn.',
  resume: 'Tiếp tục',
  restart: 'Chơi lại từ đầu',
  gameOver: 'Hết lượt',
  gameOverTitle: 'Một từ đã chạm vạch.',
  finalScore: 'Điểm lần này',
  correctCount: 'từ đúng',
  playAgain: 'Chơi lại',
  correct: 'Chuẩn!',
  wrong: 'Chưa đúng — bảng tiến lên!',
  newBest: 'Kỷ lục mới!',
  audioUnavailable: 'Từ này chưa có âm thanh.',
  enterAnswer: 'Nhập một đáp án trước đã.',
  levelAll: 'HSK 1–3',
  characterCombo: 'Nối chữ',
  themeCombo: 'Nối chủ đề',
  pinCard: 'Đã ghim gợi ý',
  freeOrderStart: 'Xóa bất kỳ từ nào',
} as const;

export type GameStringKey = keyof typeof vi;

const en: Record<GameStringKey, string> = {
  backToGraph: 'Back to graph',
  gameKicker: 'HSK Buddy · Game',
  gameTagline: 'Read fast. Remember longer. Keep words below the line.',
  score: 'Score',
  streak: 'Combo',
  best: 'Best',
  pause: 'Pause',
  level: 'Level',
  danger: 'Danger line',
  findWord: 'Pinned clue',
  answerPlaceholder: 'Type Hanzi or pinyin…',
  answer: 'Answer',
  answerHint: 'Clear any card: type its Hanzi or pinyin. Tap a card to pin its meaning.',
  hearWord: 'Hear pronunciation',
  lastAnswer: 'Last answer',
  warmup: 'Memory warm-up',
  readyTitle: 'Ready to rush?',
  readyBody: 'Clear words in any order. Rescue cards near the line for more points, or connect related words to build a combo.',
  chooseLevel: 'Choose a word set',
  mixed: 'Mix 1–3',
  start: 'Start game',
  howToPlay: 'How to play',
  howToPlayBody: 'Type the Hanzi or pinyin of any card. Tap a card to pin its meaning; glowing cards continue your combo. A wrong answer pushes the whole board upward.',
  pausedTitle: 'Game paused',
  pausedBody: 'Breathe. The words are still waiting to ruin your day.',
  resume: 'Keep going',
  restart: 'Restart game',
  gameOver: 'Run over',
  gameOverTitle: 'A word crossed the line.',
  finalScore: 'Final score',
  correctCount: 'correct words',
  playAgain: 'Play again',
  correct: 'Nailed it!',
  wrong: 'Not quite — the board moved up!',
  newBest: 'New high score!',
  audioUnavailable: 'Audio is not available for this word yet.',
  enterAnswer: 'Type an answer first.',
  levelAll: 'HSK 1–3',
  characterCombo: 'Character link',
  themeCombo: 'Theme link',
  pinCard: 'Clue pinned',
  freeOrderStart: 'Clear any word',
};

const STRINGS: Record<Lang, Record<GameStringKey, string>> = { vi, en };

export function gameT(lang: Lang, key: GameStringKey): string {
  return STRINGS[lang][key];
}

export function applyGameTranslations(lang: Lang): void {
  document.body.dataset.lang = lang;
  document.querySelectorAll<HTMLElement>('[data-game-i18n]').forEach((element) => {
    element.textContent = gameT(lang, element.dataset.gameI18n as GameStringKey);
  });
  document.querySelectorAll<HTMLInputElement>('[data-game-i18n-placeholder]').forEach((element) => {
    element.placeholder = gameT(lang, element.dataset.gameI18nPlaceholder as GameStringKey);
  });
}
