/**
 * Speaks Chinese words with the browser's built-in voices.
 *
 * Mobile browsers need some extra care, which is why this is more than a bare speak():
 * - iOS Safari and Android Chrome often return no voices until `voiceschanged` fires (some iOS
 *   versions never fire it), so voices are looked up again on every call, and when no voice is
 *   listed the utterance is still spoken with `lang = 'zh-CN'` so the browser picks its own.
 * - Mobile Safari only speaks after an utterance has been started from a tap. Game events (a hit,
 *   a new target) are not taps, so the first tap/click/key press speaks a silent utterance to
 *   unlock speech for the rest of the session.
 * - Calling cancel() right before speak() can make Safari and Chrome drop the new utterance, so
 *   cancel only runs when something is actually queued, and speak() is deferred a tick after it.
 * - iOS sometimes leaves the synth paused (e.g. after the app was in the background), so resume()
 *   runs before each utterance.
 */
let muted = false;
let unlocked = false;

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

// pointerup/touchend/click/keydown count as user activation in Safari; pointerdown and touchstart may not.
const UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const;

function chineseVoice(): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => /^zh[-_]CN/i.test(v.lang)) ?? voices.find((v) => /^(zh|cmn)/i.test(v.lang));
}

function utter(text: string): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = chineseVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? 'zh-CN';
  utterance.rate = 0.9;
  return utterance;
}

function unlock() {
  if (unlocked) return;
  unlocked = true;
  for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlock, true);
  // A near-silent space, not an empty string: Safari ignores empty utterances, and an ignored one does not unlock.
  const utterance = utter(' ');
  utterance.volume = 0;
  speechSynthesis.speak(utterance);
}

if (supported) {
  // Kick off the voice list load early; Chrome only populates it after the first getVoices() call.
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener?.('voiceschanged', () => speechSynthesis.getVoices());
  for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock, { capture: true, passive: true });
}

export function speak(text: string) {
  if (muted || !supported) return;
  const utterance = utter(text);
  const start = () => {
    speechSynthesis.resume();
    speechSynthesis.speak(utterance);
  };
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.cancel();
    setTimeout(start, 50);
  } else {
    start();
  }
}

export function toggleMute(): boolean {
  muted = !muted;
  if (muted && supported) speechSynthesis.cancel();
  return muted;
}

export const isMuted = () => muted;
