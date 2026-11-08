const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

const SOL = '1234341221434321';
// Signs between every neighbouring pair, derived from the solution.
function fullSigns(sol, n) {
  let h = '', v = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) h += sol[r * n + c] < sol[r * n + c + 1] ? '<' : '>';
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) v += sol[r * n + c] < sol[(r + 1) * n + c] ? '<' : '>';
  return { h, v };
}
const raw = (over = {}) => Object.assign({ id: 'easy-1', difficulty: 'easy', size: 4, givens: '1...............', solution: SOL }, fullSigns(SOL, 4), over);
const puzzle = () => L.normalisePuzzle(raw());

test('normalisePuzzle expands compact strings into arrays and < constraints', () => {
  const p = puzzle();
  assert.equal(p.size, 4);
  assert.deepEqual(p.givens.slice(0, 3), [1, 0, 0]);
  assert.deepEqual(p.solution.slice(0, 4), [1, 2, 3, 4]);
  assert.equal(p.lt.length, 24);
  assert.deepEqual(p.lt[0], [0, 1]);
  for (const [a, b] of p.lt) assert.ok(p.solution[a] < p.solution[b]);
});

test('blank signs add no constraint', () => {
  const p = L.normalisePuzzle(raw({ h: '.'.repeat(12), v: '.'.repeat(12) }));
  assert.equal(p.lt.length, 0);
});

test('createGame places givens and locks them', () => {
  const p = puzzle(), g = L.createGame(p);
  assert.equal(g.values[0], 1);
  assert.equal(g.given[0], true);
  assert.equal(L.setDigit(g, 0, 3), g);
  assert.equal(L.toggleNote(g, 0, 3), g);
  assert.equal(L.erase(g, 0), g);
});

test('setDigit sets, replaces and clears on repeat; ignores bad input', () => {
  const p = puzzle();
  let g = L.createGame(p);
  g = L.setDigit(g, 5, 2);
  assert.equal(g.values[5], 2);
  g = L.setDigit(g, 5, 3);
  assert.equal(g.values[5], 3);
  g = L.setDigit(g, 5, 3);
  assert.equal(g.values[5], 0);
  assert.equal(L.setDigit(g, 99, 1), g);
  assert.equal(L.setDigit(g, 5, 9), g);
  assert.equal(L.setDigit(g, 5, 0), g);
});

test('setDigit does not mutate the old state and clears notes in the row and column only', () => {
  const p = puzzle();
  let g = L.createGame(p);
  g = L.toggleNote(g, 6, 2);   // row 1, col 2: same column as cell 2? (cell 2 = r0 c2) yes
  g = L.toggleNote(g, 4, 2);   // row 1 col 0: same row as cell 5
  g = L.toggleNote(g, 15, 2);  // row 3 col 3: unrelated to cell 6? 
  g = L.toggleNote(g, 10, 2);  // row 2 col 2: same column as cell 6
  const before = g;
  const next = L.setDigit(g, 5, 2); // row 1 col 1
  assert.equal(before.values[5], 0);
  assert.equal(L.hasNote(before, 4, 2), true);
  assert.equal(L.hasNote(next, 4, 2), false);   // same row
  assert.equal(L.hasNote(next, 6, 2), false);   // same row
  assert.equal(L.hasNote(next, 15, 2), true);   // unrelated
  assert.equal(L.hasNote(next, 10, 2), true);   // column 2, not column 1
  assert.equal(next.notes[5], 0);
});

test('toggleNote flips a pencil mark, only on empty editable cells', () => {
  let g = L.createGame(puzzle());
  g = L.toggleNote(g, 5, 3);
  assert.deepEqual(L.noteDigits(g, 5), [3]);
  g = L.toggleNote(g, 5, 1);
  assert.deepEqual(L.noteDigits(g, 5), [1, 3]);
  g = L.toggleNote(g, 5, 3);
  assert.deepEqual(L.noteDigits(g, 5), [1]);
  assert.equal(L.toggleNote(g, 99, 1), g);
  assert.equal(L.toggleNote(g, 5, 9), g);
  const filled = L.setDigit(g, 6, 2);
  assert.equal(L.toggleNote(filled, 6, 1), filled);
});

test('erase clears a value or notes, and is a no-op on empty cells', () => {
  let g = L.createGame(puzzle());
  assert.equal(L.erase(g, 5), g);
  assert.equal(L.erase(g, -1), g);
  const withNote = L.toggleNote(g, 5, 2);
  assert.equal(L.erase(withNote, 5).notes[5], 0);
  const withVal = L.setDigit(g, 5, 2);
  assert.equal(L.erase(withVal, 5).values[5], 0);
});

test('conflicts finds row and column repeats', () => {
  const p = puzzle();
  let g = L.createGame(p);
  g = L.setDigit(g, 3, 1);   // row 0 repeats the given 1
  assert.ok(L.conflicts(g, p).includes(0) && L.conflicts(g, p).includes(3));
  let col = L.createGame(p);
  col = L.setDigit(col, 8, 1);   // row 2 col 0 repeats the 1 at row 0 col 0
  assert.ok(L.conflicts(col, p).includes(0) && L.conflicts(col, p).includes(8));
});

