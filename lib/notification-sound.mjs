// Resume from a user gesture so later socket/poll notifications can sound.
let context;
let pending = false;
export async function enableNotificationSound() {
  try {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) return;
    context ??= new Audio();
    await context.resume();
    if (pending) { pending = false; playNotificationSound(); }
  } catch { /* Visible notifications remain available when audio is blocked. */ }
}
export function playNotificationSound() {
  if (!context || context.state !== 'running') { pending = true; return; }
  try {
    for (const [delay, frequency] of [[0, 880], [0.22, 1174]]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + delay;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start);
      oscillator.stop(start + 0.21);
    }
  } catch { pending = true; }
}
