'use client';
import { useEffect, useState } from 'react';
import { preciseLocation } from '@/lib/precise-location.mjs';

type ApiOptions = { method?: string; body?: unknown; timeout?: number };
type ApiRequest = (path: string, options?: ApiOptions) => Promise<unknown>;

// Owned by the provider: navigation and microphone changes cannot stop it.
export function useEmergencyLocation(sessionIds: string, api: ApiRequest) {
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!sessionIds) { setStatus(''); return; }
    const ids: string[] = JSON.parse(sessionIds);
    const controller = new AbortController();
    let busy = false;
    setStatus('Finding your live location for this SOS...');
    const sample = async () => {
      if (busy || controller.signal.aborted) return;
      busy = true;
      try {
        const config = (await api('/agent/location-config')) as {
          maxAccuracyMeters: number;
        };
        if (controller.signal.aborted) return;
        const point = await preciseLocation(navigator.geolocation, {
          maxAccuracy: config.maxAccuracyMeters, signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const results = await Promise.allSettled(ids.map(id => api(`/agent/sessions/${id}/victim/location`, {
          method: 'POST', body: {
            latitude: point.coords.latitude, longitude: point.coords.longitude,
            accuracy: point.coords.accuracy, timestamp: point.timestamp,
          },
        })));
        const failure = results.find(result => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
        if (!controller.signal.aborted) setStatus('Live location sharing is on. Microphone recording is off after SOS detection.');
      } catch (error) {
        if (!controller.signal.aborted) setStatus(`Live location update failed: ${(error as Error).message}`);
      } finally { busy = false; }
    };
    void sample();
    const timer = setInterval(() => void sample(), 15000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [sessionIds, api]);
  return status;
}
