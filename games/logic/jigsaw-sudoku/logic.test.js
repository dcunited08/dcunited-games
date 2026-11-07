const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

// Standard sudoku solution with the plain 3x3 boxes as shapes.
const GRID = Array.from({ length: 81 }, (_, i) => {
  const r = Math.floor(i / 9), c = i % 9;
  return ((r % 3) * 3 + Math.floor(r / 3) + c) % 9 + 1;
});
const BOXES = Array.from({ length: 81 }, (_, i) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3));

function fixture(givens = {}, regions = BOXES) {
  const g = new Array(81).fill('0');
  for (const [k, d] of Object.entries(givens)) g[k] = String(d);
  return L.normalisePuzzle({
    id: 'easy-1', difficulty: 'easy', regions: regions.join(''), givens: g.join(''), solution: GRID.join(''),
  });
}

const fill = (state, puzzle, idxs) => idxs.reduce((s, i) => L.setDigit(s, i, puzzle.solution[i]), state);
const ALL = [...Array(81).keys()];

test('normalisePuzzle expands the compact form', () => {
  const p = fixture({ 0: GRID[0] });
  assert.equal(p.id, 'easy-1');
  assert.deepEqual(p.regions, BOXES);
  assert.deepEqual(p.solution, GRID);
  assert.deepEqual(p.givens, { 0: GRID[0] });
});

test('createGame prefills givens and flags them', () => {
  const p = fixture({ 0: GRID[0], 40: GRID[40] });
  const s = L.createGame(p);
  assert.equal(s.puzzleId, 'easy-1');
  assert.equal(s.values[0], GRID[0]);
  assert.equal(s.values[40], GRID[40]);
  assert.equal(s.values[1], 0);
  assert.ok(s.given[0] && s.given[40] && !s.given[1]);
  assert.equal(s.values.length, 81);
  assert.equal(s.notes.length, 81);
});

test('setDigit places, toggles off on the same digit, replaces on another', () => {
  const s0 = L.createGame(fixture());
  const s1 = L.setDigit(s0, 5, 3);
  assert.equal(s1.values[5], 3);
  assert.equal(s0.values[5], 0, 'input untouched');
  assert.equal(L.setDigit(s1, 5, 3).values[5], 0);
  assert.equal(L.setDigit(s1, 5, 4).values[5], 4);
});

test('setDigit ignores givens and bad input', () => {
  const s = L.createGame(fixture({ 0: GRID[0] }));
  assert.equal(L.setDigit(s, 0, 9), s);
  assert.equal(L.setDigit(s, 1, 0), s);
  assert.equal(L.setDigit(s, 1, 10), s);
  assert.equal(L.setDigit(s, -1, 5), s);
});

test('placing a digit clears that note from row, column and shape only', () => {
  let s = L.createGame(fixture());
  for (const i of [1, 9, 11, 40, 14]) s = L.toggleNote(s, i, 5);
  s = L.toggleNote(s, 1, 6);
  s = L.setDigit(s, 0, 5);
  assert.ok(!L.hasNote(s, 1, 5), 'row');
  assert.ok(L.hasNote(s, 1, 6), 'other notes stay');
  assert.ok(!L.hasNote(s, 9, 5), 'column');
  assert.ok(!L.hasNote(s, 11, 5), 'shape');
  assert.ok(L.hasNote(s, 40, 5), 'unrelated cell');
  assert.ok(L.hasNote(s, 14, 5), 'next shape over, other row and column');
});

test('on a wiggly layout the shape, not the box, clears notes', () => {
  // Swap cells 2 and 27 between shapes 0 and 3 (not touching: shape 0 only needs to be a set here).
  const wig = BOXES.slice();
  wig[20] = 3; wig[27] = 0;
  const p = fixture({}, wig);
  let s = L.createGame(p);
  s = L.toggleNote(L.toggleNote(s, 27, 5), 20, 5);
  s = L.setDigit(s, 0, 5);
  assert.ok(!L.hasNote(s, 27, 5), 'now in shape 0');
  assert.ok(L.hasNote(s, 20, 5), 'moved to shape 3');
});

test('placing a digit clears the cell own notes', () => {
  let s = L.createGame(fixture());
  s = L.toggleNote(s, 3, 2);
  s = L.setDigit(s, 3, 7);
  assert.equal(s.notes[3], 0);
});

