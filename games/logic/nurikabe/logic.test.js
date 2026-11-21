const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

const ROWS = ['3.1..', '.....', '.....', '..2..', '....1'];

test('parsePuzzle reads clue characters in base 36', () => {
  const p = L.parsePuzzle(['3.A...', '......', 'B.....', '.....1', '......', '......']);
  assert.equal(p.size, 6);
  assert.deepEqual(p.clues.slice(0, 3), [3, 0, 10]);
  assert.equal(p.clues[12], 11);
  assert.equal(L.parsePuzzle(p), p);
});

test('parsePuzzle rejects bad puzzles', () => {
  assert.throws(() => L.parsePuzzle('nope'), /array/);
  assert.throws(() => L.parsePuzzle(['12', '1']), /square/);
  assert.throws(() => L.parsePuzzle(['1x', '..']), /clue/);
  assert.throws(() => L.parsePuzzle(['0.', '..']), /clue/);
  assert.throws(() => L.parsePuzzle(['44', '44']), /too many/i);
});

test('createState starts empty; setCell and cycleCell never change clues', () => {
  const p = L.parsePuzzle(ROWS);
  let s = L.createState(p);
  assert.equal(s.cells.length, 25);
  assert.ok(s.cells.every((v) => v === 'empty'));
  assert.equal(L.getCell(s, 0, 0), 'empty');
  s = L.setCell(p, s, 1, 1, 'sea');
  assert.equal(L.getCell(s, 1, 1), 'sea');
  assert.equal(L.setCell(p, s, 0, 0, 'sea'), s);
  assert.equal(L.cycleCell(p, s, 0, 0), s);
  assert.throws(() => L.setCell(p, s, 1, 1, 'star'), /value/);
  assert.throws(() => L.setCell(p, s, 9, 9, 'sea'), /range/);
});

test('cycleCell goes empty, sea, dot, empty', () => {
  const p = L.parsePuzzle(ROWS);
  let s = L.createState(p);
  s = L.cycleCell(p, s, 1, 1);
  assert.equal(L.getCell(s, 1, 1), 'sea');
  s = L.cycleCell(p, s, 1, 1);
  assert.equal(L.getCell(s, 1, 1), 'dot');
  s = L.cycleCell(p, s, 1, 1);
  assert.equal(L.getCell(s, 1, 1), 'empty');
});

test('paint sets many cells, skipping clues and out of range', () => {
  const p = L.parsePuzzle(ROWS);
  const s = L.createState(p);
  const t = L.paint(p, s, [[0, 0], [0, 1], [0, 1], [9, 9], [0, 3]], 'sea');
  assert.deepEqual([t.cells[0], t.cells[1], t.cells[3]], ['empty', 'sea', 'sea']);
  assert.ok(s.cells.every((v) => v === 'empty'));
  assert.throws(() => L.paint(p, s, [[0, 1]], 'x'), /value/);
});

test('clearBoard empties everything', () => {
  const p = L.parsePuzzle(ROWS);
  const s = L.paint(p, L.createState(p), [[1, 1], [2, 2]], 'dot');
  assert.ok(L.clearBoard(s).cells.every((v) => v === 'empty'));
});

function stateFrom(p, picture) {
  // picture: rows of '#' sea, 'o' dot, anything else empty
  const cells = [];
  picture.forEach((row) => [...row].forEach((ch) => cells.push(ch === '#' ? 'sea' : ch === 'o' ? 'dot' : 'empty')));
  return { size: p.size, cells };
}

test('findConflicts flags 2x2 pools of sea', () => {
  const p = L.parsePuzzle(ROWS);
  const s = stateFrom(p, ['.....', '.##..', '.##..', '.....', '.....']);
  assert.deepEqual(L.findConflicts(p, s), [6, 7, 11, 12]);
});

test('findConflicts flags islands that join two numbers', () => {
  const p = L.parsePuzzle(['2.2', '...', '..1']);
  const s = stateFrom(p, ['.o.', '...', '...']);
  assert.deepEqual(L.findConflicts(p, s), [0, 1, 2]);
});

test('findConflicts flags an island bigger than its number', () => {
  const p = L.parsePuzzle(['2..', '...', '..1']);
  const s = stateFrom(p, ['.o.', '.o.', '...']);
  assert.deepEqual(L.findConflicts(p, s), [0, 1, 4]);
});

test('findConflicts flags a number walled in too small', () => {
  const p = L.parsePuzzle(['3..', '...', '..1']);
  const s = stateFrom(p, ['.#.', '#..', '...']);
  assert.deepEqual(L.findConflicts(p, s), [0]);
});

test('findConflicts flags dots walled in with no number', () => {
  const p = L.parsePuzzle(['1..', '...', '..1']);
  const s = stateFrom(p, ['.##', '#o#', '#.#']);
  assert.deepEqual(L.findConflicts(p, s), [4]);
});

test('findConflicts is empty for a clean partial board', () => {
  const p = L.parsePuzzle(ROWS);
  assert.deepEqual(L.findConflicts(p, L.createState(p)), []);
});

test('isSolved checks the rules on the shaded set', () => {
  const p = L.parsePuzzle(['2.', '..']);
  // 2 at (0,0). Answer: island (0,0),(1,0); sea (0,1),(1,1).
  assert.equal(L.isSolved(p, stateFrom(p, ['.#', '.#'])), true);
  assert.equal(L.isSolved(p, stateFrom(p, ['.#', 'o#'])), true);
  assert.equal(L.isSolved(p, stateFrom(p, ['#.', '.#'])), false); // island of 3
  assert.equal(L.isSolved(p, stateFrom(p, ['..', '..'])), false);
  assert.equal(L.isSolved(p, stateFrom(p, ['.#', '..'])), false);
});

test('isSolved accepts a full valid solution', () => {
  const p = L.parsePuzzle(['1.1', '...', '.1.']);
  assert.equal(L.isSolved(p, stateFrom(p, ['.#.', '###', '#.#'])), true);
});

test('isSolved rejects pools, cut-off sea and unnumbered islands', () => {
  const pool = L.parsePuzzle(['1..', '...', '..1']);
  assert.equal(L.isSolved(pool, stateFrom(pool, ['.##', '###', '##.'])), false);
  const cut = L.parsePuzzle(['1.1', '.1.', '...']);
  assert.equal(L.isSolved(cut, stateFrom(cut, ['.#.', '#.#', '###'])), false);
  const extra = L.parsePuzzle(['1..', '...', '..1']);
  assert.equal(L.isSolved(extra, stateFrom(extra, ['.##', '#.#', '##.'])), false);
  const two = L.parsePuzzle(['1.1', '...', '...']);
  assert.equal(L.isSolved(two, stateFrom(two, ['.#.', 'ooo', '###'])), false);
});

test('serialize and deserialize round trip, and reject bad saves', () => {
  const p = L.parsePuzzle(ROWS);
  const s = L.paint(p, L.createState(p), [[1, 1]], 'sea');
  assert.deepEqual(L.deserialize(L.serialize(s), p), s);
  assert.equal(L.deserialize('not json', p), null);
  assert.equal(L.deserialize(JSON.stringify({ size: 4, cells: [] }), p), null);
  assert.equal(L.deserialize(JSON.stringify({ size: 5, cells: Array(25).fill('star') }), p), null);
  assert.equal(L.deserialize('null', p), null);
});
