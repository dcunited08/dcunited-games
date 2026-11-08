const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

// 3x3: rows 123 / 231 / 312
const raw = {
  id: 'easy-1', difficulty: 'easy', size: 3, solution: '123231312',
  cages: [{ o: '+', t: 3, c: [0, 1] }, { o: '', t: 3, c: [2] }, { o: '-', t: 1, c: [3, 4] }, { o: '*', t: 6, c: [5, 8, 7] }, { o: '/', t: 3, c: [6] }],
};
// cage 5,8,7 -> values 1,2,1: product 2 -- fix target below
raw.cages[3].t = 2;
raw.cages[4] = { o: '', t: 3, c: [6] };
const puzzle = L.normalisePuzzle(raw);
const fresh = () => L.createGame(puzzle);

test('normalisePuzzle expands compact data', () => {
  assert.equal(puzzle.size, 3);
  assert.deepEqual(puzzle.solution, [1, 2, 3, 2, 3, 1, 3, 1, 2]);
  assert.deepEqual(puzzle.cages[0], { op: '+', target: 3, cells: [0, 1] });
});

test('cageLabel shows the target and a sign; singles show just the number', () => {
  assert.equal(L.cageLabel(puzzle.cages[0]), '3+');
  assert.equal(L.cageLabel(puzzle.cages[1]), '3');
  assert.equal(L.cageLabel({ op: '-', target: 2, cells: [0, 1] }), '2−');
  assert.equal(L.cageLabel({ op: '*', target: 12, cells: [0, 1] }), '12×');
  assert.equal(L.cageLabel({ op: '/', target: 3, cells: [0, 1] }), '3÷');
});

test('cageOf and cageLabelCell find the cage and its top-left cell', () => {
  assert.equal(L.cageOf(puzzle, 8).target, 2);
  assert.equal(L.cageOf(puzzle, 99), null);
  assert.equal(L.cageLabelCell(puzzle.cages[3]), 5);
});

test('setDigit places, replaces and clears on a repeat tap', () => {
  let s = L.setDigit(fresh(), 0, 2);
  assert.equal(s.values[0], 2);
  s = L.setDigit(s, 0, 3);
  assert.equal(s.values[0], 3);
  s = L.setDigit(s, 0, 3);
  assert.equal(s.values[0], 0);
  const f = fresh();
  assert.equal(L.setDigit(f, -1, 1), f);
  assert.equal(L.setDigit(f, 0, 0), f);
  assert.equal(L.setDigit(f, 0, 4), f);
});

test('placing a number removes that note from its row and column only', () => {
  let s = fresh();
  s = L.toggleNote(s, 1, 2);   // same row
  s = L.toggleNote(s, 3, 2);   // same column
  s = L.toggleNote(s, 4, 2);   // elsewhere
  s = L.toggleNote(s, 1, 3);
  s = L.setDigit(s, 0, 2);
  assert.equal(L.hasNote(s, 1, 2), false);
  assert.equal(L.hasNote(s, 3, 2), false);
  assert.equal(L.hasNote(s, 4, 2), true);
  assert.equal(L.hasNote(s, 1, 3), true);
});

test('toggleNote adds and removes pencil marks, not on filled cells', () => {
  let s = L.toggleNote(fresh(), 4, 1);
  s = L.toggleNote(s, 4, 3);
  assert.deepEqual(L.noteDigits(s, 4), [1, 3]);
  s = L.toggleNote(s, 4, 1);
  assert.deepEqual(L.noteDigits(s, 4), [3]);
  const filled = L.setDigit(fresh(), 4, 1);
  assert.equal(L.toggleNote(filled, 4, 2), filled);
  assert.equal(L.toggleNote(s, 4, 9), s);
  assert.equal(L.toggleNote(s, 40, 1), s);
});

test('erase clears a value or notes, and does nothing on an empty cell', () => {
  const f = fresh();
  assert.equal(L.erase(f, 0), f);
  assert.equal(L.erase(f, -3), f);
  assert.equal(L.erase(L.setDigit(f, 0, 2), 0).values[0], 0);
  const n = L.erase(L.toggleNote(f, 0, 2), 0);
  assert.equal(n.notes[0], 0);
});

test('conflicts flag repeats in a row or column', () => {
  let s = L.setDigit(fresh(), 0, 1);
  s = L.setDigit(s, 2, 1);
  assert.deepEqual(L.conflicts(s, puzzle), [0, 2]);
  s = L.setDigit(fresh(), 0, 1);
  s = L.setDigit(s, 6, 1);
  assert.ok(L.conflicts(s, puzzle).includes(0) && L.conflicts(s, puzzle).includes(6));
});

test('a full cage that misses its target is flagged; a partial one is not', () => {
  let s = L.setDigit(fresh(), 0, 1);
  assert.deepEqual(L.conflicts(s, puzzle), []);
  s = L.setDigit(fresh(), 3, 1);
  s = L.setDigit(s, 4, 3);              // |1-3| = 2, target 1
  assert.deepEqual(L.conflicts(s, puzzle), [3, 4]);
  s = L.setDigit(fresh(), 1, 3);
  s = L.setDigit(s, 0, 1);              // 1+3 = 4, target 3
  assert.deepEqual(L.conflicts(s, puzzle), [0, 1]);
  s = L.setDigit(fresh(), 2, 1);        // single should be 3
  assert.deepEqual(L.conflicts(s, puzzle), [2]);
});

