const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./make-puzzles.js');

test('buildPuzzleList makes numbered puzzles per level with compact fields', () => {
  const list = M.buildPuzzleList({ easy: 1, medium: 1, hard: 1 });
  assert.deepEqual(list.map((p) => p.id), ['easy-1', 'medium-1', 'hard-1']);
  assert.deepEqual(list.map((p) => p.difficulty), ['easy', 'medium', 'hard']);
  for (const p of list) {
    assert.equal(typeof p.solution, 'string');
    assert.equal(p.solution.length, 81);
    assert.ok(p.cages.every((c) => typeof c.s === 'number' && Array.isArray(c.c)));
    assert.equal(typeof p.givens, 'object');
  }
});

test('buildPuzzleList is repeatable', () => {
  const a = M.buildPuzzleList({ easy: 1, medium: 0, hard: 0 });
  assert.deepEqual(a, M.buildPuzzleList({ easy: 1, medium: 0, hard: 0 }));
});

test('toSource wraps the list so it loads as a plain script or via require', () => {
  const src = M.toSource([{ id: 'easy-1' }]);
  assert.match(src, /window\.KillerPuzzles|root\.KillerPuzzles/);
  assert.match(src, /"easy-1"/);
});
