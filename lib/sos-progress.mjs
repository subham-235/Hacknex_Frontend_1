export function sosProgress(session, now = Date.now()) {
  const expired = session.status === 'expired' || (session.expiresAt && +new Date(session.expiresAt) <= now);
  const active = session.status !== 'resolved' && !expired;
  const attempts = session.attempts || [];
  const delivered = attempts.filter(a => ['delivered', 'read'].includes(a.status)).length;
  const submitted = attempts.filter(a => ['accepted', 'queued', 'sending', 'sent', 'delivered', 'read'].includes(a.status)).length;
  const acknowledged = session.acknowledgments?.length || 0;
  const contacts = (session.recipients || []).filter(r => ['coming', 'cannot_help', 'arrived'].includes(r.responseStatus));
  const helping = contacts.filter(r => ['coming', 'arrived'].includes(r.responseStatus));
  const delivery = contacts.length ? `${contacts.length} trusted contact(s) responded through their secure link.`
    : acknowledged ? `${acknowledged} trusted contact(s) acknowledged your SOS.`
    : delivered ? `${delivered} SMS alert(s) delivered. No contact has acknowledged yet.`
    : submitted ? `${submitted} SMS alert(s) submitted. Delivery and acknowledgment are not yet confirmed.`
    : attempts.length && attempts.every(a => ['failed', 'undelivered', 'canceled', 'blocked'].includes(a.status))
      ? 'SMS alerts failed. No contact acknowledgment is confirmed.'
      : 'Your SOS is recorded. Contact delivery is not yet confirmed.';
  const responder = session.activeResponder;
  const tracking = session.responderTracking;
  let stage = 'searching', title = 'SOS active — searching for help', detail = 'No responder has confirmed help yet.';
  if (!active) {
    stage = session.status === 'resolved' ? 'resolved' : 'expired';
    title = stage === 'resolved' ? 'Your SOS has been resolved' : 'SOS monitoring has expired';
    detail = stage === 'resolved' ? 'This incident is closed.' : 'Help is not confirmed by an expired session. Start a new SOS if you still need assistance.';
  } else if (responder && !['cancelled', 'completed'].includes(responder.currentStatus)) {
    stage = responder.currentStatus === 'arrived' ? 'arrived'
      : tracking?.fresh && ['approaching', 'nearby', 'arrival_candidate'].includes(tracking.zone) ? tracking.zone
      : responder.currentStatus === 'en_route' ? 'en_route' : 'assigned';
    title = { assigned: 'Someone has accepted your SOS', en_route: 'Help is on the way', approaching: 'Your responder is approaching', nearby: 'Your responder is nearby', arrival_candidate: 'Responder is within the arrival area', arrived: 'Your responder confirmed arrival' }[stage];
    detail = stage === 'assigned' ? 'A responder is assigned. Their departure is not yet confirmed.'
      : stage === 'arrival_candidate' ? 'GPS suggests proximity; arrival still needs confirmation.'
      : stage === 'arrived' ? 'Your incident remains active until you mark yourself safe.'
      : 'An assigned responder is coming to help.';
    if (!tracking?.fresh && stage !== 'arrived') detail += ' Waiting for a fresh location update; current distance and ETA are unconfirmed.';
  } else if (helping.length) {
    const arrived = helping.some(r => r.responseStatus === 'arrived');
    stage = arrived ? 'contact-arrived' : 'contact-coming';
    title = arrived ? 'A trusted contact confirmed arrival' : 'Your trusted contact is coming to help';
    detail = arrived ? 'Your incident remains active until you mark yourself safe.' : 'A contact confirmed they are coming. Distance appears when they choose to share a fresh location.';
  } else if (responder?.currentStatus === 'completed') {
    stage = 'completed'; title = 'Responder marked assistance complete'; detail = 'Your incident remains active until you mark yourself safe.';
  } else if (session.escalationState === 'help_unavailable') {
    stage = 'unavailable'; title = 'No nearby responder has confirmed help'; detail = 'The search reached its configured limit. Contact emergency services if you still need help.';
  } else if (acknowledged) {
    stage = 'acknowledged'; title = 'Your SOS was acknowledged'; detail = 'A trusted contact replied. No nearby responder is assigned yet.';
  } else if ((session.escalationStage || 0) > 1) {
    stage = `expanded-${session.escalationStage}`; title = 'Searching a wider area for help';
  }
  return { active, title, detail, delivery, key: `${stage}:${acknowledged}:${delivered}:${submitted}:${contacts.map(r => `${r.contactId}-${r.responseStatus}`).join(',')}` };
}
