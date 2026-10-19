/** Speaks Chinese words with the browser's built-in voices. Silently does nothing without a Chinese voice. */
let muted = false;
let voice: SpeechSynthesisVoice | undefined;

function findVoice() {
  if (typeof speechSynthesis === 'undefined') return;
  voice = speechSynthesis.getVoices().find((v) => /^zh[-_]CN/i.test(v.lang)) ?? speechSynthesis.getVoices().find((v) => /^zh/i.test(v.lang));
}

if (typeof speechSynthesis !== 'undefined') {
  findVoice();
  speechSynthesis.addEventListener?.('voiceschanged', findVoice);
  // Mobile Safari only speaks once a first utterance has come from a tap; later ones are said from game events.
  window.addEventListener('pointerdown', () => speechSynthesis.speak(new SpeechSynthesisUtterance('')), { once: true });
}

export function speak(text: string) {
  if (muted || !voice) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.9;
  speechSynthesis.speak(utterance);
}

export function toggleMute(): boolean {
  muted = !muted;
  if (muted && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  return muted;
}

export const isMuted = () => muted;
