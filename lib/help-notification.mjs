import { sosProgress } from './sos-progress.mjs';

export function helpNotification(session) {
  const progress = sosProgress(session);
  const responder = session.activeResponder;
  const tracking = session.responderTracking;
  const distance = progress.active && responder &&
    !['cancelled', 'completed'].includes(responder.currentStatus) && tracking?.fresh &&
    Number.isFinite(tracking.distanceMeters) && tracking.distanceMeters >= 0
    ? Math.round(tracking.distanceMeters) : null;
  // Announce meaningful distance changes, not every GPS fluctuation.
  const band = distance === null ? 'unknown' : [50, 100, 250, 500, 1000].find(limit => distance <= limit) ?? 'far';
  const replies = (session.events || []).filter(event => event.type === 'contact_reply');
  const latestReply = replies.at(-1);
  const contactUpdates = progress.active ? (session.recipients || []).filter(r => ['coming', 'cannot_help', 'arrived'].includes(r.responseStatus)).map(r => {
    const meters = ['coming', 'arrived'].includes(r.responseStatus) && r.tracking?.fresh && Number.isFinite(r.tracking.distanceMeters) && r.tracking.distanceMeters >= 0 ? Math.round(r.tracking.distanceMeters) : null;
    const band = meters === null ? 'unknown' : [50, 100, 250, 500, 1000].find(limit => meters <= limit) ?? 'far';
    return {
      key: `${r.contactId}:${r.responseStatus}:${band}`,
      message: `${r.label || 'Your contact'} ${r.responseStatus === 'cannot_help' ? 'cannot help' : r.responseStatus === 'arrived' ? 'confirmed arrival' : 'is coming to help'}${meters === null ? '' : `, approximately ${meters} m away`}.`,
    };
  }) : [];
  return {
    ...progress,
    key: `${progress.key}:${responder?.userId || ''}:${band}:${latestReply?._id || latestReply?.at || ''}:${contactUpdates.map(c => c.key).join(',')}`,
    message: `${progress.title}. ${distance === null ? progress.detail : `Your responder is approximately ${distance} m away.`} ${progress.delivery} ${contactUpdates.map(c => c.message).join(' ')}${latestReply ? ' A contact reply is available in Safety agent.' : ''}`,
  };
}
