/**
 * Thin audio manager that plays the pre-recorded .wav files in /public/sounds/.
 * Falls back silently if the browser blocks autoplay or the file is missing.
 *
 * Sounds:
 *   card      — card-flip.wav   — a card is played to the table
 *   deal      — card-deal.wav   — cards are dealt / new round starts
 *   catch     — card-catch.wav  — a ten is captured in a trick
 *   trickWin  — round-win.wav   — this player's team wins a trick
 *   score     — score.wav       — scores update / trick resolved
 *   gameOver  — game-over.wav   — match ends
 */

const cache = new Map();

function load(src) {
  if (cache.has(src)) return cache.get(src);
  const audio = new Audio(src);
  audio.preload = "auto";
  cache.set(src, audio);
  return audio;
}

const SOUND_MAP = {
  card: "/sounds/card-flip.wav",
  deal: "/sounds/card-deal.wav",
  catch: "/sounds/card-catch.wav",
  trickWin: "/sounds/round-win.wav",
  score: "/sounds/score.wav",
  gameOver: "/sounds/game-over.wav"
};

let muted = false;

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

export function playSound(name, volume = 0.6) {
  if (muted || typeof window === "undefined") return;
  const src = SOUND_MAP[name];
  if (!src) return;
  try {
    const original = load(src);
    // Clone so overlapping calls don't cut each other off
    const instance = original.cloneNode();
    instance.volume = Math.max(0, Math.min(1, volume));
    instance.play().catch(() => {
      // Autoplay blocked — silently ignore
    });
  } catch {
    // Silently ignore any audio errors
  }
}
