const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

// Walls: (1,1) plain. Row/col numbers are 0-based below.
const OPEN = ['...', '.#.', '...'];
// 4x4 with a 2 at (1,1) and a 0 at (3,3)
const NUM = ['....', '.2..', '....', '...0'];

function put(puzzle, spec) {
  let s = L.createState(puzzle);
  for (const [r, c, v] of spec) s = L.setCell(puzzle, s, r, c, v);
  return s;
}

test('parsePuzzle reads whites, plain walls and numbered walls', () => {
  const p = L.parsePuzzle(NUM);
  assert.equal(p.size, 4);
  assert.equal(p.wall[5], true);
  assert.equal(p.num[5], 2);
  assert.equal(p.num[15], 0);
  assert.equal(p.wall[0], false);
  assert.equal(p.num[0], -1);
  const q = L.parsePuzzle(OPEN);
  assert.equal(q.wall[4], true);
  assert.equal(q.num[4], -1);
});

test('parsePuzzle returns an already parsed puzzle unchanged', () => {
  const p = L.parsePuzzle(OPEN);
  assert.equal(L.parsePuzzle(p), p);
});

test('parsePuzzle rejects bad input', () => {
  assert.throws(() => L.parsePuzzle('nope'), /array/);
  assert.throws(() => L.parsePuzzle([]), /empty/);
  assert.throws(() => L.parsePuzzle(['...', '..']), /square/);
  assert.throws(() => L.parsePuzzle(['..', '..', '..']), /square/);
  assert.throws(() => L.parsePuzzle(['.x', '..']), /Bad cell/);
  assert.throws(() => L.parsePuzzle(['.5', '..']), /Bad cell/);
});

test('createState starts empty; getCell reads it', () => {
  const s = L.createState(OPEN);
  assert.equal(s.size, 3);
  assert.equal(s.cells.length, 9);
  assert.ok(s.cells.every((v) => v === 'empty'));
  assert.equal(L.getCell(s, 0, 0), 'empty');
});

test('setCell returns a new state and validates', () => {
  const s = L.createState(OPEN);
  const t = L.setCell(OPEN, s, 0, 0, 'bulb');
  assert.equal(L.getCell(t, 0, 0), 'bulb');
  assert.equal(L.getCell(s, 0, 0), 'empty');
  assert.throws(() => L.setCell(OPEN, s, 0, 0, 'star'), /Bad cell value/);
  assert.throws(() => L.setCell(OPEN, s, 5, 0, 'bulb'), /out of range/);
  assert.throws(() => L.setCell(OPEN, s, -1, 0, 'bulb'), /out of range/);
});

test('walls cannot hold marks', () => {
  const s = L.createState(OPEN);
  assert.equal(L.setCell(OPEN, s, 1, 1, 'bulb'), s);
  assert.equal(L.cycleCell(OPEN, s, 1, 1), s);
});

test('cycleCell goes empty -> bulb -> dot -> empty', () => {
  let s = L.createState(OPEN);
  s = L.cycleCell(OPEN, s, 0, 1);
  assert.equal(L.getCell(s, 0, 1), 'bulb');
  s = L.cycleCell(OPEN, s, 0, 1);
  assert.equal(L.getCell(s, 0, 1), 'dot');
  s = L.cycleCell(OPEN, s, 0, 1);
  assert.equal(L.getCell(s, 0, 1), 'empty');
});

test('markDot dots only empty white cells in range', () => {
  const s = put(OPEN, [[0, 0, 'bulb']]);
  const t = L.markDot(OPEN, s, [[0, 0], [0, 1], [1, 1], [9, 9], [-1, 0], [2, 2]]);
  assert.equal(L.getCell(t, 0, 0), 'bulb');
  assert.equal(L.getCell(t, 0, 1), 'dot');
  assert.equal(L.getCell(t, 1, 1), 'empty');
  assert.equal(L.getCell(t, 2, 2), 'dot');
  assert.equal(L.getCell(s, 0, 1), 'empty');
});

test('clearBoard empties everything', () => {
  const s = put(OPEN, [[0, 0, 'bulb'], [2, 2, 'dot']]);
  assert.ok(L.clearBoard(s).cells.every((v) => v === 'empty'));
});

test('lineOfSight stops at walls and includes the cell itself', () => {
  const p = L.parsePuzzle(['..#.', '....', '#...', '....']);
  // (0,0): right to (0,1) then wall at (0,2); down (1,0) then wall (2,0)
  assert.deepEqual(L.lineOfSight(p, 0).sort((a, b) => a - b), [0, 1, 4]);
  // (1,1): row 1 all, column 1 all
  assert.deepEqual(L.lineOfSight(p, 5).sort((a, b) => a - b), [1, 4, 5, 6, 7, 9, 13]);
  assert.deepEqual(L.lineOfSight(p, 2), []);
});

test('litMap counts bulbs lighting each cell', () => {
  const s = put(OPEN, [[0, 0, 'bulb'], [2, 2, 'bulb']]);
  const lit = L.litMap(OPEN, s);
  assert.deepEqual(lit, [1, 1, 2, 1, 0, 1, 2, 1, 1]);
});

