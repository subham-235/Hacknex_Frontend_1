import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createApi,
  ApiError,
  validateCoordinates,
  safeMapUrl,
} from '../lib/api.mjs';
test('JSON requests include cookies and preserve request body', async () => {
  let captured;
  const request = createApi('/api/', async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({ user: { _id: '1' } }));
  });
  await request('/user/login', {
    method: 'POST',
    body: { emailId: 'sample@example.test', password: 'test' },
  });
  assert.equal(captured.url, '/api/user/login');
  assert.equal(captured.options.credentials, 'include');
  assert.equal(
    JSON.parse(captured.options.body).emailId,
    'sample@example.test',
  );
});
test('multipart leaves content type to the browser', async () => {
  const form = new FormData();
  form.append('location', '0,0');
  await createApi('/api', async (url, options) => {
    assert.equal(options.body, form);
    assert.equal(options.headers['Content-Type'], undefined);
    return new Response('{}');
  })('/sos/trigger', { method: 'POST', body: form });
});
test('failed SOS preserves partial outcome and never retries', async () => {
  let count = 0;
  const request = createApi('/api', async () => {
    count++;
    return new Response(
      JSON.stringify({
        error: 'All SMS failed',
        isDistress: true,
        failedTo: ['demo'],
      }),
      { status: 502 },
    );
  });
  await assert.rejects(
    request('/sos/trigger', { method: 'POST' }),
    (e) =>
      e instanceof ApiError && e.status === 502 && e.data.failedTo.length === 1,
  );
  assert.equal(count, 1);
});
test('plain text authentication errors remain readable', async () => {
  await assert.rejects(
    createApi(
      '/api',
      async () => new Response('Token not found', { status: 404 }),
    )('/user/auth'),
    /Token not found/,
  );
});
test('network failures are actionable', async () => {
  await assert.rejects(
    createApi('/api', async () => {
      throw new TypeError('fetch failed');
    })('/health'),
    /Cannot reach the backend/,
  );
});
test('timeouts abort the underlying request', async () => {
  await assert.rejects(
    createApi(
      '/api',
      async (url, { signal }) =>
        new Promise((resolve, reject) =>
          signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          ),
        ),
    )('/health', { timeout: 5 }),
    /too long/,
  );
});
test('coordinates accept zero and reject missing or out-of-range values', () => {
  assert.equal(validateCoordinates('0', '0'), true);
  for (const point of [
    ['', '0'],
    [' ', '0'],
    ['91', '0'],
    ['0', '181'],
    ['NaN', '3'],
  ])
    assert.equal(validateCoordinates(...point), false);
});
test('map links reject scripts and deceptive domains', () => {
  assert.ok(safeMapUrl('https://maps.google.com/?q=0,0'));
  assert.equal(safeMapUrl('javascript:alert(1)'), undefined);
  assert.equal(safeMapUrl('https://google.com.attacker.test/'), undefined);
});
