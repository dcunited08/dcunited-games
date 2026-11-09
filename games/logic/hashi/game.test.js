const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');
const Kit = require('../kit.js');
const G = require('./game.js');

const SQUARE = ['2.2', '...', '2.2'];
const LINE = ['1.3.2'];
const CROSS = ['..1..', '1...1', '..1..'];

test('a new game starts empty, unsolved and with nothing to undo', () => {
  const g = G.createGame(SQUARE);
  assert.deepEqual(g.state().counts, [0, 0, 0, 0]);
  assert.equal(g.isSolved(), false);
  assert.equal(g.canUndo(), false);
  assert.deepEqual(g.conflicts(), []);
  assert.equal(g.puzzle().islands.length, 4);
});

test('cycle builds, doubles and removes a bridge, and undo steps back', () => {
  const g = G.createGame(SQUARE);
  assert.equal(g.cycle(0), true);
  assert.equal(g.cycle(0), true);
  assert.equal(g.state().counts[0], 2);
  assert.equal(g.canUndo(), true);
  assert.equal(g.undo(), true);
  assert.equal(g.state().counts[0], 1);
  assert.equal(g.undo(), true);
  assert.equal(g.undo(), false);
  assert.equal(g.cycle(99), false);
});

test('state() returns a copy', () => {
  const g = G.createGame(SQUARE);
  g.state().counts[0] = 2;
  assert.equal(g.state().counts[0], 0);
});

test('link cycles the bridge between two islands, or does nothing without one', () => {
  const g = G.createGame(SQUARE);
  assert.equal(g.link(0, 1), true);
  assert.equal(g.state().counts[g.puzzle().edges.findIndex((e) => e.a === 0 && e.b === 1)], 1);
  assert.equal(g.link(3, 0), false);
});

test('a blocked crossing is not a move', () => {
  const g = G.createGame(CROSS);
  g.cycle(0);
  assert.equal(g.cycle(1), false);
});

test('conflicts lists overfull islands', () => {
  const g = G.createGame(LINE);
  g.cycle(0);
  g.cycle(0);
  assert.deepEqual(g.conflicts(), [0]);
});

test('mistakes lists bridges with more than the answer has', () => {
  const g = G.createGame(LINE);
  assert.deepEqual(g.mistakes(), []);
  g.cycle(0);
  assert.deepEqual(g.mistakes(), []);
  g.cycle(0);
  assert.deepEqual(g.mistakes(), [0]);
  assert.deepEqual(G.createGame(['3.1']).mistakes(), []);
});

test('solving locks the board', () => {
  const g = G.createGame(SQUARE);
  [0, 1, 2, 3].forEach((e) => g.cycle(e));
  assert.equal(g.isSolved(), true);
  assert.equal(g.cycle(0), false);
  assert.equal(g.clear(), false);
  assert.equal(g.undo(), false);
  assert.equal(g.applyHint(), null);
  assert.deepEqual(g.state().counts, [1, 1, 1, 1]);
});

test('clear empties the board and can be undone', () => {
  const g = G.createGame(SQUARE);
  g.cycle(0);
  assert.equal(g.clear(), true);
  assert.deepEqual(g.state().counts, [0, 0, 0, 0]);
  assert.equal(g.clear(), false);
  g.undo();
  assert.equal(g.state().counts[0], 1);
});

test('applyHint sets the hinted bridge and returns the hint', () => {
  const g = G.createGame(LINE);
  const h = g.applyHint();
  assert.equal(g.state().counts[h.edge], h.value);
  assert.equal(h.value, S.solve(LINE)[h.edge]);
  assert.equal(g.canUndo(), true);
  g.cycle(1);
  g.applyHint();
  assert.equal(G.createGame(['3.1']).applyHint(), null);
});

test('a game can start from a saved state', () => {
  const g = G.createGame(LINE, { counts: [1, 0] });
  assert.deepEqual(g.state().counts, [1, 0]);
  assert.equal(g.canUndo(), false);
});

test('tapIsland selects, links neighbours, switches and deselects', () => {
  const g = G.createGame(SQUARE);
  let r = g.tapIsland(null, 0);
  assert.deepEqual(r, { selected: 0, changed: false });
  r = g.tapIsland(0, 1);
  assert.deepEqual(r, { selected: 0, changed: true });
  assert.equal(g.state().counts[g.puzzle().edges.findIndex((e) => e.a === 0 && e.b === 1)], 1);
  r = g.tapIsland(0, 3);
  assert.deepEqual(r, { selected: 3, changed: false });
  r = g.tapIsland(3, 3);
  assert.deepEqual(r, { selected: null, changed: false });
});

