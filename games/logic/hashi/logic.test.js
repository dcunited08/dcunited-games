const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

const SQUARE = ['2.2', '...', '2.2'];
const CROSS = ['..1..', '1...1', '..1..'];

test('parsePuzzle finds islands in row-major order', () => {
  const p = L.parsePuzzle(SQUARE);
  assert.equal(p.size, 3);
  assert.deepEqual(p.islands, [{ r: 0, c: 0, n: 2 }, { r: 0, c: 2, n: 2 }, { r: 2, c: 0, n: 2 }, { r: 2, c: 2, n: 2 }]);
});

test('parsePuzzle lists straight edges between islands that see each other', () => {
  const p = L.parsePuzzle(SQUARE);
  assert.equal(p.edges.length, 4);
  const top = p.edges[L.edgeBetween(p, 0, 1)];
  assert.equal(top.dir, 'h');
  assert.deepEqual(top.cells, [[0, 1]]);
  assert.equal(p.edges[L.edgeBetween(p, 1, 3)].dir, 'v');
  assert.equal(L.edgeBetween(p, 0, 3), -1);
  assert.equal(L.edgeBetween(p, 3, 1), L.edgeBetween(p, 1, 3));
});

test('islands block the view: only the nearest island is a neighbour', () => {
  const p = L.parsePuzzle(['1.2.1']);
  assert.equal(p.edges.length, 2);
  assert.equal(L.edgeBetween(p, 0, 2), -1);
  assert.deepEqual(L.parsePuzzle(['12']).edges[0].cells, []);
});

test('parsePuzzle finds crossings and is idempotent', () => {
  const p = L.parsePuzzle(CROSS);
  assert.equal(p.edges.length, 2);
  assert.deepEqual(p.crossings, [[0, 1]]);
  assert.equal(L.parsePuzzle(p), p);
  assert.deepEqual(L.parsePuzzle(SQUARE).crossings, []);
});

test('parsePuzzle rejects bad input', () => {
  assert.throws(() => L.parsePuzzle([]));
  assert.throws(() => L.parsePuzzle(['2.', '2']));
  assert.throws(() => L.parsePuzzle([5]));
  assert.throws(() => L.parsePuzzle(['2x']));
  assert.throws(() => L.parsePuzzle(['90']));
});

test('createState starts with no bridges; cycleEdge goes 0, 1, 2, 0', () => {
  const p = L.parsePuzzle(SQUARE);
  let s = L.createState(p);
  assert.deepEqual(s.counts, [0, 0, 0, 0]);
  s = L.cycleEdge(p, s, 0);
  assert.equal(s.counts[0], 1);
  s = L.cycleEdge(p, s, 0);
  assert.equal(s.counts[0], 2);
  s = L.cycleEdge(p, s, 0);
  assert.equal(s.counts[0], 0);
});

test('functions do not mutate the state they are given', () => {
  const p = L.parsePuzzle(SQUARE);
  const s = L.createState(p);
  L.cycleEdge(p, s, 0);
  L.setEdge(p, s, 1, 2);
  assert.deepEqual(s.counts, [0, 0, 0, 0]);
});

test('a bridge cannot be added across a built one', () => {
  const p = L.parsePuzzle(CROSS);
  let s = L.cycleEdge(p, L.createState(p), 0);
  assert.equal(L.cycleEdge(p, s, 1), s);
  assert.equal(L.setEdge(p, s, 1, 1), s);
  s = L.cycleEdge(p, s, 0);
  assert.equal(L.cycleEdge(p, s, 1), s);
  s = L.cycleEdge(p, s, 0);
  assert.equal(L.cycleEdge(p, s, 1).counts[1], 1);
});

test('setEdge sets 0 to 2 and ignores other values', () => {
  const p = L.parsePuzzle(SQUARE);
  const s = L.setEdge(p, L.createState(p), 2, 2);
  assert.equal(s.counts[2], 2);
  assert.equal(L.setEdge(p, s, 2, 5), s);
  assert.equal(L.setEdge(p, s, 99, 1), s);
  assert.equal(L.setEdge(p, s, 2, 2), s);
});

test('islandTotals adds up bridges at each end; findConflicts flags overfull islands', () => {
  const p = L.parsePuzzle(['1.2.1']);
  let s = L.setEdge(p, L.createState(p), 0, 2);
  assert.deepEqual(L.islandTotals(p, s), [2, 2, 0]);
  assert.deepEqual(L.findConflicts(p, s), [0]);
  s = L.setEdge(p, s, 0, 1);
  assert.deepEqual(L.findConflicts(p, s), []);
});

test('isSolved needs every count met and all islands connected', () => {
  const p = L.parsePuzzle(SQUARE);
  let s = L.createState(p);
  assert.equal(L.isSolved(p, s), false);
  s = L.setEdge(p, s, 0, 2);
  s = L.setEdge(p, s, 3, 2);
  assert.equal(L.isSolved(p, s), false, 'two separate pairs');
  const ok = { counts: [1, 1, 1, 1] };
  assert.equal(L.isSolved(p, ok), true);
  assert.equal(L.isSolved(L.parsePuzzle(['2.1']), { counts: [1] }), false);
});

test('isSolved is false when built bridges cross', () => {
  const p = L.parsePuzzle(CROSS);
  assert.equal(L.isSolved(p, { counts: [1, 1] }), false);
});

test('a single island with 0 is not a puzzle but counts as connected', () => {
  assert.equal(L.isConnected(L.parsePuzzle(['.1.']), { counts: [] }), true);
});

test('serialize and deserialize round trip, and reject bad saves', () => {
  const p = L.parsePuzzle(SQUARE);
  const s = L.setEdge(p, L.createState(p), 1, 2);
  assert.deepEqual(L.deserialize(L.serialize(s), p), s);
  assert.equal(L.deserialize('nope', p), null);
  assert.equal(L.deserialize('null', p), null);
  assert.equal(L.deserialize(JSON.stringify({ counts: [0, 0, 0] }), p), null);
  assert.equal(L.deserialize(JSON.stringify({ counts: [0, 0, 0, 3] }), p), null);
  assert.equal(L.deserialize(JSON.stringify({ counts: 'x' }), p), null);
  const c = L.parsePuzzle(CROSS);
  assert.equal(L.deserialize(JSON.stringify({ counts: [1, 1] }), c), null);
});
