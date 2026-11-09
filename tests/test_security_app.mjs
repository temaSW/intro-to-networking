import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplication, advanceApplication } from '../course/interactives/security-app-model.js';

test('three requests arrive, two finish, one remains; processing is FIFO', () => {
  const initial = createApplication();
  const one = advanceApplication(initial);
  assert.deepEqual(one.arrivals, [1, 2, 3]);
  assert.deepEqual(one.served, [1, 2]);
  assert.deepEqual(one.waiting, [3]);
  const two = advanceApplication(one);
  assert.deepEqual(two.served, [3, 4]);
  assert.deepEqual(two.waiting, [5, 6]);
  assert.deepEqual(initial, createApplication());
  assert.deepEqual(one.waiting, [3]);
});

test('protection limits new work without deleting accepted requests', () => {
  let state = createApplication();
  for (let i = 0; i < 5; i++) state = advanceApplication(state);
  assert.equal(state.waiting.length, 5);
  const earlier = [...state.waiting];
  const first = advanceApplication(state, true);
  assert.equal(first.waiting.length, 3);
  assert.equal(first.refused.length, 3);
  assert.deepEqual(first.served, earlier.slice(0, 2));
  assert.deepEqual(first.waiting, earlier.slice(2));
  const second = advanceApplication(first, true);
  assert.equal(second.waiting.length, 2);
  assert.equal(second.refused.length, 2);
  const third = advanceApplication(second, true);
  assert.equal(third.waiting.length, 2);
  assert.equal(third.refused.length, 1);
  assert.equal(advanceApplication(third).waiting.length, 3);
});

test('each request has one fate, with conservation and no duplicate service under switching protection', () => {
  let state = createApplication();
  const completed = new Set(), rejected = new Set();
  for (let time = 0; time < 20; time++) {
    state = advanceApplication(state, time > 4 && time < 12);
    for (const id of state.served) { assert.ok(!completed.has(id) && !rejected.has(id)); completed.add(id); }
    for (const id of state.refused) { assert.ok(!completed.has(id) && !rejected.has(id)); rejected.add(id); }
    for (const id of state.waiting) assert.ok(!completed.has(id) && !rejected.has(id));
    assert.equal(state.arrived, state.completed + state.rejected + state.waiting.length);
    assert.equal(state.completed, state.time * 2);
    assert.equal(new Set(state.waiting).size, state.waiting.length);
  }
  assert.strictEqual(advanceApplication(state), state);
});
