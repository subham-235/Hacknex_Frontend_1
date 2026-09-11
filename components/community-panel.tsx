'use client';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Navigation, LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, Status } from './shared';
import { api, useApp } from './app-provider';
import { validateCoordinates } from '@/lib/api.mjs';
const Map = lazy(() => import('./community-map'));
export default function CommunityPanel() {
  const { demo, socket, notify } = useApp();
  const [sharing, setSharing] = useState(false),
    [busy, setBusy] = useState(false),
    [mounted, setMounted] = useState(false),
    [error, setError] = useState(''),
    [lat, setLat] = useState(''),
    [lon, setLon] = useState('');
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const active = useRef(false);
  const alive = useRef(true);
  const heatmap = useQuery({
    queryKey: ['heatmap', demo],
    queryFn: () => api('/incident/heatmap'),
    enabled: !demo,
    retry: false,
  });
  const points = demo
    ? [
        [22.5726, 88.3639, 3],
        [22.5802, 88.371, 2],
        [22.563, 88.35, 4],
      ]
    : heatmap.data?.heatmapPoints || [];
  useEffect(() => {
    setMounted(true);
    alive.current = true;
    return () => {
      alive.current = false;
      if (interval.current) clearInterval(interval.current);
      if (active.current && !demo)
        void api('/location/deactivate', { method: 'POST' }).catch(() => {});
    };
  }, [demo]);
  function position() {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is unavailable.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10000,
      });
    });
  }
  async function stop() {
    if (interval.current) clearInterval(interval.current);
    interval.current = null;
    active.current = false;
    setSharing(false);
    if (!demo) await api('/location/deactivate', { method: 'POST' });
  }
  async function toggleSharing() {
    setBusy(true);
    setError('');
    try {
      if (sharing) {
        await stop();
        return;
      }
      if (demo) {
        setSharing(true);
        active.current = true;
        return;
      }
      const p = await position();
      if (!alive.current) return;
      await api('/location/activate', {
        method: 'POST',
        body: {
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          socketId: socket.current?.id,
        },
      });
      if (!alive.current) {
        await api('/location/deactivate', { method: 'POST' });
        return;
      }
      active.current = true;
      setSharing(true);
      interval.current = setInterval(async () => {
        if (!active.current) return;
        try {
          const current = await position();
          if (!active.current) return;
          await api('/location/update', {
            method: 'PATCH',
            body: {
              lat: current.coords.latitude,
              lon: current.coords.longitude,
            },
          });
        } catch (e) {
          if (interval.current) clearInterval(interval.current);
          active.current = false;
          setSharing(false);
          setError(
            `Location updates stopped: ${(e as Error).message}. The backend may retain your previous active location for up to 10 minutes.`,
          );
        }
      }, 30000);
    } catch (e) {
      setError(
        `${(e as Error).message} If stopping failed, your last shared location can remain active for up to 10 minutes.`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="card location-card">
        <div className="agent-icon">
          <Navigation />
        </div>
        <div>
          <h2>Be part of a more connected community.</h2>
          <p>
            {demo
              ? 'Try sharing controls without accessing or sending your location.'
              : 'While this screen is open, update your location every 30 seconds and receive nearby SOS notifications.'}
          </p>
          <Status
            value={
              sharing ? (demo ? 'demo_sharing' : 'sharing') : 'not_sharing'
            }
          />
        </div>
        <Button disabled={busy} onClick={toggleSharing}>
          {busy
            ? 'Connecting...'
            : sharing
              ? 'Stop sharing'
              : demo
                ? 'Try demo sharing'
                : 'Enable location sharing'}
        </Button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="community-layout">
        <section className="card map-card">
          <div className="section-heading">
            <div>
              <h2>Community awareness</h2>
              <p>
                {demo
                  ? 'Illustrative incident locations in Kolkata.'
                  : 'Reported incident locations. These do not establish whether an area is safe.'}
              </p>
            </div>
            <MapPin size={20} />
          </div>
          {heatmap.isError ? (
            <p className="error">{heatmap.error.message}</p>
          ) : mounted ? (
            <Suspense
              fallback={<div className="map-placeholder">Loading map...</div>}
            >
              <Map points={points} />
            </Suspense>
          ) : (
            <div className="map-placeholder">Loading map...</div>
          )}
          <div className="map-legend">
            <span className="dot" />{' '}
            {demo
              ? 'Demo incidents'
              : `${points.length} reported incident point(s)`}
            <span>Map tiles require internet access</span>
          </div>
        </section>
        <form
          className="card"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            if (!validateCoordinates(lat, lon)) {
              setError('Enter valid latitude and longitude.');
              setBusy(false);
              return;
            }
            const data = new FormData(e.currentTarget);
            try {
              if (!demo) {
                await api('/incident/report', {
                  method: 'POST',
                  body: {
                    lat: Number(lat),
                    lon: Number(lon),
                    incidentType: data.get('incidentType'),
                    severity: Number(data.get('severity')),
                  },
                });
                await heatmap.refetch();
              }
              notify(
                demo
                  ? 'Demo report completed. No incident was published.'
                  : 'Incident reported. Thank you for contributing.',
              );
              setLat('');
              setLon('');
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="eyebrow">LOOK OUT FOR EACH OTHER</p>
          <h2>Report an incident</h2>
          <p className="fine">
            An incident report adds a map point. It does not send an emergency
            SOS.
          </p>
          <Field label="Incident type">
            <select name="incidentType">
              <option value="unsafe_area">Unsafe area</option>
              <option value="harassment">Harassment</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Severity">
            <select name="severity">
              <option value="1">1 - Low</option>
              <option value="2">2 - Moderate</option>
              <option value="3">3 - Concerning</option>
              <option value="4">4 - High</option>
              <option value="5">5 - Severe</option>
            </select>
          </Field>
          <Field label="Latitude">
            <Input
              required
              type="number"
              step="any"
              min={-90}
              max={90}
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
          </Field>
          <Field label="Longitude">
            <Input
              required
              type="number"
              step="any"
              min={-180}
              max={180}
              value={lon}
              onChange={(e) => setLon(e.target.value)}
            />
          </Field>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              try {
                const p = await position();
                setLat(String(p.coords.latitude));
                setLon(String(p.coords.longitude));
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <LocateFixed /> Use current coordinates
          </Button>
          <Button type="submit" disabled={busy}>
            {busy
              ? 'Working...'
              : demo
                ? 'Simulate report'
                : 'Submit incident report'}
          </Button>
        </form>
      </div>
    </>
  );
}
