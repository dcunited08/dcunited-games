const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

// Trees at (0,0) and (2,2). Answer: tents at (1,0) and (2,3).
const puzzle = { grid: ['T...', '....', '..T.', '....'], rows: [0, 1, 1, 0], cols: [1, 0, 0, 1] };
const idx = (r, c) => r * 4 + c;
function withCells(map) {
  const s = L.createState(puzzle);
  for (const [k, v] of Object.entries(map)) s.cells[k] = v;
  return s;
}

test('parsePuzzle reads trees and clues', () => {
  const p = L.parsePuzzle(puzzle);
  assert.equal(p.size, 4);
  assert.deepEqual(p.trees.map(Number), [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0]);
  assert.deepEqual(p.rows, [0, 1, 1, 0]);
  assert.deepEqual(p.cols, [1, 0, 0, 1]);
  assert.equal(L.parsePuzzle(p), p);
});

test('parsePuzzle rejects bad puzzles', () => {
  assert.throws(() => L.parsePuzzle(null), /object/);
  assert.throws(() => L.parsePuzzle({ grid: 'x', rows: [], cols: [] }), /grid/);
  assert.throws(() => L.parsePuzzle({ grid: ['T..', '..'], rows: [0, 0], cols: [0, 0, 0] }), /square/);
  assert.throws(() => L.parsePuzzle({ grid: ['T.', '.x'], rows: [0, 0], cols: [0, 0] }), /T or/);
  assert.throws(() => L.parsePuzzle({ grid: ['T.', '..'], rows: [0], cols: [0, 0] }), /clues/);
  assert.throws(() => L.parsePuzzle({ grid: ['T.', '..'], rows: [0, 0], cols: [0, 9] }), /clues/);
});

test('createState starts empty; cycleCell goes empty -> grass -> tent -> empty', () => {
  let s = L.createState(puzzle);
  assert.equal(s.cells.length, 16);
  assert.ok(s.cells.every((v) => v === 'empty'));
  s = L.cycleCell(puzzle, s, 1, 1);
  assert.equal(L.getCell(s, 1, 1), 'grass');
  s = L.cycleCell(puzzle, s, 1, 1);
  assert.equal(L.getCell(s, 1, 1), 'tent');
  s = L.cycleCell(puzzle, s, 1, 1);
  assert.equal(L.getCell(s, 1, 1), 'empty');
});

test('trees never change and functions do not mutate their input', () => {
  const s = L.createState(puzzle);
  const t = L.cycleCell(puzzle, s, 0, 0);
  assert.deepEqual(t.cells, s.cells);
  const u = L.setCell(puzzle, s, 1, 1, 'tent');
  assert.equal(s.cells[5], 'empty');
  assert.equal(u.cells[5], 'tent');
  assert.deepEqual(L.setCell(puzzle, s, 0, 0, 'tent').cells, s.cells);
});

test('setCell rejects bad values and positions', () => {
  const s = L.createState(puzzle);
  assert.throws(() => L.setCell(puzzle, s, 1, 1, 'star'), /Bad cell/);
  assert.throws(() => L.setCell(puzzle, s, 9, 1, 'tent'), /range/);
});

test('markGrass only touches empty non-tree cells', () => {
  const s = withCells({ [idx(1, 1)]: 'tent' });
  const t = L.markGrass(puzzle, s, [[0, 0], [1, 1], [1, 2], [1, 2], [9, 9]]);
  assert.equal(t.cells[idx(0, 0)], 'empty');
  assert.equal(t.cells[idx(1, 1)], 'tent');
  assert.equal(t.cells[idx(1, 2)], 'grass');
});

test('clearBoard empties everything', () => {
  const s = withCells({ 5: 'tent', 6: 'grass' });
  assert.ok(L.clearBoard(s).cells.every((v) => v === 'empty'));
});

test('lineCounts and lineStatus compare tents with the clues', () => {
  const s = withCells({ [idx(1, 0)]: 'tent', [idx(2, 3)]: 'tent', [idx(3, 0)]: 'tent' });
  assert.deepEqual(L.lineCounts(puzzle, s), { rows: [0, 1, 1, 1], cols: [2, 0, 0, 1] });
  assert.deepEqual(L.lineStatus(puzzle, s), { rows: ['met', 'met', 'met', 'over'], cols: ['over', 'met', 'met', 'met'] });
  const e = L.createState(puzzle);
  assert.deepEqual(L.lineStatus(puzzle, e).rows, ['met', 'under', 'under', 'met']);
});

