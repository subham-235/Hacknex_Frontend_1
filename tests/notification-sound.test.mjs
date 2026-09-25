import test from 'node:test';
import assert from 'node:assert/strict';
import { enableNotificationSound, playNotificationSound } from '../lib/notification-sound.mjs';

test('notifications queued before interaction sound after unlock; subsequent alerts sound immediately', async () => {
  const starts = [];
  class AudioContext {
    state = 'suspended';
    currentTime = 10;
    destination = {};
    async resume() { this.state = 'running'; }
    createOscillator() {
      return { frequency: {}, connect() {}, disconnect() {}, start(at) { starts.push(at); }, stop() {} };
    }
    createGain() {
      return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} };
    }
  }
  globalThis.AudioContext = AudioContext;
  try {
    playNotificationSound();
    assert.equal(starts.length, 0);
    await enableNotificationSound();
    assert.deepEqual(starts, [10, 10.22]);
    playNotificationSound();
    assert.equal(starts.length, 4);
    await enableNotificationSound();
    assert.equal(starts.length, 4);
  } finally { delete globalThis.AudioContext; }
});
