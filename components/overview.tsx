'use client';
import { useEffect, useRef, type CSSProperties } from 'react';
import { motion, animate, stagger, useReducedMotion } from 'framer-motion';
import {
  ShieldCheck,
  Mic,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Users,
  Activity,
  MapPin,
  Plus,
  Radio,
  Sparkles,
  Check,
  Clock3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { useApp } from './app-provider';
import { SafetyOrbit } from './safety-orbit';
import { HeroScrollDemo } from './demo';

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      if (ref.current) ref.current.textContent = String(value);
      return;
    }
    const animation = animate(0, value, {
      duration: 0.85,
      ease: 'easeOut',
      onUpdate: (current) => {
        if (ref.current) ref.current.textContent = String(Math.round(current));
      },
    });
    return () => animation.stop();
  }, [value, reduced]);
  return (
    <>
      <span ref={ref} aria-hidden="true">
        {value}
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}
export default function Overview({
  onNavigate,
}: {
  onNavigate: (view: string) => void;
}) {
  const { contacts, sessions, history, demo } = useApp();
  const active = contacts.filter((c) => c.isActive);
  const openSessions = sessions.filter(
    (s) => !['resolved', 'expired'].includes(s.status),
  );
  const reduced = useReducedMotion();
  const stats = [
    {
      label: 'Your trusted circle',
      value: active.length,
      detail: 'active contacts',
      icon: Users,
      tone: 'mint',
      view: 'Trusted contacts',
    },
    {
      label: 'Safety agent',
      value: openSessions.length,
      detail: 'open follow-ups',
      icon: Bot,
      tone: 'violet',
      view: 'Safety agent',
    },
    {
      label: 'Alert activity',
      value: history.length,
      detail: demo ? 'sample alerts' : 'recorded alerts',
      icon: Activity,
      tone: 'peach',
      view: 'Alert history',
    },
  ];
  return (
    <motion.div
      className="overview-content"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { delayChildren: stagger(reduced ? 0 : 0.08) } },
      }}
    >
      <motion.section
        className="command-hero"
        variants={{
          hidden: { opacity: 0, y: reduced ? 0 : 15 },
          visible: { opacity: 1, y: 0 },
        }}
      >
        <div className="hero-copy">
          <span className="hero-kicker">
            <span className="dot" /> A LITTLE PEACE OF MIND
          </span>
          <h2>
            Go live your life.
            <br />
            <span>Keep your circle close.</span>
          </h2>
          <p>
            Your voice. Your people. One connected space.
            <br />A little more confidence, wherever the day takes you.
          </p>
          <div className="actions">
            <Button
              onClick={() => onNavigate('Emergency SOS')}
              className="hero-primary"
            >
              <Mic size={17} /> Open voice guard <ArrowUpRight size={16} />
            </Button>
            <Button
              variant="ghost"
              onClick={() => onNavigate('Trusted contacts')}
            >
              My safety circle <ArrowRight size={15} />
            </Button>
          </div>
          <div className="hero-footnote">
            <ShieldCheck size={13} /> Microphone stays off until you activate
            it.
          </div>
        </div>
        <SafetyOrbit />
      </motion.section>
      <section className="metric-grid" aria-label="Your safety summary">
        {stats.map(({ label, value, detail, icon: Icon, tone, view }) => (
          <motion.div
            key={label}
            variants={{
              hidden: { opacity: 0, y: reduced ? 0 : 18 },
              visible: { opacity: 1, y: 0 },
            }}
          >
            <button
              className={`metric-card ${tone}`}
              onClick={() => onNavigate(view)}
            >
              <div className="metric-heading">
                <span className="metric-icon">
                  <Icon size={19} />
                </span>
                <span>{label}</span>
                <ArrowUpRight size={16} />
              </div>
              <div className="metric-value">
                <AnimatedNumber value={value} />
                <small>{detail}</small>
              </div>
              <div className="metric-line" />
            </button>
          </motion.div>
        ))}
      </section>
      <div className="dashboard-grid">
        <SpotlightCard className="voice-card">
          <div className="section-heading">
            <span className="feature-label">
              <Radio size={16} /> VOICE GUARD
            </span>
            <span className="standby">
              <span /> Standby
            </span>
          </div>
          <div className="voice-card-body">
            <div>
              <h2>
                A voice can be
                <br />a lifeline.
              </h2>
              <p>
                When something feels wrong, let your people know. Start with
                your voice.
              </p>
            </div>
            <div className="waveform" aria-hidden="true">
              {Array.from({ length: 23 }, (_, i) => (
                <i
                  key={i}
                  style={
                    {
                      '--bar-height': `${14 + Math.sin(i * 1.7) ** 2 * 54}px`,
                      '--bar-delay': `${i * -0.11}s`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </div>
          <Button
            className="voice-cta"
            onClick={() => onNavigate('Emergency SOS')}
          >
            <Mic /> Open voice guard <ArrowRight />
          </Button>
          <p className="fine">Review monitoring details before activating.</p>
        </SpotlightCard>
        <SpotlightCard className="circle-card">
          <div className="section-heading">
            <span className="feature-label">
              <Users size={16} /> YOUR PEOPLE
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Manage trusted contacts"
              onClick={() => onNavigate('Trusted contacts')}
            >
              <Plus />
            </Button>
          </div>
          <h2>Better, together.</h2>
          <p>Your trusted circle is a good place to start.</p>
          <div className="circle-people">
            {contacts.slice(0, 3).map((c, i) => (
              <div className="person-row" key={c._id}>
                <span className={`person-avatar tone-${i}`}>
                  {c.contacts.slice(0, 1)}
                </span>
                <div>
                  <strong>{c.contacts}</strong>
                  <small>
                    {c.isActive ? 'Included in SMS alerts' : 'Alerts paused'}
                  </small>
                </div>
                <span
                  className={
                    c.isActive ? 'person-state active' : 'person-state'
                  }
                >
                  {c.isActive ? <Check size={14} /> : <Clock3 size={14} />}
                </span>
              </div>
            ))}
            {contacts.length === 0 && (
              <p className="fine">
                Add your first contact to build your circle.
              </p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => onNavigate('Trusted contacts')}
          >
            Manage my circle <ArrowUpRight />
          </Button>
        </SpotlightCard>
        <SpotlightCard className="agent-banner">
          <div className="agent-icon">
            <Sparkles />
          </div>
          <div>
            <span className="feature-label">A LITTLE EXTRA SUPPORT</span>
            <h2>Meet your safety agent.</h2>
            <p>
              Follow the alert. Review the next step. Close the loop when you’re
              safe.
            </p>
          </div>
          <Button variant="outline" onClick={() => onNavigate('Safety agent')}>
            Explore agent <ArrowRight />
          </Button>
        </SpotlightCard>
        <SpotlightCard className="activity-card">
          <div className="section-heading">
            <div>
              <span className="feature-label">THE LATEST</span>
              <h2>Your safety timeline</h2>
            </div>
            <Button variant="ghost" onClick={() => onNavigate('Alert history')}>
              View all <ArrowUpRight />
            </Button>
          </div>
          {history.length ? (
            history.slice(0, 3).map((h) => (
              <div className="activity-entry" key={h._id}>
                <span className="activity-symbol">
                  <Activity size={17} />
                </span>
                <div>
                  <strong>{h.summary || 'Emergency alert'}</strong>
                  <small>
                    {new Date(h.createdAt).toLocaleDateString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    · {demo ? 'Demo entry' : h.severity}
                  </small>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="View alert details"
                  onClick={() => onNavigate('Alert history')}
                >
                  <ArrowUpRight />
                </Button>
              </div>
            ))
          ) : (
            <p>No alerts yet. Your recent activity will appear here.</p>
          )}
        </SpotlightCard>
        <SpotlightCard className="readiness">
          <span className="feature-label">
            <ShieldCheck size={16} /> SMALL STEPS, MORE CONFIDENCE
          </span>
          <h2>Your safety checklist</h2>
          {[
            {
              icon: Users,
              title: 'Bring your people closer',
              text: 'Add a trusted contact.',
              view: 'Trusted contacts',
            },
            {
              icon: MapPin,
              title: 'Know your surroundings',
              text: 'Explore community awareness.',
              view: 'Community',
            },
            {
              icon: Bot,
              title: 'Check in on follow-ups',
              text: 'Review your agent’s next steps.',
              view: 'Safety agent',
            },
          ].map(({ icon: Icon, title, text, view }) => (
            <button
              className="check-row"
              key={view}
              onClick={() => onNavigate(view)}
            >
              <span className="check-number">
                <Icon size={16} />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{text}</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </SpotlightCard>
      </div>
      <HeroScrollDemo onNavigate={onNavigate} />
    </motion.div>
  );
}