test('findConflicts: touching tents, including diagonals', () => {
  const s = withCells({ [idx(1, 0)]: 'tent', [idx(2, 1)]: 'tent' });
  const bad = L.findConflicts(puzzle, s);
  assert.ok(bad.includes(idx(1, 0)) && bad.includes(idx(2, 1)));
});

test('findConflicts: tent with no tree next to it, and tents in an over-full line', () => {
  const lone = withCells({ [idx(3, 3)]: 'tent' });
  assert.ok(L.findConflicts(puzzle, lone).includes(idx(3, 3)));
  const over = withCells({ [idx(0, 1)]: 'tent', [idx(1, 0)]: 'tent' });
  const bad = L.findConflicts(puzzle, over);
  assert.ok(bad.includes(idx(0, 1))); // row 0 wants no tents
});

test('findConflicts: a tree with no room for a tent is flagged', () => {
  const s = withCells({ [idx(0, 1)]: 'grass', [idx(1, 0)]: 'grass' });
  assert.ok(L.findConflicts(puzzle, s).includes(idx(0, 0)));
  assert.ok(!L.findConflicts(puzzle, L.createState(puzzle)).includes(idx(0, 0)));
});

test('findConflicts is clean for the right answer', () => {
  const s = withCells({ [idx(1, 0)]: 'tent', [idx(2, 3)]: 'tent' });
  assert.deepEqual(L.findConflicts(puzzle, s), []);
});

test('pairTrees finds a one-to-one pairing or null', () => {
  const s = withCells({ [idx(1, 0)]: 'tent', [idx(2, 3)]: 'tent' });
  const pairs = L.pairTrees(puzzle, s);
  assert.deepEqual(pairs.map((p) => [p.tree, p.tent]).sort(), [[idx(0, 0), idx(1, 0)], [idx(2, 2), idx(2, 3)]]);
  // Two tents next to the same single tree cannot both be paired.
  const two = withCells({ [idx(0, 1)]: 'tent', [idx(1, 0)]: 'tent' });
  assert.equal(L.pairTrees(puzzle, two), null);
  assert.equal(L.pairTrees(puzzle, L.createState(puzzle)), null);
});

test('pairTrees needs a re-route when a tent is shared (augmenting path)', () => {
  // Trees at (0,1) and (1,0); tents at (0,0) (next to both) and (2,0) (next to (1,0)).
  const p = { grid: ['.T.', 'T..', '...'], rows: [1, 0, 1], cols: [2, 0, 0] };
  const s = L.createState(p);
  s.cells[0] = 'tent';
  s.cells[6] = 'tent';
  const pairs = L.pairTrees(p, s);
  assert.equal(pairs.length, 2);
  assert.deepEqual(pairs.map((x) => x.tent).sort(), [0, 6]);
});

test('isSolved needs counts, no touching and a pairing', () => {
  assert.equal(L.isSolved(puzzle, withCells({ [idx(1, 0)]: 'tent', [idx(2, 3)]: 'tent' })), true);
  assert.equal(L.isSolved(puzzle, L.createState(puzzle)), false);
  // Right counts, wrong place: tents at (1,0) and (3,3)? row 3 over. Use (1,0),(2,1)? touches.
  assert.equal(L.isSolved(puzzle, withCells({ [idx(1, 0)]: 'tent', [idx(2, 1)]: 'tent' })), false);
  // Grass marks do not matter.
  assert.equal(L.isSolved(puzzle, withCells({ [idx(1, 0)]: 'tent', [idx(2, 3)]: 'tent', [idx(3, 3)]: 'grass' })), true);
});

test('serialize / deserialize round trip and reject bad saves', () => {
  const s = withCells({ 5: 'tent', 6: 'grass' });
  assert.deepEqual(L.deserialize(L.serialize(s), puzzle), s);
  assert.equal(L.deserialize('nope', puzzle), null);
  assert.equal(L.deserialize(JSON.stringify({ size: 3, cells: [] }), puzzle), null);
  assert.equal(L.deserialize(JSON.stringify({ size: 4, cells: Array(16).fill('star') }), puzzle), null);
  assert.equal(L.deserialize(JSON.stringify({ size: 4, cells: Array(15).fill('empty') }), puzzle), null);
  assert.equal(L.deserialize('null', puzzle), null);
  const onTree = Array(16).fill('empty');
  onTree[0] = 'tent';
  assert.equal(L.deserialize(JSON.stringify({ size: 4, cells: onTree }), puzzle), null);
});
