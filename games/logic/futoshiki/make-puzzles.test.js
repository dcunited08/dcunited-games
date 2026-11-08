const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./make-puzzles.js');

test('buildPuzzleList makes numbered puzzles per level with compact string fields', () => {
  const list = M.buildPuzzleList({ easy: 1, medium: 1, hard: 0 });
  assert.deepEqual(list.map((p) => p.id), ['easy-1', 'medium-1']);
  assert.deepEqual(list.map((p) => p.size), [5, 6]);
  for (const p of list) {
    for (const k of ['givens', 'h', 'v', 'solution']) assert.equal(typeof p[k], 'string');
    assert.equal(p.solution.length, p.size * p.size);
  }
});

test('buildPuzzleList is repeatable', () => {
  const a = M.buildPuzzleList({ easy: 2, medium: 0, hard: 0 });
  assert.deepEqual(a, M.buildPuzzleList({ easy: 2, medium: 0, hard: 0 }));
});

test('toSource wraps the list so it loads as a plain script or via require', () => {
  const src = M.toSource([{ id: 'easy-1' }]);
  assert.match(src, /root\.FutoshikiPuzzles/);
  assert.match(src, /module\.exports/);
  assert.match(src, /"easy-1"/);
});
