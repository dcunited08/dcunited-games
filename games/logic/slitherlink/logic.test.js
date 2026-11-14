const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

// 2x2 block, every cell has two outside sides: the only loop is the outer square.
const SQUARE = ['22', '22'];
const p = L.parsePuzzle(SQUARE);
// Outer loop edges: H(r,c) = r*cols+c, V(r,c) = nH + r*(cols+1)+c
const H = (r, c) => p.cols * r + c;
const V = (r, c) => p.nH + r * (p.cols + 1) + c;
const OUTER = [H(0, 0), H(0, 1), H(2, 0), H(2, 1), V(0, 0), V(1, 0), V(0, 2), V(1, 2)];

test('parsePuzzle reads clues and sizes', () => {
  const q = L.parsePuzzle(['3.', '.0']);
  assert.equal(q.rows, 2);
  assert.equal(q.cols, 2);
  assert.deepEqual(q.clues, [3, -1, -1, 0]);
  assert.equal(q.nH, 6);
  assert.equal(q.nV, 6);
  assert.equal(q.edgeCount, 12);
  assert.equal(L.parsePuzzle(q), q);
});

test('parsePuzzle rejects bad input', () => {
  assert.throws(() => L.parsePuzzle('nope'));
  assert.throws(() => L.parsePuzzle([]));
  assert.throws(() => L.parsePuzzle(['12', '1']));
  assert.throws(() => L.parsePuzzle(['14']));
  assert.throws(() => L.parsePuzzle([12]));
});

test('edge topology: cells, dots and edges agree', () => {
  assert.deepEqual(p.cellE[0], [H(0, 0), H(1, 0), V(0, 0), V(0, 1)]);
  assert.deepEqual(p.edgeD[H(0, 0)], [0, 1]);
  assert.deepEqual(p.edgeD[V(0, 0)], [0, 3]);
  assert.equal(p.dotE[4].length, 4);
  assert.equal(p.dotE[0].length, 2);
  assert.deepEqual(p.edgeC[H(1, 1)].sort(), [1, 3]);
  assert.deepEqual(p.edgeC[H(0, 0)], [0]);
  assert.deepEqual(L.dotRC(p, 5), [1, 2]);
});

test('createState starts empty and cycleEdge goes empty -> line -> x -> empty', () => {
  const s = L.createState(p);
  assert.equal(s.edges.length, 12);
  assert.ok(s.edges.every((v) => v === 'empty'));
  const a = L.cycleEdge(s, 0);
  assert.equal(a.edges[0], 'line');
  assert.equal(s.edges[0], 'empty');
  assert.equal(L.cycleEdge(a, 0).edges[0], 'x');
  assert.equal(L.cycleEdge(L.cycleEdge(a, 0), 0).edges[0], 'empty');
  assert.equal(L.cycleEdge(s, 99), s);
});

test('setEdge, setPath and clearBoard', () => {
  let s = L.createState(p);
  s = L.setEdge(s, 3, 'x');
  assert.equal(s.edges[3], 'x');
  assert.equal(L.setEdge(s, 3, 'x'), s);
  assert.equal(L.setEdge(s, 99, 'line'), s);
  const d = L.setPath(s, [3, 4, 5], false);
  assert.deepEqual(d.edges.slice(3, 6), ['line', 'line', 'line']);
  const e = L.setPath(d, [3, 4, 77], true);
  assert.deepEqual(e.edges.slice(3, 6), ['empty', 'empty', 'line']);
  const x = L.setPath(L.setEdge(L.createState(p), 3, 'x'), [3], true);
  assert.equal(x.edges[3], 'x');
  assert.ok(L.clearBoard(d).edges.every((v) => v === 'empty'));
});

