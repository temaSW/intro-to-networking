import test from 'node:test';
import assert from 'node:assert/strict';
import { createTCP, advanceTCP, occupancy, tcpMetrics, CAPACITY } from '../course/interactives/security-tcp-model.js';
import { udpReflection } from '../course/interactives/security-udp-model.js';
import { tcpStory } from '../course/interactives/security-tcp-story-model.js';

function run(config, seconds) {
  let state = createTCP(config);
  for (let i = 0; i < seconds; i++) state = advanceTCP(state);
  return state;
}

test('one handshake holds a waiting record until its final ACK', () => {
  assert.equal(tcpStory(0, 0).used, 0);
  assert.equal(tcpStory(0, 1).used, 1);
  assert.equal(tcpStory(0, 2).used, 1);
  assert.equal(tcpStory(0, 2).established, false);
  assert.equal(tcpStory(0, 3).used, 0);
  assert.equal(tcpStory(0, 3).established, true);
});

test('missing ACK retains a record, timeout releases it', () => {
  assert.equal(tcpStory(1, 3).used, 1);
  assert.equal(tcpStory(1, 3).missing, true);
  assert.equal(tcpStory(1, 3).expired, false);
  assert.equal(tcpStory(1, 4).used, 0);
  assert.equal(tcpStory(1, 4).expired, true);
  assert.equal(tcpStory(1, 4).established, false);
});

test('many incomplete attempts deny a later ordinary attempt without adding a seventh slot', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(step => tcpStory(2, step).used), [0, 2, 4, 6, 6]);
  assert.equal(tcpStory(2, 3).rejected, false);
  assert.equal(tcpStory(2, 4).rejected, true);
});

test('protected teaching case keeps waiting slots free but creates established state only after ACK validation', () => {
  for (let step = 0; step < 5; step++) {
    const state = tcpStory(3, step);
    assert.equal(state.used, 0);
    assert.equal(state.rejected, false);
    assert.equal(state.established, step === 4);
    assert.equal(state.checked, step === 4);
  }
  assert.equal(tcpStory(3, 1).burst, true);
  assert.equal(tcpStory(3, 2).synAck, false);
  assert.equal(tcpStory(3, 3).synAck, true);
  assert.equal(tcpStory(3, 3).ack, false);
  assert.equal(tcpStory(3, 4).ack, true);
});

test('incomplete attempts fill finite state before their timeout', () => {
  const state = run({ rate: 15, complete: 0, timeout: 10, probe: false }, 8);
  assert.equal(occupancy(state), CAPACITY);
  assert.equal(state.total.expired, 0);
  assert.equal(state.total.established, 0);
  const next = advanceTCP(state);
  assert.equal(next.recent.rejected, 15);
  assert.equal(occupancy(state), CAPACITY);
  assert(tcpMetrics(next).kbps < 1000);
});

test('completed handshakes release only the waiting-table resource', () => {
  const state = run({ rate: 15, complete: 100, timeout: 10, probe: false }, 30);
  assert.equal(occupancy(state), 15);
  assert.equal(state.total.established, 15 * 29);
  assert.equal(state.total.rejected, 0);
});

test('timed-out entries leave the table, and ordinary probes can fail', () => {
  let state = run({ rate: 15, complete: 0, timeout: 10 }, 10);
  assert(state.probeFailed > 0);
  assert(state.probeOK > 0);
  state.config = { ...state.config, rate: 0, probe: false };
  for (let i = 0; i < 12; i++) state = advanceTCP(state);
  assert.equal(occupancy(state), 0);
  assert(state.total.expired > 0);
});

test('stateless response protects waiting slots, not packet processing or traffic', () => {
  const state = run({ rate: 60, complete: 0, protected: true }, 20);
  assert.equal(occupancy(state), 0);
  assert.equal(state.total.rejected, 0);
  assert.equal(state.probeFailed, 0);
  assert.equal(state.probeOK, 19);
  assert.equal(state.total.syn, 1220);
  assert.equal(state.total.synAck, 1220);
  assert(tcpMetrics(state).kbps > 0);
});

test('advancing does not mutate a previous observation', () => {
  const first = createTCP({ rate: 60 });
  const serialized = JSON.stringify(first);
  advanceTCP(first);
  assert.equal(JSON.stringify(first), serialized);
  for (const complete of [0, 33, 100]) {
    const state = run({ rate: 60, complete, timeout: 2 }, 40);
    assert(occupancy(state) <= CAPACITY);
    assert.equal(state.total.syn, state.total.synAck + state.total.rejected);
  }
});

test('UDP reflection separates amplification from delivered channel capacity', () => {
  assert.equal(udpReflection(1).victimKbps, 0);
  assert.equal(udpReflection(2).victimKbps, 64);
  assert.equal(udpReflection(3, 8).victimKbps, 512);
  assert.equal(udpReflection(3, 8).amplification, 10);
  assert(udpReflection(3, 6).victimKbps < 400);
  assert(udpReflection(3, 7).victimKbps > 400);
});
