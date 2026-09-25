'use client';
import { useState } from 'react';
import { Bot, ArrowRight, CheckCircle2, Search, Activity, Users, ShieldAlert, Clock3, ChevronDown, AudioLines, MapPin, Trash2, RadioTower, MessageSquareText, ListChecks, Route, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApp, api } from './app-provider';
import { Confirm, Empty, Status } from './shared';
import { OwnerCoordination } from './rescue-panel';
import { safeMapUrl } from '@/lib/api.mjs';
import { ContactHelp } from './contact-help';
export function AgentPanel() {
  const { sessions, setSessions, demo, rescueError, refresh, notify } = useApp();
  const [selected, setSelected] = useState('');
  const session = sessions.find((s) => s._id === selected) || sessions[0];
  async function action(id: string, choice: 'approve' | 'reject') {
    if (!session) return;
    if (demo)
      setSessions((items) =>
        items.map((s) =>
          s._id === session._id
            ? {
                ...s,
                actions: s.actions.map((a) =>
                  a._id === id
                    ? {
                        ...a,
                        state: choice === 'approve' ? 'approved' : 'rejected',
                      }
                    : a,
                ),
              }
            : s,
        ),
      );
    else {
      await api(`/agent/sessions/${session._id}/actions/${id}/${choice}`, {
        method: 'POST',
      });
      await refresh();
    }
    notify(
      choice === 'approve'
        ? 'Follow-up approved. Approval does not confirm delivery.'
        : 'Follow-up rejected.',
    );
  }
  const openSessions = sessions.filter(
    (item) => !['resolved', 'expired'].includes(item.status),
  ).length;
  const proposedActions = sessions.reduce(
    (total, item) =>
      total + item.actions.filter((itemAction) => itemAction.state === 'proposed').length,
    0,
  );
  return (
    <div className="agent-console">
      {rescueError && <p role="alert" className="error">Unable to refresh agent activity: {rescueError}</p>}
      <section className="agent-console-intro" aria-label="Safety agent overview">
        <div className="agent-console-copy">
          <span className="agent-console-kicker"><Sparkles size={14} /> HUMAN-GUIDED AUTOMATION</span>
          <h2>Your safety follow-ups, clearly coordinated.</h2>
          <p>Review delivery, contact replies, and proposed next steps. Nothing is approved without you.</p>
        </div>
        <div className="agent-pipeline" aria-label="Agent workflow">
          {['Observe', 'Verify', 'Propose', 'Track'].map((step, index) => <div key={step}>
            <span>{String(index + 1).padStart(2, '0')}</span><strong>{step}</strong>
            {index < 3 && <ArrowRight size={13} />}
          </div>)}
        </div>
        <div className="agent-console-stats">
          <div><RadioTower size={16} /><span><strong>{openSessions}</strong> open sessions</span></div>
          <div><ListChecks size={16} /><span><strong>{proposedActions}</strong> actions to review</span></div>
          <div><MessageSquareText size={16} /><span><strong>{sessions.reduce((count, item) => count + item.events.filter(event => event.type === 'contact_reply').length, 0)}</strong> contact replies</span></div>
        </div>
      </section>
      {!session ? (
        <div className="card agent-empty">
          <Empty
            title="No follow-ups to review."
            text="An agent session can appear after an SOS. Make sure the agent worker is running."
          />
        </div>
      ) : (
        <div className="agent-console-layout">
          <aside className="agent-session-rail">
            <div className="agent-rail-heading">
              <div><p className="eyebrow">INCIDENT QUEUE</p><h2>Recent sessions</h2></div>
              <span>{sessions.length}</span>
            </div>
            <div className="agent-session-items">
              {sessions.map((s) => (
                <button
                  className={s._id === session._id ? 'agent-session-item chosen' : 'agent-session-item'}
                  key={s._id}
                  aria-pressed={s._id === session._id}
                  onClick={() => setSelected(s._id)}
                >
                  <span className="agent-session-top"><strong>{s.reference}</strong><Status value={s.status} /></span>
                  <small><Clock3 size={12} />{new Date(s.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</small>
                  <span className="agent-session-arrow"><ArrowRight size={14} /></span>
                </button>
              ))}
            </div>
            <p className="agent-rail-note"><Bot size={14} />The worker monitors sessions in the background. You approve proposed messages.</p>
          </aside>
          <section className="agent-case" aria-label={`Session ${session.reference}`}>
            <div className="agent-case-header">
              <div>
                <p className="eyebrow">ACTIVE CASE / {session.reference}</p>
                <h2>{session.summary || 'Safety follow-up'}</h2>
                <p>Opened {new Date(session.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
              </div>
              <Status value={session.status} />
            </div>
            <div className="agent-command-grid">
              <div className="agent-rescue"><OwnerCoordination session={session} /></div>
              <article className="agent-resolution-card">
                <div className="agent-card-icon"><CheckCircle2 size={20} /></div>
                <p className="eyebrow">SESSION CONTROL</p>
                <h2>{session.status === 'resolved' ? 'This session is closed.' : 'Are you safe now?'}</h2>
                <p>{session.acknowledgments?.length || 0} acknowledgment(s) received. Delivery alone does not confirm someone is helping.</p>
                {session.status !== 'resolved' && (
                  <Confirm
                    title="Mark yourself safe and close this session?"
                    description="This stops future follow-ups for this session. Messages already submitted cannot be recalled."
                    label="Resolve session"
                    onConfirm={async () => {
                      if (demo) setSessions((items) => items.map((s) => s._id === session._id ? { ...s, status: 'resolved' } : s));
                      else {
                        await api(`/agent/sessions/${session._id}/resolve`, { method: 'POST' });
                        await refresh();
                      }
                    }}
                  ><CheckCircle2 /> I&apos;m safe — close session</Confirm>
                )}
              </article>
            </div>
            {session.lastError && <article className="agent-warning" role="status">
              <ShieldAlert size={18} /><div><h2>AI follow-up review is interrupted</h2><p>{session.lastError}</p><small>Incoming replies and responder tracking continue independently.</small></div>
            </article>}
            <div className="agent-information-grid">
              <article className="agent-data-card" aria-live="polite">
                <div className="agent-data-heading"><span><MessageSquareText size={18} /></span><div><p className="eyebrow">INCOMING</p><h2>Contact replies</h2></div></div>
                <ContactHelp session={session} stale={Boolean(rescueError)} />
                {session.events.filter(event => event.type === 'contact_reply').length === 0
                  ? <div className="agent-inline-empty"><MessageSquareText size={20} /><p>No reply received yet.<small>Delivery does not mean a contact has responded.</small></p></div>
                  : session.events.filter(event => event.type === 'contact_reply').slice().reverse().map(event => <div className="agent-reply" key={event._id}>
                      <div><strong>{session.recipients.find(contact => String(contact.contactId) === String(event.contactId))?.label || 'Trusted contact'}</strong><small>{new Date(event.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</small></div>
                      <p>{event.text}</p>
                    </div>)}
                <p className="agent-card-footnote">Contacts use the private link in their SMS to respond. Expired and resolved sessions do not accept replies.</p>
              </article>
              <article className="agent-data-card">
                <div className="agent-data-heading"><span><ListChecks size={18} /></span><div><p className="eyebrow">YOUR APPROVAL</p><h2>Suggested actions</h2></div></div>
                {session.actions.length === 0 ? (
                  <div className="agent-inline-empty"><ListChecks size={20} /><p>No actions proposed yet.<small>New suggestions will appear here for review.</small></p></div>
                ) : session.actions.map((a) => (
                  <div className="agent-action" key={a._id}>
                    <div className="agent-action-top"><strong>{session.recipients.find((c) => String(c.contactId) === String(a.contactId))?.label || 'Trusted contact'}</strong><Status value={a.state} /></div>
                    <p>{a.reason}</p>
                    {a.state === 'proposed' && !['resolved', 'expired'].includes(session.status) && (
                      <div className="actions">
                        <Confirm
                          title="Approve this follow-up SMS?"
                          description={demo ? 'This changes the demo action only. No SMS will be sent.' : 'This authorizes the agent worker to send a follow-up SMS to this contact, subject to backend limits.'}
                          label={demo ? 'Simulate approval' : 'Approve SMS'}
                          onConfirm={() => action(a._id, 'approve')}
                        >Approve follow-up</Confirm>
                        <Button variant="ghost" onClick={() => action(a._id, 'reject').catch((e) => notify(e.message))}>Reject</Button>
                      </div>
                    )}
                  </div>
                ))}
              </article>
            </div>
            <article className="agent-activity-card">
              <div className="agent-data-heading"><span><Route size={18} /></span><div><p className="eyebrow">AUDIT TRAIL</p><h2>Delivery &amp; activity</h2></div></div>
              <div className="agent-activity-grid">
                <div className="agent-deliveries">
                  <h3>Message delivery</h3>
                  {session.attempts.length === 0 ? <p className="fine">No delivery attempts recorded.</p> : session.attempts.map((a) => (
                    <div className="agent-delivery" key={a._id}>
                      <span><strong>{session.recipients.find((c) => String(c.contactId) === String(a.contactId))?.label || 'Contact'}</strong><small>{a.kind}</small></span>
                      <Status value={a.status} />
                      {a.error && <small>{a.error}</small>}
                    </div>
                  ))}
                </div>
                <div className="agent-timeline">
                  <h3>Session timeline</h3>
                  {session.events.map((e) => (
                    <div className="agent-timeline-row" key={e._id}>
                      <span className="agent-timeline-dot" />
                      <div><strong>{e.type.replaceAll('_', ' ')}</strong><p>{e.text}</p><small>{new Date(e.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</small></div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </section>
        </div>
      )}
    </div>
  );
}
export function HistoryPanel() {
  const { history, setHistory, demo, refresh } = useApp();
  const [filter, setFilter] = useState(''),
    [expanded, setExpanded] = useState('');
  const filtered = history.filter((h) =>
    `${h.summary} ${h.severity}`.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <div className="history-workspace">
      <div className="history-metrics" aria-label="Recent alert summary">
        <div><span><Activity size={17} /> RECENT ALERTS</span><strong>{history.length.toString().padStart(2, '0')}</strong><small>In your recent history</small></div>
        <div><span><ShieldAlert size={17} /> HIGH SEVERITY</span><strong>{history.filter(h => h.severity.toLowerCase() === 'high').length.toString().padStart(2, '0')}</strong><small>As assessed at the time</small></div>
        <div><span><Users size={17} /> CONTACT SUBMISSIONS</span><strong>{history.reduce((total, h) => total + h.sent.length, 0).toString().padStart(2, '0')}</strong><small>Submission does not confirm delivery</small></div>
      </div>
      <div className="section-heading history-toolbar">
        <div>
          <h2>Activity log <span>{filtered.length}</span></h2>
          <p>Up to 20 recent alerts · Times shown in IST</p>
        </div>
        <label className="history-search" htmlFor="history-search"><Search size={17} aria-hidden="true" />
        <Input
          id="history-search"
          className="search"
          aria-label="Search alert history"
          placeholder="Search alerts..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        </label>
      </div>
      <section className="history-records" aria-label="Alert records">
        {filtered.length === 0 ? (
          <Empty
            title={filter ? 'No alerts match your search.' : 'Your story starts here.'}
            text={filter ? 'Try another keyword or severity, or clear the search.' : 'Recorded SOS alerts will appear here with their details and contact submissions.'}
          />
        ) : (
          filtered.map((h) => (
            <article className={`history-item history-record ${expanded === h._id ? 'is-expanded' : ''}`} key={h._id}>
              <div className="history-record-top">
                <div className="history-date"><strong>{new Date(h.createdAt).toLocaleDateString('en-IN', { day: '2-digit', timeZone: 'Asia/Kolkata' })}</strong><span>{new Date(h.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</span></div>
                <div className="history-record-copy">
                  <div className="history-record-label"><span><AudioLines size={14} /> SOS ALERT</span>
                  <Status value={h.severity.toLowerCase()} />
                  </div>
                  <h2>{h.summary || 'Emergency alert'}</h2>
                  <div className="history-record-meta"><span><Clock3 size={13} /><time dateTime={h.createdAt}>{new Date(h.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST</time></span><span><Users size={13} />{h.sent.length} contact submissions</span></div>
                </div>
                <Button
                  variant="outline"
                  aria-expanded={expanded === h._id}
                  aria-controls={`history-detail-${h._id}`}
                  className="history-expand"
                  onClick={() => setExpanded(expanded === h._id ? '' : h._id)}
                >
                  {expanded === h._id ? 'Close' : 'View details'}
                  <ChevronDown size={15} />
                </Button>
              </div>
              {expanded === h._id && (
                <div className="history-detail" id={`history-detail-${h._id}`}>
                  <div className="history-transcript">
                    <p className="eyebrow"><AudioLines size={14} /> AUDIO TRANSCRIPT</p>
                    <blockquote>{h.transcript || 'No transcript available.'}</blockquote>
                  </div>
                  <aside className="history-detail-aside">
                    <div className="history-confidence">
                      <span>MODEL CONFIDENCE</span>
                      <strong>{h.confidencePercentage}%</strong>
                      <small>Automated assessment</small>
                    </div>
                    <div className="history-detail-actions">
                      {safeMapUrl(h.location?.mapsLink) && (
                        <a
                          className="history-location-link"
                          href={safeMapUrl(h.location?.mapsLink)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MapPin size={14} /> Open location
                        </a>
                      )}
                      <Confirm
                        title="Delete this history entry?"
                        description="This removes the history entry only. Any associated agent session must be resolved separately."
                        label="Delete entry"
                        onConfirm={async () => {
                          if (demo)
                            setHistory((items) =>
                              items.filter((x) => x._id !== h._id),
                            );
                          else {
                            await api(`/history/delete/${h._id}`, {
                              method: 'DELETE',
                            });
                            await refresh();
                          }
                        }}
                      >
                        <Trash2 size={14} /> Delete entry
                      </Confirm>
                    </div>
                  </aside>
                </div>
              )}
            </article>
          ))
        )}
      </section>
      <p className="history-footnote"><ShieldAlert size={14} />History is a record of past alerts. Check Safety agent for ongoing responses and follow-ups.</p>
    </div>
  );
}
