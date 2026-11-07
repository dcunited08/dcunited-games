const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

const heart = { id: 'easy-1', name: 'Heart', level: 'easy', rows: ['.#.#.', '#####', '#####', '.###.', '..#..'] };
const plus = { id: 't', name: 'Plus', level: 'easy', rows: ['.#.', '###', '.#.'] };

const cellsOf = (...rc) => rc.map(([r, c]) => ({ r, c }));

test('cluesFor gives row and column clues', () => {
  assert.deepEqual(L.cluesFor(plus), { rows: [[1], [3], [1]], cols: [[1], [3], [1]] });
  assert.deepEqual(L.cluesFor(heart).rows[0], [1, 1]);
  assert.deepEqual(L.cluesFor({ rows: ['...'] }).rows, [[]]);
});

test('createGame starts empty with the right size', () => {
  const s = L.createGame(plus);
  assert.equal(s.h, 3);
  assert.equal(s.w, 3);
  assert.ok(s.cells.every((row) => row.every((v) => v === 'empty')));
});

test('applyTool paints cells without mutating the old state', () => {
  const s = L.createGame(plus);
  const t = L.applyTool(s, cellsOf([0, 1], [1, 1]), 'fill');
  assert.equal(s.cells[0][1], 'empty');
  assert.equal(t.cells[0][1], 'filled');
  assert.equal(t.cells[1][1], 'filled');
  const u = L.applyTool(t, cellsOf([0, 1]), 'cross');
  assert.equal(u.cells[0][1], 'cross');
  const v = L.applyTool(u, cellsOf([0, 1], [9, 9]), 'clear');
  assert.equal(v.cells[0][1], 'empty');
});

test('applyTool rejects an unknown tool', () => {
  assert.throws(() => L.applyTool(L.createGame(plus), cellsOf([0, 0]), 'zap'));
});

test('dragAction toggles on the same tool and otherwise sets it', () => {
  assert.equal(L.dragAction('empty', 'fill'), 'fill');
  assert.equal(L.dragAction('filled', 'fill'), 'clear');
  assert.equal(L.dragAction('cross', 'fill'), 'fill');
  assert.equal(L.dragAction('empty', 'cross'), 'cross');
  assert.equal(L.dragAction('cross', 'cross'), 'clear');
  assert.equal(L.dragAction('filled', 'cross'), 'cross');
});

test('lineCells snaps to the dominant axis', () => {
  assert.deepEqual(L.lineCells({ r: 2, c: 1 }, { r: 2, c: 4 }), cellsOf([2, 1], [2, 2], [2, 3], [2, 4]));
  assert.deepEqual(L.lineCells({ r: 1, c: 3 }, { r: 3, c: 3 }), cellsOf([1, 3], [2, 3], [3, 3]));
  assert.deepEqual(L.lineCells({ r: 1, c: 1 }, { r: 2, c: 4 }), cellsOf([1, 1], [1, 2], [1, 3], [1, 4]));
  assert.deepEqual(L.lineCells({ r: 1, c: 1 }, { r: 4, c: 2 }), cellsOf([1, 1], [2, 1], [3, 1], [4, 1]));
  assert.deepEqual(L.lineCells({ r: 3, c: 3 }, { r: 3, c: 1 }), cellsOf([3, 3], [3, 2], [3, 1]));
  assert.deepEqual(L.lineCells({ r: 3, c: 3 }, { r: 3, c: 3 }), cellsOf([3, 3]));
});

test('rowComplete and colComplete compare filled runs with the clue', () => {
  let s = L.createGame(plus);
  assert.equal(L.rowComplete(s, 0), false);
  s = L.applyTool(s, cellsOf([0, 1]), 'fill');
  assert.equal(L.rowComplete(s, 0), true);
  assert.equal(L.colComplete(s, 1), false);
  s = L.applyTool(s, cellsOf([1, 1]), 'fill');
  assert.equal(L.colComplete(s, 1), false);
  s = L.applyTool(s, cellsOf([2, 1]), 'fill');
  assert.equal(L.colComplete(s, 1), true);
  s = L.applyTool(s, cellsOf([1, 1]), 'cross');
  assert.equal(L.colComplete(s, 1), false);
  assert.equal(L.rowComplete(L.createGame({ rows: ['..'] }), 0), true);
});

test('isSolved needs every row and column right; crosses are ignored', () => {
  let s = L.createGame(plus);
  s = L.applyTool(s, cellsOf([0, 1], [1, 0], [1, 1], [1, 2], [2, 1]), 'fill');
  assert.equal(L.isSolved(s), true);
  s = L.applyTool(s, cellsOf([0, 0]), 'cross');
  assert.equal(L.isSolved(s), true);
  s = L.applyTool(s, cellsOf([0, 0]), 'fill');
  assert.equal(L.isSolved(s), false);
  assert.equal(L.isSolved(L.createGame(plus)), false);
});

test('wrongCells lists stray fills and crosses on picture cells', () => {
  let s = L.createGame(plus);
  s = L.applyTool(s, cellsOf([0, 0]), 'fill');
  s = L.applyTool(s, cellsOf([1, 1]), 'cross');
  s = L.applyTool(s, cellsOf([0, 1]), 'fill');
  s = L.applyTool(s, cellsOf([2, 0]), 'cross');
  assert.deepEqual(L.wrongCells(s), cellsOf([0, 0], [1, 1]));
});

test('serialize and deserialize round trip', () => {
  let s = L.createGame(plus);
  s = L.applyTool(s, cellsOf([0, 1], [1, 1]), 'fill');
  s = L.applyTool(s, cellsOf([2, 2]), 'cross');
  const str = L.serialize(s);
  assert.equal(str, '.#.|.#.|..x'.replace(/\|/g, ''));
  const back = L.deserialize(plus, str);
  assert.deepEqual(back.cells, s.cells);
});

test('deserialize returns null for bad input', () => {
  assert.equal(L.deserialize(plus, null), null);
  assert.equal(L.deserialize(plus, 42), null);
  assert.equal(L.deserialize(plus, '.#.'), null);
  assert.equal(L.deserialize(plus, '.#..#..#?'), null);
  assert.equal(L.deserialize(null, '.........'), null);
});

test('hintCell corrects a wrong cell first', () => {
  let s = L.createGame(plus);
  s = L.applyTool(s, cellsOf([0, 0]), 'fill');
  assert.deepEqual(L.hintCell(s), { r: 0, c: 0, value: 'empty' });
  s = L.applyTool(L.createGame(plus), cellsOf([1, 1]), 'cross');
  assert.deepEqual(L.hintCell(s), { r: 1, c: 1, value: 'filled' });
});

test('hintCell fills a missing picture cell, deterministic by default and random with rng', () => {
  const s = L.createGame(plus);
  assert.deepEqual(L.hintCell(s), { r: 0, c: 1, value: 'filled' });
  assert.deepEqual(L.hintCell(s, () => 0.999), { r: 2, c: 1, value: 'filled' });
  assert.deepEqual(L.hintCell(s, () => 0), { r: 0, c: 1, value: 'filled' });
});

test('hintCell is null when solved and a hint applies cleanly', () => {
  let s = L.createGame(plus);
  for (let i = 0; i < 5; i++) {
    const h = L.hintCell(s);
    assert.ok(h);
    s = L.applyTool(s, [h], h.value === 'filled' ? 'fill' : 'clear');
  }
  assert.equal(L.isSolved(s), true);
  assert.equal(L.hintCell(s), null);
});