test('a bulb does not light through a wall', () => {
  const q = L.parsePuzzle(['.#.', '...', '...']);
  const s = put(q, [[0, 0, 'bulb']]);
  const lit = L.litMap(q, s);
  assert.equal(lit[2], 0);
  assert.equal(lit[3], 1);
});

test('findConflicts lists bulbs that see each other', () => {
  const s = put(OPEN, [[0, 0, 'bulb'], [0, 2, 'bulb'], [2, 1, 'bulb']]);
  assert.deepEqual(L.findConflicts(OPEN, s), [0, 2]);
  const ok = put(OPEN, [[0, 0, 'bulb'], [2, 2, 'bulb']]);
  assert.deepEqual(L.findConflicts(OPEN, ok), []);
});

test('bulbs separated by a wall do not conflict', () => {
  const q = L.parsePuzzle(['.#.', '...', '...']);
  const s = put(q, [[0, 0, 'bulb'], [0, 2, 'bulb']]);
  assert.deepEqual(L.findConflicts(q, s), []);
});

test('wallStatus: open, done, over and short', () => {
  let s = L.createState(NUM);
  assert.equal(L.wallStatus(NUM, s)[5], 'open');
  assert.equal(L.wallStatus(NUM, s)[15], 'done');
  assert.equal(L.wallStatus(NUM, s)[0], null);
  s = put(NUM, [[0, 1, 'bulb'], [1, 0, 'bulb']]);
  assert.equal(L.wallStatus(NUM, s)[5], 'done');
  s = put(NUM, [[0, 1, 'bulb'], [1, 0, 'bulb'], [1, 2, 'bulb']]);
  assert.equal(L.wallStatus(NUM, s)[5], 'over');
  s = put(NUM, [[0, 1, 'dot'], [1, 0, 'dot'], [1, 2, 'dot']]);
  assert.equal(L.wallStatus(NUM, s)[5], 'short');
  s = put(NUM, [[3, 2, 'bulb']]);
  assert.equal(L.wallStatus(NUM, s)[15], 'over');
});

test('findConflicts includes numbered walls that are over or short', () => {
  const over = put(NUM, [[0, 1, 'bulb'], [1, 0, 'bulb'], [1, 2, 'bulb']]);
  assert.ok(L.findConflicts(NUM, over).includes(5));
  const short = put(NUM, [[0, 1, 'dot'], [1, 0, 'dot'], [1, 2, 'dot']]);
  assert.deepEqual(L.findConflicts(NUM, short), [5]);
  const fine = put(NUM, [[0, 1, 'bulb']]);
  assert.ok(!L.findConflicts(NUM, fine).includes(5));
});

test('isSolved needs every white cell lit, no clashes and exact numbers', () => {
  const s = put(OPEN, [[0, 0, 'bulb'], [2, 2, 'bulb']]);
  assert.equal(L.isSolved(OPEN, s), true);
  assert.equal(L.isSolved(OPEN, put(OPEN, [[0, 0, 'bulb']])), false);
  const clash = put(OPEN, [[0, 0, 'bulb'], [0, 2, 'bulb'], [2, 0, 'bulb'], [2, 2, 'bulb']]);
  assert.equal(L.isSolved(OPEN, clash), false);
});

test('isSolved ignores dots and checks numbers', () => {
  const p = ['...', '.2.', '...'];
  // bulb above the 2, plus bulbs lighting everything
  const good = put(p, [[0, 1, 'bulb'], [1, 0, 'dot'], [2, 0, 'bulb'], [2, 2, 'bulb']]);
  // (0,1) lights row0 + col1 top; (2,0) lights row 2 + col 0; (2,2) conflicts with (2,0)
  assert.equal(L.isSolved(p, good), false);
  const good2 = put(p, [[0, 1, 'bulb'], [1, 0, 'dot'], [2, 0, 'bulb'], [1, 2, 'bulb']]);
  assert.equal(L.isSolved(p, good2), true);
  const wrongCount = put(p, [[0, 0, 'bulb'], [2, 2, 'bulb']]);
  assert.equal(L.isSolved(p, wrongCount), false);
});

test('countUnlit counts dark white cells', () => {
  const s = put(OPEN, [[0, 0, 'bulb']]);
  assert.equal(L.countUnlit(OPEN, s), 3);
  assert.equal(L.countUnlit(OPEN, L.createState(OPEN)), 8);
});

test('serialize and deserialize round trip', () => {
  const s = put(OPEN, [[0, 0, 'bulb'], [2, 2, 'dot']]);
  const back = L.deserialize(L.serialize(s), OPEN);
  assert.deepEqual(back, s);
});

test('deserialize rejects bad saves', () => {
  assert.equal(L.deserialize('not json', OPEN), null);
  assert.equal(L.deserialize('null', OPEN), null);
  assert.equal(L.deserialize(JSON.stringify({ size: 4, cells: [] }), OPEN), null);
  assert.equal(L.deserialize(JSON.stringify({ size: 3, cells: ['empty'] }), OPEN), null);
  assert.equal(L.deserialize(JSON.stringify({ size: 3, cells: Array(9).fill('star') }), OPEN), null);
  assert.equal(L.deserialize(JSON.stringify({ size: 3, cells: Array(9).fill('bulb') }), OPEN), null); // bulb on a wall
});
