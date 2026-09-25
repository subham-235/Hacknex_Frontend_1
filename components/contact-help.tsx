'use client';
import type { Session } from '@/lib/models';
import { sosProgress } from '@/lib/sos-progress.mjs';

export function ContactHelp({ session, stale = false }: { session: Session; stale?: boolean }) {
  const active = sosProgress(session).active;
  const contacts = session.recipients.filter(c => c.responseStatus && c.responseStatus !== 'pending');
  if (!contacts.length) return null;
  return <div aria-label="Trusted contact help" aria-live="polite">
    {contacts.map(contact => <div className="action-card" key={contact.contactId}>
      <strong>{contact.label || 'Trusted contact'}</strong>
      <p>{contact.responseStatus === 'coming' ? active ? 'Coming to help' : 'Previously confirmed they were coming'
        : contact.responseStatus === 'arrived' ? 'Confirmed arrival' : 'Cannot help'}</p>
      {active && contact.responseStatus !== 'cannot_help' && <p>
        {!stale && contact.tracking?.fresh
          ? `Approximately ${contact.tracking.distanceMeters} m away`
          : 'Current distance unavailable. Waiting for fresh shared location.'}
      </p>}
    </div>)}
  </div>;
}
