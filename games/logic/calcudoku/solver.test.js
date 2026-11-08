const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./solver.js');

const cage = (op, target, cells) => ({ op, target, cells });
const singles = (vals) => vals.map((v, i) => cage('', v, [i]));

test('countSolutions finds the one answer when every cell is a single', () => {
  const p = { size: 3, cages: singles([1, 2, 3, 2, 3, 1, 3, 1, 2]) };
  assert.equal(S.countSolutions(p), 1);
  assert.deepEqual(S.solve(p), [1, 2, 3, 2, 3, 1, 3, 1, 2]);
});

test('countSolutions stops at the limit', () => {
  const p = { size: 3, cages: [cage('+', 3, [0, 1]), ...[2, 3, 4, 5, 6, 7, 8].map((i) => cage('+', 6, [i]))] };
  assert.equal(S.countSolutions({ size: 2, cages: [cage('+', 3, [0, 1]), cage('+', 3, [2, 3])] }), 2);
  const wide = { size: 4, cages: [0, 1, 2, 3].map((r) => cage('+', 10, [r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 3])) };
  assert.equal(S.countSolutions(wide), 2);
  assert.equal(S.countSolutions(wide, 5), 5);
  assert.equal(S.countSolutions(wide, 1), 1);
  assert.ok(p);
});

test('subtraction and division cages are respected', () => {
  const sub = { size: 2, cages: [cage('-', 1, [0, 1]), cage('-', 1, [2, 3])] };
  assert.equal(S.countSolutions(sub), 2);
  assert.equal(S.countSolutions({ size: 2, cages: [cage('', 2, [0]), cage('-', 1, [1, 3]), cage('', 1, [2])] }), 1);
  const mul = { size: 2, cages: [cage('*', 2, [0, 1]), cage('/', 2, [2, 3])] };
  assert.equal(S.countSolutions(mul), 2);
  const none = { size: 2, cages: [cage('*', 3, [0, 1]), cage('/', 2, [2, 3])] };
  assert.equal(S.countSolutions(none), 0);
  assert.equal(S.solve(none), null);
});

test('impossible sums and products are pruned', () => {
  assert.equal(S.countSolutions({ size: 2, cages: [cage('+', 4, [0, 1]), cage('+', 3, [2, 3])] }), 0);
  assert.equal(S.countSolutions({ size: 3, cages: [cage('+', 3, [0, 1, 2]), ...[3, 4, 5, 6, 7, 8].map((i) => cage('', 1, [i]))] }), 0);
  assert.equal(S.countSolutions({ size: 3, cages: [cage('*', 7, [0, 1]), ...[2, 3, 4, 5, 6, 7, 8].map((i) => cage('', 1, [i]))] }), 0);
});

test('three cell cages work (product and sum)', () => {
  const p = { size: 3, cages: [cage('*', 6, [0, 1, 2]), cage('+', 6, [3, 4, 5]), cage('+', 6, [6, 7, 8])] };
  assert.equal(S.countSolutions(p, 100), 6 * 2);
});
