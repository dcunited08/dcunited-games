const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');

const SQUARE = ['2.2', '...', '2.2'];
const TWO_WAYS = ['3.3', '...', '3.3'];
const DISCONNECTED = ['1.1', '...', '1.1'];
const LINE = ['1.3.2'];

test('solve returns the bridge count of every edge', () => {
  assert.deepEqual(S.solve(SQUARE), [1, 1, 1, 1]);
  assert.deepEqual(S.solve(LINE), [1, 2]);
  assert.deepEqual(S.solve(L.parsePuzzle(LINE)), [1, 2]);
});

test('solve returns null when there is no solution', () => {
  assert.equal(S.solve(DISCONNECTED), null);
  assert.equal(S.solve(['3.1']), null);
});

test('countSolutions counts up to the limit', () => {
  assert.equal(S.countSolutions(SQUARE), 1);
  assert.equal(S.countSolutions(TWO_WAYS), 2);
  assert.equal(S.countSolutions(TWO_WAYS, 1), 1);
  assert.equal(S.countSolutions(DISCONNECTED), 0);
});

test('bridges that cross are never both used', () => {
  // The only way to link all four is not to cross, so this has no answer.
  assert.equal(S.countSolutions(['..1..', '1...1', '..1..']), 0);
  // With a bridge route round the outside there is exactly one.
  const p = ['.2.2.', '2...2', '..1..', '1...1', '.2.2.'];
  assert.equal(S.countSolutions(p) <= 1, true);
});

test('every solution found is accepted by isSolved', () => {
  for (const rows of [SQUARE, LINE, ['2.3', '...', '1.2']]) {
    const p = L.parsePuzzle(rows);
    const sol = S.solve(p);
    if (sol) assert.equal(L.isSolved(p, { counts: sol }), true, rows.join('/'));
  }
});

test('hint on an empty board gives a forced bridge with a reason', () => {
  const p = L.parsePuzzle(LINE);
  const h = S.hint(p, L.createState(p));
  assert.ok(h.reason.length > 10);
  assert.deepEqual([h.edge, h.value].map(Number).every(Number.isInteger), true);
  assert.equal(h.value, S.solve(p)[h.edge]);
  assert.match(h.reason, /island/i);
});

test('hint explains an island that can only use all its room', () => {
  const p = L.parsePuzzle(['2.4.2']);
  const h = S.hint(p, { counts: [2, 0] });
  assert.equal(h.edge, 1);
  assert.equal(h.value, 2);
  assert.match(h.reason, /needs 2 more/);
});

test('hint uses the lower bound: an island whose other neighbours cannot take it all', () => {
  const rows = ['.....', '33..2', '2.1..', '.....', '.34.4'];
  const p = L.parsePuzzle(rows);
  assert.equal(S.countSolutions(rows), 1);
  const h = S.hint(p, L.createState(p));
  assert.match(h.reason, /at least 1 more/);
  assert.equal(h.value, S.solve(p)[h.edge]);
});

test('hint fixes a wrong bridge first', () => {
  const p = L.parsePuzzle(LINE);
  const h = S.hint(p, { counts: [2, 0] });
  assert.equal(h.edge, 0);
  assert.equal(h.value, 1);
  assert.match(h.reason, /not part of the answer|too many/i);
});

test('hint is null when the board already matches the answer', () => {
  const p = L.parsePuzzle(SQUARE);
  assert.equal(S.hint(p, { counts: [1, 1, 1, 1] }), null);
});

test('hint is null when the puzzle has no solution', () => {
  const p = L.parsePuzzle(DISCONNECTED);
  assert.equal(S.hint(p, L.createState(p)), null);
});

test('analyze reports whether plain deduction solves a puzzle', () => {
  const a = S.analyze(LINE);
  assert.equal(a.solved, true);
  assert.ok(a.rounds >= 1);
  assert.equal(S.analyze(SQUARE).solved, false, 'needs a guess');
  assert.equal(S.analyze(DISCONNECTED).solved, false);
  });

test('hint falls back to "part of the answer" when counting alone gets stuck', () => {
  const rows = ['2..2..2', '.......', '5.3....', '.......', '..2....', '5..4..2', '1......'];
  const p = L.parsePuzzle(rows);
  const state = { counts: [0, 2, 0, 0, 0, 1, 2, 2, 2, 1, 0] };
  const h = S.hint(p, state);
  assert.equal(h.reason, 'This bridge is part of the answer.');
  assert.equal(h.value, S.solve(p)[h.edge]);
  assert.ok(state.counts[h.edge] < h.value);
});
