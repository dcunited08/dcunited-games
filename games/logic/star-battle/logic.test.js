const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

const ROWS = ['AABBB', 'ACBBB', 'CCCDD', 'EECDD', 'EEEDD'];
const SOLUTION_COLS = [0, 3, 1, 4, 2];
const puzzle = { size: 5, regions: ROWS };

function withStars(cols, extra = []) {
  let s = L.createState(puzzle);
  cols.forEach((c, r) => { if (c !== null) s = L.setCell(s, r, c, 'star'); });
  extra.forEach(([r, c]) => { s = L.setCell(s, r, c, 'star'); });
  return s;
}

test('parsePuzzle converts letters to region numbers', () => {
  const p = L.parsePuzzle(ROWS);
  assert.equal(p.size, 5);
  assert.deepEqual(p.regions[0], [0, 0, 1, 1, 1]);
  assert.deepEqual(p.regions[2], [2, 2, 2, 3, 3]);
});

test('parsePuzzle accepts a {size, regions} object and is idempotent', () => {
  const p = L.parsePuzzle(puzzle);
  assert.deepEqual(L.parsePuzzle(p), p);
});

test('parsePuzzle rejects bad puzzles', () => {
  assert.throws(() => L.parsePuzzle('nope'), /array/);
  assert.throws(() => L.parsePuzzle(['AB', 'AB', 'AB']), /square/);
  assert.throws(() => L.parsePuzzle(['AAB', 'AAB']), /square/);
  assert.throws(() => L.parsePuzzle(['AA', 'AA']), /regions/);
  assert.throws(() => L.parsePuzzle(['A1', '1A']), /letter/);
  assert.throws(() => L.parsePuzzle(['AB', 'BA']), /contiguous/);
});

test('createState is an empty board', () => {
  const s = L.createState(puzzle);
  assert.equal(s.size, 5);
  assert.equal(s.cells.length, 25);
  assert.ok(s.cells.every((v) => v === 'empty'));
});

test('cycleCell goes empty -> x -> star -> empty without mutating', () => {
  const s0 = L.createState(puzzle);
  const s1 = L.cycleCell(s0, 1, 2);
  const s2 = L.cycleCell(s1, 1, 2);
  const s3 = L.cycleCell(s2, 1, 2);
  assert.equal(L.getCell(s1, 1, 2), 'x');
  assert.equal(L.getCell(s2, 1, 2), 'star');
  assert.equal(L.getCell(s3, 1, 2), 'empty');
  assert.equal(L.getCell(s0, 1, 2), 'empty');
});

test('setCell sets a value, rejects bad input', () => {
  const s = L.setCell(L.createState(puzzle), 0, 0, 'star');
  assert.equal(L.getCell(s, 0, 0), 'star');
  assert.throws(() => L.setCell(s, 0, 0, 'moon'), /value/);
  assert.throws(() => L.setCell(s, 5, 0, 'x'), /range/);
});

test('markX only changes empty cells', () => {
  let s = L.setCell(L.createState(puzzle), 0, 0, 'star');
  s = L.setCell(s, 0, 1, 'x');
  const out = L.markX(s, [[0, 0], [0, 1], [0, 2], [4, 4]]);
  assert.equal(L.getCell(out, 0, 0), 'star');
  assert.equal(L.getCell(out, 0, 1), 'x');
  assert.equal(L.getCell(out, 0, 2), 'x');
  assert.equal(L.getCell(out, 4, 4), 'x');
  assert.equal(L.getCell(s, 0, 2), 'empty');
  assert.equal(L.markX(s, [[9, 9]]).cells.join(), s.cells.join());
});

test('clearBoard empties everything', () => {
  const s = L.clearBoard(withStars(SOLUTION_COLS));
  assert.ok(s.cells.every((v) => v === 'empty'));
});

test('findConflicts is empty for a correct partial board', () => {
  assert.deepEqual(L.findConflicts(puzzle, withStars([0, 3, null, null, null])), []);
});

test('findConflicts flags same row, column, region and touching stars', () => {
  const idx = (r, c) => r * 5 + c;
  assert.deepEqual(L.findConflicts(puzzle, withStars([0, null, null, null, null], [[0, 3]])),
    [idx(0, 0), idx(0, 3)]);
  assert.deepEqual(L.findConflicts(puzzle, withStars([0, null, 0, null, null])),
    [idx(0, 0), idx(2, 0)]);
  assert.deepEqual(L.findConflicts(puzzle, withStars([null, 1, null, 2, null])),
    [idx(1, 1), idx(3, 2)]);
  assert.deepEqual(L.findConflicts(puzzle, withStars([0, 1, null, null, null])),
    [idx(0, 0), idx(1, 1)]);
  assert.deepEqual(L.findConflicts(puzzle, withStars([2, null, null, null, null], [[1, 4]])),
    [idx(0, 2), idx(1, 4)]);
});

test('findConflicts ignores X marks', () => {
  const s = L.markX(L.createState(puzzle), [[0, 0], [0, 1]]);
  assert.deepEqual(L.findConflicts(puzzle, s), []);
});

test('isSolved needs N stars, no conflicts', () => {
  assert.equal(L.isSolved(puzzle, withStars(SOLUTION_COLS)), true);
  assert.equal(L.isSolved(puzzle, withStars([0, 3, 1, 4, null])), false);
  assert.equal(L.isSolved(puzzle, withStars([0, 3, 1, 4, 3])), false);
  const withX = L.markX(withStars(SOLUTION_COLS), [[0, 0]]);
  assert.equal(L.isSolved(puzzle, withX), true);
});

test('serialize / deserialize round trip', () => {
  const s = L.markX(withStars([0, 3, null, null, null]), [[4, 4]]);
  const json = L.serialize(s);
  assert.equal(typeof json, 'string');
  assert.deepEqual(L.deserialize(json, puzzle), s);
});

test('deserialize rejects junk and wrong sizes', () => {
  assert.equal(L.deserialize('not json', puzzle), null);
  assert.equal(L.deserialize('null', puzzle), null);
  assert.equal(L.deserialize(JSON.stringify({ size: 4, cells: [] }), puzzle), null);
  assert.equal(L.deserialize(JSON.stringify({ size: 5, cells: Array(25).fill('moon') }), puzzle), null);
  assert.equal(L.deserialize(JSON.stringify({ size: 5, cells: [] }), puzzle), null);
  assert.equal(L.deserialize(undefined, puzzle), null);
});
