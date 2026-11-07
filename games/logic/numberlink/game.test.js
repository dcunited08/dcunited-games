const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./game.js');
const L = require('./logic.js');

const ROWS = ['1..', '.21', '..2'];
const SOL = { 1: [0, 1, 2, 5], 2: [4, 3, 6, 7, 8] };
const ROWS4 = ['1..2', '....', '....', '1..2'];

const stroke = (g, cells) => {
  assert.equal(g.beginStroke(cells[0]), true);
  cells.slice(1).forEach((c) => g.moveStroke(c));
  return g.endStroke();
};

test('a stroke draws a line and is one undo step', () => {
  const g = G.createGame(ROWS);
  assert.equal(stroke(g, [0, 1, 2, 5]), true);
  assert.deepEqual(g.state().lines[1], [0, 1, 2, 5]);
  assert.equal(g.canUndo(), true);
  assert.equal(g.undo(), true);
  assert.deepEqual(g.state().lines[1], []);
  assert.equal(g.canUndo(), false);
  assert.equal(g.undo(), false);
});

test('beginStroke on an empty square does nothing', () => {
  const g = G.createGame(ROWS);
  assert.equal(g.beginStroke(3), false);
  assert.equal(g.strokeActive(), false);
  assert.equal(g.moveStroke(1), false);
  assert.equal(g.endStroke(), false);
});

test('moveStroke reports whether the board changed', () => {
  const g = G.createGame(ROWS);
  g.beginStroke(0);
  assert.equal(g.strokeActive(), true);
  assert.equal(g.moveStroke(1), true);
  assert.equal(g.moveStroke(1), false);
  g.endStroke();
});

test('a tap on a dot clears its line in one undo step; tapping an empty dot changes nothing', () => {
  const g = G.createGame(ROWS);
  assert.equal(stroke(g, [0]), false);
  stroke(g, [0, 1]);
  assert.equal(stroke(g, [0]), true);
  assert.deepEqual(g.state().lines[1], []);
  g.undo();
  assert.deepEqual(g.state().lines[1], [0, 1]);
});

test('a stroke that ends where it began adds no history', () => {
  const g = G.createGame(ROWS);
  stroke(g, [0, 1]);
  assert.equal(stroke(g, [1]), false);
  assert.equal(stroke(g, [1, 2, 1]), false);
  g.undo();
  assert.equal(g.canUndo(), false);
});

test('undo is ignored while a stroke is in progress', () => {
  const g = G.createGame(ROWS);
  stroke(g, [0, 1]);
  g.beginStroke(1);
  assert.equal(g.undo(), false);
  g.endStroke();
});

test('a new stroke cannot start while one is in progress', () => {
  const g = G.createGame(ROWS);
  g.beginStroke(0);
  assert.equal(g.beginStroke(4), false);
  g.endStroke();
});

test('solving locks the game', () => {
  const g = G.createGame(ROWS);
  stroke(g, [0, 1, 2, 5]);
  assert.equal(g.isSolved(), false);
  stroke(g, [4, 3, 6, 7, 8]);
  assert.equal(g.isSolved(), true);
  assert.equal(g.status(), 'solved');
  assert.equal(g.beginStroke(0), false);
  assert.equal(g.clear(), false);
  assert.equal(g.undo(), false);
  assert.equal(g.applyHint(), null);
});

test('status says when every pair is joined but squares are empty', () => {
  const g = G.createGame(ROWS4);
  assert.equal(g.status(), 'open');
  stroke(g, [0, 4, 8, 12]);
  stroke(g, [3, 7, 11, 15]);
  assert.equal(g.status(), 'joined');
  assert.equal(g.isSolved(), false);
});

test('clear removes every line and can be undone', () => {
  const g = G.createGame(ROWS);
  assert.equal(g.clear(), false);
  stroke(g, [0, 1]);
  stroke(g, [4, 3]);
  assert.equal(g.clear(), true);
  assert.deepEqual(g.state().lines, { 1: [], 2: [] });
  g.undo();
  assert.deepEqual(g.state().lines[2], [4, 3]);
});

test('mistakes lists cells that disagree with the answer', () => {
  const g = G.createGame(ROWS);
  assert.deepEqual(g.mistakes(), []);
  stroke(g, [0, 3]);
  stroke(g, [0, 1]);
  stroke(g, [4, 1]);
  assert.deepEqual(g.mistakes(), [1]);
});

