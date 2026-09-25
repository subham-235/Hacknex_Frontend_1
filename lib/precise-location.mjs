// Wait for GPS refinement instead of uploading the first (often coarse) fix.
/** @param {Geolocation | undefined} geolocation
 * @param {{ maxAccuracy?: number, timeout?: number, signal?: AbortSignal }} options
 * @returns {Promise<GeolocationPosition>}
 */
export function preciseLocation(
  geolocation,
  { maxAccuracy = 100, timeout = 20000, signal } = {},
) {
  return new Promise((resolve, reject) => {
    if (!geolocation)
      return reject(new Error('Location is unavailable in this browser.'));
    let watch,
      settled = false,
      bestAccuracy;
    const finish = (error, point) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (watch !== undefined) geolocation.clearWatch(watch);
      signal?.removeEventListener('abort', cancel);
      if (error) reject(error);
      else resolve(point);
    };
    const cancel = () =>
      finish(new DOMException('Location request cancelled', 'AbortError'));
    const unavailable = () =>
      finish(
        new Error(
          bestAccuracy !== undefined
            ? `Your device reports location accuracy of ±${Math.ceil(bestAccuracy)} m; this action requires ±${maxAccuracy} m or better. Enable precise location in your device settings and try outdoors on a GPS-equipped phone. For a laptop demonstration, use GPS simulator.`
            : 'No precise location received. Check location permission and device location settings, then retry.',
        ),
      );
    const timer = setTimeout(unavailable, timeout);
    if (signal?.aborted) return cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      watch = geolocation.watchPosition(
        (p) => {
          const accuracy = p.coords.accuracy;
          if (
            !Number.isFinite(accuracy) ||
            accuracy < 0 ||
            Date.now() - p.timestamp > 15000
          )
            return;
          bestAccuracy = Math.min(bestAccuracy ?? Infinity, accuracy);
          if (accuracy <= maxAccuracy) finish(null, p);
        },
        (error) => {
          if (error.code === 1)
            finish(
              new Error(
                'Location permission denied. Allow precise location for this site in your browser and device settings, then retry.',
              ),
            );
          // Transient unavailable/timeout callbacks can precede a refined fix.
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout },
      );
      if (settled) geolocation.clearWatch(watch);
    } catch (error) {
      finish(error);
    }
  });
}
