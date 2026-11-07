const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

const GRID = Array.from({ length: 81 }, (_, i) => {
  const r = Math.floor(i / 9), c = i % 9;
  return ((r % 3) * 3 + Math.floor(r / 3) + c) % 9 + 1;
});

// Horizontal dominoes (cols 0-1, 2-3, 4-5, 6-7) plus a single in col 8.
function fixture(givens = {}) {
  const cages = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 8; c += 2) {
      const a = r * 9 + c;
      cages.push({ s: GRID[a] + GRID[a + 1], c: [a, a + 1] });
    }
    cages.push({ s: GRID[r * 9 + 8], c: [r * 9 + 8] });
  }
  return L.normalisePuzzle({ id: 'easy-1', difficulty: 'easy', cages, givens, solution: GRID.join('') });
}

const fill = (state, puzzle, idxs) => idxs.reduce((s, i) => L.setDigit(s, i, puzzle.solution[i]), state);

test('normalisePuzzle expands the compact form', () => {
  const p = fixture({ 0: GRID[0] });
  assert.equal(p.id, 'easy-1');
  assert.deepEqual(p.cages[0], { sum: GRID[0] + GRID[1], cells: [0, 1] });
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
  const p = fixture();
  const s0 = L.createGame(p);
  const s1 = L.setDigit(s0, 5, 3);
  assert.equal(s1.values[5], 3);
  assert.equal(s0.values[5], 0, 'input untouched');
  assert.equal(L.setDigit(s1, 5, 3).values[5], 0);
  assert.equal(L.setDigit(s1, 5, 4).values[5], 4);
});

test('setDigit ignores givens and bad input', () => {
  const p = fixture({ 0: GRID[0] });
  const s = L.createGame(p);
  assert.equal(L.setDigit(s, 0, 9), s);
  assert.equal(L.setDigit(s, 1, 0), s);
  assert.equal(L.setDigit(s, 1, 10), s);
  assert.equal(L.setDigit(s, -1, 5), s);
});

test('placing a digit clears that note from row, column, box and cage only', () => {
  const p = fixture();
  let s = L.createGame(p);
  for (const i of [1, 9, 11, 40, 14]) s = L.toggleNote(s, i, 5);
  s = L.toggleNote(s, 1, 6);
  s = L.setDigit(s, 0, 5);
  assert.ok(!L.hasNote(s, 1, 5), 'row/cage');
  assert.ok(L.hasNote(s, 1, 6), 'other notes stay');
  assert.ok(!L.hasNote(s, 9, 5), 'column');
  assert.ok(!L.hasNote(s, 11, 5), 'box');
  assert.ok(L.hasNote(s, 40, 5), 'unrelated cell');
  assert.ok(L.hasNote(s, 14, 5), 'next box over, other row and column');
});

test('placing a digit clears the cell own notes', () => {
  let s = L.createGame(fixture());
  s = L.toggleNote(s, 3, 2);
  s = L.setDigit(s, 3, 7);
  assert.equal(s.notes[3], 0);
});

