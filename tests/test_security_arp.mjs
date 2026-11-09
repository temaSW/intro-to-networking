import test from 'node:test';
import assert from 'node:assert/strict';
import { arpState, LAST_STEP } from '../course/interactives/security-arp-model.js';

test('an announcement alone does not change the stored next-hop mapping', () => {
  assert.equal(arpState(0).mapping, 'MAC G');
  const announcement = arpState(1);
  assert.equal(announcement.message, true);
  assert.equal(announcement.mapping, 'MAC G');
  assert.equal(arpState(2).mapping, 'MAC X');
  assert.equal(arpState(2).toX, false);
  assert.equal(arpState(3).frame, 'S → X');
});

test('forwarding and dropping differ in delivery, not the final IP destination', () => {
  for (let step = 0; step <= LAST_STEP; step++) {
    for (const action of ['forward', 'drop']) assert.equal(arpState(step, action).destinationIP, 'R');
  }
  assert.equal(arpState(4, 'forward').path, 'S → X → G');
  const dropped = arpState(4, 'drop');
  assert.equal(dropped.path, 'S → X');
  assert.equal(dropped.toG, false);
  assert.equal(dropped.dropped, true);
  assert.equal(arpState(0).path, 'S → G');
});
