const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

const P = ['0.....', '......', '..1...', '......', '......', '.....1'];

test('parsePuzzle accepts a valid puzzle and rejects bad ones', () => {
  assert.equal(L.parsePuzzle(P).size, 6);
  assert.throws(() => L.parsePuzzle('nope'), /array/);
  assert.throws(() => L.parsePuzzle([]), /even/);
  assert.throws(() => L.parsePuzzle(['0.', '.1', '..']), /even/);
  assert.throws(() => L.parsePuzzle(['0..', '...', '...']), /even/);
  assert.throws(() => L.parsePuzzle(['0.', '.']), /square/);
  assert.throws(() => L.parsePuzzle(['0x', '..']), /characters/);
  assert.throws(() => L.parsePuzzle([1, 2]), /strings/);
});

test('createState marks givens and leaves the rest empty', () => {
  const s = L.createState(P);
  assert.equal(s.size, 6);
  assert.equal(s.cells[0], 'sun');
  assert.equal(s.cells[14], 'moon');
  assert.equal(s.cells[1], 'empty');
  assert.equal(s.given[0], true);
  assert.equal(s.given[1], false);
});

test('cycleCell goes empty, sun, moon, empty and locks givens', () => {
  let s = L.createState(P);
  s = L.cycleCell(s, 0, 1);
  assert.equal(s.cells[1], 'sun');
  s = L.cycleCell(s, 0, 1);
  assert.equal(s.cells[1], 'moon');
  s = L.cycleCell(s, 0, 1);
  assert.equal(s.cells[1], 'empty');
  assert.equal(L.cycleCell(s, 0, 0), s);
  assert.equal(L.getCell(s, 0, 0), 'sun');
});

test('setCell validates, respects givens and does not mutate', () => {
  const s = L.createState(P);
  const t = L.setCell(s, 1, 1, 'moon');
  assert.equal(s.cells[7], 'empty');
  assert.equal(t.cells[7], 'moon');
  assert.equal(L.setCell(s, 0, 0, 'moon'), s);
  assert.throws(() => L.setCell(s, 1, 1, 'x'), /value/);
  assert.throws(() => L.setCell(s, 9, 1, 'sun'), /range/);
});

test('clearBoard clears player cells only', () => {
  let s = L.createState(P);
  s = L.setCell(s, 1, 1, 'moon');
  s = L.clearBoard(s);
  assert.equal(s.cells[7], 'empty');
  assert.equal(s.cells[0], 'sun');
});

function fill(rows) {
  const p = rows.map((r) => '.'.repeat(r.length));
  let s = L.createState(p);
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== '.') s = L.setCell(s, r, c, ch === '0' ? 'sun' : 'moon');
  }));
  return s;
}
const EMPTY6 = ['......', '......', '......', '......', '......', '......'];
const withRow0 = (row) => [row, ...EMPTY6.slice(1)];

test('findConflicts: three in a row, in rows and columns', () => {
  assert.deepEqual(L.findConflicts(EMPTY6, fill(withRow0('000...'))), [0, 1, 2]);
  const col = ['1.....', '1.....', '1.....', '......', '......', '......'];
  assert.deepEqual(L.findConflicts(EMPTY6, fill(col)), [0, 6, 12]);
  assert.deepEqual(L.findConflicts(EMPTY6, fill(withRow0('00.01.'))), []);
});

test('findConflicts: too many of one symbol in a line', () => {
  assert.deepEqual(L.findConflicts(EMPTY6, fill(withRow0('00.0.0'))), [0, 1, 3, 5]);
});

test('findConflicts: identical full rows and columns', () => {
  const rows = ['001011', '001011', '......', '......', '......', '......'];
  const bad = L.findConflicts(EMPTY6, fill(rows));
  assert.ok([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].every((i) => bad.includes(i)));
  const bad2 = L.findConflicts(EMPTY6, fill(['001100', '001100', '110011', '110011', '001100', '110011']));
  assert.ok(bad2.length > 0);
  // partial rows that look alike are fine
  assert.deepEqual(L.findConflicts(EMPTY6, fill(['001.11', '001.11', '......', '......', '......', '......'])), []);
});

const GOOD = ['001011', '001101', '110010', '010011', '101100', '110100'];

test('isSolved needs a full conflict-free board', () => {
  const full = fill(GOOD);
  assert.deepEqual(L.findConflicts(EMPTY6, full), []);
  assert.equal(L.isSolved(EMPTY6, full), true);
  assert.equal(L.isSolved(EMPTY6, L.createState(EMPTY6)), false);
  assert.equal(L.isSolved(EMPTY6, L.setCell(full, 0, 0, 'moon')), false);
});

test('serialize and deserialize round trip and validate', () => {
  let s = L.createState(P);
  s = L.setCell(s, 1, 1, 'moon');
  const back = L.deserialize(L.serialize(s), P);
  assert.deepEqual(back.cells, s.cells);
  assert.equal(back.given[0], true);
  assert.equal(L.deserialize('not json', P), null);
  assert.equal(L.deserialize('null', P), null);
  assert.equal(L.deserialize(JSON.stringify({ size: 4, cells: [] }), P), null);
  assert.equal(L.deserialize(JSON.stringify({ size: 6, cells: ['sun'] }), P), null);
  const badVal = s.cells.slice(); badVal[1] = 'x';
  assert.equal(L.deserialize(JSON.stringify({ size: 6, cells: badVal }), P), null);
  const badGiven = s.cells.slice(); badGiven[0] = 'moon';
  assert.equal(L.deserialize(JSON.stringify({ size: 6, cells: badGiven }), P), null);
  const lostGiven = s.cells.slice(); lostGiven[0] = 'empty';
  assert.equal(L.deserialize(JSON.stringify({ size: 6, cells: lostGiven }), P), null);
});

test('findConflicts: identical full columns', () => {
  const rows = ['001011', '001101', '110010', '010011', '101100', '110100'];
  const cols = [0, 1, 2, 3, 4, 5].map((c) => rows.map((r) => r[c]).join(''));
  assert.deepEqual(L.findConflicts(EMPTY6, fill(rows)), []);
  const twin = [0, 1, 2, 3, 4, 5].map((r) => cols[0][r] + cols[0][r] + '1010'.slice(0, 4));
  const bad = L.findConflicts(EMPTY6, fill(twin));
  assert.ok(bad.includes(0) && bad.includes(1) && bad.includes(30));
});