test('toggleNote toggles, skips filled cells and givens', () => {
  let s = L.createGame(fixture({ 0: GRID[0] }));
  s = L.toggleNote(s, 2, 4);
  assert.ok(L.hasNote(s, 2, 4));
  assert.deepEqual(L.noteDigits(s, 2), [4]);
  s = L.toggleNote(s, 2, 4);
  assert.ok(!L.hasNote(s, 2, 4));
  assert.equal(L.toggleNote(s, 0, 4), s);
  const filled = L.setDigit(s, 2, 9);
  assert.equal(L.toggleNote(filled, 2, 4), filled);
  assert.equal(L.toggleNote(s, 2, 0), s);
});

test('erase clears value and notes but not givens', () => {
  const p = fixture({ 0: GRID[0] });
  let s = L.createGame(p);
  s = L.setDigit(s, 5, 2);
  assert.equal(L.erase(s, 5).values[5], 0);
  s = L.toggleNote(L.erase(s, 5), 5, 3);
  assert.equal(L.erase(s, 5).notes[5], 0);
  assert.equal(L.erase(s, 0), s);
  const empty = L.createGame(p);
  assert.equal(L.erase(empty, 7), empty);
});

test('regionOf finds the shape of a cell', () => {
  const p = fixture();
  assert.equal(L.regionOf(p, 0), 0);
  assert.equal(L.regionOf(p, 80), 8);
  assert.equal(L.regionOf(p, 99), -1);
});

test('conflicts: none for the solution, flags repeats in a row, column or shape', () => {
  const p = fixture();
  const solved = fill(L.createGame(p), p, ALL);
  assert.deepEqual(L.conflicts(solved, p), []);
  assert.deepEqual(L.conflicts(L.createGame(p), p), []);
  let s = L.setDigit(L.setDigit(L.createGame(p), 0, 1), 5, 1);
  assert.deepEqual(L.conflicts(s, p), [0, 5], 'row');
  s = L.setDigit(L.setDigit(L.createGame(p), 0, 1), 9 * 4, 1);
  assert.deepEqual(L.conflicts(s, p), [0, 36], 'column');
  s = L.setDigit(L.setDigit(L.createGame(p), 0, 1), 19, 1);
  assert.deepEqual(L.conflicts(s, p), [0, 19], 'shape');
  s = L.setDigit(L.setDigit(L.createGame(p), 0, 1), 22, 1);
  assert.deepEqual(L.conflicts(s, p), [], 'different shape, row and column');
});

test('conflicts follow the shapes, not the boxes', () => {
  const wig = BOXES.slice();
  wig[20] = 3; wig[27] = 0;
  const p = fixture({}, wig);
  const s = L.setDigit(L.setDigit(L.createGame(p), 0, 1), 27, 1);
  assert.deepEqual(L.conflicts(s, p), [0, 27]);
  const t = L.setDigit(L.setDigit(L.createGame(p), 0, 1), 20, 1);
  assert.deepEqual(L.conflicts(t, p), []);
});

test('isSolved only when every cell is right', () => {
  const p = fixture({ 0: GRID[0] });
  const s = L.createGame(p);
  assert.equal(L.isSolved(s, p), false);
  const done = fill(s, p, ALL.filter((i) => i !== 0));
  assert.equal(L.isSolved(done, p), true);
  assert.equal(L.isSolved(fill(s, p, ALL.filter((i) => i > 1)), p), false);
});

