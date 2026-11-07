const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./solver.js');

const BOXES = Array.from({ length: 81 }, (_, i) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3));
const parse = (s) => s.split('').map(Number);
const PUZZLE = parse('530070000600195000098000060800060003400803001700020006060000280000419005000080079');
const ANSWER = parse('534678912672195348198342567859761423426853791713924856961537284287419635345286179');

function valid(g, regions) {
  for (let a = 0; a < 9; a++) {
    const row = new Set(), col = new Set(), reg = new Set();
    for (let i = 0; i < 81; i++) {
      if (Math.floor(i / 9) === a) row.add(g[i]);
      if (i % 9 === a) col.add(g[i]);
      if (regions[i] === a) reg.add(g[i]);
    }
    if (row.size !== 9 || col.size !== 9 || reg.size !== 9) return false;
  }
  return true;
}

test('solve finds the answer to a classic puzzle on box regions', () => {
  assert.deepEqual(S.solve(BOXES, PUZZLE), ANSWER);
});

test('countSolutions is 1 for a unique puzzle and stops at the limit for an empty grid', () => {
  assert.equal(S.countSolutions(BOXES, PUZZLE), 1);
  assert.equal(S.countSolutions(BOXES, new Array(81).fill(0)), 2);
  assert.equal(S.countSolutions(BOXES, new Array(81).fill(0), 5), 5);
});

test('givens may be a string of digits', () => {
  assert.equal(S.countSolutions(BOXES, PUZZLE.join('')), 1);
});

test('conflicting or impossible givens give no solution', () => {
  const g = new Array(81).fill(0);
  g[0] = 5; g[1] = 5;
  assert.equal(S.countSolutions(BOXES, g), 0);
  assert.equal(S.solve(BOXES, g), null);
  const h = new Array(81).fill(0);
  h[0] = 5; h[10] = 5; // same region
  assert.equal(S.countSolutions(BOXES, h), 0);
});

test('a cell with no candidates prunes the search', () => {
  const g = new Array(81).fill(0);
  [1, 2, 3, 4, 5, 6, 7, 8].forEach((d, k) => { g[9 + k] = d; }); // row 1 cols 0-7 hold 1..8
  g[0] = 9; // cell 0 sees 9 above... cell 8 needs 9 in row 1 but col/row clash
  g[17] = 0;
  g[26] = 9; // box 2? makes cell (1,8) unable to take 9
  assert.equal(S.countSolutions(BOXES, g), 0);
});

test('works on a wiggly layout and respects the node budget', () => {
  // Rows as regions plus a shifted latin square exists, so solutions exist.
  const rows = Array.from({ length: 81 }, (_, i) => Math.floor(i / 9));
  const sol = S.solve(rows, new Array(81).fill(0));
  assert.ok(sol && valid(sol, rows));
  assert.equal(S.countSolutions(BOXES, new Array(81).fill(0), 2, 5), 2, 'aborted counts as limit');
  assert.equal(S.solve(BOXES, new Array(81).fill(0), 3), null, 'aborted solve gives null');
});

test('a random digit order still gives a valid grid', () => {
  let n = 1;
  const rng = () => { n = (n * 16807) % 2147483647; return n / 2147483647; };
  const g = S.solve(BOXES, new Array(81).fill(0), Infinity, rng);
  assert.ok(valid(g, BOXES));
  assert.notDeepEqual(g, S.solve(BOXES, new Array(81).fill(0)));
});