test('conflicts finds broken signs only when both squares are filled', () => {
  const p = puzzle();
  let g = L.createGame(p);
  g = L.setDigit(g, 1, 4);   // 1 < 4 holds
  assert.deepEqual(L.brokenSigns(g, p), []);
  g = L.setDigit(g, 2, 3);   // 4 < 3 is false; sign between cells 1 and 2
  assert.deepEqual(L.brokenSigns(g, p), [{ kind: 'h', r: 0, c: 1 }]);
  assert.ok(L.conflicts(g, p).includes(1) && L.conflicts(g, p).includes(2));
  // vertical: cell 0 = 1 (given), cell 4 should be > 1.
  const vp = L.normalisePuzzle(raw({ givens: '4...............' }));
  let v = L.createGame(vp);
  v = L.setDigit(v, 4, 2);   // 4 above 2, but sign says top < bottom
  assert.deepEqual(L.brokenSigns(v, vp), [{ kind: 'v', r: 0, c: 0 }]);
});

test('a correct partial fill has no conflicts', () => {
  const p = puzzle();
  let g = L.createGame(p);
  g = L.setDigit(g, 1, 2);
  g = L.setDigit(g, 4, 3);
  assert.deepEqual(L.conflicts(g, p), []);
});

test('isSolved needs every square filled and no conflict', () => {
  const p = puzzle();
  let g = L.createGame(p);
  assert.equal(L.isSolved(g, p), false);
  for (let i = 1; i < 16; i++) g = L.setDigit(g, i, p.solution[i]);
  assert.equal(L.isSolved(g, p), true);
  const bad = L.setDigit(L.setDigit(g, 1, 3), 2, 2);
  assert.equal(L.isSolved(bad, p), false);
});

test('wrongCells lists filled squares that differ from the answer', () => {
  const p = puzzle();
  let g = L.createGame(p);
  g = L.setDigit(g, 1, 2);
  g = L.setDigit(g, 2, 4);
  assert.deepEqual(L.wrongCells(g, p), [2]);
});

test('hint fills the selected empty square, else the first wrong or empty one', () => {
  const p = puzzle();
  const g = L.createGame(p);
  const a = L.hint(g, p, 5);
  assert.equal(a.idx, 5);
  assert.equal(a.state.values[5], p.solution[5]);
  const b = L.hint(g, p, 0);   // selected is a given: falls back to first empty
  assert.equal(b.idx, 1);
  const wrong = L.setDigit(g, 1, 4);
  const c = L.hint(wrong, p, -1);
  assert.equal(c.idx, 1);
  assert.equal(c.state.values[1], 2);
  let full = g;
  for (let i = 1; i < 16; i++) full = L.setDigit(full, i, p.solution[i]);
  assert.equal(L.hint(full, p, -1).idx, -1);
});

test('digitCounts counts how often each digit is placed', () => {
  const p = puzzle();
  let g = L.createGame(p);
  g = L.setDigit(g, 1, 2);
  g = L.setDigit(g, 5, 2);
  const c = L.digitCounts(g, p.size);
  assert.equal(c[1], 1);
  assert.equal(c[2], 2);
});

test('toSave and fromSave round trip, and reject mismatched data', () => {
  const p = puzzle();
  let g = L.createGame(p);
  g = L.setDigit(g, 1, 2);
  g = L.toggleNote(g, 5, 3);
  const saved = JSON.parse(JSON.stringify(L.toSave(g)));
  const back = L.fromSave(saved, p);
  assert.deepEqual(back.values, g.values);
  assert.deepEqual(back.notes, g.notes);
  assert.deepEqual(back.given, g.given);
  assert.equal(L.fromSave(null, p), null);
  assert.equal(L.fromSave({ v: 1, values: [1], notes: [] }, p), null);
  assert.equal(L.fromSave(Object.assign({}, saved, { v: 99 }), p), null);
  assert.equal(L.fromSave(Object.assign({}, saved, { values: saved.values.map(() => 9) }), p), null);
  assert.equal(L.fromSave(Object.assign({}, saved, { notes: saved.notes.map(() => -1) }), p), null);
  const tampered = Object.assign({}, saved, { values: saved.values.slice() });
  tampered.values[0] = 3;   // a given must stay
  assert.equal(L.fromSave(tampered, p), null);
});

test('levelCounts, getPuzzle and levelOrder', () => {
  const list = [{ id: 'easy-1', difficulty: 'easy' }, { id: 'easy-2', difficulty: 'easy' }, { id: 'hard-1', difficulty: 'hard' }];
  assert.deepEqual(L.levelCounts(list), { easy: 2, medium: 0, hard: 1 });
  assert.equal(L.getPuzzle(list, 'hard-1').id, 'hard-1');
  assert.equal(L.getPuzzle(list, 'nope'), null);
  assert.deepEqual(L.levelOrder('medium'), ['medium', 'hard', 'easy']);
  assert.deepEqual(L.levelOrder('hard'), ['hard', 'easy', 'medium']);
  assert.deepEqual(L.levelOrder('easy'), ['easy', 'medium', 'hard']);
});

test('signOk checks one relation', () => {
  assert.equal(L.signOk(1, 2, '<'), true);
  assert.equal(L.signOk(2, 1, '<'), false);
  assert.equal(L.signOk(2, 1, '>'), true);
  assert.equal(L.signOk(0, 1, '<'), true);   // unfilled: not broken
  assert.equal(L.signOk(1, 2, '.'), true);
});
