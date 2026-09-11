export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.status = status;
    this.data = data;
  }
}
export function createApi(base = '/api', transport = fetch) {
  return async function request(path, options = {}) {
    const { method = 'GET', body, timeout = 15000 } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const multipart =
        typeof FormData !== 'undefined' && body instanceof FormData;
      const response = await transport(`${base.replace(/\/$/, '')}${path}`, {
        method,
        credentials: 'include',
        signal: controller.signal,
        headers:
          body && !multipart ? { 'Content-Type': 'application/json' } : {},
        body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
      });
      const raw = await response.text();
      if (/^\s*<!doctype html|^\s*<html/i.test(raw)) {
        throw new ApiError(
          'The API address returned a web page. Configure the backend URL or API reverse proxy.',
          response.status,
        );
      }
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = { message: raw };
      }
      if (!response.ok)
        throw new ApiError(
          data.error || data.message || `Request failed (${response.status})`,
          response.status,
          data,
        );
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        error.name === 'AbortError'
          ? 'The backend took too long to respond. Check its terminal and database connection.'
          : 'Cannot reach the backend. Start it on port 5000 and check the database connection.',
      );
    } finally {
      clearTimeout(timer);
    }
  };
}
export function validateCoordinates(lat, lon) {
  return (
    String(lat).trim() !== '' &&
    String(lon).trim() !== '' &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lon)) &&
    Math.abs(Number(lat)) <= 90 &&
    Math.abs(Number(lon)) <= 180
  );
}
export function safeMapUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      [
        'maps.google.com',
        'www.google.com',
        'google.com',
        'maps.app.goo.gl',
      ].includes(url.hostname)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