test('lineFlags lists which edges are lines', () => {
  const s = L.setPath(L.createState(p), [2, 5], false);
  assert.deepEqual(L.lineFlags(s).map(Number), [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
});

test('isSingleLoop and cluesMet', () => {
  const s = L.setPath(L.createState(p), OUTER, false);
  assert.equal(L.isSingleLoop(p, L.lineFlags(s)), true);
  assert.equal(L.cluesMet(p, L.lineFlags(s)), true);
  assert.equal(L.isSolved(p, s), true);
  assert.equal(L.isSolved(p, L.createState(p)), false);
  // Open path: not a loop.
  const open = L.setPath(L.createState(p), OUTER.slice(1), false);
  assert.equal(L.isSingleLoop(p, L.lineFlags(open)), false);
});

test('two disjoint loops are not a single loop', () => {
  const q = L.parsePuzzle(['.', '.', '.']); // 3 rows, 1 col: H = 4, V = 3
  const h = (r) => r;
  const v = (r) => q.nH + 2 * r;
  const w = (r) => q.nH + 2 * r + 1;
  // Loop around row 0 cell only, and nothing else: that is one loop...
  const one = L.setPath(L.createState(q), [h(0), h(1), v(0), w(0)], false);
  assert.equal(L.isSingleLoop(q, L.lineFlags(one)), true);
  // ...plus a second loop around row 2 cell: two loops.
  const two = L.setPath(one, [h(2), h(3), v(2), w(2)], false);
  assert.equal(L.isSingleLoop(q, L.lineFlags(two)), false);
});

test('isSolved fails when a clue is not met', () => {
  const q = L.parsePuzzle(['21', '22']);
  const s = L.setPath(L.createState(q), OUTER, false);
  assert.equal(L.isSingleLoop(q, L.lineFlags(s)), true);
  assert.equal(L.isSolved(q, s), false);
});

test('findConflicts flags over-full and unreachable clues and branching dots', () => {
  const q = L.parsePuzzle(['1.', '..']);
  let s = L.setPath(L.createState(q), [q.cellE[0][0], q.cellE[0][1]], false);
  assert.deepEqual(L.findConflicts(q, s).cells, [0]);
  s = L.setPath(L.createState(q), [q.cellE[0][0]], false);
  s = L.setPath(s, [q.cellE[0][1], q.cellE[0][2]], false);
  s = L.setPath(L.createState(q), [], false);
  assert.deepEqual(L.findConflicts(q, s), { cells: [], dots: [] });
  // All four sides X'd around a 1 -> cannot be met.
  const x = ['x', 'x', 'x', 'x'].reduce((st, v, i) => L.setEdge(st, q.cellE[0][i], v), L.createState(q));
  assert.deepEqual(L.findConflicts(q, x).cells, [0]);
  const two = L.setEdge(L.setEdge(L.createState(q), q.cellE[0][0], 'x'), q.cellE[0][1], 'x');
  assert.deepEqual(L.findConflicts(q, two).cells, []);
  // Dot with three lines.
  const branch = L.setPath(L.createState(q), q.dotE[4].slice(0, 3), false);
  assert.deepEqual(L.findConflicts(q, branch).dots, [4]);
  const mid = L.setPath(L.createState(q), q.dotE[4].slice(0, 2), false);
  assert.deepEqual(L.findConflicts(q, mid).dots, []);
});

test('nearestEdge picks the closest edge midpoint', () => {
  // Coordinates are in cell units: dot (r, c) sits at x = c, y = r.
  assert.equal(L.nearestEdge(p, 0.5, 0.05), H(0, 0));
  assert.equal(L.nearestEdge(p, 1.5, 2.1), H(2, 1));
  assert.equal(L.nearestEdge(p, 0.04, 1.5), V(1, 0));
  assert.equal(L.nearestEdge(p, 1.95, 0.45), V(0, 2));
  assert.equal(L.nearestEdge(p, -2, -2), -1);
  assert.equal(L.nearestEdge(p, 9, 1), -1);
});

test('nearestDot snaps only within the radius', () => {
  assert.equal(L.nearestDot(p, 1.1, 0.9, 0.3), 4);
  assert.equal(L.nearestDot(p, 0.02, 0.0, 0.3), 0);
  assert.equal(L.nearestDot(p, 0.5, 0.5, 0.3), -1);
  assert.equal(L.nearestDot(p, 5, 5, 0.3), -1);
});

test('dotBetween finds the edge joining neighbouring dots', () => {
  assert.equal(L.edgeBetween(p, 0, 1), H(0, 0));
  assert.equal(L.edgeBetween(p, 1, 0), H(0, 0));
  assert.equal(L.edgeBetween(p, 0, 3), V(0, 0));
  assert.equal(L.edgeBetween(p, 0, 4), -1);
});

test('dotPath walks one step at a time towards a dot', () => {
  assert.deepEqual(L.dotPath(p, 0, 0), []);
  assert.deepEqual(L.dotPath(p, 0, 2), [1, 2]);
  assert.deepEqual(L.dotPath(p, 8, 4), [5, 4]);
  assert.deepEqual(L.dotPath(p, 0, 8), [3, 4, 7, 8]);
  assert.deepEqual(L.dotPath(p, 8, 0), [5, 4, 1, 0]);
});

test('serialize and deserialize round trip, and reject bad data', () => {
  const s = L.setPath(L.createState(p), [1, 2], false);
  assert.deepEqual(L.deserialize(L.serialize(s), p), s);
  assert.equal(L.deserialize('not json', p), null);
  assert.equal(L.deserialize(JSON.stringify({ edges: ['line'] }), p), null);
  assert.equal(L.deserialize(JSON.stringify({ edges: new Array(12).fill('star') }), p), null);
  assert.equal(L.deserialize(JSON.stringify({}), p), null);
});
