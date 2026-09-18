import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise lifecycle and async races without acquiring a real mic or contacting services.
function harness(file, globals = {}) {
  const slots = [], effects = [];
  let cursor = 0;
  const hooks = {
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useCallback(fn) { cursor++; return fn; },
    useEffect(fn) { const i = cursor++; if (!(i in slots)) { slots[i] = true; effects.push(fn); } },
  };
  const source = readFileSync(new URL(`../hooks/${file}`, import.meta.url), 'utf8')
    .replace(/^import .*;$/gm, '').replace('export default function', 'function')
    .replace('export async function', 'async function').replaceAll('import.meta.env', 'environment');
  const context = vm.createContext({ ...hooks, Blob, FormData, AbortController, setTimeout, clearTimeout,
    console: { error() {} }, environment: {}, ...globals });
  vm.runInContext(source, context);
  return {
    context,
    render(...args) { cursor = 0; const result = context[file.replace('.js', '')](...args); while (effects.length) effects.shift()(); return result; },
  };
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));

function modeHarness(options = {}) {
  let chunk;
  let stopped = 0;
  const requests = [];
  const h = harness('useSurakshaMode.js', {
    navigator: { geolocation: { getCurrentPosition(success) { success({ coords: { latitude: 0, longitude: 0 } }); } } },
    useAudioRecorder(callback) { chunk = callback; return { startRecording: async () => options.startSuccess !== false, stopRecording() { stopped++; }, isRecording: true, error: '' }; },
    fetch: async (url, request) => { requests.push({ url, request }); return options.respond ? options.respond(url, request) : { ok: true, json: async () => ({ isDistress: false, transcript: 'hello' }) }; },
  });
  return { ...h, requests, send: blob => chunk(blob), stopped: () => stopped };
}

test('voice uploads preserve zero coordinates, include cookies, and allow browser multipart boundaries', async () => {
  const h = modeHarness();
  const state = h.render({});
  await h.send(new Blob(['before activation']));
  assert.equal(h.requests.length, 0);
  await state.activate();
  await h.send(new Blob(['audio']));
  const { url, request } = h.requests[0];
  assert.equal(url, '/api/sos/trigger');
  assert.equal(request.credentials, 'include');
  assert.equal(request.headers, undefined);
  assert.equal(request.body.get('lat'), '0');
  assert.equal(request.body.get('lon'), '0');
  assert.equal(request.body.get('location'), '0,0');
  assert.equal(request.body.get('audio').name, 'recording.webm');
  assert.equal(h.render({}).liveTranscript, 'hello');
});

test('overlapping chunks are skipped and stale distress responses cannot reopen an alert after stopping', async () => {
  const response = deferred();
  const alerts = [];
  const h = modeHarness({ respond: () => response.promise });
  const state = h.render({ onSOSTriggered: data => alerts.push(data) });
  await state.activate();
  const first = h.send(new Blob(['audio']));
  assert.match(h.render({}).voiceStatus, /sending audio/);
  assert.equal(h.render({}).isLoading, true);
  await h.send(new Blob(['skip']));
  assert.equal(h.requests.length, 1);
  state.deactivate();
  assert.equal(h.requests[0].request.signal.aborted, true);
  response.resolve({ ok: true, json: async () => ({ isDistress: true, summary: 'help' }) });
  await first;
  assert.equal(alerts.length, 0);
  assert.equal(h.render({}).isActive, false);
  assert.equal(h.render({}).liveTranscript, '');
  assert.equal(h.render({}).voiceStatus, '');
});

test('failed SMS distress responses remain visible and recording stays active', async () => {
  const alerts = [];
  const h = modeHarness({ respond: async () => ({ ok: false, status: 502, json: async () => ({ isDistress: true, sent: false, sentTo: [], failedTo: ['test contact'], transcript: 'help' }) }) });
  await h.render({ onSOSTriggered: data => alerts.push(data) }).activate();
  await h.send(new Blob(['audio']));
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].sent, false);
  assert.equal(h.render({}).isActive, true);
  assert.equal(h.render({}).isLoading, false);
  assert.match(h.render({}).voiceStatus, /could not be sent/);
});