test('applyHint draws a correct line, can be undone, and can finish the puzzle', () => {
  const g = G.createGame(ROWS);
  stroke(g, [4, 7, 8]);
  const h = g.applyHint();
  assert.equal(h.id, '2');
  assert.deepEqual(g.state().lines[2], SOL[2]);
  assert.deepEqual(g.mistakes(), []);
  g.undo();
  assert.deepEqual(g.state().lines[2], [4, 7, 8]);
  g.applyHint();
  g.applyHint();
  assert.equal(g.isSolved(), true);
});

test('createGame can start from a saved state, and state() returns a copy', () => {
  const start = L.applyStroke(ROWS, L.createState(ROWS), [0, 1]);
  const g = G.createGame(ROWS, start);
  const s = g.state();
  assert.deepEqual(s.lines[1], [0, 1]);
  s.lines[1].push(99);
  assert.deepEqual(g.state().lines[1], [0, 1]);
});

test('timer counts while running and pauses', () => {
  const t = G.createTimer(1000);
  assert.equal(t.elapsed(5000), 1000);
  assert.equal(t.isRunning(), false);
  t.start(5000);
  t.start(5500);
  assert.equal(t.isRunning(), true);
  assert.equal(t.elapsed(7000), 3000);
  t.pause(8000);
  assert.equal(t.elapsed(99999), 4000);
  t.pause(100000);
  assert.equal(t.elapsed(100001), 4000);
  t.start(200000);
  assert.equal(t.elapsed(201000), 5000);
});

test('timer defaults to zero, rejects bad values and resets', () => {
  assert.equal(G.createTimer().elapsed(0), 0);
  assert.equal(G.createTimer(-5).elapsed(0), 0);
  assert.equal(G.createTimer(NaN).elapsed(0), 0);
  const t = G.createTimer(4000);
  t.start(0);
  t.reset();
  assert.equal(t.isRunning(), false);
  assert.equal(t.elapsed(10), 0);
});

test('buildSave and restoreSave round trip', () => {
  const st = L.applyStroke(ROWS, L.createState(ROWS), [0, 1, 2]);
  const saved = G.buildSave(st, 12345.9);
  assert.deepEqual(saved, { lines: { 1: [0, 1, 2] }, elapsedMs: 12345 });
  const back = G.restoreSave(ROWS, JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(back.state, st);
  assert.equal(back.elapsedMs, 12345);
});

test('restoreSave rejects bad data and tolerates a bad time', () => {
  assert.equal(G.restoreSave(ROWS, null), null);
  assert.equal(G.restoreSave(ROWS, {}), null);
  assert.equal(G.restoreSave(ROWS, { lines: { 1: [4, 5] } }), null);
  assert.equal(G.restoreSave(ROWS, { lines: { 1: [0, 1] } }).elapsedMs, 0);
  assert.equal(G.restoreSave(ROWS, { lines: {}, elapsedMs: -3 }).elapsedMs, 0);
  assert.equal(G.buildSave(L.createState(ROWS), -1).elapsedMs, 0);
});

test('nextPuzzleId picks the next unsolved puzzle, same level first', () => {
  const counts = { easy: 3, medium: 2, hard: 2 };
  const solved = new Set(['easy-1']);
  const is = (id) => solved.has(id);
  assert.equal(G.nextPuzzleId(counts, is, 'easy-1'), 'easy-2');
  assert.equal(G.nextPuzzleId(counts, is, 'easy-2'), 'easy-3');
  assert.equal(G.nextPuzzleId(counts, is, 'easy-3'), 'easy-2');
  solved.add('easy-2').add('easy-3');
  assert.equal(G.nextPuzzleId(counts, is, 'easy-3'), 'medium-1');
  solved.add('medium-1').add('medium-2').add('hard-1');
  assert.equal(G.nextPuzzleId(counts, is, 'medium-2'), 'hard-2');
  assert.equal(G.nextPuzzleId(counts, is, 'hard-2'), 'hard-1');
});

test('nextPuzzleId goes back to earlier levels and wraps when all are solved', () => {
  const counts = { easy: 2, medium: 1, hard: 1 };
  const solved = new Set(['easy-1', 'medium-1', 'hard-1']);
  const is = (id) => solved.has(id);
  assert.equal(G.nextPuzzleId(counts, is, 'hard-1'), 'easy-2');
  solved.add('easy-2');
  assert.equal(G.nextPuzzleId(counts, is, 'easy-2'), 'easy-1');
  assert.equal(G.nextPuzzleId(counts, is, 'easy-1'), 'easy-2');
  assert.equal(G.nextPuzzleId(counts, is, 'bogus'), 'easy-1');
});
