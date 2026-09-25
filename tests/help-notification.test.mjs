import test from 'node:test';
import assert from 'node:assert/strict';
import { helpNotification } from '../lib/help-notification.mjs';

const session = {
  status: 'active', activeResponder: { userId: 'helper', currentStatus: 'en_route' },
  responderTracking: { fresh: true, distanceMeters: 100, zone: 'approaching' },
};
test('fresh distances are announced with stable keys within a distance band', () => {
  const result = helpNotification(session);
  assert.match(result.message, /approximately 100 m away/);
  const at = distanceMeters => helpNotification({ ...session, responderTracking: { ...session.responderTracking, distanceMeters } });
  assert.equal(result.key, at(95).key);
  assert.notEqual(result.key, at(50).key);
});
test('stale locations and closed rescues never announce a current distance', () => {
  assert.doesNotMatch(helpNotification({ ...session, responderTracking: { ...session.responderTracking, fresh: false } }).message, /m away/);
  assert.doesNotMatch(helpNotification({ ...session, status: 'resolved' }).message, /m away/);
});
test('contact acknowledgment does not invent travel or distance', () => {
  const result = helpNotification({ status: 'acknowledged', acknowledgments: [{ contactId: 'family' }] });
  assert.match(result.message, /trusted contact/);
  assert.doesNotMatch(result.message, /m away|is coming|on the way/);
});

test('a new ordinary contact reply changes the notification key without inventing acknowledgment', () => {
  const before = helpNotification(session);
  const after = helpNotification({ ...session, events: [{ _id: 'reply-1', type: 'contact_reply', text: 'checking' }] });
  assert.notEqual(before.key, after.key);
  assert.match(after.message, /contact reply is available/);
  assert.doesNotMatch(after.message, /contact\(s\) acknowledged/);
});

test('secure-link contact help includes fresh distance and sounds on proximity milestones', () => {
  const contact = { contactId: 'mother', label: 'Mother', responseStatus: 'coming', tracking: { fresh: true, distanceMeters: 100 } };
  const s = { status: 'active', recipients: [contact] };
  const first = helpNotification(s);
  assert.match(first.message, /Mother is coming to help, approximately 100 m away/);
  assert.match(first.title, /coming to help/);
  assert.notEqual(first.key, helpNotification({ ...s, recipients: [{ ...contact, tracking: { fresh: true, distanceMeters: 50 } }] }).key);
  assert.doesNotMatch(helpNotification({ ...s, recipients: [{ ...contact, tracking: { fresh: false, distanceMeters: 100 } }] }).message, /100 m away/);
  const declined = helpNotification({ ...s, recipients: [{ ...contact, responseStatus: 'cannot_help' }] });
  assert.match(declined.message, /Mother cannot help/);
  assert.doesNotMatch(declined.message, /is coming|100 m away/);
  assert.doesNotMatch(helpNotification({ ...s, status: 'resolved' }).message, /is coming|100 m away/);
});