test('network failure releases the busy lock for the next fresh chunk', async () => {
  let calls = 0;
  const h = modeHarness({ respond: async () => { if (++calls === 1) throw new Error('Offline'); return { ok: true, json: async () => ({ transcript: 'recovered' }) }; } });
  await h.render({}).activate();
  await h.send(new Blob(['one']));
  assert.match(h.render({}).voiceStatus, /unconfirmed/);
  await h.send(new Blob(['two']));
  assert.equal(calls, 2);
  assert.equal(h.render({}).liveTranscript, 'recovered');
  assert.match(h.render({}).voiceStatus, /no SOS triggered/);
});

test('demo never uploads audio and microphone failure never marks mode active', async () => {
  const h = modeHarness();
  await h.render({ demo: true }).activate();
  await h.send(new Blob(['private']));
  assert.equal(h.requests.length, 0);
  const failed = modeHarness({ startSuccess: false });
  await failed.render({}).activate();
  assert.equal(failed.render({}).isActive, false);
});

test('cancel during location lookup cannot subsequently open the microphone', async () => {
  let acceptLocation, starts = 0;
  const h = harness('useSurakshaMode.js', {
    navigator: { geolocation: { getCurrentPosition(success) { acceptLocation = success; } } },
    useAudioRecorder() { return { startRecording: async () => { starts++; return true; }, stopRecording() {}, isRecording: false, error: '' }; },
  });
  const state = h.render({});
  const activation = state.activate();
  state.deactivate();
  acceptLocation({ coords: { latitude: 12, longitude: 34 } });
  await activation;
  assert.equal(starts, 0);
});

test('location fallback is approximate and total failure still uploads without coordinates', async () => {
  const h = modeHarness();
  h.context.navigator.geolocation.getCurrentPosition = (success, failure) => failure(new Error('Denied'));
  h.context.fetch = async () => ({ ok: true, json: async () => ({ latitude: 12, longitude: 34 }) });
  assert.equal((await h.context.getLocation()).source, 'ip');
  h.context.fetch = async () => { throw new Error('Offline'); };
  const result = await h.context.getLocation();
  assert.equal(result.lat, null);
  assert.equal(result.lon, null);
  assert.equal(result.source, 'unavailable');
});

function recorderHarness(permission) {
  const timers = new Map(), recorders = [], delivered = [];
  let id = 0, stopped = 0;
  const stream = { getTracks: () => [{ stop() { stopped++; } }], getAudioTracks: () => [{ addEventListener() {} }] };
  class Recorder {
    static isTypeSupported() { return true; }
    constructor() { this.state = 'inactive'; recorders.push(this); }
    start(timeslice) { this.timeslice = timeslice; this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['a'.repeat(600)]) }); this.onstop(); }
  }
  const h = harness('useAudioRecorder.js', {
    MediaRecorder: Recorder,
    navigator: { mediaDevices: { getUserMedia: permission || (async () => stream) } },
    setTimeout(fn) { timers.set(++id, fn); return id; }, clearTimeout(key) { timers.delete(key); },
  });
  return { ...h, timers, recorders, delivered, stream, stopped: () => stopped };
}

test('recorder finalizes each segment, restarts, and discards final audio on deactivate', async () => {
  const h = recorderHarness();
  const state = h.render(blob => h.delivered.push(blob));
  assert.equal(await state.startRecording(), true);
  assert.equal(h.recorders[0].timeslice, 4000);
  h.timers.values().next().value();
  await tick();
  assert.equal(h.delivered.length, 1);
  assert.equal(h.recorders.length, 2);
  assert.equal(h.delivered[0].type, 'audio/webm');
  state.stopRecording();
  await tick();
  assert.equal(h.delivered.length, 1);
  assert.equal(h.stopped(), 1);
});

test('late microphone permission is released after cancellation', async () => {
  const permission = deferred();
  const h = recorderHarness(() => permission.promise);
  const state = h.render(() => {});
  const pending = state.startRecording();
  state.stopRecording();
  permission.resolve(h.stream);
  assert.equal(await pending, false);
  assert.equal(h.stopped(), 1);
  assert.equal(h.recorders.length, 0);
});

for (const [name, expected] of [
  ['NotAllowedError', 'Microphone permission denied. Please allow mic access in browser settings.'],
  ['NotFoundError', 'No microphone found on this device.'],
]) {
  test(`microphone ${name} gives the requested message`, async () => {
    const h = recorderHarness(async () => { throw Object.assign(new Error('failed'), { name }); });
    await h.render(() => {}).startRecording();
    assert.equal(h.render(() => {}).error, expected);
  });
}
