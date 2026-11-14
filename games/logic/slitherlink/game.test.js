const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./game.js');
const L = require('./logic.js');
const S = require('./solver.js');

const ROWS = ['212', '101', '212'];
const p = L.parsePuzzle(ROWS);
const answer = S.solve(p);
const answerEdges = answer.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
const wrongEdge = answer.findIndex((v) => !v);

function solveGame(game) { game.drawPath(answerEdges, false); }

test('tap cycles an edge empty -> line -> x -> empty', () => {
  const g = G.createGame(ROWS);
  assert.equal(g.tap(0), true);
  assert.equal(g.state().edges[0], 'line');
  g.tap(0);
  assert.equal(g.state().edges[0], 'x');
  g.tap(0);
  assert.equal(g.state().edges[0], 'empty');
});

test('tap out of range is ignored and not undoable', () => {
  const g = G.createGame(ROWS);
  assert.equal(g.tap(999), false);
  assert.equal(g.canUndo(), false);
});

test('drawPath adds lines in one undo step, and erase mode removes them', () => {
  const g = G.createGame(ROWS);
  assert.equal(g.drawPath([0, 1, 2], false), true);
  assert.deepEqual(g.state().edges.slice(0, 3), ['line', 'line', 'line']);
  assert.equal(g.drawPath([0, 1, 2], false), false);
  assert.equal(g.drawPath([1], true), true);
  assert.equal(g.state().edges[1], 'empty');
  assert.equal(g.undo(), true);
  assert.equal(g.state().edges[1], 'line');
  assert.equal(g.undo(), true);
  assert.equal(g.state().edges[0], 'empty');
  assert.equal(g.undo(), false);
});

test('clear empties the board and can be undone', () => {
  const g = G.createGame(ROWS);
  assert.equal(g.clear(), false);
  g.tap(0);
  assert.equal(g.clear(), true);
  assert.equal(g.state().edges[0], 'empty');
  g.undo();
  assert.equal(g.state().edges[0], 'line');
});

test('mistakes lists wrong lines and X marks on answer edges', () => {
  const g = G.createGame(ROWS);
  assert.deepEqual(g.mistakes(), []);
  g.tap(wrongEdge);
  g.tap(answerEdges[0]);
  g.tap(answerEdges[0]);
  assert.deepEqual(g.mistakes(), [wrongEdge, answerEdges[0]].sort((a, b) => a - b));
  g.tap(wrongEdge);
  g.tap(wrongEdge);
  assert.deepEqual(g.mistakes(), [answerEdges[0]]);
});

test('conflicts reports over-full clues and branching dots', () => {
  const g = G.createGame(['1.', '..']);
  assert.deepEqual(g.conflicts(), { cells: [], dots: [] });
  g.drawPath([0, 2], false);
  assert.deepEqual(g.conflicts().cells, [0]);
});

test('isSolved locks the board', () => {
  const g = G.createGame(ROWS);
  assert.equal(g.isSolved(), false);
  solveGame(g);
  assert.equal(g.isSolved(), true);
  assert.equal(g.tap(0), false);
  assert.equal(g.drawPath([0], true), false);
  assert.equal(g.clear(), false);
  assert.equal(g.undo(), false);
  assert.equal(g.applyHint(), null);
});

test('hint removes a wrong line first, with a reason', () => {
  const g = G.createGame(ROWS);
  g.tap(wrongEdge);
  const h = g.applyHint();
  assert.equal(h.edge, wrongEdge);
  assert.equal(h.value, 'empty');
  assert.match(h.reason, /isn't part of the loop/);
  assert.equal(g.state().edges[wrongEdge], 'empty');
});

test('hint clears a wrong X on an answer edge', () => {
  const g = G.createGame(ROWS);
  g.tap(answerEdges[0]);
  g.tap(answerEdges[0]);
  const h = g.applyHint();
  assert.equal(h.edge, answerEdges[0]);
  assert.equal(h.value, 'empty');
  assert.match(h.reason, /X/);
});

test('hint adds an answer line, preferring one next to a clue, until solved', () => {
  const g = G.createGame(ROWS);
  const seen = new Set();
  for (let i = 0; i < 40 && !g.isSolved(); i++) {
    const h = g.applyHint();
    assert.equal(h.value, 'line');
    assert.equal(answer[h.edge], true);
    assert.ok(!seen.has(h.edge));
    assert.ok(h.reason.length > 5);
    seen.add(h.edge);
  }
  assert.equal(g.isSolved(), true);
  assert.equal(seen.size, answerEdges.length);
});

test('hint reason mentions the clue number when next to a clue', () => {
  const g = G.createGame(ROWS);
  assert.match(g.applyHint().reason, /[0-3]/);
  const free = G.createGame(['.', '.']);
  assert.match(free.applyHint().reason, /loop/);
});

test('createGame can start from a saved state', () => {
  const start = L.setPath(L.createState(p), [0], false);
  const g = G.createGame(ROWS, start);
  assert.equal(g.state().edges[0], 'line');
  start.edges[0] = 'empty';
  assert.equal(g.state().edges[0], 'line');
});

test('timer counts only while running and can be restored', () => {
  const t = G.createTimer(5000);
  assert.equal(t.elapsed(100), 5000);
  t.start(1000);
  t.start(2000);
  assert.equal(t.isRunning(), true);
  assert.equal(t.elapsed(4000), 8000);
  t.pause(4000);
  t.pause(9000);
  assert.equal(t.elapsed(9999), 8000);
  t.reset();
  assert.equal(t.elapsed(0), 0);
  assert.equal(G.createTimer(-3).elapsed(0), 0);
});

test('buildSave and restoreSave round trip and reject bad saves', () => {
  const s = L.setPath(L.createState(p), [0, 4], false);
  const saved = G.buildSave(s, 12345.9);
  assert.deepEqual(saved, { edges: s.edges, elapsedMs: 12345 });
  const back = G.restoreSave(ROWS, JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(back.state, s);
  assert.equal(back.elapsedMs, 12345);
  assert.equal(G.buildSave(s, NaN).elapsedMs, 0);
  assert.equal(G.restoreSave(ROWS, null), null);
  assert.equal(G.restoreSave(ROWS, { edges: ['line'] }), null);
  assert.equal(G.restoreSave(ROWS, {}), null);
});

test('nextPuzzleId picks the next unsolved puzzle, then wraps', () => {
  const counts = { easy: 3, medium: 2, hard: 2 };
  assert.equal(G.nextPuzzleId(counts, () => false, 'easy-1'), 'easy-2');
  assert.equal(G.nextPuzzleId(counts, (id) => id === 'easy-2', 'easy-1'), 'easy-3');
  assert.equal(G.nextPuzzleId(counts, (id) => id.startsWith('easy'), 'easy-1'), 'medium-1');
  assert.equal(G.nextPuzzleId(counts, () => true, 'easy-3'), 'easy-1');
  assert.equal(G.nextPuzzleId(counts, () => true, 'easy-1'), 'easy-2');
});
