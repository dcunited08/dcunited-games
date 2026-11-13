const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

// People Ana/Ben/Cal; Pets cat/rabbit/dog; House 1..3.
// Pets: Ana cat, Ben rabbit, Cal dog.  House: Ben 1, Cal 2, Ana 3.
const puzzle = {
  cats: [
    { name: 'People', kind: 'people', items: [{ w: 'Ana', e: '' }, { w: 'Ben', e: '' }, { w: 'Cal', e: '' }] },
    { name: 'Pets', kind: 'pets', items: [{ w: 'dog', e: '🐶' }, { w: 'cat', e: '🐱' }, { w: 'rabbit', e: '🐰' }] },
    { name: 'House', kind: 'house', ordered: true, items: [{ w: '1', e: '' }, { w: '2', e: '' }, { w: '3', e: '' }] },
  ],
  solution: [[0, 1, 2], [1, 2, 0], [2, 0, 1]],
  clues: [],
};
const big = (n, k) => ({
  cats: Array.from({ length: n }, (_, c) => ({ name: `C${c}`, kind: 'pets', items: Array.from({ length: k }, (_, i) => ({ w: `w${i}`, e: '' })) })),
  solution: Array.from({ length: n }, () => Array.from({ length: k }, (_, i) => i)),
  clues: [],
});

test('personOf finds who holds an item', () => {
  assert.equal(L.personOf(puzzle, 1, 1), 0);
  assert.equal(L.personOf(puzzle, 1, 0), 2);
  assert.equal(L.personOf(puzzle, 2, 0), 1);
  assert.equal(L.personOf(puzzle, 0, 2), 2);
});

test('layout of a 3-category puzzle has 3 blocks', () => {
  const lay = L.layout(big(3, 4));
  assert.deepEqual(lay.rowCats, [0, 2]);
  assert.deepEqual(lay.colCats, [1, 2]);
  assert.equal(lay.blocks.length, 3);
  assert.equal(lay.size.rows, 8);
  assert.equal(lay.size.cols, 8);
  assert.deepEqual(lay.blocks.map((b) => [b.rc, b.cc]), [[0, 1], [0, 2], [2, 1]]);
});

test('layout of 4 categories x 5 items is a 15x15 staircase of 6 blocks', () => {
  const lay = L.layout(big(4, 5));
  assert.deepEqual(lay.rowCats, [0, 3, 2]);
  assert.deepEqual(lay.colCats, [1, 2, 3]);
  assert.equal(lay.blocks.length, 6);
  assert.deepEqual(lay.size, { rows: 15, cols: 15 });
  assert.deepEqual(lay.blocks.map((b) => [b.ri, b.ci]), [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [2, 0]]);
  const pairs = lay.blocks.map((b) => [Math.min(b.rc, b.cc), Math.max(b.rc, b.cc)].join('-')).sort();
  assert.deepEqual(pairs, ['0-1', '0-2', '0-3', '1-2', '1-3', '2-3']);
});

test('hasBlock tells whether a staircase position exists', () => {
  const lay = L.layout(big(4, 4));
  assert.ok(L.hasBlock(lay, 0, 2));
  assert.ok(!L.hasBlock(lay, 1, 2));
  assert.ok(!L.hasBlock(lay, 3, 0));
  assert.ok(!L.hasBlock(lay, -1, 0));
});

test('cellTruth is true where both items belong to the same person', () => {
  const lay = L.layout(puzzle);
  const b = lay.blocks.findIndex((x) => x.rc === 0 && x.cc === 1);
  // rows are people, columns are pets: Ana(0)-cat(1) yes, Ana-dog no
  assert.equal(L.cellTruth(puzzle, lay.blocks[b], 0, 1), true);
  assert.equal(L.cellTruth(puzzle, lay.blocks[b], 0, 0), false);
  assert.equal(L.cellTruth(puzzle, lay.blocks[b], 2, 0), true);
});

test('createState makes an empty mark list per block', () => {
  const s = L.createState(puzzle);
  assert.equal(s.k, 3);
  assert.equal(s.cells.length, 3);
  assert.ok(s.cells.every((c) => c.length === 9 && c.every((v) => v === '')));
});

test('cycleCell goes empty, x, o, empty and does not change the input', () => {
  const s0 = L.createState(puzzle);
  const s1 = L.cycleCell(s0, 0, 1, 1);
  assert.equal(s1.cells[0][4], 'x');
  assert.equal(s0.cells[0][4], '');
  const s2 = L.cycleCell(s1, 0, 1, 1);
  assert.equal(s2.cells[0][4], 'o');
  const s3 = L.cycleCell(s2, 0, 1, 1);
  assert.equal(s3.cells[0][4], '');
});

test('placing o fills x in the empty cells of its row and column in that block only', () => {
  let s = L.createState(puzzle);
  s = L.cycleCell(s, 0, 0, 0);          // x
  s = L.cycleCell(L.setCell(s, 0, 2, 1, 'o'), 0, 1, 1); // row 1 col 1 -> x (unrelated)
  const before = s.cells[0].slice();
  s = L.cycleCell(s, 0, 1, 1);          // x -> o
  const c = s.cells[0];
  assert.equal(c[1 * 3 + 1], 'o');
  assert.equal(c[1 * 3 + 0], 'x');
  assert.equal(c[1 * 3 + 2], 'x');
  assert.equal(c[0 * 3 + 1], 'x');
  assert.equal(c[2 * 3 + 1], 'o');      // existing o is kept
  assert.equal(c[0], before[0]);        // the earlier x stays an x
  assert.ok(s.cells[1].every((v) => v === ''), 'other blocks untouched');
});