test('tapIsland does nothing once solved', () => {
  const g = G.createGame(SQUARE);
  [0, 1, 2, 3].forEach((e) => g.cycle(e));
  assert.deepEqual(g.tapIsland(null, 0), { selected: null, changed: false });
});

test('dragTarget finds the neighbour a drag points at', () => {
  const p = L.parsePuzzle(['2...2', '.....', '2...2']);
  // island 0 is at row 0 col 0; neighbours: right (col 4) and down (row 2).
  assert.equal(G.dragTarget(p, 0, 2.5, 0), 1);
  assert.equal(G.dragTarget(p, 0, 4, 0.2), 1);
  assert.equal(G.dragTarget(p, 0, 0.2, 1.2), 2);
  assert.equal(G.dragTarget(p, 0, 1.5, 0), -1, 'not far enough');
  assert.equal(G.dragTarget(p, 0, -2, 0), -1, 'nothing that way');
  assert.equal(G.dragTarget(p, 0, 0, -3), -1);
  assert.equal(G.dragTarget(p, 1, 0, 0), 0);
  assert.equal(G.dragTarget(p, 3, 4, 0.5), 1);
  assert.equal(G.dragTarget(p, 0, 0.1, 0.1), -1);
});

test('describeIsland reads out the count for screen readers', () => {
  const g = G.createGame(LINE);
  g.cycle(1);
  assert.equal(g.describeIsland(1), 'Island 3, has 1 of 3 bridges');
  assert.equal(g.describeIsland(0), 'Island 1, has 0 of 1 bridge');
  assert.equal(g.describeIsland(2), 'Island 2, has 1 of 2 bridges');
});

test('timer counts only while running', () => {
  const t = G.createTimer(5000);
  assert.equal(t.elapsed(100), 5000);
  t.start(1000);
  t.start(1500);
  assert.equal(t.isRunning(), true);
  assert.equal(t.elapsed(3000), 7000);
  t.pause(3000);
  t.pause(4000);
  assert.equal(t.elapsed(9000), 7000);
  t.reset();
  assert.equal(t.elapsed(9000), 0);
  assert.equal(G.createTimer(-4).elapsed(0), 0);
  assert.equal(G.createTimer(NaN).elapsed(0), 0);
});

test('buildSave and restoreSave round trip and reject bad saves', () => {
  const p = L.parsePuzzle(SQUARE);
  const saved = G.buildSave({ counts: [1, 2, 0, 1] }, 12345.9);
  assert.deepEqual(saved, { counts: [1, 2, 0, 1], elapsedMs: 12345 });
  assert.deepEqual(G.restoreSave(p, saved), { state: { counts: [1, 2, 0, 1] }, elapsedMs: 12345 });
  assert.equal(G.restoreSave(p, null), null);
  assert.equal(G.restoreSave(p, { counts: [1, 2] }), null);
  assert.equal(G.restoreSave(p, { counts: 'x' }), null);
  assert.equal(G.restoreSave(p, { counts: [0, 0, 0, 0], elapsedMs: 'a' }).elapsedMs, 0);
  assert.equal(G.buildSave({ counts: [0] }, -5).elapsedMs, 0);
});

test('nextPuzzleId goes to the next unsolved, then later levels, then wraps', () => {
  const counts = { easy: 3, medium: 2, hard: 2 };
  const solved = new Set();
  const isSolved = (id) => solved.has(id);
  assert.equal(G.nextPuzzleId(counts, isSolved, 'easy-1'), 'easy-2');
  solved.add('easy-2');
  assert.equal(G.nextPuzzleId(counts, isSolved, 'easy-1'), 'easy-3');
  solved.add('easy-3');
  assert.equal(G.nextPuzzleId(counts, isSolved, 'easy-1'), 'medium-1');
  assert.equal(G.nextPuzzleId(counts, isSolved, 'hard-2'), 'hard-1');
  Kit.LEVELS.forEach((lv) => { for (let n = 1; n <= counts[lv]; n++) solved.add(`${lv}-${n}`); });
  assert.equal(G.nextPuzzleId(counts, isSolved, 'easy-1'), 'easy-2');
  assert.equal(G.nextPuzzleId(counts, isSolved, 'easy-3'), 'easy-1');
  assert.equal(G.nextPuzzleId(counts, isSolved, 'garbage'), 'easy-1');
});
