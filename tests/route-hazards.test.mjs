import test from 'node:test';
import assert from 'node:assert/strict';
import { hazardsAlongRoute, hazardsAtLocation } from '../lib/route-hazards.mjs';

const route = [
  { latitude: 22.57, longitude: 88.36 },
  { latitude: 22.59, longitude: 88.36 },
];

test('selects only reported areas whose approximate zones intersect the route', () => {
  const hazards = hazardsAlongRoute(route, [
    [22.58, 88.365, 0.8],
    [22.58, 88.39, 1],
  ], 800);
  assert.equal(hazards.length, 1);
  assert.equal(hazards[0].intensity, 0.8);
});

test('alerts only while the current position is inside a route hazard zone', () => {
  const hazards = hazardsAlongRoute(route, [[22.58, 88.365, 0.8]], 800);
  assert.equal(hazardsAtLocation({ latitude: 22.58, longitude: 88.36 }, hazards).length, 1);
  assert.equal(hazardsAtLocation({ latitude: 22.57, longitude: 88.34 }, hazards).length, 0);
});
