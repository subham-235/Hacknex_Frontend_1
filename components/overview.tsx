'use client';
import {
  ShieldCheck,
  Siren,
  ArrowRight,
  ArrowUpRight,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from './app-provider';
export default function Overview({
  onNavigate,
}: {
  onNavigate: (view: string) => void;
}) {
  const { contacts, sessions, history, demo } = useApp();
  return (
    <>
      <div className="stats-row">
        <div>
          <span>Trusted contacts</span>
          <strong>
            {contacts.filter((c) => c.isActive).length}
            <small>active in your circle</small>
          </strong>
        </div>
        <div>
          <span>Agent sessions</span>
          <strong>
            {
              sessions.filter(
                (s) => !['resolved', 'expired'].includes(s.status),
              ).length
            }
            <small>open follow-ups</small>
          </strong>
        </div>
        <div>
          <span>Recorded alerts</span>
          <strong>
            {history.length}
            <small>{demo ? 'illustrative history' : 'recent history'}</small>
          </strong>
        </div>
      </div>
      <section className="overview-grid">
        <article className="sos-hero">
          <span className="badge">
            <span className="dot" /> HERE WHEN YOU NEED IT
          </span>
          <h2>
            Your voice.
            <br />
            Their signal to help.
          </h2>
          <p>
            Record what’s happening. Suraksha can assess your message and alert
            your trusted contacts.
          </p>
          <Button
            className="sos-button"
            onClick={() => onNavigate('Emergency SOS')}
          >
            <Siren /> Prepare an SOS <ArrowRight />
          </Button>
          <small>You review before sending an alert.</small>
          <div className="signal-orbit">
            <Siren size={56} />
          </div>
        </article>
        <article className="card readiness">
          <div className="card-heading">
            <ShieldCheck />
            <span>YOUR SAFETY CHECK</span>
          </div>
          <h2>A stronger safety circle.</h2>
          <p>Small steps that help you be prepared.</p>
          <div className="check-row">
            <span className="check-number">01</span>
            <div>
              <strong>Add someone you trust</strong>
              <small>Choose who receives your SOS.</small>
            </div>
            <ArrowUpRight size={17} />
          </div>
          <div className="check-row">
            <span className="check-number">02</span>
            <div>
              <strong>Enable location when needed</strong>
              <small>Share a more useful call for help.</small>
            </div>
            <ArrowUpRight size={17} />
          </div>
          <div className="check-row">
            <span className="check-number">03</span>
            <div>
              <strong>Stay in control of follow-ups</strong>
              <small>Review the agent’s proposed actions.</small>
            </div>
            <ArrowUpRight size={17} />
          </div>
        </article>
      </section>
      <section className="card agent-intro">
        <div className="agent-icon">
          <Bot />
        </div>
        <div>
          <p className="eyebrow">MEET YOUR SAFETY AGENT</p>
          <h2>Support that follows through.</h2>
          <p>
            Track delivery, review suggested follow-ups, and close an alert when
            you’re safe.
          </p>
        </div>
        <Button variant="outline" onClick={() => onNavigate('Safety agent')}>
          Explore agent <ArrowRight />
        </Button>
      </section>
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Your latest activity</h2>
            <p>Keep track of your safety conversations.</p>
          </div>
          <Button variant="ghost" onClick={() => onNavigate('Alert history')}>
            View history <ArrowRight />
          </Button>
        </div>
        {history.length ? (
          history.slice(0, 3).map((h) => (
            <div className="delivery-row" key={h._id}>
              <div>
                <strong>{h.summary || 'Emergency alert'}</strong>
                <small>
                  {new Date(h.createdAt).toLocaleDateString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                  })}{' '}
                  ? {demo ? 'Demo entry' : h.severity}
                </small>
              </div>
              <Button
                variant="outline"
                onClick={() => onNavigate('Alert history')}
              >
                Details
              </Button>
            </div>
          ))
        ) : (
          <p>No alerts yet. Add a trusted contact to get started.</p>
        )}
      </section>
    </>
  );
}