test('toggleNote toggles, skips filled cells and givens', () => {
  const p = fixture({ 0: GRID[0] });
  let s = L.createGame(p);
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

test('cageOf and cageLabelCell', () => {
  const p = fixture();
  assert.deepEqual(L.cageOf(p, 3).cells, [2, 3]);
  assert.equal(L.cageOf(p, 99), null);
  assert.equal(L.cageLabelCell({ sum: 10, cells: [20, 11, 12, 19] }), 11);
  assert.equal(L.cageLabelCell({ sum: 10, cells: [10, 18, 9] }), 9);
});

test('conflicts: none for the solution, flags repeats, wrong full cages and overfull cages', () => {
  const p = fixture();
  const solved = fill(L.createGame(p), p, [...Array(81).keys()]);
  assert.deepEqual(L.conflicts(solved, p), []);
  let s = L.createGame(p);
  assert.deepEqual(L.conflicts(s, p), []);
  // Row repeat: cell 0 and cell 2 both 5 (different cages).
  s = L.setDigit(L.setDigit(s, 0, 1), 2, 1);
  assert.deepEqual(L.conflicts(s, p), [0, 2]);
  // Column repeat.
  s = L.setDigit(L.setDigit(L.createGame(p), 0, 1), 9, 1);
  assert.deepEqual(L.conflicts(s, p), [0, 9]);
  // Box repeat (cells 0 and 20 share box 0, differ in row/col).
  s = L.setDigit(L.setDigit(L.createGame(p), 0, 1), 19, 1);
  assert.deepEqual(L.conflicts(s, p), [0, 19]);
});

test('conflicts: cage sums', () => {
  const p = fixture();
  const [a, b] = p.cages[0].cells; // domino
  const sum = p.cages[0].sum;
  // Full cage with the wrong sum (pick digits that avoid every other rule)
  const wrong = L.setDigit(L.setDigit(L.createGame(p), a, GRID[a]), b, GRID[b] === 9 ? 8 : GRID[b] + 1);
  assert.notEqual(GRID[a] + GRID[b] + (GRID[b] === 9 ? -1 : 1), sum);
  assert.deepEqual(L.conflicts(wrong, p), [a, b]);
  // Partly filled and already over the sum
  const tiny = L.normalisePuzzle({ id: 't', difficulty: 'easy', cages: [{ s: 3, c: [0, 1, 2] }], givens: {}, solution: GRID.join('') });
  const over = L.setDigit(L.createGame(tiny), 0, 4);
  assert.deepEqual(L.conflicts(over, tiny), [0, 1, 2]);
  // Repeat inside a cage
  const rep = L.setDigit(L.setDigit(L.createGame(tiny), 0, 1), 1, 1);
  assert.deepEqual(L.conflicts(rep, tiny), [0, 1]);
  // Not over yet
  assert.deepEqual(L.conflicts(L.setDigit(L.createGame(tiny), 0, 1), tiny), []);
});

test('isSolved only when every cell is right', () => {
  const p = fixture({ 0: GRID[0] });
  const s = L.createGame(p);
  assert.equal(L.isSolved(s, p), false);
  const done = fill(s, p, [...Array(81).keys()].filter((i) => i !== 0));
  assert.equal(L.isSolved(done, p), true);
  const almost = fill(s, p, [...Array(81).keys()].filter((i) => i > 1));
  assert.equal(L.isSolved(almost, p), false);
});

test('digitCounts counts placed digits 1-9', () => {
  const p = fixture();
  let s = L.createGame(p);
  assert.deepEqual(L.digitCounts(s), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  s = L.setDigit(L.setDigit(s, 0, 4), 10, 4);
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
  const h2 = L.hint(s, p);
  assert.equal(h2.idx, 1);
  const wrong = L.setDigit(s, 1, GRID[1] === 9 ? 8 : 9);
  assert.equal(L.hint(wrong, p).idx, 1);
  assert.equal(L.hint(wrong, p).state.values[1], GRID[1]);
  // Selected cell already right or a given: falls back to the first empty
  const right = L.setDigit(s, 1, GRID[1]);
  assert.equal(L.hint(right, p, 1).idx, 2);
  assert.equal(L.hint(s, p, 0).idx, 1);
  // Hint clears peer notes
  const noted = L.toggleNote(s, 2, GRID[1]);
  assert.ok(!L.hasNote(L.hint(noted, p, 1).state, 2, GRID[1]));
});

test('hint with nothing left returns idx -1 and the same state', () => {
  const p = fixture();
  const done = fill(L.createGame(p), p, [...Array(81).keys()]);
  const h = L.hint(done, p);
  assert.equal(h.idx, -1);
  assert.equal(h.state, done);
});

test('toSave and fromSave round trip and reject junk', () => {
  const p = fixture({ 0: GRID[0] });
  let s = L.setDigit(L.toggleNote(L.createGame(p), 4, 3), 20, 6);
  const saved = JSON.parse(JSON.stringify(L.toSave(s)));
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

test('placing a digit also clears notes elsewhere in its cage', () => {
  const odd = L.normalisePuzzle({ id: 't', difficulty: 'easy', cages: [{ s: 10, c: [0, 40] }], givens: {}, solution: GRID.join('') });
  let s = L.toggleNote(L.createGame(odd), 40, 5);
  s = L.toggleNote(s, 41, 5);
  s = L.setDigit(s, 0, 5);
  assert.ok(!L.hasNote(s, 40, 5));
  assert.ok(L.hasNote(s, 41, 5), 'not in the cage and not a peer');
});

test('cageBorders marks the sides where the neighbour is in another cage or off the board', () => {
  const p = fixture(); // horizontal dominoes: [0,1] [2,3] ... single at col 8
  const b = L.cageBorders(p);
  assert.equal(b.length, 81);
  assert.deepEqual(b[0], { t: true, r: false, b: true, l: true });
  assert.deepEqual(b[1], { t: true, r: true, b: true, l: false });
  assert.deepEqual(b[8], { t: true, r: true, b: true, l: true });
  assert.deepEqual(b[40], { t: true, r: false, b: true, l: true });
  const tall = L.normalisePuzzle({ id: 't', difficulty: 'easy', cages: [{ s: 3, c: [0, 9] }], givens: {}, solution: GRID.join('') });
  const tb = L.cageBorders(tall);
  assert.deepEqual(tb[0], { t: true, r: true, b: false, l: true });
  assert.deepEqual(tb[9], { t: false, r: true, b: true, l: true });
  assert.deepEqual(tb[5], { t: true, r: true, b: true, l: true }, 'cells outside any cage get a full box');
});

test('relatedCells lists the row, column, box and cage of a cell', () => {
  const odd = L.normalisePuzzle({ id: 't', difficulty: 'easy', cages: [{ s: 10, c: [0, 40] }], givens: {}, solution: GRID.join('') });
  const rel = L.relatedCells(odd, 0);
  assert.deepEqual(rel, [...new Set(rel)].sort((a, b) => a - b));
  for (const i of [0, 8, 72, 18, 20, 40]) assert.ok(rel.includes(i), String(i));
  assert.ok(!rel.includes(41));
  assert.deepEqual(L.relatedCells(odd, -1), []);
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
