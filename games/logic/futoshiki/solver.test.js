const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');

const SOL = '1234341221434321';
const mk = (givens, h, v) => L.normalisePuzzle({ id: 'x', difficulty: 'easy', size: 4, givens, h, v, solution: SOL });
const none = '.'.repeat(12);

test('countSolutions finds one solution for a fully given grid', () => {
  assert.equal(S.countSolutions(mk(SOL, none, none)), 1);
});

test('countSolutions stops at the limit when many grids fit', () => {
  assert.equal(S.countSolutions(mk('.'.repeat(16), none, none)), 2);
  assert.equal(S.countSolutions(mk('.'.repeat(16), none, none), 5), 5);
});

test('countSolutions returns 0 for contradictions', () => {
  assert.equal(S.countSolutions(mk('11..............', none, none)), 0);
  // 1 < 1 impossible
  assert.equal(S.countSolutions(mk('................', '<' + '.'.repeat(11), none)), 2);
  assert.equal(S.countSolutions(mk('4...............', '<' + '.'.repeat(11), none)), 0);
});

test('solve returns the grid or null', () => {
  const p = mk('1.3.............', none, none);
  const g = S.solve(p);
  assert.equal(g[0], 1);
  assert.equal(g[2], 3);
  assert.equal(S.solve(mk('11..............', none, none)), null);
});

test('inequalities narrow the answer', () => {
  // Row 0 pinned to 1234 by signs leaves the 24 Latin squares with that first row.
  assert.equal(S.countSolutions(mk('................', '<<<' + '.'.repeat(9), none), 1000), 24);
  assert.equal(S.countSolutions(mk('................', '<<<' + '.'.repeat(9), '>' + '.'.repeat(11)), 1000), 0);
});

test('simpleSolve finishes an easy puzzle with row/column singles', () => {
  // Three givens per row-ish: naked singles and hidden singles finish it.
  const r = S.simpleSolve(mk('123.34.2214.4.2.', none, none));
  assert.equal(r.solved, true);
  assert.deepEqual(r.grid, SOL.split('').map(Number));
});

test('simpleSolve uses sign bounds', () => {
  // 1 . . . / row 0 chain 1<2<3<4 pins the whole row without givens.
  const r = S.simpleSolve(mk('................', '<<<' + '.'.repeat(9), none));
  assert.deepEqual(r.grid.slice(0, 4), [1, 2, 3, 4]);
});

test('simpleSolve reports unsolved when logic runs out', () => {
  const r = S.simpleSolve(mk('................', none, none));
  assert.equal(r.solved, false);
});

test('simpleSolve reports a contradiction as unsolved', () => {
  const r = S.simpleSolve(mk('11..............', none, none));
  assert.equal(r.solved, false);
  assert.equal(r.grid, null);
});

test('a cycle of signs has no solution (and does not hang)', () => {
  // cell0 < cell1 < cell5 < cell4 < cell0
  const h = '<' + '..' + '>' + '.'.repeat(8);
  const v = '>' + '<' + '.'.repeat(10);
  assert.equal(S.countSolutions(mk('................', h, v)), 0);
});

test('chains of signs limit a square before anything is placed', () => {
  // 1<2<3<4 along a row: square 3 can only be 4.
  const p = mk('................', '<<<' + '.'.repeat(9), none);
  assert.equal(S.countSolutions(p, 1000), 24);
});
