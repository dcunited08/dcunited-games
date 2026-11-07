const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');

// Exactly one solution: stars at columns 3,0,2,4,1.
const UNIQUE = ['BBAAA', 'BBCCC', 'BCCCC', 'BCCCD', 'EECCD'];
const UNIQUE_SOLUTION = [3, 0, 2, 4, 1];
// Four solutions.
const MANY = ['AABBB', 'ACBBB', 'CCCDD', 'EECDD', 'EEEDD'];
// Zero solutions: no 2x2 board can hold two non-touching stars.
const NONE = ['AB', 'AB'];

test('countSolutions counts up to the limit', () => {
  assert.equal(S.countSolutions(UNIQUE), 1);
  assert.equal(S.countSolutions(MANY), 2);
  assert.equal(S.countSolutions(MANY, 10), 4);
  assert.equal(S.countSolutions(MANY, 3), 3);
});

test('countSolutions accepts parsed puzzles and finds zero', () => {
  assert.equal(S.countSolutions(L.parsePuzzle(UNIQUE)), 1);
  assert.equal(S.countSolutions(NONE), 0);
});

test('solve returns the star column of each row, or null', () => {
  assert.deepEqual(S.solve(UNIQUE), UNIQUE_SOLUTION);
  assert.equal(S.solve(NONE), null);
});

function stateWith(stars, xs = []) {
  let s = L.createState(UNIQUE);
  stars.forEach(([r, c]) => { s = L.setCell(s, r, c, 'star'); });
  xs.forEach(([r, c]) => { s = L.setCell(s, r, c, 'x'); });
  return s;
}

test('hint on an empty board suggests a solution star in a tight region', () => {
  const h = S.hint(UNIQUE, stateWith([]));
  assert.equal(h.value, 'star');
  assert.equal(UNIQUE_SOLUTION[h.r], h.c);
  assert.match(h.reason, /region/i);
  // Regions D and E have only two cells, so one of them is chosen.
  assert.ok(['D', 'E'].includes(UNIQUE[h.r][h.c]));
});

test('hint prefers the region with fewest open cells', () => {
  // X out one cell of region E so E has a single open cell: (4,1).
  const h = S.hint(UNIQUE, stateWith([], [[4, 0]]));
  assert.deepEqual([h.r, h.c, h.value], [4, 1, 'star']);
});

test('hint skips regions that already have their star', () => {
  const h = S.hint(UNIQUE, stateWith([[3, 4], [4, 1]]));
  assert.equal(h.value, 'star');
  assert.ok(![[3, 4], [4, 1]].some(([r, c]) => r === h.r && c === h.c));
  assert.equal(UNIQUE_SOLUTION[h.r], h.c);
});

test('hint first asks to remove a wrong star (value empty)', () => {
  const h = S.hint(UNIQUE, stateWith([[0, 0], [3, 4]]));
  assert.deepEqual([h.r, h.c, h.value], [0, 0, 'empty']);
  assert.match(h.reason, /star/i);
});

test('hint then asks to clear an X that sits on a solution cell', () => {
  const h = S.hint(UNIQUE, stateWith([], [[0, 3]]));
  assert.deepEqual([h.r, h.c, h.value], [0, 3, 'empty']);
  assert.match(h.reason, /X/);
});

test('hint is null once every solution star is placed', () => {
  const all = UNIQUE_SOLUTION.map((c, r) => [r, c]);
  assert.equal(S.hint(UNIQUE, stateWith(all)), null);
});

test('hint is null for an unsolvable puzzle', () => {
  assert.equal(S.hint(NONE, L.createState(NONE)), null);
});

test('difficultyScore solves a puzzle made of one-cell regions with no confinement', () => {
  const d = S.difficultyScore(['DADD', 'DDDB', 'CDDD', 'DDDD']);
  assert.deepEqual(d, { solved: true, stars: 4, steps: 4, confinements: 0 });
});

test('difficultyScore counts confinement deductions and can get stuck', () => {
  const d = S.difficultyScore(UNIQUE);
  assert.equal(d.solved, false);
  assert.ok(d.confinements > 0);
  assert.ok(d.steps > d.confinements);
  assert.ok(d.stars < 5);
});

test('difficultyScore cannot fully solve a puzzle with several answers', () => {
  const d = S.difficultyScore(MANY);
  assert.equal(d.solved, false);
});
