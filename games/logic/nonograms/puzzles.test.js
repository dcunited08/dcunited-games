const test = require('node:test');
const assert = require('node:assert/strict');
const PUZZLES = require('./puzzles.js');
const S = require('./solver.js');

const byLevel = (level) => PUZZLES.filter((p) => p.level === level);

test('there are 50 puzzles split 17 / 17 / 16', () => {
  assert.equal(PUZZLES.length, 50);
  assert.equal(byLevel('easy').length, 17);
  assert.equal(byLevel('medium').length, 17);
  assert.equal(byLevel('hard').length, 16);
});

test('sizes match the level', () => {
  const size = { easy: 5, medium: 10, hard: 15 };
  for (const p of PUZZLES) {
    assert.equal(p.rows.length, size[p.level], p.id);
    for (const r of p.rows) assert.match(r, new RegExp(`^[#.]{${size[p.level]}}$`), p.id);
  }
});

test('ids are <level>-<n> in order and names are unique', () => {
  for (const level of ['easy', 'medium', 'hard']) {
    byLevel(level).forEach((p, i) => assert.equal(p.id, `${level}-${i + 1}`));
  }
  assert.equal(new Set(PUZZLES.map((p) => p.id)).size, 50);
  assert.equal(new Set(PUZZLES.map((p) => p.name.toLowerCase())).size, 50);
  for (const p of PUZZLES) assert.ok(p.name.length > 0);
});

test('empty rows and columns are rare', () => {
  let withEmpty = 0;
  for (const p of PUZZLES) {
    const { rows, cols } = S.picture(p.rows);
    const empty = [...rows, ...cols].filter((c) => c.length === 0).length;
    assert.ok(empty <= 4, `${p.id} has ${empty} empty lines`);
    if (empty) withEmpty++;
  }
  assert.ok(withEmpty <= 8, `${withEmpty} puzzles have empty lines`);
});

for (const p of PUZZLES) {
  test(`${p.id} (${p.name}) is solved uniquely by line logic`, () => {
    const { rows, cols } = S.picture(p.rows);
    const res = S.solvePuzzle(rows, cols);
    assert.equal(res.contradiction, false);
    assert.equal(res.solved, true);
    const picture = p.rows.map((r) => [...r].map((ch) => (ch === '#' ? 1 : 0)));
    assert.deepEqual(res.grid, picture);
  });
}
