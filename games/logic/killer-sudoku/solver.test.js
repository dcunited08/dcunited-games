const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./solver.js');

// A valid sudoku grid by a simple pattern.
const GRID = Array.from({ length: 81 }, (_, i) => {
  const r = Math.floor(i / 9), c = i % 9;
  return ((r % 3) * 3 + Math.floor(r / 3) + c) % 9 + 1;
});

const singles = () => GRID.map((d, i) => ({ sum: d, cells: [i] }));

function validGrid(g) {
  for (let a = 0; a < 9; a++) {
    const row = new Set(), col = new Set(), box = new Set();
    for (let b = 0; b < 9; b++) {
      row.add(g[a * 9 + b]);
      col.add(g[b * 9 + a]);
      box.add(g[(Math.floor(a / 3) * 3 + Math.floor(b / 3)) * 9 + (a % 3) * 3 + (b % 3)]);
    }
    if (row.size !== 9 || col.size !== 9 || box.size !== 9) return false;
  }
  return true;
}

test('pattern grid is itself a valid sudoku (fixture sanity)', () => {
  assert.ok(validGrid(GRID));
});

test('all single-cell cages have exactly one solution', () => {
  const p = { cages: singles(), givens: {} };
  assert.equal(S.countSolutions(p), 1);
  assert.deepEqual(S.solve(p), GRID);
});

test('givens are respected and may stand in for cage info', () => {
  const cages = [];
  for (let r = 0; r < 9; r++) cages.push({ sum: 45, cells: [...Array(9).keys()].map((c) => r * 9 + c) });
  const givens = {};
  for (let i = 0; i < 81; i += 1) givens[i] = GRID[i];
  assert.equal(S.countSolutions({ cages, givens }), 1);
  delete givens[0];
  delete givens[1];
  assert.equal(S.countSolutions({ cages, givens }), 1);
});

test('countSolutions stops at the limit', () => {
  const cages = [];
  for (let r = 0; r < 9; r++) cages.push({ sum: 45, cells: [...Array(9).keys()].map((c) => r * 9 + c) });
  const p = { cages, givens: {} };
  assert.equal(S.countSolutions(p, 2), 2);
  assert.equal(S.countSolutions(p, 5), 5);
  assert.equal(S.countSolutions(p), 2);
});

test('contradictory puzzles have no solution', () => {
  const cages = singles();
  cages[0] = { sum: GRID[0] === 9 ? 8 : GRID[0] + 1, cells: [0] };
  cages[1] = { sum: cages[0].sum, cells: [1] };
  const p = { cages, givens: {} };
  assert.equal(S.countSolutions(p), 0);
  assert.equal(S.solve(p), null);
});

test('impossible cage sums are rejected', () => {
  const cages = singles();
  cages[0] = { sum: 12, cells: [0] };
  assert.equal(S.solve({ cages, givens: {} }), null);
  const tooBig = [{ sum: 3, cells: [0, 1] }, ...singles().slice(2)];
  tooBig.push({ sum: 40, cells: [] });
  assert.equal(S.solve({ cages: [{ sum: 4, cells: [0, 1] }, { sum: 20, cells: [2] }], givens: {} }), null);
});

test('solves dominoes plus a few givens and satisfies every cage', () => {
  const cages = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 8; c += 2) {
      const a = r * 9 + c;
      cages.push({ sum: GRID[a] + GRID[a + 1], cells: [a, a + 1] });
    }
    cages.push({ sum: GRID[r * 9 + 8], cells: [r * 9 + 8] });
  }
  const p = { cages, givens: { 0: GRID[0] } };
  const sol = S.solve(p);
  assert.ok(sol && validGrid(sol));
  for (const cg of cages) {
    assert.equal(cg.cells.reduce((s, i) => s + sol[i], 0), cg.sum);
  }
  assert.equal(sol[0], GRID[0]);
});

test('solutions() returns distinct full grids up to the limit', () => {
  const cages = [];
  for (let r = 0; r < 9; r++) cages.push({ sum: 45, cells: [...Array(9).keys()].map((c) => r * 9 + c) });
  const sols = S.solutions({ cages, givens: {} }, 3);
  assert.equal(sols.length, 3);
  assert.notDeepEqual(sols[0], sols[1]);
  sols.forEach((s) => assert.ok(validGrid(s)));
});

test('a node budget aborts the search and reports the limit', () => {
  const cages = [];
  for (let r = 0; r < 9; r++) cages.push({ sum: 45, cells: [...Array(9).keys()].map((c) => r * 9 + c) });
  const p = { cages, givens: {} };
  assert.equal(S.countSolutions(p, 2, 1), 2);
  assert.deepEqual(S.solutions(p, 2, 1), []);
});

test('does not mutate its input', () => {
  const p = { cages: singles(), givens: { 3: GRID[3] } };
  const copy = JSON.stringify(p);
  S.solve(p);
  assert.equal(JSON.stringify(p), copy);
});

test('cell with a given conflicting with its cage is unsolvable', () => {
  const p = { cages: singles(), givens: { 0: GRID[0] === 1 ? 2 : 1 } };
  assert.equal(S.countSolutions(p), 0);
});

test('duplicate givens in a row are unsolvable', () => {
  const p = { cages: [{ sum: 45, cells: [...Array(81).keys()] }], givens: { 0: 5, 1: 5 } };
  assert.equal(S.countSolutions(p), 0);
});
