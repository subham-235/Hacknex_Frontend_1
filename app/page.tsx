'use client';
import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  LayoutDashboard,
  Siren,
  Users,
  MapPin,
  History,
  Bot,
  ArrowUpRight,
  Radio,
  RefreshCw,
  LogOut,
  LogIn,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Providers, useApp, api, API_BASE } from '@/components/app-provider';
import { Auth, Confirm, Status } from '@/components/shared';
import Overview from '@/components/overview';
import Contacts from '@/components/contacts-panel';
import SosPanel from '@/components/sos-panel';
import CommunityPanel from '@/components/community-panel';
import { AgentPanel, HistoryPanel } from '@/components/activity-panels';
const nav = [
  ['Overview', LayoutDashboard, 'overview'],
  ['Emergency SOS', Siren, 'sos'],
  ['Trusted contacts', Users, 'contacts'],
  ['Community', MapPin, 'community'],
  ['Alert history', History, 'history'],
  ['Safety agent', Bot, 'agent'],
  ['Settings', Settings, 'settings'],
] as const;
const descriptions: Record<string, [string, string]> = {
  Overview: [
    'Your safety starts here.',
    'Stay connected to the people who have your back.',
  ],
  'Emergency SOS': [
    'Your voice can make a difference.',
    'Prepare an alert with audio, location, and your trusted contacts.',
  ],
  'Trusted contacts': [
    'The people who have your back.',
    'Build a circle you can count on.',
  ],
  Community: [
    'A little safer, together.',
    'Connect with your surroundings and report concerns.',
  ],
  'Alert history': [
    'Every signal, in one place.',
    'Review your recent alerts and what happened next.',
  ],
  'Safety agent': [
    'Support that follows through.',
    'Review follow-ups and keep track of your safety conversations.',
  ],
  Settings: [
    'Your safety workspace.',
    'Connection details and a clear view of how this app works.',
  ],
};
function SettingsPanel() {
  const { demo, user, live, notify } = useApp();
  const [checking, setChecking] = useState(false),
    [health, setHealth] = useState('Not checked');
  return (
    <div className="settings-grid">
      <article className="card">
        <h2>Backend connection</h2>
        <p>
          Requests go to <code>{API_BASE}</code>.
        </p>
        <p className="fine">
          In local development, /api forwards to http://127.0.0.1:5000. A
          healthy web server does not prove every database or API provider is
          working.
        </p>
        <Status
          value={live ? 'live_updates_connected' : 'live_updates_disconnected'}
        />
        <div className="divider" />
        <p aria-live="polite">{health}</p>
        <Button
          disabled={checking}
          onClick={async () => {
            setChecking(true);
            try {
              const data = await api('/health');
              setHealth(
                data.status === 'ok'
                  ? 'Backend HTTP server responded.'
                  : 'Backend returned an unexpected health response.',
              );
            } catch (e) {
              setHealth((e as Error).message);
            } finally {
              setChecking(false);
            }
          }}
        >
          {checking ? 'Checking...' : 'Check backend'}
        </Button>
      </article>
      <article className="card">
        <h2>Your account</h2>
        <p>{demo ? 'Demo explorer' : user?.fullName}</p>
        <p>
          {demo
            ? 'Sample data is held in memory and resets on refresh.'
            : user?.emailId}
        </p>
        <p className="fine">
          Microphone and location access are requested only when you choose the
          corresponding action. Recordings and precise coordinates are not
          stored in browser storage.
        </p>
        <Button
          variant="outline"
          onClick={() =>
            notify(
              'Manage microphone and location permissions using the site controls next to your browser address bar.',
            )
          }
        >
          How to manage permissions
        </Button>
      </article>
      <article className="card full">
        <h2>How the safety agent works</h2>
        <div className="steps">
          <div>
            <span>01</span>
            <h3>An SOS starts the session</h3>
            <p>
              Your backend assesses audio and attempts initial SMS alerts when
              distress is detected.
            </p>
          </div>
          <div>
            <span>02</span>
            <h3>The worker checks progress</h3>
            <p>
              Delivery callbacks and contact replies help the agent decide
              whether follow-up is useful.
            </p>
          </div>
          <div>
            <span>03</span>
            <h3>You review proposed actions</h3>
            <p>
              In review mode, approve or reject suggested follow-ups. Resolve
              the session when you are safe.
            </p>
          </div>
        </div>
        <p className="fine">
          The worker, MongoDB, Redis, Gemini, and Twilio must be available for
          the complete live workflow. Its configured mode and limits are
          enforced by your backend.
        </p>
      </article>
    </div>
  );
}
function Workspace() {
  const app = useApp();
  const [view, setView] = useState('Overview');
  useEffect(() => {
    const sync = () =>
      setView(
        nav.find((n) => n[2] === location.hash.slice(1))?.[0] || 'Overview',
      );
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  function navigate(label: string) {
    setView(label);
    location.hash = nav.find((n) => n[0] === label)?.[2] || 'overview';
  }
  const signedIn = app.demo || !!app.user;
  const [title, description] = descriptions[view];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview">
          <ShieldCheck />
          <span>
            suraksha<span className="brand-dot">.</span>
          </span>
        </a>
        <p className="eyebrow">YOUR SAFETY SPACE</p>
        <nav aria-label="Main navigation">
          {nav.map(([label, Icon, slug]) => (
            <a
              href={`#${slug}`}
              className={view === label ? 'nav-item selected' : 'nav-item'}
              aria-current={view === label ? 'page' : undefined}
              key={label}
            >
              <Icon size={19} />
              {label}
              {label === 'Safety agent' && <span className="mini">AI</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck />
          <strong>A little peace of mind.</strong>
          <p>
            Your people. Your voice.
            <br />A safer way forward.
          </p>
        </div>
        <div className="profile">
          <span className="avatar">
            {app.demo ? 'D' : app.user?.fullName[0] || 'S'}
          </span>
          <div>
            <strong>
              {app.demo
                ? 'Demo explorer'
                : app.user?.fullName || 'Welcome to Suraksha'}
            </strong>
            <small>
              {app.demo
                ? 'Explore with sample data'
                : 'Personal safety account'}
            </small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <span>
            Personal workspace <span className="slash">/</span> {view}
          </span>
          <div className="actions">
            {app.demo ? (
              <>
                <span className="badge amber">
                  <span className="dot" /> Demo mode
                </span>
                <Button variant="ghost" onClick={() => app.setDemo(false)}>
                  <LogIn /> Sign in
                </Button>
              </>
            ) : app.user ? (
              <>
                <span className="badge">
                  <span className="dot" />
                  {app.live ? 'Live updates' : 'Updates offline'}
                </span>
                <Confirm
                  title="Sign out?"
                  description="This ends your authenticated session on the backend."
                  label="Sign out"
                  onConfirm={app.signOut}
                >
                  <LogOut />
                </Confirm>
              </>
            ) : (
              <Button variant="ghost" onClick={() => app.setDemo(true)}>
                Explore demo
              </Button>
            )}
          </div>
        </header>
        <main>
          {!signedIn ? (
            <Auth />
          ) : (
            <>
              <div className="page-title">
                <div>
                  <p className="eyebrow">A LITTLE MORE CONFIDENCE, EVERY DAY</p>
                  <h1>{title}</h1>
                  <p>{description}</p>
                </div>
                {view === 'Overview' ? (
                  <Button
                    variant="outline"
                    onClick={() => navigate('Trusted contacts')}
                  >
                    Manage contacts <ArrowUpRight />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={app.loading}
                    onClick={() => app.refresh()}
                  >
                    <RefreshCw className={app.loading ? 'spin' : ''} /> Refresh
                  </Button>
                )}
              </div>
              {app.demo && (
                <div className="notice">
                  <Radio size={16} />
                  <span>
                    You’re exploring a demo. No alerts are sent and no location
                    is shared.
                  </span>
                </div>
              )}
              {app.error && (
                <div className="error" role="alert">
                  {app.error}{' '}
                  <Button variant="ghost" onClick={() => app.refresh()}>
                    Try again
                  </Button>
                  <Button variant="ghost" onClick={() => app.setDemo(false)}>
                    Sign in again
                  </Button>
                </div>
              )}
              {app.loading && (
                <div className="loading-line" role="status">
                  Loading your workspace...
                </div>
              )}
              {view === 'Overview' && <Overview onNavigate={navigate} />}{' '}
              {view === 'Trusted contacts' && <Contacts />}
              {view === 'Emergency SOS' && <SosPanel />}
              {view === 'Community' && <CommunityPanel />}
              {view === 'Alert history' && <HistoryPanel />}
              {view === 'Safety agent' && <AgentPanel />}
              {view === 'Settings' && <SettingsPanel />}
            </>
          )}
        </main>
        {app.message && (
          <div className="toast" role="status">
            <ShieldCheck size={19} />
            {app.message}
            <button
              aria-label="Dismiss notification"
              onClick={() => app.notify('')}
            >
              ×
            </button>
          </div>
        )}
        <footer>
          <ShieldCheck size={14} /> Built for a little more peace of mind.
          <span>
            In immediate danger? Call <a href="tel:112">112</a>.
          </span>
        </footer>
      </div>
    </div>
  );
}
export default function Home() {
  return (
    <Providers>
      <Workspace />
    </Providers>
  );
}
