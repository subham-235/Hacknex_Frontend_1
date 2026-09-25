'use client';
import { useState } from 'react';
import { Bot, ArrowRight, CheckCircle2 } from 'lucide-react';
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
  return (
    <>
      {rescueError && <p role="alert" className="error">Unable to refresh agent activity: {rescueError}</p>}
      <div className="agent-explainer card">
        <div className="agent-icon">
          <Bot />
        </div>
        <div>
          <h2>A thoughtful next step. You stay in control.</h2>
          <p>
            The agent reviews delivery and replies, then proposes follow-ups
            when appropriate. The worker and its configured mode determine when
            actions run.
          </p>
          <div className="flow">
            <span>Observe alert</span>
            <ArrowRight size={14} />
            <span>Review delivery</span>
            <ArrowRight size={14} />
            <span>Propose follow-up</span>
            <ArrowRight size={14} />
            <span>Track outcome</span>
          </div>
        </div>
      </div>
      {!session ? (
        <div className="card">
          <Empty
            title="No follow-ups to review."
            text="An agent session can appear after an SOS. Make sure the agent worker is running."
          />
        </div>
      ) : (
        <div className="agent-layout">
          <div className="card session-list">
            <p className="eyebrow">RECENT SESSIONS</p>
            {sessions.map((s) => (
              <button
                className={
                  s._id === session._id ? 'session-item chosen' : 'session-item'
                }
                key={s._id}
                onClick={() => setSelected(s._id)}
              >
                <strong>{s.reference}</strong>
                <Status value={s.status} />
                <small>
                  {new Date(s.createdAt).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                  })}
                </small>
              </button>
            ))}
          </div>
          <section>
            <OwnerCoordination session={session} />
            {session.lastError && <article className="card" role="status">
              <h2>AI follow-up review is interrupted</h2>
              <p>{session.lastError}</p>
              <p>Incoming SMS processing and responder tracking run independently of Gemini. This error does not explain a missing SMS reply.</p>
            </article>}
            <article className="card" aria-live="polite">
              <h2>Contact replies</h2>
              <ContactHelp session={session} stale={Boolean(rescueError)} />
              {session.events.filter(event => event.type === 'contact_reply').length === 0
                ? <p>No contact reply has been received for this session. SMS accepted or delivered does not mean a reply was received.</p>
                : session.events.filter(event => event.type === 'contact_reply').slice().reverse().map(event => <div className="action-card" key={event._id}>
                    <strong>{session.recipients.find(contact => String(contact.contactId) === String(event.contactId))?.label || 'Trusted contact'}</strong>
                    <p>{event.text}</p>
                    <small>{new Date(event.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</small>
                  </div>)}
              <p className="fine">Contacts can use the private link in a new SMS to respond. Expired and resolved sessions do not accept new replies. For a supported two-way SMS channel only, the acknowledgment format is <code>ACK {session.reference}</code>.</p>
            </article>
            <article className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">SESSION {session.reference}</p>
                  <h2>{session.summary || 'Safety follow-up'}</h2>
                </div>
                <Status value={session.status} />
              </div>
              <p className="fine">
                {session.acknowledgments?.length || 0} acknowledgment(s). SMS
                delivery alone does not confirm someone is helping.
              </p>
              {session.status !== 'resolved' && (
                <Confirm
                  title="Mark yourself safe and close this session?"
                  description="This stops future follow-ups for this session. Messages already submitted cannot be recalled."
                  label="Resolve session"
                  onConfirm={async () => {
                    if (demo)
                      setSessions((items) =>
                        items.map((s) =>
                          s._id === session._id
                            ? { ...s, status: 'resolved' }
                            : s,
                        ),
                      );
                    else {
                      await api(`/agent/sessions/${session._id}/resolve`, {
                        method: 'POST',
                      });
                      await refresh();
                    }
                  }}
                >
                  <CheckCircle2 /> I&apos;m safe - resolve session
                </Confirm>
              )}
            </article>
            <article className="card">
              <h2>Suggested actions</h2>
              {session.actions.length === 0 ? (
                <p>No actions proposed yet.</p>
              ) : (
                session.actions.map((a) => (
                  <div className="action-card" key={a._id}>
                    <div className="section-heading">
                      <strong>
                        {session.recipients.find(
                          (c) => String(c.contactId) === String(a.contactId),
                        )?.label || 'Trusted contact'}
                      </strong>
                      <Status value={a.state} />
                    </div>
                    <p>{a.reason}</p>
                    {a.state === 'proposed' &&
                      !['resolved', 'expired'].includes(session.status) && (
                        <div className="actions">
                          <Confirm
                            title="Approve this follow-up SMS?"
                            description={
                              demo
                                ? 'This changes the demo action only. No SMS will be sent.'
                                : 'This authorizes the agent worker to send a follow-up SMS to this contact, subject to backend limits.'
                            }
                            label={demo ? 'Simulate approval' : 'Approve SMS'}
                            onConfirm={() => action(a._id, 'approve')}
                          >
                            Approve follow-up
                          </Confirm>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              action(a._id, 'reject').catch((e) =>
                                notify(e.message),
                              )
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                  </div>
                ))
              )}
            </article>
            <article className="card">
              <h2>Delivery & activity</h2>
              {session.attempts.map((a) => (
                <div className="delivery-row" key={a._id}>
                  <span>
                    {session.recipients.find(
                      (c) => String(c.contactId) === String(a.contactId),
                    )?.label || 'Contact'}{' '}
                    <small>{a.kind}</small>
                  </span>
                  <Status value={a.status} />
                  {a.error && <small>{a.error}</small>}
                </div>
              ))}
              {session.events.map((e) => (
                <div className="timeline-row" key={e._id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{e.type.replaceAll('_', ' ')}</strong>
                    <p>{e.text}</p>
                    <small>
                      {new Date(e.at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      })}
                    </small>
                  </div>
                </div>
              ))}
            </article>
          </section>
        </div>
      )}
    </>
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
    <>
      <div className="section-heading">
        <div>
          <h2>Your alert history</h2>
          <p>Your most recent 20 alerts, as returned by the backend.</p>
        </div>
        <Input
          className="search"
          aria-label="Search alert history"
          placeholder="Search alerts..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <section className="card">
        {filtered.length === 0 ? (
          <Empty
            title="No matching alerts."
            text="Your SOS history will appear here after an alert is recorded."
          />
        ) : (
          filtered.map((h) => (
            <div className="history-item" key={h._id}>
              <div className="section-heading">
                <div>
                  <Status value={h.severity.toLowerCase()} />
                  <h2>{h.summary || 'Emergency alert'}</h2>
                  <small>
                    {new Date(h.createdAt).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                    })}{' '}
                    · {h.sent.length} contact(s) submitted
                  </small>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setExpanded(expanded === h._id ? '' : h._id)}
                >
                  {expanded === h._id ? 'Close' : 'View details'}
                </Button>
              </div>
              {expanded === h._id && (
                <div className="history-detail">
                  <p className="eyebrow">AUDIO TRANSCRIPT</p>
                  <p>{h.transcript || 'No transcript available.'}</p>
                  <p className="fine">
                    Model confidence: {h.confidencePercentage}% · This is a
                    model assessment.
                  </p>
                  {safeMapUrl(h.location?.mapsLink) && (
                    <a
                      className="text-link"
                      href={safeMapUrl(h.location?.mapsLink)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open alert location ↗
                    </a>
                  )}
                  <div className="actions">
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
                      Delete entry
                    </Confirm>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </section>
    </>
  );
}
