import type { Lang } from './i18n';

const vi = {
  gameKicker: 'HSK Buddy · Luyện nghe',
  backToGraph: 'Về đồ thị',
  rush: 'HSK Rush',
  score: 'Điểm',
  streak: 'Chuỗi đúng',
  best: 'Kỷ lục',
  question: 'Câu',
  time: 'Thời gian',
  listen: 'Nghe lại',
  listenHint: 'Nghe kỹ, rồi chọn nghĩa bạn vừa nghe.',
  chooseMeaning: 'Chọn nghĩa đúng',
  waiting: 'Âm thanh đang chờ bạn.',
  replayHint: 'Có thể nghe lại bất cứ lúc nào.',
  answerReveal: 'Bạn vừa nghe',
  correct: 'Chuẩn rồi!',
  wrong: 'Chưa đúng.',
  timeUp: 'Hết giờ!',
  next: 'Từ tiếp theo',
  finish: 'Xem kết quả',
  warmup: 'Khởi động tai',
  readyTitle: 'Sẵn sàng nghe chưa?',
  readyBody: 'Nghe một từ tiếng Trung và chọn nghĩa của nó. Mỗi lượt có 10 câu, mỗi câu 15 giây. Bạn có thể nghe lại trong thời gian đó.',
  chooseLevel: 'Chọn bộ từ',
  mixed: 'Trộn 1–3',
  start: 'Bắt đầu nghe',
  howToPlay: 'Cách chơi',
  howToPlayBody: 'Mỗi lượt phát một từ. Chọn nghĩa đúng để ghi điểm và nối chuỗi. Nhấn 1–4 để chọn nhanh, R để nghe lại.',
  paused: 'Đã tạm dừng',
  pausedBody: 'Tai nghỉ một chút. Từ vựng sẽ không trốn đâu.',
  resume: 'Tiếp tục',
  restart: 'Chơi lại',
  complete: 'Hoàn thành',
  completeTitle: 'Bạn đã nghe hết lượt.',
  finalScore: 'Điểm lần này',
  correctCount: 'đáp án đúng',
  newBest: 'Kỷ lục mới!',
  playAgain: 'Chơi lại',
  backToGraphAction: 'Về đồ thị',
  audioUnavailable: 'Từ này chưa có âm thanh.',
  roundAnnouncement: 'Câu {current} trên {total}. Hãy nghe và chọn nghĩa đúng.',
  correctAnnouncement: 'Chuẩn rồi. {word}, {pinyin}.',
  wrongAnnouncement: 'Chưa đúng. Đáp án là {word}, {pinyin}.',
  timeUpAnnouncement: 'Hết giờ. Đáp án là {word}, {pinyin}.',
  selected: 'Đã chọn',
  levelAll: 'HSK 1–3',
} as const;

export type ListenStringKey = keyof typeof vi;

const en: Record<ListenStringKey, string> = {
  gameKicker: 'HSK Buddy · Listening',
  backToGraph: 'Back to graph',
  rush: 'HSK Rush',
  score: 'Score',
  streak: 'Streak',
  best: 'Best',
  question: 'Question',
  time: 'Time',
  listen: 'Play again',
  listenHint: 'Listen closely, then choose the meaning you heard.',
  chooseMeaning: 'Choose the right meaning',
  waiting: 'The audio is ready when you are.',
  replayHint: 'Replay it as often as you need.',
  answerReveal: 'You heard',
  correct: 'That’s right!',
  wrong: 'Not this time.',
  timeUp: 'Time’s up!',
  next: 'Next word',
  finish: 'See results',
  warmup: 'Warm up your ears',
  readyTitle: 'Ready to listen?',
  readyBody: 'Hear a Chinese word and choose what it means. Play 10 questions with 15 seconds each. Replay the audio within that time as needed.',
  chooseLevel: 'Choose a word set',
  mixed: 'Mix 1–3',
  start: 'Start listening',
  howToPlay: 'How to play',
  howToPlayBody: 'Each round plays one word. Choose its meaning to score and build a streak. Press 1–4 to answer quickly, or R to replay.',
  paused: 'Game paused',
  pausedBody: 'Give your ears a break. The vocabulary is not going anywhere.',
  resume: 'Keep listening',
  restart: 'Restart',
  complete: 'Round complete',
  completeTitle: 'You heard every word.',
  finalScore: 'Final score',
  correctCount: 'correct answers',
  newBest: 'New high score!',
  playAgain: 'Play again',
  backToGraphAction: 'Back to graph',
  audioUnavailable: 'Audio is not available for this word yet.',
  roundAnnouncement: 'Question {current} of {total}. Listen and choose the right meaning.',
  correctAnnouncement: 'That’s right. {word}, {pinyin}.',
  wrongAnnouncement: 'Not this time. The answer is {word}, {pinyin}.',
  timeUpAnnouncement: 'Time’s up. The answer is {word}, {pinyin}.',
  selected: 'Selected',
  levelAll: 'HSK 1–3',
};

const STRINGS: Record<Lang, Record<ListenStringKey, string>> = { vi, en };

export function listenT(lang: Lang, key: ListenStringKey): string {
  return STRINGS[lang][key];
}

export function formatListenT(lang: Lang, key: ListenStringKey, values: Record<string, string | number>): string {
  return listenT(lang, key).replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''));
}

export function applyListenTranslations(lang: Lang): void {
  document.body.dataset.lang = lang;
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>('[data-listen-i18n]').forEach((element) => {
    element.textContent = listenT(lang, element.dataset.listenI18n as ListenStringKey);
  });
  document.querySelectorAll<HTMLElement>('[data-listen-i18n-aria]').forEach((element) => {
    element.setAttribute('aria-label', listenT(lang, element.dataset.listenI18nAria as ListenStringKey));
  });
}
