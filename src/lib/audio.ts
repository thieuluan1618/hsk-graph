// Audio playback via Web Audio API. Clips live as static files under
// /audio/{w,s}/<hanzi>.mp3 and are fetched + decoded lazily on first play.
import manifest from '../data/audio-manifest.json';

const BASE = import.meta.env.BASE_URL;
const wordSet = new Set<string>(manifest.words);
const sentenceSet = new Set<string>(manifest.sentences);

export function hasWordAudio(hz: string): boolean {
  return wordSet.has(hz);
}
export function hasSentenceAudio(hz: string): boolean {
  return sentenceSet.has(hz);
}

let actx: AudioContext | null = null;
function ensureCtx(): AudioContext | null {
  if (!actx) {
    try {
      actx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

const buffers = new Map<string, AudioBuffer>();
let curSrc: AudioBufferSourceNode | null = null;

async function play(key: string, url: string, btnId: string): Promise<boolean> {
  const ctx = ensureCtx();
  if (!ctx) return false;
  try {
    let buf = buffers.get(key);
    if (!buf) {
      const res = await fetch(url);
      if (!res.ok) return false;
      buf = await ctx.decodeAudioData(await res.arrayBuffer());
      buffers.set(key, buf);
    }
    if (curSrc) {
      try { curSrc.stop(); } catch { /* already stopped */ }
    }
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.connect(ctx.destination);
    s.start();
    curSrc = s;
    const b = document.getElementById(btnId);
    if (b) {
      b.classList.remove('playing');
      void (b as HTMLElement).offsetWidth; // restart CSS animation
      b.classList.add('playing');
    }
    return true;
  } catch {
    return false;
  }
}

export function playWord(hz: string): Promise<boolean> {
  if (!hasWordAudio(hz)) return Promise.resolve(false);
  return play(`w:${hz}`, `${BASE}audio/w/${encodeURIComponent(hz)}.mp3`, 'd-audio');
}

export function playSentence(hz: string): Promise<boolean> {
  if (!hasSentenceAudio(hz)) return Promise.resolve(false);
  return play(`s:${hz}`, `${BASE}audio/s/${encodeURIComponent(hz)}.mp3`, 'd-ex-audio');
}