test('cageHolds covers every sign', () => {
  assert.equal(L.cageHolds('+', 5, [2, 3]), true);
  assert.equal(L.cageHolds('-', 2, [5, 3]), true);
  assert.equal(L.cageHolds('-', 2, [3, 5]), true);
  assert.equal(L.cageHolds('*', 6, [2, 3]), true);
  assert.equal(L.cageHolds('/', 3, [1, 3]), true);
  assert.equal(L.cageHolds('/', 2, [3, 1]), false);
  assert.equal(L.cageHolds('', 4, [4]), true);
  assert.equal(L.cageHolds('', 4, [3]), false);
});

test('isSolved needs every cell filled with no conflicts', () => {
  let s = fresh();
  assert.equal(L.isSolved(s, puzzle), false);
  puzzle.solution.forEach((d, i) => { s = L.setDigit(s, i, d); });
  assert.equal(L.isSolved(s, puzzle), true);
  assert.equal(L.isSolved(L.erase(s, 0), puzzle), false);
});

test('hint fills the preferred cell, then the first needing one, then nothing', () => {
  let h = L.hint(fresh(), puzzle, 4);
  assert.equal(h.idx, 4);
  assert.equal(h.state.values[4], 3);
  h = L.hint(fresh(), puzzle, -1);
  assert.equal(h.idx, 0);
  const wrong = L.setDigit(fresh(), 0, 3);
  assert.equal(L.hint(wrong, puzzle, 0).state.values[0], 1);
  let s = fresh();
  puzzle.solution.forEach((d, i) => { s = L.setDigit(s, i, d); });
  const done = L.hint(s, puzzle, 2);
  assert.equal(done.idx, -1);
  assert.equal(done.state, s);
  const keep = L.setDigit(fresh(), 4, 3);
  assert.equal(L.hint(keep, puzzle, 4).idx, 0);
});

test('wrongCells lists filled cells that differ from the answer', () => {
  let s = L.setDigit(fresh(), 0, 1);
  s = L.setDigit(s, 1, 3);
  assert.deepEqual(L.wrongCells(s, puzzle), [1]);
});

test('digitCounts counts each number on the board', () => {
  const s = L.setDigit(L.setDigit(fresh(), 0, 2), 5, 2);
  const c = L.digitCounts(s);
  assert.equal(c[2], 2);
  assert.equal(c.length, 4);
});

test('relatedCells covers the row, column and cage of a cell', () => {
  assert.deepEqual(L.relatedCells(puzzle, 4), [1, 3, 4, 5, 7]);
  assert.deepEqual(L.relatedCells(puzzle, 8), [2, 5, 6, 7, 8]);
  assert.deepEqual(L.relatedCells(puzzle, -1), []);
});

test('cageBorders marks sides that touch another cage or the edge', () => {
  const b = L.cageBorders(puzzle);
  assert.deepEqual(b[0], { t: true, r: false, b: true, l: true });
  assert.deepEqual(b[1], { t: true, r: true, b: true, l: false });
  assert.deepEqual(b[8], { t: false, r: true, b: true, l: false });
});

test('save and load round trip, and bad saves are refused', () => {
  const s = L.toggleNote(L.setDigit(fresh(), 0, 1), 4, 2);
  const save = L.toSave(s);
  const back = L.fromSave(JSON.parse(JSON.stringify(save)), puzzle);
  assert.deepEqual(back.values, s.values);
  assert.deepEqual(back.notes, s.notes);
  assert.equal(L.fromSave(JSON.stringify(save), puzzle).values[0], 1);
  assert.equal(L.fromSave('not json', puzzle), null);
  assert.equal(L.fromSave(null, puzzle), null);
  assert.equal(L.fromSave({ ...save, v: 99 }, puzzle), null);
  assert.equal(L.fromSave({ ...save, puzzleId: 'x' }, puzzle), null);
  assert.equal(L.fromSave({ ...save, values: [1] }, puzzle), null);
  assert.equal(L.fromSave({ ...save, values: save.values.map(() => 7) }, puzzle), null);
  assert.equal(L.fromSave({ ...save, notes: save.notes.map(() => 999) }, puzzle), null);
  assert.equal(L.fromSave({ ...save, puzzleId: 5 }, puzzle), null);
  assert.equal(L.fromSave(save).size, 3);
});

test('level helpers', () => {
  assert.deepEqual(L.levelOrder('medium'), ['medium', 'hard', 'easy']);
  assert.deepEqual(L.levelOrder('zzz'), ['easy', 'medium', 'hard']);
  assert.equal(L.getPuzzle([raw], 'easy-1'), raw);
  assert.equal(L.getPuzzle([raw], 'nope'), null);
  assert.deepEqual(L.levelCounts([raw, { difficulty: 'hard' }]), { easy: 1, medium: 0, hard: 1 });
});
