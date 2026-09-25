'use client';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, useApp } from './app-provider';
import { Button } from './ui/button';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Radio,
  ShieldCheck,
  Navigation,
  Route,
  Radar,
  Check,
  ChevronRight,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
} from 'lucide-react';
import { scenarios } from '@/lib/demo-scenarios.mjs';
import { usePageVisible } from './workspace-pages';
const Map = lazy(() => import('./simulator-map'));
type Point = { latitude: number; longitude: number };
type DemoSnapshot = {
  run: {
    _id: string;
    clock: string | number;
    checkInWallDeadline?: string | null;
    previousCenter?: Point;
    liveSmsResult?: { accepted: number; failed: number };
  };
  route: Point[];
  config: { tolerance: number; destinationRadius: number };
  routeDistanceMeters?: number | null;
  outsideSeconds?: number;
  session?: {
    status?: string;
    escalationStage?: number;
    latestVictimLocation?: Point;
    emergencyGeofence?: { center: Point; radiusMeters: number };
    responderTracking?: { fresh: boolean; distanceMeters: number };
    activeResponder?: { currentStatus?: string; lastLocation?: Point };
  } | null;
  journey?: {
    open?: boolean;
    sosState?: string;
    checkInState?: string;
    routeDeviationDetected?: boolean;
    destinationReached?: boolean;
    currentLocation: Point;
    outsideSamples?: number;
  } | null;
};
const groups = [
  [
    'Victim & journey',
    [
      ['start', 'Set Start Position'],
      ['safe', 'Move Along Safe Route'],
      ['deviation', 'Simulate Route Deviation'],
      ['noise', 'Simulate GPS Noise'],
      ['checkin-safe', 'Confirm I Am Safe'],
      ['checkin-wait', 'Advance Check-in Halfway'],
      ['checkin-timeout', 'Simulate Unanswered Deadline'],
      ['victim-300', 'Move Victim 300m'],
      ['victim-700', 'Move Victim 700m'],
      ['near-destination', 'Move Near Destination'],
      ['destination', 'Enter Destination'],
    ],
  ],
  [
    'Responder',
    [
      ['responder-900', 'Start 900m Away'],
      ['responder-500', 'Move To 500m'],
      ['responder-250', 'Move To 250m'],
      ['responder-80', 'Move To 80m'],
      ['responder-15', 'Move To 15m'],
      ['confirm-arrival', 'Confirm Arrival'],
    ],
  ],
  [
    'Emergency',
    [
      ['emergency', 'Start Emergency'],
      ['no-responder', 'Simulate No Responder'],
      ['expand', 'Trigger Radius Expansion'],
      ['accept', 'Simulate Responder Accept'],
      ['resolve', 'Resolve Incident'],
      ['reset', 'RESET DEMO'],
    ],
  ],
] as const;
const coordinates = (p?: Point | null) =>
  p ? `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}` : '—';