test('digitCounts counts placed digits 1-9', () => {
  let s = L.createGame(fixture());
  assert.deepEqual(L.digitCounts(s), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  s = L.setDigit(L.setDigit(s, 0, 4), 30, 4);
  assert.equal(L.digitCounts(s)[4], 2);
  assert.equal(L.digitCounts(s)[1], 0);
});

test('hint fills the selected empty or wrong cell, else the first empty or wrong one', () => {
  const p = fixture({ 0: GRID[0] });
  const s = L.createGame(p);
  const h1 = L.hint(s, p, 30);
  assert.equal(h1.idx, 30);
  assert.equal(h1.state.values[30], GRID[30]);
  assert.equal(s.values[30], 0);
  assert.equal(L.hint(s, p).idx, 1);
  const wrong = L.setDigit(s, 1, GRID[1] === 9 ? 8 : 9);
  assert.equal(L.hint(wrong, p).idx, 1);
  assert.equal(L.hint(wrong, p).state.values[1], GRID[1]);
  const right = L.setDigit(s, 1, GRID[1]);
  assert.equal(L.hint(right, p, 1).idx, 2);
  assert.equal(L.hint(s, p, 0).idx, 1);
  const noted = L.toggleNote(s, 2, GRID[1]);
  assert.ok(!L.hasNote(L.hint(noted, p, 1).state, 2, GRID[1]));
});

test('hint with nothing left returns idx -1 and the same state', () => {
  const p = fixture();
  const done = fill(L.createGame(p), p, ALL);
  const h = L.hint(done, p);
  assert.equal(h.idx, -1);
  assert.equal(h.state, done);
});

test('toSave and fromSave round trip and reject junk', () => {
  const p = fixture({ 0: GRID[0] });
  const s = L.setDigit(L.toggleNote(L.createGame(p), 4, 3), 20, 6);
  const saved = JSON.parse(JSON.stringify(L.toSave(s)));
  assert.equal(saved.v, 1);
  assert.deepEqual(L.fromSave(saved, p), s);
  assert.deepEqual(L.fromSave(JSON.stringify(saved), p), s);
  assert.equal(L.fromSave(saved, { ...p, id: 'other' }), null);
  assert.deepEqual(L.fromSave(saved).values, s.values);
  const bad = [
    null, undefined, 5, 'nope', {}, { ...saved, puzzleId: 4 }, { ...saved, values: saved.values.slice(1) },
    { ...saved, values: saved.values.map(() => 10) }, { ...saved, values: saved.values.map(() => 1.5) },
    { ...saved, notes: saved.notes.map(() => 512) }, { ...saved, notes: 'x' },
    { ...saved, given: saved.given.map(() => 1) }, { ...saved, v: 2 },
  ];
  for (const b of bad) assert.equal(L.fromSave(b), null);
});

test('getPuzzle and levelCounts', () => {
  const list = [
    { id: 'easy-1', difficulty: 'easy' }, { id: 'easy-2', difficulty: 'easy' },
    { id: 'hard-1', difficulty: 'hard' },
  ];
  assert.equal(L.getPuzzle(list, 'easy-2'), list[1]);
  assert.equal(L.getPuzzle(list, 'zzz'), null);
  assert.deepEqual(L.levelCounts(list), { easy: 2, medium: 0, hard: 1 });
});

test('regionBorders marks the sides where the neighbour is in another shape or off the board', () => {
  const b = L.regionBorders(fixture());
  assert.equal(b.length, 81);
  assert.deepEqual(b[0], { t: true, r: false, b: false, l: true });
  assert.deepEqual(b[2], { t: true, r: true, b: false, l: false });
  assert.deepEqual(b[20], { t: false, r: true, b: true, l: false });
  assert.deepEqual(b[40], { t: false, r: false, b: false, l: false });
  assert.deepEqual(b[80], { t: false, r: true, b: true, l: false });
});

test('relatedCells lists the row, column and shape of a cell', () => {
  const wig = BOXES.slice();
  wig[20] = 3; wig[27] = 0;
  const p = fixture({}, wig);
  const rel = L.relatedCells(p, 0);
  assert.deepEqual(rel, [...new Set(rel)].sort((a, b) => a - b));
  for (const i of [0, 8, 72, 18, 19, 27]) assert.ok(rel.includes(i), String(i));
  assert.ok(!rel.includes(20), 'moved out of the shape');
  assert.ok(!rel.includes(41));
  assert.deepEqual(L.relatedCells(p, -1), []);
});

test('wrongCells lists filled non-given cells that differ from the solution', () => {
  const p = fixture({ 0: GRID[0] });
  let s = L.createGame(p);
  assert.deepEqual(L.wrongCells(s, p), []);
  s = L.setDigit(s, 1, GRID[1] === 9 ? 8 : 9);
  s = L.setDigit(s, 2, GRID[2]);
  assert.deepEqual(L.wrongCells(s, p), [1]);
});

test('levelOrder starts at the level and wraps through the rest', () => {
  assert.deepEqual(L.levelOrder('medium'), ['medium', 'hard', 'easy']);
  assert.deepEqual(L.levelOrder('hard'), ['hard', 'easy', 'medium']);
  assert.deepEqual(L.levelOrder('easy'), ['easy', 'medium', 'hard']);
  assert.deepEqual(L.levelOrder('zzz'), ['easy', 'medium', 'hard']);
});
