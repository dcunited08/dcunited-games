const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');

const puzzle = { grid: ['T...', '....', '..T.', '....'], rows: [0, 1, 1, 0], cols: [1, 0, 0, 1] };
const idx = (r, c) => r * 4 + c;

// Reference: try every set of cells and count the ones L.isSolved accepts.
function bruteCount(p) {
  const n = p.size;
  let count = 0;
  for (let mask = 0; mask < 1 << (n * n); mask++) {
    const s = L.createState(p);
    for (let i = 0; i < n * n; i++) if (mask & (1 << i)) s.cells[i] = 'tent';
    if (L.isSolved(p, s)) count++;
  }
  return count;
}

function randomPuzzle(seed) {
  let x = seed * 2654435761 >>> 0;
  const rnd = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
  const n = 4;
  const trees = [];
  for (let i = 0; i < n * n; i++) if (rnd() < 0.22) trees.push(i);
  const grid = [];
  for (let r = 0; r < n; r++) grid.push([...Array(n).keys()].map((c) => (trees.includes(r * n + c) ? 'T' : '.')).join(''));
  // Clues from a random tent set (not necessarily solvable: 0-solution puzzles are fine too).
  const rows = Array(n).fill(0);
  const cols = Array(n).fill(0);
  const k = trees.length;
  for (let t = 0; t < k; t++) { rows[Math.floor(rnd() * n)]++; cols[Math.floor(rnd() * n)]++; }
  return { grid, rows: rows.map((v) => Math.min(v, n)), cols: cols.map((v) => Math.min(v, n)) };
}

test('countSolutions agrees with brute force on small random puzzles', () => {
  let nonZero = 0;
  for (let seed = 1; seed <= 25; seed++) {
    const p = L.parsePuzzle(randomPuzzle(seed));
    const expected = bruteCount(p);
    if (expected > 0) nonZero++;
    assert.equal(S.countSolutions(p, 1000), expected, JSON.stringify(p.grid));
  }
  assert.ok(nonZero > 0);
});

test('countSolutions stops at the limit', () => {
  // Mirror-image answers: tents at (0,0)+(2,2) or (0,2)+(2,0).
  const multi = { grid: ['.T.', '...', '.T.'], rows: [1, 0, 1], cols: [1, 0, 1] };
  assert.equal(S.countSolutions(multi, 1), 1);
  assert.equal(S.countSolutions(multi), 2);
  assert.equal(S.countSolutions(multi, 5), 2);
});

test('solve returns the tent cells of the unique answer', () => {
  assert.deepEqual(S.solve(puzzle), [idx(1, 0), idx(2, 3)]);
});

test('solve returns null when there is no answer or the clues cannot add up', () => {
  assert.equal(S.solve({ grid: ['T...', '....', '..T.', '....'], rows: [0, 1, 1, 0], cols: [0, 0, 0, 2] }), null);
  assert.equal(S.solve({ grid: ['T.', '..'], rows: [1, 1], cols: [1, 1] }), null);
  assert.equal(S.countSolutions({ grid: ['T.', '..'], rows: [1, 0], cols: [0, 0] }), 0);
});

test('hint takes off a wrong tent or a wrong grass first', () => {
  const s = L.createState(puzzle);
  s.cells[idx(3, 3)] = 'tent';
  let h = S.hint(puzzle, s);
  assert.deepEqual([h.r, h.c, h.value], [3, 3, 'empty']);
  const t = L.createState(puzzle);
  t.cells[idx(1, 0)] = 'grass';
  h = S.hint(puzzle, t);
  assert.deepEqual([h.r, h.c, h.value], [1, 0, 'empty']);
  assert.match(h.reason, /grass/i);
});

test('hint gives a correct move with a reason, and is null once finished', () => {
  const s = L.createState(puzzle);
  const sol = S.solve(puzzle);
  const h = S.hint(puzzle, s);
  assert.ok(['tent', 'grass'].includes(h.value));
  assert.equal(sol.includes(h.r * 4 + h.c), h.value === 'tent');
  assert.ok(h.reason.length > 0);
  const done = L.createState(puzzle);
  sol.forEach((i) => { done.cells[i] = 'tent'; });
  done.cells.forEach((v, i) => { if (v === 'empty' && !puzzle.grid[Math.floor(i / 4)][i % 4].match(/T/)) done.cells[i] = 'grass'; });
  assert.equal(S.hint(puzzle, done), null);
  assert.equal(S.hint({ grid: ['T.', '..'], rows: [1, 1], cols: [1, 1] }, L.createState({ grid: ['T.', '..'], rows: [1, 1], cols: [1, 1] })), null);
});

test('repeated hints solve the puzzle', () => {
  let s = L.createState(puzzle);
  for (let n = 0; n < 40; n++) {
    const h = S.hint(puzzle, s);
    if (!h) break;
    s = L.setCell(puzzle, s, h.r, h.c, h.value);
  }
  assert.equal(S.hint(puzzle, s), null);
  assert.equal(L.isSolved(puzzle, s), true);
});

test('difficultyScore plays with easy deductions only', () => {
  const d = S.difficultyScore(puzzle);
  assert.equal(d.solved, true);
  assert.equal(d.tier, 1);
  assert.ok(d.steps > 0);
});

test('the "touches every spot" rule only applies from tier 2', () => {
  // Tree (0,0) can take its tent at (0,1) or (1,0); (1,1) touches both, so it is grass.
  const p = L.parsePuzzle({ grid: ['T...', '....', '.T..', '....'], rows: [2, 1, 1, 2], cols: [1, 1, 2, 0] });
  assert.equal(S.nextDeduction(p, Array(16).fill(0), 1), null);
  const d = S.nextDeduction(p, Array(16).fill(0), 2);
  assert.deepEqual([d.i, d.value], [idx(1, 1), 'grass']);
});

test('grade names the lowest tier that solves the puzzle', () => {
  assert.equal(S.grade(puzzle), 'easy');
  assert.equal(S.gradeOf({ solved: true, tier: 2 }), 'medium');
  assert.equal(S.gradeOf({ solved: false, tier: 2 }), 'hard');
});

test('nextDeduction reports row, column, touching and single-spot reasons', () => {
  const p = L.parsePuzzle(puzzle);
  const marks = Array(16).fill(0);
  let d = S.nextDeduction(p, marks, 1);
  assert.equal(d.value, 'grass'); // row 0 and column 1/2 want no tents
  marks[idx(1, 0)] = 1;
  marks[idx(2, 3)] = 1;
  d = S.nextDeduction(p, marks, 1);
  assert.match(d.reason, /already has all its tents/);
  const touch = L.parsePuzzle({ grid: ['T..T', '....', '....', '....'], rows: [1, 1, 0, 0], cols: [1, 0, 0, 1] });
  const m2 = Array(16).fill(0);
  m2[1] = 1;
  assert.equal(S.nextDeduction(touch, m2, 1).value, 'grass');
  assert.equal(S.nextDeduction(puzzle, [1, ...Array(15).fill(2)], 1), null);
});

test('a lone tree spot is reported as a tent', () => {
  // Tree (0,0) has grass at (0,1): its only spot is (1,0).
  const p = L.parsePuzzle({ grid: ['T..', '...', '..T'], rows: [0, 2, 0], cols: [2, 0, 0] });
  const marks = Array(9).fill(2);
  marks[3] = 0;
  assert.match(S.nextDeduction(p, marks, 1).reason, /(only one spot|needs)/);
});