export default function LocationSimulator() {
  const visible = usePageVisible();
  const sequenceEpoch = useRef(0);
  const mutation = useRef(false);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [needsReplay, setNeedsReplay] = useState(false);
  const scenario = scenarios[scenarioIndex];
  useEffect(() => {
    if (!presenting) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPresenting(false);
    };
    window.addEventListener('keydown', escape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', escape);
    };
  }, [presenting]);
  useEffect(() => {
    if (!visible) {
      sequenceEpoch.current++;
      setPlaying(false);
      setPresenting(false);
    }
  }, [visible]);
  const { user, demo, socket, live } = useApp();
  const [data, setData] = useState<DemoSnapshot | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [liveSmsAvailable, setLiveSmsAvailable] = useState(false);
  const [liveSmsEnabled, setLiveSmsEnabled] = useState(false);
  const [checking, setChecking] = useState(false);
  const [availabilityCheck, setAvailabilityCheck] = useState(0);
  const stop = useRef(false);
  const id = data?.run._id;
  const [wallNow, setWallNow] = useState(Date.now);
  const attemptedDeadline = useRef('');
  const deadline = data?.journey?.open && data?.journey?.checkInState === 'pending' ? data?.run.checkInWallDeadline : null;
  useEffect(() => {
    if (!deadline || !visible) return;
    setWallNow(Date.now());
    const timer = setInterval(() => setWallNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline, visible]);
  useEffect(() => {
    if (!deadline || !visible || !enabled || busy || mutation.current || scenario.id !== 'journey') return;
    const remaining = new Date(deadline).getTime() - wallNow;
    if (remaining > 0) {
      if (remaining <= 5000) setCursor(scenario.steps.findIndex(step => step.action === 'checkin-wait'));
      return;
    }
    const key = `${id}:${deadline}`;
    if (attemptedDeadline.current === key) return;
    attemptedDeadline.current = key;
    mutation.current = true;
    const epoch = ++sequenceEpoch.current;
    setBusy('Submitting simulated SOS');
    void api(`/demo/sessions/${id}/scenario`, {
      method: 'POST',
      body: {
        action: 'checkin-tick',
        sendRealSms: liveSmsEnabled,
        demoSmsConfirmation: liveSmsEnabled ? 'SEND DEMO SMS' : undefined,
      },
    })
      .then(next => {
        if (stop.current || sequenceEpoch.current !== epoch) return;
        setData(next);
        if (next.journey?.sosState === 'accepted') setCursor(scenario.steps.length - 1);
        else attemptedDeadline.current = ''; // Server clock may be behind this browser.
      })
      .catch((e: Error) => { setError(e.message); setNeedsReplay(true); })
      .finally(() => { mutation.current = false; setBusy(''); });
  }, [deadline, wallNow, visible, enabled, busy, id, scenario, liveSmsEnabled]);
  useEffect(() => {
    stop.current = false;
    let active = true;
    if (user && !demo) {
      setChecking(true);
      setEnabled(false);
      setError('');
      api('/demo/config')
        .then(config => {
          if (config.demoVersion !== 2) throw new Error('The backend is running an older demo version. Restart the backend, then click Retry connection to load the 10-second demo.');
          if (active) {
            setEnabled(true);
            setLiveSmsAvailable(Boolean(config.liveSmsAvailable));
          }
        })
        .catch((e: Error & { status?: number }) => {
          if (active)
            setError(
              e.status === 404
                ? 'GPS simulator is unavailable on the backend. Set ENABLE_DEMO_MODE=true in backend/.env, restart the backend, then click Retry connection. If it is already enabled, sign in again.'
                : e.message,
            );
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    }
    return () => {
      active = false;
      stop.current = true;
    };
  }, [user, demo, availabilityCheck]);
  useEffect(() => {
    if (!id || !visible) return;
    let active = true;
    const refresh = () => {
      if (mutation.current) return;
      const epoch = sequenceEpoch.current;
      return api(`/demo/sessions/${id}`)
        .then((d) => {
          if (active && !mutation.current && epoch === sequenceEpoch.current)
            setData(d);
        })
        .catch((e: Error) => {
          if (active && !mutation.current) setError(e.message);
        });
    };
    const connection = socket.current;
    connection?.on('demo-updated', refresh);
    const timer = setInterval(refresh, 3000);
    return () => {
      active = false;
      clearInterval(timer);
      connection?.off('demo-updated', refresh);
    };
  }, [id, socket, live, visible]);
  async function action(name: string, extra = {}) {
    const next = await api(`/demo/sessions/${id}/scenario`, {
      method: 'POST',
      body: {
        action: name,
        sendRealSms: liveSmsEnabled,
        demoSmsConfirmation: liveSmsEnabled ? 'SEND DEMO SMS' : undefined,
        ...extra,
      },
    });
    if (!stop.current) setData(next);
    return next;
  }
  async function run(name: string) {
    if (mutation.current) return;
    mutation.current = true;
    sequenceEpoch.current++;
    if (name !== 'checkin-safe') setCursor(-1);
    setPlaying(false);
    setBusy(name);
    setError('');
    try {
      await action(name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      mutation.current = false;
      setBusy('');
    }
  }
  async function present(auto: boolean, restart = false) {
    if (mutation.current) return;
    mutation.current = true;
    const epoch = ++sequenceEpoch.current;
    const start =
      restart || needsReplay || cursor >= scenario.steps.length - 1
        ? 0
        : cursor + 1;
    if (start === 0) setCursor(-1);
    setPlaying(auto);
    setNeedsReplay(false);
    setError('');
    setBusy('Preparing demo');
    try {
      let runId = id;
      if (!runId) {
        const opened = await api('/demo/sessions', { method: 'POST' });
        if (stop.current) return;
        setData(opened);
        runId = opened.run._id;
      }
      for (let i = start; i < scenario.steps.length; i++) {
        if (stop.current || sequenceEpoch.current !== epoch) break;
        const step = scenario.steps[i];
        setBusy(step.title);
        const next = await api(`/demo/sessions/${runId}/scenario`, {
          method: 'POST',
          body: {
            action: step.action,
            sendRealSms: liveSmsEnabled,
            demoSmsConfirmation: liveSmsEnabled ? 'SEND DEMO SMS' : undefined,
          },
        });
        if (stop.current) break;
        setData(next);
        setCursor(i);
        if (!auto || ('pauseAfter' in step && step.pauseAfter)) break;
        if (i < scenario.steps.length - 1)
          await new Promise((resolve) => setTimeout(resolve, 2400));
      }
    } catch (e) {
      setError(
        `${(e as Error).message} Replay the story to restart from a clean demo.`,
      );
      setNeedsReplay(true);
    } finally {
      mutation.current = false;
      setBusy('');
      setPlaying(false);
    }
  }
  if (demo || !user)
    return (
      <article className="card">
        <h2>Your rescue demo is waiting</h2>
        <p>
          Sign in to run the interactive GPS simulation. No real SOS messages
          are sent.
        </p>
      </article>
    );
  const s = data?.session,
    j = data?.journey,
    t = s?.responderTracking;
  const journeyStory = scenario.id === 'journey';
  const checkInDeadline = data?.run.checkInWallDeadline;
  const checkedIn = journeyStory && j?.checkInState === 'safe' && !j?.open;
  const pendingCheck = journeyStory && j?.open && j?.checkInState === 'pending';
  const checkSeconds = pendingCheck && checkInDeadline
    ? Math.max(
        0,
        Math.ceil((new Date(checkInDeadline).getTime() - wallNow) / 1000),
      )
    : 0;
  const checkTime = `${Math.floor(checkSeconds / 60)}:${String(checkSeconds % 60).padStart(2, '0')}`;
  const step = cursor >= 0 ? scenario.steps[cursor] : null;
  const finished = cursor === scenario.steps.length - 1;
  const state = checkedIn
    ? 'Safety confirmed — journey ended'
    : journeyStory && j?.sosState === 'accepted'
      ? 'Automatic SOS simulated'
      : s?.status === 'resolved'
        ? 'Incident resolved'
        : s?.activeResponder?.currentStatus === 'arrived'
          ? 'Arrival confirmed'
          : s?.activeResponder
            ? 'Help is on the way'
            : s
              ? 'Searching for help'
              : j?.routeDeviationDetected
                ? 'Safety check required'
                : j
                  ? 'Journey being monitored'
                  : 'Ready to demonstrate';
  const metric = t?.fresh ? `${t.distanceMeters}` : '?';
  const canPlay = enabled && !busy;
  const canAdvance = canPlay && !pendingCheck;
  const content = (
    <section
      className={`sim-stage ${presenting ? 'sim-presenting' : ''}`}
      aria-label="Interactive rescue demonstration"
    >
      <header className="sim-topline">
        <span className="sim-demo-label">
          <span /> {liveSmsEnabled ? 'SIMULATION · LIVE DEMO SMS ENABLED' : 'SIMULATION · NO REAL SOS SENT'}
        </span>
        <div className="sim-top-actions">
          <span className="sim-connection">
            <Radio size={13} />
            {enabled
              ? 'Backend connected'
              : checking
                ? 'Connecting?'
                : 'Connection needed'}
          </span>
          <button
            className="sim-icon-button"
            aria-label={
              presenting ? 'Exit presentation view' : 'Open presentation view'
            }
            aria-pressed={presenting}
            onClick={() => setPresenting(!presenting)}
          >
            {presenting ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </header>
      <div className="sim-intro">
        <div>
          <p className="sim-kicker">THE MOMENT THAT MATTERS</p>
          <h1>
            From a signal.
            <br />
            <span>To someone by your side.</span>
          </h1>
        </div>
        <p>
          Watch Suraksha find help, follow its approach, and confirm arrival.
          You control the story.
        </p>
      </div>
      <div className="sim-scenarios" aria-label="Choose a demo story">
        {scenarios.map((item, i) => {
          const Icon = [ShieldCheck, Route, Radar][i];
          return (
            <button
              key={item.id}
              className={`sim-scenario ${scenarioIndex === i ? 'selected' : ''}`}
              disabled={!!busy}
              aria-pressed={scenarioIndex === i}
              onClick={() => {
                setScenarioIndex(i);
                setCursor(-1);
                setNeedsReplay(false);
                setData(null);
                setError('');
              }}
            >
              <span className="sim-scenario-icon">
                <Icon size={20} />
              </span>
              <span>
                <small>
                  0{i + 1} / {item.tag}
                </small>
                <strong>{item.title}</strong>
              </span>
              <ChevronRight size={18} />
            </button>
          );
        })}
      </div>
      {error && (
        <div className="sim-error" role="alert">
          {error}
        </div>
      )}
      {!enabled && (
        <div className="sim-setup">
          <p>
            {checking
              ? 'Connecting to your demo environment?'
              : 'The simulator needs a connection before it can run.'}
          </p>
          <Button
            variant="outline"
            disabled={checking}
            onClick={() => setAvailabilityCheck((v) => v + 1)}
          >
            Retry connection
          </Button>
        </div>
      )}
      {enabled && (
        <div className={`sim-sms-mode ${liveSmsEnabled ? 'enabled' : ''}`}>
          <div>
            <strong>Send a labelled demo SMS to my trusted contacts</strong>
            <p>
              {liveSmsAvailable
                ? 'When the story triggers SOS, each active SMS contact receives one message clearly marked “NO REAL EMERGENCY”. Replaying cannot resend it until the demo is reset.'
                : 'Live demo SMS is unavailable. Configure Twilio and ENABLE_DEMO_SMS=true, then restart the backend.'}
            </p>
          </div>
          <label className="sim-sms-toggle">
            <input
              type="checkbox"
              checked={liveSmsEnabled}
              disabled={!liveSmsAvailable || Boolean(busy)}
              onChange={(event) => {
                if (!event.target.checked) {
                  setLiveSmsEnabled(false);
                  return;
                }
                const accepted = window.confirm(
                  'Send a clearly labelled Suraksha DEMO SMS to every active SMS trusted contact when this story triggers SOS?',
                );
                setLiveSmsEnabled(accepted);
              }}
            />
            <span>{liveSmsEnabled ? 'Live SMS on' : 'Live SMS off'}</span>
          </label>
          {data?.run.liveSmsResult && (
            <span className="sim-sms-result" role="status">
              {data.run.liveSmsResult.accepted} accepted · {data.run.liveSmsResult.failed} failed
            </span>
          )}
        </div>
      )}
      <div className="sim-workspace">
        <article className="sim-map-card">
          <div className="sim-map-heading">
            <div>
              <span className="sim-kicker">LIVE SCENARIO MAP</span>
              <h3>{state}</h3>
            </div>
            <span className="sim-map-pill">Kolkata · Simulated GPS</span>
          </div>
          <div className="sim-map-surface">
            {data ? (
              <Suspense
                fallback={<div className="sim-map-empty">Loading the map?</div>}
              >
                <Map data={data} />
              </Suspense>
            ) : (
              <div className="sim-map-empty">
                <span className="sim-empty-icon">
                  <Navigation size={35} />
                </span>
                <h3>
                  {journeyStory
                    ? 'Off route. Check in. Get help.'
                    : 'One click. The whole rescue.'}
                </h3>
                <p>
                  {journeyStory
                    ? 'See the safety check, try the safe response, or let the simulated deadline trigger SOS.'
                    : 'Start the guided demo to bring the map to life.'}
                  <br />
                  Every step runs through the backend.{' '}
                  {liveSmsEnabled ? 'Your confirmed demo SMS setting is active.' : 'No real SMS is sent.'}
                </p>
                <Button
                  disabled={!canPlay}
                  onClick={() => void present(true, true)}
                >
                  <Play size={16} /> {busy || 'Start guided demo'}
                </Button>
              </div>
            )}
            {data && (
              <div className="sim-map-caption">
                <span className="sim-live-dot" />
                {checkedIn
                  ? 'Journey ended safely'
                  : journeyStory && j?.sosState === 'accepted'
                    ? 'Last known location attached to the simulated SOS'
                    : pendingCheck
                      ? 'Off route — waiting for a safety check-in'
                      : s?.activeResponder
                        ? 'Following the responder’s approach'
                        : j
                          ? 'Monitoring the planned route'
                          : 'Waiting for a scenario'}
              </div>
            )}
          </div>
          <div className="sim-map-legend">
            <span>
              <i className="victim-dot" /> Person needing help
            </span>
            <span>
              <i className="responder-dot" /> Responder
            </span>
            <span>
              <i className="route-dot" /> Safe route
            </span>
            <span className="sim-map-note">Distances are estimates</span>
          </div>
          {journeyStory && j && (
            <div className="sim-journey-check" role="status">
              <strong>
                {checkedIn
                  ? 'You checked in safely'
                  : j.sosState === 'accepted'
                    ? 'Simulated SOS accepted'
                    : pendingCheck
                      ? 'Are you safe?'
                      : 'Watching your planned route'}
              </strong>
              <p>
                {checkedIn
                  ? 'Monitoring ended before escalation. No automatic SOS was created.'
                  : j.sosState === 'accepted'
                    ? 'One demo contact alert was accepted. This is simulated submission, not real delivery or confirmed help.'
                    : pendingCheck
                      ? 'Confirm safety to stop escalation, or continue the story to demonstrate an unanswered check-in.'
                      : 'A sustained departure starts the safety check. A brief GPS drift does not immediately send SOS.'}
              </p>
              {pendingCheck && (
                <>
                  <div className="sim-check-clock">
                    {checkTime}
                    <small>seconds remaining before simulated SOS</small>
                  </div>
                  <Button
                    disabled={!canPlay}
                    onClick={() => {
                      setNeedsReplay(true);
                      void run('checkin-safe');
                    }}
                  >
                    <ShieldCheck size={16} /> I’m safe — end demo journey
                  </Button>
                </>
              )}
              <p className="fine">
                This demo uses a live 10-second countdown. Keep this page open.
                Real journey timing is unchanged (5 minutes by default).
              </p>
            </div>
          )}
          <div className="sim-metrics">
            {journeyStory ? (
              <>
                <div>
                  <span>DISTANCE OFF ROUTE</span>
                  <strong>
                    {data?.routeDistanceMeters != null
                      ? Math.round(data.routeDistanceMeters)
                      : '—'}
                    <small>metres</small>
                  </strong>
                </div>
                <div>
                  <span>SAFETY CHECK</span>
                  <strong className="sim-text-metric">
                    {checkedIn
                      ? 'Safe'
                      : pendingCheck
                        ? checkTime
                        : j?.checkInState === 'unanswered'
                          ? 'Unanswered'
                          : 'Not needed'}
                  </strong>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span>HELPER DISTANCE</span>
                  <strong>
                    {metric}
                    <small>{t?.fresh ? 'm away' : 'awaiting location'}</small>
                  </strong>
                </div>
                <div>
                  <span>SEARCH RADIUS</span>
                  <strong>
                    {s?.emergencyGeofence
                      ? (s.emergencyGeofence.radiusMeters / 1000).toFixed(1)
                      : '?'}
                    <small>{s?.emergencyGeofence ? 'km' : 'not started'}</small>
                  </strong>
                </div>
              </>
            )}
            <div>
              <span>{j ? 'ROUTE STATUS' : 'RESPONDER'}</span>
              <strong className="sim-text-metric">
                {j
                  ? j.routeDeviationDetected
                    ? 'Off route'
                    : j.destinationReached
                      ? 'Arrived'
                      : 'On route'
                  : s?.activeResponder
                    ? 'Accepted'
                    : s
                      ? 'Searching'
                      : 'Standby'}
              </strong>
            </div>
          </div>
        </article>
        <aside className="sim-story-card">
          <div className="sim-story-top">
            <span className="sim-kicker">THE STORY, STEP BY STEP</span>
            <span>
              {Math.max(cursor + 1, 0)} / {scenario.steps.length}
            </span>
          </div>
          <h3>{scenario.title}</h3>
          <p className="sim-story-description">{scenario.description}</p>
          <ol className="sim-timeline">
            {scenario.steps.map((item, i) => (
              <li
                key={item.action}
                className={
                  i === cursor ? 'current' : i < cursor ? 'complete' : ''
                }
                aria-current={i === cursor ? 'step' : undefined}
              >
                <span className="sim-step-number">
                  {i <= cursor ? (
                    <Check size={12} />
                  ) : (
                    String(i + 1).padStart(2, '0')
                  )}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  {i === cursor && <p>{item.detail}</p>}
                </div>
                {i === cursor && <span className="sim-step-live">NOW</span>}
              </li>
            ))}
          </ol>
          <div className="sim-proof">
            <ShieldCheck size={17} />
            <p>
              {journeyStory
                ? 'Real deviation, deadline and duplicate-send rules. Simulated GPS and SMS only.'
                : 'Simulated positions. Real distance checks, search expansion and arrival rules.'}
            </p>
          </div>
        </aside>
      </div>
      <div className="sim-player">
        <div className="sim-player-copy" role="status" aria-live="polite">
          <span className="sim-kicker">
            {playing
              ? 'PLAYING THE SCENARIO'
              : finished
                ? 'SCENARIO COMPLETE'
                : cursor >= 0
                  ? 'YOUR PACE. YOUR DEMO.'
                  : 'READY WHEN YOU ARE'}
          </span>
          <strong>{step?.title || scenario.title}</strong>
          <p>
            {step?.detail ||
              'Press play to run the story, or use Next step to explain each moment.'}
          </p>
        </div>
        <div className="sim-player-actions">
          {playing ? (
            <Button
              className="sim-play"
              onClick={() => {
                sequenceEpoch.current++;
                setPlaying(false);
              }}
            >
              <Pause size={16} /> Pause
            </Button>
          ) : (
            <Button
              className="sim-play"
              disabled={!canAdvance}
              onClick={() => void present(true)}
            >
              <Play size={16} />
              {busy
                ? 'Finishing step?'
                : finished || needsReplay
                  ? 'Replay story'
                  : cursor >= 0
                    ? 'Continue story'
                    : 'Play story'}
            </Button>
          )}
          <Button
            variant="outline"
            disabled={!canAdvance || finished || needsReplay}
            onClick={() => void present(false)}
          >
            <SkipForward size={16} /> Next step
          </Button>
          <button
            className="sim-icon-button"
            title="Reset and replay this story"
            aria-label="Reset and replay this story"
            disabled={!canPlay}
            onClick={() => void present(true, true)}
          >
            <RotateCcw size={17} />
          </button>
        </div>
      </div>
      {finished && (
        <div className="sim-takeaway">
          <Check size={20} />
          <div>
            <strong>{scenario.takeaway}</strong>
            <p>{scenario.evidence}</p>
          </div>
        </div>
      )}
      {data && (
        <details className="sim-advanced">
          <summary>
            <SlidersHorizontal size={17} /> Explore the controls{' '}
            <span>Manual scenarios & technical evidence</span>
          </summary>
          <div className="simulator-controls">
            {groups.map(([title, buttons]) => (
              <article key={title}>
                <h3>{title}</h3>
                <div className="simulator-buttons">
                  {buttons.map(([key, label]) => (
                    <Button
                      variant="outline"
                      key={key}
                      disabled={!!busy}
                      onClick={() => void run(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <dl className="sim-evidence">
            <div>
              <dt>Victim coordinates</dt>
              <dd>
                {coordinates(s?.latestVictimLocation || j?.currentLocation)}
              </dd>
            </div>
            <div>
              <dt>Simulation clock</dt>
              <dd>{new Date(data.run.clock).toLocaleTimeString()}</dd>
            </div>
            <div>
              <dt>Route deviation samples</dt>
              <dd>{j?.outsideSamples || 0}</dd>
            </div>
            <div>
              <dt>Outside corridor</dt>
              <dd>{Math.round(data.outsideSeconds || 0)} sec</dd>
            </div>
            <div>
              <dt>Escalation stage</dt>
              <dd>{s?.escalationStage || 0}</dd>
            </div>
            <div>
              <dt>Backend incident status</dt>
              <dd>{s?.status || 'Not started'}</dd>
            </div>
          </dl>
        </details>
      )}
      <p className="sim-footnote">
        Each story resets only your isolated demo. No real messages are sent.
        GPS proximity never substitutes for confirmed arrival.
      </p>
    </section>
  );
  return presenting ? createPortal(content, document.body) : content;
}