test('isSolved needs exactly the right o marks, x marks do not matter', () => {
  let s = L.createState(puzzle);
  assert.equal(L.isSolved(puzzle, s), false);
  const lay = L.layout(puzzle);
  lay.blocks.forEach((blk, b) => {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      s = L.setCell(s, b, r, c, L.cellTruth(puzzle, blk, r, c) ? 'o' : 'x');
    }
  });
  assert.equal(L.isSolved(puzzle, s), true);
  const wrong = L.setCell(s, 0, 0, 0, 'o');
  assert.equal(L.isSolved(puzzle, wrong), false);
  const blank = L.setCell(s, 0, 0, 1, '');
  assert.equal(L.isSolved(puzzle, blank), false);
});

test('mistakes lists wrong o marks and x marks on true cells', () => {
  let s = L.createState(puzzle);
  s = L.setCell(s, 0, 0, 0, 'o'); // wrong: Ana-dog
  s = L.setCell(s, 0, 0, 1, 'x'); // wrong: Ana-cat is true
  s = L.setCell(s, 0, 1, 0, 'x'); // right
  s = L.setCell(s, 0, 1, 2, 'o'); // right: Ben-rabbit
  assert.deepEqual(L.mistakes(puzzle, s), [{ b: 0, r: 0, c: 0 }, { b: 0, r: 0, c: 1 }]);
});

test('headerLabel gives emoji and word, the name for people, and the number for houses', () => {
  assert.deepEqual(L.headerLabel(puzzle, 0, 1), { e: '', w: 'Ben' });
  assert.deepEqual(L.headerLabel(puzzle, 1, 0), { e: '🐶', w: 'dog' });
  assert.deepEqual(L.headerLabel(puzzle, 2, 2), { e: '', w: '3' });
});

test('themes: five distinct items each with an emoji and a template', () => {
  const kinds = Object.keys(L.THEMES);
  assert.ok(kinds.length >= 8);
  const seen = new Set();
  for (const kind of kinds) {
    const t = L.THEMES[kind];
    assert.equal(t.items.length, 5, kind);
    assert.match(t.tpl, /\{e\}.*\{w\}/, kind);
    for (const it of t.items) {
      assert.ok(it.e && it.w, kind);
      assert.ok(!seen.has(it.e), `emoji ${it.e} reused`);
      seen.add(it.e);
    }
  }
  assert.ok(L.NAMES.length >= 16 && L.NAMES.every((n) => n.length >= 3 && n.length <= 4));
  assert.equal(new Set(L.NAMES).size, L.NAMES.length);
});

const text = (clue) => L.clueText(puzzle, clue);
const P = (i) => [0, i];

test('clue text: is', () => {
  assert.equal(text({ t: 'is', a: P(0), b: [1, 1] }), 'Ana is the 🐱 cat owner.');
  assert.equal(text({ t: 'is', a: [1, 0], b: P(2) }), 'Cal is the 🐶 dog owner.');
  assert.equal(text({ t: 'is', a: P(1), b: [2, 0] }), 'Ben lives in house 1.');
  assert.equal(text({ t: 'is', a: [1, 2], b: [2, 0] }), 'The 🐰 rabbit owner lives in house 1.');
  assert.equal(text({ t: 'is', a: [2, 1], b: [1, 0] }), 'The 🐶 dog owner lives in house 2.');
});

test('clue text: not', () => {
  assert.equal(text({ t: 'not', a: P(0), b: [1, 0] }), 'Ana is not the 🐶 dog owner.');
  assert.equal(text({ t: 'not', a: P(0), b: [2, 1] }), 'Ana does not live in house 2.');
  assert.equal(text({ t: 'not', a: [1, 0], b: [2, 2] }), 'The 🐶 dog owner does not live in house 3.');
  assert.equal(text({ t: 'not', a: [1, 0], b: [1, 1] }), 'The 🐶 dog owner is not the 🐱 cat owner.');
});

test('clue text: or', () => {
  assert.equal(text({ t: 'or', a: P(1), b: [1, 1], c: [1, 2] }), 'Ben is either the 🐱 cat owner or the 🐰 rabbit owner.');
  assert.equal(text({ t: 'or', a: P(1), b: [2, 0], c: [2, 2] }), 'Ben lives in either house 1 or house 3.');
  assert.equal(text({ t: 'or', a: [1, 0], b: [2, 0], c: [2, 1] }), 'The 🐶 dog owner lives in either house 1 or house 2.');
  assert.equal(text({ t: 'or', a: [2, 1], b: [1, 0], c: P(0) }), 'The person in house 2 is either the 🐶 dog owner or Ana.');
});

test('clue text: next, left, before', () => {
  assert.equal(text({ t: 'next', a: [1, 0], b: [1, 1] }), 'The 🐶 dog owner lives next to the 🐱 cat owner.');
  assert.equal(text({ t: 'left', a: P(1), b: [1, 2] }), 'Ben lives directly left of the 🐰 rabbit owner.');
  assert.equal(text({ t: 'before', a: [1, 1], b: P(2) }), 'The 🐱 cat owner lives somewhere left of Cal.');
});

test('every clue sentence starts with a capital and ends with a period', () => {
  for (const clue of [
    { t: 'is', a: [1, 0], b: [1, 1] }, { t: 'next', a: [1, 2], b: P(0) }, { t: 'before', a: P(1), b: P(2) },
  ]) assert.match(text(clue), /^[A-Z].*\.$/);
});

test('phrase uses the category template', () => {
  const p = { cats: [puzzle.cats[0], { name: 'Drinks', kind: 'drinks', items: [{ w: 'tea', e: '🍵' }] }], solution: [[0], [0]], clues: [] };
  assert.equal(L.phrase(p, [1, 0]), 'the 🍵 tea drinker');
});
