const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./make-puzzles.js');

test('buildPuzzleList makes numbered puzzles per level in compact form', () => {
  const list = M.buildPuzzleList({ easy: 1, medium: 1, hard: 1 });
  assert.deepEqual(list.map((p) => p.id), ['easy-1', 'medium-1', 'hard-1']);
  assert.deepEqual(list.map((p) => p.size), [4, 5, 6]);
  for (const p of list) {
    assert.equal(p.solution.length, p.size * p.size);
    assert.ok(p.cages.every((c) => typeof c.t === 'number' && typeof c.o === 'string' && Array.isArray(c.c)));
  }
});

test('buildPuzzleList is repeatable and defaults to 17/17/16', () => {
  const a = M.buildPuzzleList({ easy: 2, medium: 0, hard: 0 });
  assert.deepEqual(a, M.buildPuzzleList({ easy: 2, medium: 0, hard: 0 }));
  assert.deepEqual(M.DEFAULT_COUNTS, { easy: 17, medium: 17, hard: 16 });
  assert.equal(M.buildPuzzleList({}).length, 0);
});

test('toSource wraps the list so it loads as a plain script or via require', () => {
  const src = M.toSource([{ id: 'easy-1' }]);
  assert.match(src, /root\.CalcudokuPuzzles/);
  assert.match(src, /"easy-1"/);
});
