const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');
const G = require('./generator.js');

test('createRng is deterministic per seed and stays in [0, 1)', () => {
  const a = G.createRng(7);
  const b = G.createRng(7);
  const xs = [a(), a(), a()];
  assert.deepEqual(xs, [b(), b(), b()]);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(xs, [G.createRng(8)(), 0, 0]);
});

test('shuffled returns a permutation and leaves the input alone', () => {
  const src = [1, 2, 3, 4, 5, 6];
  const out = G.shuffled(src, G.createRng(3));
  assert.deepEqual(src, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(out.slice().sort(), src);
});

test('isLoopRegion accepts blobs and rejects holes, checkerboards and splits', () => {
  const grid = (rows) => rows.map((r) => [...r].map((ch) => ch === '#'));
  const ok = (rows) => G.isLoopRegion(rows.length, rows[0].length, grid(rows).flat());
  assert.equal(ok(['##', '##']), true);
  assert.equal(ok(['###', '#.#', '###']), false, 'a hole');
  assert.equal(ok(['#.', '.#']), false, 'diagonal touch');
  assert.equal(ok(['#.#', '###']), true);
  assert.equal(ok(['#..', '...', '..#']), false, 'two blobs');
  assert.equal(ok(['..', '..']), false, 'empty');
});

test('growRegion makes a valid loop region of roughly the asked size', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const inside = G.growRegion(5, 5, G.createRng(seed), 0.5);
    assert.equal(G.isLoopRegion(5, 5, inside), true);
    const n = inside.filter(Boolean).length;
    assert.ok(n >= 8 && n <= 16, `size ${n}`);
  }
});

test('cluesFor and answerLines agree with the region boundary', () => {
  // 2x2 block inside a 3x3 grid.
  const inside = [true, true, false, true, true, false, false, false, false];
  const p = L.parsePuzzle(['...', '...', '...']);
  assert.deepEqual(G.cluesFor(p, inside), [2, 2, 1, 2, 2, 1, 1, 1, 0]);
  const lines = G.answerLines(p, inside);
  assert.equal(L.isSingleLoop(p, lines), true);
  assert.equal(lines.filter(Boolean).length, 8);
});

test('generate makes unique puzzles whose clues fit a loop, and easy ones need no guessing', () => {
  for (const [level, rows, cols] of [['easy', 5, 5], ['medium', 7, 7], ['hard', 6, 6]]) {
    const { puzzle, lines } = G.generate(rows, cols, G.createRng(11), level);
    const p = L.parsePuzzle(puzzle);
    assert.equal(p.rows, rows);
    assert.equal(S.countSolutions(puzzle), 1);
    assert.equal(L.isSingleLoop(p, lines) && L.cluesMet(p, lines), true);
    assert.deepEqual(S.solve(puzzle), lines);
    if (level !== 'hard') assert.equal(S.solvesByPropagation(puzzle), true);
  }
});

test('buildPuzzleSet is deterministic, sized, and has no repeats', () => {
  const counts = { easy: 2, medium: 1, hard: 0 };
  const a = G.buildPuzzleSet(counts, 5);
  assert.deepEqual(a, G.buildPuzzleSet(counts, 5));
  assert.equal(a.easy.length, 2);
  assert.equal(a.medium[0].length, 7);
  assert.deepEqual(a.hard, []);
  assert.notEqual(a.easy[0].join('/'), a.easy[1].join('/'));
});

test('puzzlesSource writes a loadable module', () => {
  const set = { easy: [['1.', '.2']], medium: [], hard: [] };
  const src = G.puzzlesSource(set);
  assert.match(src, /SlitherlinkPuzzles/);
  const m = { exports: {} };
  new Function('module', 'self', src.replace('})(this);', '})(self);'))(m, {});
  assert.deepEqual(m.exports, set);
});
