'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api, useApp } from './app-provider';
import { Status } from './shared';
import { preciseLocation } from '@/lib/precise-location.mjs';
import { usePageVisible } from './workspace-pages';
import {
  Navigation,
  MapPin,
  ShieldCheck,
  BellRing,
  Radio,
  ArrowUpRight,
  Check,
  LocateFixed,
} from 'lucide-react';

type Point = {
  latitude: number;
  longitude: number;
  observedAt?: string;
  fresh?: boolean;
  ageSeconds?: number;
};
type Tracking = {
  distanceMeters: number;
  estimatedEtaSeconds: number | null;
  zone: string;
  fresh: boolean;
  lastUpdatedAt: string;
};
type Request = {
  sessionId: string;
  status: string;
  assigned: boolean;
  request?: {
    status: string;
    distanceAtNotification: number;
    expiresAt: string;
  };
  victimLocation?: Point;
  responder?: { currentStatus: string };
  tracking?: Tracking;
};
const events = [
  'responder-request-created',
  'responder-assigned',
  'responder-location-updated',
  'responder-arrived',
  'responder-nearby',
  'emergency-radius-expanded',
  'agent-session-updated',
  'journey-updated',
  'journey-checkin-required',
  'journey-deviation-detected',
];
export function useGeoRefresh() {
  const { socket, live } = useApp();
  const cache = useQueryClient();
  useEffect(() => {
    const connection = socket.current;
    const refresh = () => {
      void cache.invalidateQueries({ queryKey: ['coordination'] });
    };
    events.forEach((e) => connection?.on(e, refresh));
    connection?.on('connect', refresh);
    return () => {
      events.forEach((e) => connection?.off(e, refresh));
      connection?.off('connect', refresh);
    };
  }, [socket, live, cache]);
}
export async function currentPosition(
  signal?: AbortSignal,
  options: {
    maxAccuracyMeters?: number;
    timeout?: number;
    journeyAccuracy?: boolean;
  } = {},
): Promise<GeolocationPosition> {
  const config = await api('/agent/location-config');
  return preciseLocation(navigator.geolocation, {
    maxAccuracy:
      options.maxAccuracyMeters ??
      (options.journeyAccuracy
        ? config.journeyMaxAccuracyMeters
        : config.maxAccuracyMeters),
    timeout: options.timeout,
    signal,
  }) as Promise<GeolocationPosition>;
}
export const payload = (p: GeolocationPosition) => ({
  latitude: p.coords.latitude,
  longitude: p.coords.longitude,
  accuracy: p.coords.accuracy,
  timestamp: p.timestamp,
});
export function LocationSharing({
  path,
  active,
  method = 'POST',
  initialSentAt = 0,
  autoStart = false,
  journeyAccuracy = false,
}: {
  path: string;
  active: boolean;
  method?: string;
  initialSentAt?: number;
  autoStart?: boolean;
  journeyAccuracy?: boolean;
}) {
  const [sharing, setSharing] = useState(autoStart),
    [error, setError] = useState(''),
    [confirmed, setConfirmed] = useState(false);
  const visible = usePageVisible();
  useEffect(() => {
    if (!visible) {
      setSharing(false);
      setConfirmed(false);
    }
  }, [visible]);
  const lastSent = useRef(initialSentAt);
  useEffect(() => {
    lastSent.current = Math.max(lastSent.current, initialSentAt);
  }, [initialSentAt]);
  useEffect(() => {
    if (!sharing || !active || !visible) return;
    let stopped = false,
      busy = false;
    const controller = new AbortController();
    setConfirmed(false);
    const sample = async () => {
      if (busy || stopped) return;
      busy = true;
      try {
        const p = await currentPosition(controller.signal, { journeyAccuracy });
        if (stopped || Date.now() - lastSent.current < 10000) return;
        lastSent.current = Date.now();
        await api(path, { method, body: payload(p) });
        if (!stopped) {
          setError('');
          setConfirmed(true);
        }
      } catch (e) {
        if (!stopped) {
          setError((e as Error).message);
          setConfirmed(false);
          if ([403, 404].includes((e as { status?: number }).status || 0))
            setSharing(false);
        }
      } finally {
        busy = false;
      }
    };
    void sample();
    const timer = setInterval(() => void sample(), 15000);
    return () => {
      stopped = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [sharing, active, path, method, visible, journeyAccuracy]);
  return (
    <div>
      <Button
        variant="outline"
        disabled={!active}
        onClick={() => {
          if (!navigator.geolocation) {
            setError('Location unavailable');
            return;
          }
          setError('');
          setConfirmed(false);
          setSharing(!sharing);
        }}
      >
        {sharing && active
          ? confirmed
            ? 'Stop sharing location'
            : 'Cancel GPS search'
          : 'Share live location'}
      </Button>
      <p className="fine">
        {!sharing && active && 'Live location sharing is paused. '}
        {sharing && active && confirmed && 'Live location updates are on. '}
        {sharing &&
          active &&
          !confirmed &&
          !error &&
          'Waiting for a precise GPS fix. No location has been shared yet. '}
        Keep this screen open to share. Sharing stops when you leave this
        screen.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
function Distance({ tracking }: { tracking?: Tracking }) {
  return tracking ? (
    <p>
      {tracking.distanceMeters} m away ·{' '}
      {tracking.estimatedEtaSeconds !== null
        ? `Estimated ${Math.ceil(tracking.estimatedEtaSeconds / 60)} min`
        : 'ETA unavailable: location stale'}{' '}
      · {tracking.zone.replaceAll('_', ' ')}
      <br />
      <small>
        Updated {new Date(tracking.lastUpdatedAt).toLocaleTimeString()}
      </small>
    </p>
  ) : (
    <p>Waiting for fresh location updates.</p>
  );
}
export function ResponderPanel() {
  const visible = usePageVisible();
  const { demo, user, notify, live } = useApp();
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [activatedAt, setActivatedAt] = useState(0);
  const [deviceAccuracy, setDeviceAccuracy] = useState<number | null>(null);
  const activation = useRef<AbortController | null>(null);
  useEffect(() => () => activation.current?.abort(), []);
  useEffect(() => {
    if (!visible) activation.current?.abort();
  }, [visible]);
  useGeoRefresh();
  const query = useQuery({
    queryKey: ['coordination', 'requests', user?._id],
    enabled: !demo && !!user,
    queryFn: async () =>
      (await api('/agent/responder-requests')).requests as Request[],
    refetchInterval: 10000,
  });
  const act = async (id: string, action: string, status?: string) => {
    setBusy(true);
    try {
      await api(`/agent/sessions/${id}/${action}`, {
        method: 'POST',
        body: status ? { status } : undefined,
      });
      await query.refetch();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="responder-workspace" aria-label="Help people nearby">
      {demo ? (
        <div className="card responder-demo">
          <ShieldCheck size={28} />
          <div>
            <h2>Be there for someone nearby</h2>
            <p>
              Sign in to receive real requests for help. To try a rescue with
              simulated locations, open the GPS simulator after signing in.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="responder-status-strip" aria-label="Responder status summary">
            <div className={available ? 'active' : ''}><LocateFixed size={16} /><span><small>AVAILABILITY</small><strong>{available ? 'Ready nearby' : 'Currently offline'}</strong></span></div>
            <div><BellRing size={16} /><span><small>REQUESTS</small><strong>{query.data?.length || 0} nearby</strong></span></div>
            <div className={live ? 'active' : ''}><Radio size={16} /><span><small>NETWORK</small><strong>{live ? 'Live updates on' : 'Reconnecting'}</strong></span></div>
          </div>
          <div className="responder-main">
            <article
              className={`responder-availability ${available ? 'is-available' : ''}`}
            >
              <div className="responder-card-top">
                <span className="responder-icon">
                  <Navigation size={23} />
                </span>
                <span
                  className={`responder-pill ${available ? 'positive' : ''}`}
                >
                  {available ? (
                    <Check size={13} />
                  ) : (
                    <span className="responder-status-dot" />
                  )}
                  {available ? 'Location registered' : 'Not available yet'}
                </span>
              </div>
              <p className="responder-kicker">RESPONDER MODE</p>
              <h2>
                {available
                  ? 'You’re ready to help nearby.'
                  : 'Make yourself available nearby.'}
              </h2>
              <p className="responder-intro">
                {available
                  ? 'Keep your location updated so people nearby can find you when they need help.'
                  : 'Turn on your availability to receive SOS requests from people near you. You choose which requests to accept.'}
              </p>
              <div className="responder-availability-actions">
                <Button
                  className="responder-primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setLocationError('');
                    const controller = new AbortController();
                    activation.current = controller;
                    try {
                      const p = await currentPosition(controller.signal);
                      if (controller.signal.aborted) return;
                      await api('/location/activate', {
                        method: 'POST',
                        body: payload(p),
                      });
                      setAvailable(true);
                      setActivatedAt(Date.now());
                      setDeviceAccuracy(p.coords.accuracy);
                      notify(
                        'Available for nearby requests. Keep community location sharing active.',
                      );
                    } catch (e) {
                      if (controller.signal.aborted) return;
                      setAvailable(false);
                      setLocationError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <LocateFixed size={18} className={busy ? 'spin' : ''} />
                  {busy
                    ? 'Finding your location…'
                    : available
                      ? 'Update my location'
                      : 'Turn on availability'}
                  {!busy && <ArrowUpRight size={17} />}
                </Button>
                <span className="responder-privacy">
                  <ShieldCheck size={14} />
                  Your browser will ask for location access
                </span>
              </div>
              {available && deviceAccuracy !== null && (
                <div role="status" className="responder-location-quality">
                  <MapPin size={17} />
                  <div>
                    <strong>
                      Location accuracy: ±{Math.ceil(deviceAccuracy)} m
                    </strong>
                    <p>
                      {deviceAccuracy > 100
                        ? 'Approximate location. Distances may vary; arrival needs confirmation.'
                        : 'Location received. Keep updates on while you are available.'}
                    </p>
                  </div>
                </div>
              )}
              {locationError && (
                <p role="alert" className="error">
                  {locationError}
                </p>
              )}
              {available && (
                <div className="responder-live-control">
                  <div>
                    <Radio size={17} />
                    <strong>Keep your location up to date</strong>
                  </div>
                  <LocationSharing
                    path="/location/update"
                    method="PATCH"
                    active={!demo && available}
                    initialSentAt={activatedAt}
                  />
                </div>
              )}
            </article>
            <section
              className="responder-inbox"
              aria-labelledby="responder-inbox-title"
            >
              <div className="responder-inbox-heading">
                <div>
                  <h2 id="responder-inbox-title">
                    Requests for help{' '}
                    <span className="responder-count">
                      {query.data?.length || 0}
                    </span>
                  </h2>
                  <p>Nearby SOS requests will appear here.</p>
                </div>
                <span
                  className={`responder-connection ${live ? 'connected' : ''}`}
                >
                  <span className="responder-status-dot" />
                  {live ? 'Live updates' : 'Checking for updates'}
                </span>
              </div>
              {query.isLoading && <p>Loading requests…</p>}
              {query.error && <p className="error">{query.error.message}</p>}
              {!query.isLoading && query.data?.length === 0 && (
                <div className="responder-empty">
                  <span className="responder-empty-icon">
                    <BellRing size={28} strokeWidth={1.5} />
                  </span>
                  <h3>No requests right now</h3>
                  <p>
                    {available
                      ? 'Your inbox is clear. New requests will appear here automatically when someone nearby needs help.'
                      : 'Turn on your availability above. When someone nearby asks for help, their request will appear here.'}
                  </p>
                  <span className="responder-empty-note">
                    <ShieldCheck size={14} />
                    You are always free to accept or decline.
                  </span>
                </div>
              )}
              {query.data?.map((r) => (
                <article
                  className="action-card responder-request"
                  key={r.sessionId}
                >
                  <div className="responder-request-head">
                    <span className="responder-request-icon"><BellRing size={17} /></span>
                    <div><small>REQUEST {r.sessionId.slice(-6).toUpperCase()}</small><h3>{r.assigned ? 'You are the assigned responder' : 'Emergency nearby'}</h3></div>
                    <Status value={r.assigned ? r.responder?.currentStatus || 'assigned' : r.request?.status || r.status} />
                  </div>
                  <div className="responder-request-distance"><Navigation size={15} /><span><strong>{r.request?.distanceAtNotification} m</strong><small>Distance when notified</small></span></div>
                  {r.request?.status === 'pending' && (
                    <div className="actions">
                      <Button
                        disabled={busy}
                        onClick={() => act(r.sessionId, 'responders/accept')}
                      >
                        Accept &amp; help
                      </Button>
                      <Button
                        disabled={busy}
                        variant="outline"
                        onClick={() => act(r.sessionId, 'responders/decline')}
                      >
                        Cannot help
                      </Button>
                    </div>
                  )}
                  {r.request?.status === 'accepted' && !r.assigned && (
                    <p>
                      You accepted. Another responder may be primary; await
                      assignment.
                    </p>
                  )}
                  {r.assigned && (
                    <>
                      <Distance tracking={r.tracking} />
                      {r.victimLocation && (
                        <p>
                          <a
                            className="text-link"
                            target="_blank"
                            rel="noreferrer"
                            href={`https://maps.google.com/?q=${r.victimLocation.latitude},${r.victimLocation.longitude}`}
                          >
                            Open victim location ↗
                          </a>{' '}
                          ·{' '}
                          {r.victimLocation.fresh
                            ? 'Recent location'
                            : `Last known, ${Math.round(r.victimLocation.ageSeconds || 0)} seconds old`}
                        </p>
                      )}
                      <LocationSharing
                        path={`/agent/sessions/${r.sessionId}/responder/location`}
                        active={r.responder?.currentStatus !== 'completed'}
                      />
                      <div className="actions">
                        {['assigned', 'nearby'].includes(
                          r.responder?.currentStatus || '',
                        ) && (
                          <Button
                            disabled={busy}
                            onClick={() =>
                              act(r.sessionId, 'responder/status', 'en_route')
                            }
                          >
                            I’m on the way
                          </Button>
                        )}
                        {['assigned', 'en_route', 'nearby'].includes(
                          r.responder?.currentStatus || '',
                        ) && (
                          <Button
                            disabled={busy}
                            onClick={() =>
                              act(r.sessionId, 'responder/status', 'arrived')
                            }
                          >
                            I have arrived
                          </Button>
                        )}
                        {r.responder?.currentStatus === 'arrived' && (
                          <Button
                            disabled={busy}
                            onClick={() =>
                              act(r.sessionId, 'responder/status', 'completed')
                            }
                          >
                            Assistance completed
                          </Button>
                        )}
                        {r.responder?.currentStatus !== 'completed' && (
                          <Button
                            disabled={busy}
                            variant="outline"
                            onClick={() =>
                              act(r.sessionId, 'responder/status', 'cancelled')
                            }
                          >
                            Cannot continue
                          </Button>
                        )}
                      </div>
                      <p className="fine">
                        Arrival and completed assistance do not resolve the
                        incident. The owner closes it.
                      </p>
                    </>
                  )}
                </article>
              ))}
            </section>
          </div>
          <aside className="responder-guide">
            <p className="responder-guide-label">RESPONDER PLAYBOOK</p>
            <div className="responder-guide-heading">
              <ShieldCheck size={21} />
              <h2>How helping works</h2>
            </div>
            <ol className="responder-steps">
              <li>
                <span>1</span>
                <div>
                  <h3>Make yourself available</h3>
                  <p>
                    Share your location so we can find requests close to you.
                  </p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <h3>Choose a request</h3>
                  <p>
                    Check the distance and accept only if you can help safely.
                  </p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <h3>Let them know you’re coming</h3>
                  <p>Once assigned, open directions and share your progress.</p>
                </div>
              </li>
            </ol>
            <div className="responder-safety-note">
              <strong>Your safety comes first</strong>
              <p>
                Do not enter a dangerous situation. For an immediate emergency,
                call <a href="tel:112">112</a>.
              </p>
            </div>
            <div className="responder-demo-link">
              <p>Just trying things out?</p>
              <a href="#simulator">
                Explore the GPS simulator <ArrowUpRight size={15} />
              </a>
              <small>Practice with clearly labelled simulated locations.</small>
            </div>
          </aside>
        </>
      )}
    </section>
  );
}
export function OwnerCoordination({
  session,
}: {
  session: import('@/lib/models').Session;
}) {
  const { demo, locationStatus } = useApp();
  const active =
    !['resolved', 'expired'].includes(session.status) &&
    (!session.expiresAt || +new Date(session.expiresAt) > Date.now());
  const responderCount = session.nearbyResponderRequests?.length || 0;
  const responderState = session.activeResponder
    ? session.activeResponder.currentStatus.replaceAll('_', ' ')
    : 'Searching for help';
  return (
    <article className="card rescue-progress-card">
      <header className="rescue-progress-header">
        <div className="rescue-progress-title">
          <span className="rescue-progress-icon"><BellRing size={19} /></span>
          <div><p className="eyebrow">LIVE COORDINATION</p><h2>Rescue progress</h2></div>
        </div>
        <Status value={session.escalationState || 'searching'} />
      </header>
      <div className="rescue-progress-state">
        <span className={`rescue-live-indicator ${session.activeResponder ? 'confirmed' : ''}`}><i /></span>
        <div>
          <p>{session.activeResponder ? 'Responder connected' : 'Looking for nearby responders'}</p>
          <strong>{responderState}</strong>
          {session.activeResponder && <small>Responder {session.activeResponder.userId}</small>}
        </div>
      </div>
      <div className="rescue-progress-metrics">
        <div><span>SEVERITY</span><strong>{session.severity}</strong></div>
        <div><span>CONFIDENCE</span><strong>{session.distressConfidence ?? '—'}%</strong></div>
        <div><span>NOTIFIED</span><strong>{responderCount}</strong><small>responder{responderCount === 1 ? '' : 's'}</small></div>
      </div>
      <div className="rescue-radius">
        <div><span>Search radius</span><strong>Stage {session.escalationStage || 0}</strong></div>
        <div className="rescue-radius-track" aria-label={`Search radius stage ${session.escalationStage || 0}`}>
          {[1, 2, 3].map(stage => <i key={stage} className={(session.escalationStage || 0) >= stage ? 'active' : ''} />)}
        </div>
      </div>
      <div className="rescue-distance"><LocateFixed size={15} /><Distance tracking={session.responderTracking || undefined} /></div>
      {session.latestVictimLocation && (
        <div className="rescue-location">
          <MapPin size={17} />
          <div>
            <span>{session.latestVictimLocation.fresh ? 'Current victim location' : 'Last known victim location'}</span>
            <strong>{session.latestVictimLocation.latitude.toFixed(5)}, {session.latestVictimLocation.longitude.toFixed(5)}</strong>
            <small>Observed {new Date(session.latestVictimLocation.observedAt || '').toLocaleString()}</small>
          </div>
        </div>
      )}
      {session.geoRiskSignals?.length ? (
        <div className="rescue-risk-signals">{session.geoRiskSignals.map(signal => <span key={signal}>{signal.replaceAll('_', ' ')}</span>)}</div>
      ) : null}
      {!demo && active && (
        <p role="status" className="rescue-location-status"><Radio size={13} />{locationStatus} Location updates continue while the app stays open.</p>
      )}
    </article>
  );
}
