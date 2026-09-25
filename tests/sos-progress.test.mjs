import test from 'node:test';
import assert from 'node:assert/strict';
import { sosProgress } from '../lib/sos-progress.mjs';
const base = { status: 'active', attempts: [], acknowledgments: [] };
test('an SOS stays active regardless of microphone state; submission is not acknowledgment', () => {
  const p = sosProgress({ ...base, microphoneActive: false, attempts: [{ status: 'sent' }] });
  assert.equal(p.active, true);
  assert.match(p.title, /searching/);
  assert.match(p.delivery, /submitted.*not yet confirmed/);
});
test('delivered SMS does not falsely promise incoming help', () => {
  const p = sosProgress({ ...base, attempts: [{ status: 'delivered' }] });
  assert.match(p.delivery, /delivered.*No contact has acknowledged/);
  assert.match(p.detail, /No responder/);
});
test('a contact reply is distinct from responder assignment', () => {
  const p = sosProgress({ ...base, acknowledgments: [{}] });
  assert.match(p.title, /acknowledged/);
  assert.match(p.detail, /No nearby responder is assigned/);
});
test('accepted, en route, nearby, candidate and confirmed arrival stay distinct', () => {
  const assigned = { ...base, activeResponder: { currentStatus: 'assigned' } };
  assert.match(sosProgress(assigned).detail, /departure is not yet confirmed/);
  const enRoute = { ...assigned, activeResponder: { currentStatus: 'en_route' } };
  assert.equal(sosProgress(enRoute).title, 'Help is on the way');
  assert.match(sosProgress(enRoute).detail, /unconfirmed/);
  assert.match(sosProgress({ ...enRoute, responderTracking: { fresh: true, zone: 'nearby' } }).title, /nearby/);
  assert.match(sosProgress({ ...enRoute, responderTracking: { fresh: true, zone: 'arrival_candidate' } }).detail, /still needs confirmation/);
  const arrived = sosProgress({ ...enRoute, activeResponder: { currentStatus: 'arrived' } });
  assert.match(arrived.title, /confirmed arrival/); assert.equal(arrived.active, true);
});
test('escalation, failed messages and lack of responders are explicit', () => {
  assert.match(sosProgress({ ...base, escalationStage: 2 }).title, /wider area/);
  const p = sosProgress({ ...base, escalationState: 'help_unavailable', attempts: [{ status: 'failed' }] });
  assert.match(p.title, /No nearby responder/); assert.match(p.delivery, /failed/);
});
test('resolved/expired incidents never continue promising rescue', () => {
  for (const session of [{ ...base, status: 'resolved' }, { ...base, status: 'expired' }, { ...base, expiresAt: new Date(0).toISOString() }]) {
    const p = sosProgress({ ...session, activeResponder: { currentStatus: 'en_route' } });
    assert.equal(p.active, false); assert.doesNotMatch(p.title, /on the way/);
  }
});
test('distance updates do not repeatedly toast the same rescue stage', () => {
  const s = { ...base, activeResponder: { currentStatus: 'en_route' }, responderTracking: { fresh: true, zone: 'approaching', distanceMeters: 400 } };
  assert.equal(sosProgress(s).key, sosProgress({ ...s, responderTracking: { ...s.responderTracking, distanceMeters: 350 } }).key);
  assert.notEqual(sosProgress(s).key, sosProgress({ ...s, responderTracking: { ...s.responderTracking, zone: 'nearby' } }).key);
});
