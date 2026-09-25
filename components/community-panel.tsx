'use client';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Navigation, LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, Status } from './shared';
import { api, useApp } from './app-provider';
import { validateCoordinates, safeMapUrl } from '@/lib/api.mjs';
import { usePageVisible } from './workspace-pages';
const Map = lazy(() => import('./community-map'));
export default function CommunityPanel() {
  const visible = usePageVisible();
  const { demo, socket, notify, live, socketError, nearbyAlerts } = useApp();
  const [sharing, setSharing] = useState(false),
    [busy, setBusy] = useState(false),
    [mounted, setMounted] = useState(false),
    [error, setError] = useState(''),
    [lat, setLat] = useState(''),
    [lon, setLon] = useState('');
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const active = useRef(false);
  const [locating, setLocating] = useState(false);
  const selected: [number, number] | null = validateCoordinates(lat, lon)
    ? [Number(lat), Number(lon)]
    : null;
  function selectPlace(point: [number, number]) {
    setLat(String(point[0]));
    setLon(String(point[1]));
    setError('');
  }
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
    alive.current = visible;
    if (!visible) {
      setSharing(false);
      setBusy(false);
    }
    return () => {
      alive.current = false;
      if (interval.current) clearInterval(interval.current);
      if (active.current && !demo)
        void api('/location/deactivate', { method: 'POST' }).catch(() => {});
      active.current = false;
    };
  }, [demo, visible]);
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
      {!demo && (
        <section className="card" aria-labelledby="nearby-alerts-title">
          <h2 id="nearby-alerts-title">Nearby SOS alerts</h2>
          {nearbyAlerts.length === 0 ? (
            <p>
              No nearby SOS alerts received yet. Enable location sharing and
              keep this screen open.
            </p>
          ) : (
            nearbyAlerts.map((alert) => {
              const mapUrl = safeMapUrl(alert.mapsLink);
              return (
                <article
                  key={alert.id}
                  style={{
                    borderLeft: '4px solid #d68da8',
                    padding: '12px 16px',
                    marginTop: 12,
                  }}
                >
                  <h3>{alert.message}</h3>
                  <p>
                    {alert.distance} · {alert.severity || 'SOS'}
                  </p>
                  <p>
                    Reported{' '}
                    <time dateTime={new Date(alert.timestamp).toISOString()}>
                      {new Date(alert.timestamp).toLocaleString()}
                    </time>
                    . Current incident status is unknown.
                  </p>
                  {mapUrl && (
                    <a href={mapUrl} target="_blank" rel="noopener noreferrer">
                      Open location in Google Maps
                    </a>
                  )}
                </article>
              );
            })
          )}
        </section>
      )}
      {!demo && !live && (
        <div className="card" role="alert">
          <h2>Nearby notifications are offline</h2>
          <p>{socketError || 'Connecting to nearby alerts…'}</p>
          <p>
            Location sharing alone does not connect notifications. Wait for
            “Live updates” before testing an SOS.
          </p>
          <Button onClick={() => socket.current?.connect()}>
            Reconnect notifications
          </Button>
        </div>
      )}
      <div className="card location-card">
        <div className="agent-icon">
          <Navigation />
        </div>
        <div>
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
          <div className="report-map-hint">
            <MapPin size={18} />
            <span>Tap the map to mark a place. Drag the pin to adjust.</span>
          </div>
          {heatmap.isError && <p className="error">{heatmap.error.message}</p>}
          {mounted ? (
            <Suspense
              fallback={<div className="map-placeholder">Loading map...</div>}
            >
              <Map
                points={points}
                selected={selected}
                onSelect={selectPlace}
                disabled={busy || locating}
              />
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
              setError(
                'Choose a place on the map before submitting your report.',
              );
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
          <h2>Mark an unsafe place</h2>
          <p className="fine">
            An incident report adds a map point. It does not send an emergency
            SOS.
          </p>
          <div
            className={`report-place${selected ? ' is-selected' : ''}`}
            role="status"
          >
            <MapPin size={22} />
            <div>
              <strong>
                {selected
                  ? 'Report location selected'
                  : 'Choose a place on the map'}
              </strong>
              <p>
                {selected
                  ? 'Your purple pin marks the place you are reporting.'
                  : 'Zoom in and tap the street or place you want to report.'}
              </p>
              {selected && (
                <small>
                  {selected[0].toFixed(5)}, {selected[1].toFixed(5)}
                </small>
              )}
            </div>
            {selected && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy || locating}
                onClick={() => {
                  setLat('');
                  setLon('');
                }}
              >
                Clear
              </Button>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            disabled={busy || locating}
            onClick={async () => {
              setLocating(true);
              setError('');
              try {
                const p = await position();
                if (alive.current)
                  selectPlace([p.coords.latitude, p.coords.longitude]);
              } catch {
                if (alive.current)
                  setError(
                    'Could not find your location. Allow location access or select a place on the map.',
                  );
              } finally {
                setLocating(false);
              }
            }}
          >
            <LocateFixed />{' '}
            {locating ? 'Finding your location...' : 'Use my current location'}
          </Button>
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
          <details className="report-coordinates">
            <summary>Enter coordinates manually (optional)</summary>
            <Field label="Latitude">
              <Input
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
                type="number"
                step="any"
                min={-180}
                max={180}
                value={lon}
                onChange={(e) => setLon(e.target.value)}
              />
            </Field>
          </details>
          <Button type="submit" disabled={busy || locating || !selected}>
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
