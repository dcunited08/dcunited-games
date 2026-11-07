const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./solver.js');

const { UNKNOWN: U, FILLED: F, EMPTY: E } = S;

test('clues gives run lengths and [] for an empty line', () => {
  assert.deepEqual(S.clues([1, 1, 0, 1, 0, 0, 1, 1, 1]), [2, 1, 3]);
  assert.deepEqual(S.clues([0, 0, 0]), []);
  assert.deepEqual(S.clues([true, false, true]), [1, 1]);
});

test('solveLine finds forced cells by overlap', () => {
  assert.deepEqual(S.solveLine([4], [U, U, U, U, U]), [U, F, F, F, U]);
  assert.deepEqual(S.solveLine([5], [U, U, U, U, U]), [F, F, F, F, F]);
  assert.deepEqual(S.solveLine([], [U, U, U]), [E, E, E]);
  assert.deepEqual(S.solveLine([1, 1, 1], [U, U, U, U, U]), [F, E, F, E, F]);
});

test('solveLine uses known cells', () => {
  assert.deepEqual(S.solveLine([2], [F, U, U, U, U]), [F, F, E, E, E]);
  assert.deepEqual(S.solveLine([1, 1], [U, U, E, U, F]), [U, U, E, E, F]);
});

test('solveLine returns null on contradiction', () => {
  assert.equal(S.solveLine([3], [E, U, U]), null);
  assert.equal(S.solveLine([], [F, U]), null);
});

test('solveLine is quick on a 15-wide line', () => {
  const r = S.solveLine([2, 2, 2, 2], new Array(15).fill(U));
  assert.equal(r.length, 15);
});

test('solvePuzzle solves a line-logic puzzle', () => {
  const rows = ['.#.', '###', '.#.'];
  const res = S.solvePuzzle(S.picture(rows).rows, S.picture(rows).cols);
  assert.equal(res.solved, true);
  assert.equal(res.contradiction, false);
  assert.deepEqual(res.grid, [[0, 1, 0], [1, 1, 1], [0, 1, 0]]);
});

test('solvePuzzle reports unsolved when guessing is needed', () => {
  const p = S.picture(['#.', '.#']);
  const res = S.solvePuzzle(p.rows, p.cols);
  assert.equal(res.solved, false);
  assert.equal(res.contradiction, false);
});

test('solvePuzzle reports a contradiction', () => {
  const res = S.solvePuzzle([[2], [2]], [[1], [1], [1]]);
  assert.equal(res.contradiction, true);
  assert.equal(res.solved, false);
});

test('solvePuzzle contradiction found in columns', () => {
  const res = S.solvePuzzle([[1], [1]], [[2], [2]]);
  assert.equal(res.contradiction, true);
});
