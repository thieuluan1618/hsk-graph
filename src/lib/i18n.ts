// UI language support (Vietnamese / English learners).
// The default markup is Vietnamese; applyTranslations() rewrites labelled
// elements. Word data always carries both en + vi; `vi-only` elements
// (Hán–Việt, Vietnamese glosses) are hidden in EN mode via body[data-lang].
export type Lang = 'vi' | 'en';

const KEY = 'hsk-graph:lang';

const vi = {
  searchPh: 'Tìm từ · pinyin · nghĩa…',
  brandSub: '<b id="wc">{wc}</b> từ · <b id="hc">{hc}</b> chữ chung · kéo · phóng to · 🔊 bấm vào từ để nghe',
  hint1: '🖱️ <b>Kéo</b> để di chuyển',
  hint2: '🔍 <b>Cuộn</b> để phóng to',
  hint3: '🔊 <b>Bấm</b> vào từ để nghe &amp; xem chi tiết',
  loading: '加油! Đang dựng bản đồ từ vựng…',
  controls: 'Bộ điều khiển',
  level: 'Cấp độ · Level',
  all: 'Tất cả',
  togGroup: 'Gom theo chủ đề',
  togHubs: 'Chữ chung (hub)',
  togSpokes: 'Đường nối chủ đề',
  togHideKnown: 'Ẩn từ đã thuộc',
  frequencyLearning: 'Học theo tần suất',
  topPercent: 'Top {percent}%',
  frequencySummary: '{focus}/{total} từ · phủ {coverage}% tần suất',
  freqSourceLabel: 'Nguồn hội thoại',
  progress: 'Tiến độ · Progress',
  font: 'Font chữ Hán · Hanzi font',
  spacing: 'Khoảng cách · Spacing',
  near: 'Gần · gọn',
  far: 'Xa · thoáng',
  themes: 'Chủ đề · Themes',
  recenter: '⟲ Về giữa',
  shuffle: '✦ Xáo trộn',
  posLabel: 'Từ loại',
  frequencyRank: 'Xếp hạng tần suất',
  frequencyRate: '{rate}/triệu · {count} lượt',
  frequencyUnavailable: 'Chưa có dữ liệu',
  example: 'Ví dụ · Example',
  strokes: '笔顺 · Nét chữ',
  related: 'Từ liên quan',
  relHub: 'Học 1 chữ, hiểu nhiều từ',
  relShared: 'Cùng chữ Hán',
  contains: 'chứa',
  noRelated: 'Từ này không chia sẻ chữ Hán với từ nào khác trong HSK 1–3.',
  hubBadge: 'chữ chung',
  suppBadge: 'bổ sung',
  playWord: 'Nghe phát âm',
  playWordSoon: 'Nghe phát âm — sắp ra mắt',
  noAudio: 'Chưa có âm thanh',
  playSent: 'Nghe câu',
  playSentSoon: 'Nghe câu — sắp có',
  markKnown: 'Đánh dấu đã thuộc',
  knownOn: 'Đã thuộc ✓ — bấm để bỏ',
  matches: '{n} từ khớp',
  noMatch: 'không tìm thấy',
};

const en: Record<StringKey, string> = {
  searchPh: 'Search word · pinyin…',
  brandSub: '<b id="wc">{wc}</b> words · <b id="hc">{hc}</b> shared characters · drag · zoom · 🔊 click a word to listen',
  hint1: '🖱️ <b>Drag</b> to move',
  hint2: '🔍 <b>Scroll</b> to zoom',
  hint3: '🔊 <b>Click</b> a word to listen &amp; see details',
  loading: '加油! Building the vocabulary map…',
  controls: 'Controls',
  level: 'Level',
  all: 'All',
  togGroup: 'Group by theme',
  togHubs: 'Shared characters (hubs)',
  togSpokes: 'Theme links',
  togHideKnown: 'Hide known words',
  frequencyLearning: 'Learn by frequency',
  topPercent: 'Top {percent}%',
  frequencySummary: '{focus}/{total} words · {coverage}% frequency coverage',
  freqSourceLabel: 'Spoken-language source',
  progress: 'Progress',
  font: 'Hanzi font',
  spacing: 'Spacing',
  near: 'Compact',
  far: 'Spread out',
  themes: 'Themes',
  recenter: '⟲ Re-center',
  shuffle: '✦ Shuffle',
  posLabel: 'Part of speech',
  frequencyRank: 'Frequency rank',
  frequencyRate: '{rate}/M · {count} hits',
  frequencyUnavailable: 'No frequency data',
  example: 'Example',
  strokes: '笔顺 · Stroke order',
  related: 'Related words',
  relHub: 'One character, many words',
  relShared: 'Shares a character',
  contains: 'contains',
  noRelated: 'This word does not share a character with any other HSK 1–3 word.',
  hubBadge: 'shared character',
  suppBadge: 'extra',
  playWord: 'Play pronunciation',
  playWordSoon: 'Pronunciation — coming soon',
  noAudio: 'No audio yet',
  playSent: 'Play sentence',
  playSentSoon: 'Sentence audio — coming soon',
  markKnown: 'Mark as known',
  knownOn: 'Known ✓ — click to unmark',
  matches: '{n} matches',
  noMatch: 'no matches',
};

export type StringKey = keyof typeof vi;

const STRINGS: Record<Lang, Record<StringKey, string>> = { vi, en };

export function t(lang: Lang, key: StringKey, params?: Record<string, string | number>): string {
  let s = STRINGS[lang][key];
  if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
  return s;
}

export function loadLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // storage unavailable — language just won't persist
  }
}

/** Rewrite all statically labelled DOM elements for the given language. */
export function applyTranslations(lang: Lang): void {
  document.body.dataset.lang = lang;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(lang, el.dataset.i18n as StringKey);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(lang, el.dataset.i18nHtml as StringKey, { wc: el.dataset.wc ?? '', hc: el.dataset.hc ?? '' });
  });
  document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(lang, el.dataset.i18nPlaceholder as StringKey);
  });
}
