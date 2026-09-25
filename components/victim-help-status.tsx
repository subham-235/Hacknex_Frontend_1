'use client';
import { useApp, api } from './app-provider';
import { sosProgress } from '@/lib/sos-progress.mjs';
import { Confirm } from './shared';
import { ContactHelp } from './contact-help';

export default function VictimHelpStatus() {
  const { user, demo, sessions, live, rescueError, locationStatus, refresh, notify } = useApp();
  if (!user || demo) return null;
  const active = sessions.filter(session => sosProgress(session).active);
  if (!active.length && !rescueError) return null;
  return <section className="victim-help-status" aria-label="Your SOS and incoming help">
    {locationStatus && <p role="status">{locationStatus}</p>}
    {rescueError && <p role="alert" className="error">Unable to refresh your SOS status. Last known information may be outdated. {rescueError}</p>}
    {active.map(session => {
      const progress = sosProgress(session);
      const tracking = session.responderTracking;
      return <article className="card" key={session._id}>
        <p className="eyebrow">YOUR SOS · {session.reference}</p>
        <div role="status" aria-live="polite" aria-atomic="true">
          <h2>{progress.title}</h2>
          <p>{progress.detail}</p>
          <p>{progress.delivery}</p>
        </div>
        <ContactHelp session={session} stale={Boolean(rescueError)} />
        {!rescueError && tracking?.fresh && session.activeResponder && <p>
          Responder distance: approximately {tracking.distanceMeters} m
          {tracking.estimatedEtaSeconds !== null && ` · Estimated arrival: ${Math.ceil(tracking.estimatedEtaSeconds / 60)} min`}
        </p>}
        <p className="fine">Turning off Suraksha Mode stops the microphone, not this SOS. Help updates continue while you stay signed in with this app open. {live ? 'Live updates connected.' : 'Live connection unavailable; checking every 5 seconds.'}</p>
        <div className="actions">
          <a className="text-link" href="#agent">View rescue details</a>
          <Confirm title="Are you safe now?" description="This resolves this SOS and stops further follow-ups. Turning off the microphone alone does not resolve it." label="I'm safe — resolve SOS" onConfirm={async () => {
            try {
              await api(`/agent/sessions/${session._id}/resolve`, { method: 'POST' });
              await refresh();
            } catch (error) { notify((error as Error).message); }
          }}>I’m safe — resolve SOS</Confirm>
        </div>
      </article>;
    })}
  </section>;
}
