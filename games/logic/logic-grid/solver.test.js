const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./solver.js');

// Ana cat/house 3, Ben rabbit/house 1, Cal dog/house 2 (see logic.test.js).
const base = {
  cats: [
    { name: 'People', kind: 'people', items: [{ w: 'Ana' }, { w: 'Ben' }, { w: 'Cal' }] },
    { name: 'Pets', kind: 'pets', items: [{ w: 'dog', e: '🐶' }, { w: 'cat', e: '🐱' }, { w: 'rabbit', e: '🐰' }] },
    { name: 'House', kind: 'house', ordered: true, items: [{ w: '1' }, { w: '2' }, { w: '3' }] },
  ],
  solution: [[0, 1, 2], [1, 2, 0], [2, 0, 1]],
};
const withClues = (clues) => ({ ...base, clues });
const unique = [
  { t: 'is', a: [0, 0], b: [1, 1] },
  { t: 'is', a: [0, 1], b: [2, 0] },
  { t: 'not', a: [0, 1], b: [1, 0] },
  { t: 'left', a: [1, 0], b: [0, 0] },
];

test('holds evaluates each clue type against the solution', () => {
  const h = (clue) => S.holds(base, clue);
  assert.equal(h({ t: 'is', a: [0, 0], b: [1, 1] }), true);
  assert.equal(h({ t: 'is', a: [0, 0], b: [1, 0] }), false);
  assert.equal(h({ t: 'not', a: [0, 0], b: [1, 0] }), true);
  assert.equal(h({ t: 'not', a: [0, 0], b: [1, 1] }), false);
  assert.equal(h({ t: 'or', a: [0, 0], b: [1, 0], c: [1, 1] }), true);
  assert.equal(h({ t: 'or', a: [0, 0], b: [1, 0], c: [1, 2] }), false);
  assert.equal(h({ t: 'next', a: [1, 0], b: [1, 1] }), true);      // Cal 2, Ana 3
  assert.equal(h({ t: 'next', a: [1, 1], b: [1, 2] }), false);     // Ana 3, Ben 1
  assert.equal(h({ t: 'left', a: [1, 0], b: [1, 1] }), true);
  assert.equal(h({ t: 'left', a: [1, 1], b: [1, 0] }), false);
  assert.equal(h({ t: 'before', a: [1, 2], b: [1, 1] }), true);    // Ben 1 < Ana 3
  assert.equal(h({ t: 'before', a: [1, 1], b: [1, 2] }), false);
});

test('four clues leave exactly one solution and solve returns it', () => {
  const p = withClues(unique);
  assert.equal(S.countSolutions(p), 1);
  assert.deepEqual(S.solve(p), base.solution);
});

test('removing a clue leaves more than one solution; the limit caps the count', () => {
  const p = withClues(unique.slice(0, 3));
  assert.equal(S.countSolutions(p), 2);
  assert.equal(S.countSolutions(p, 10), 2);
  assert.equal(S.countSolutions(withClues([]), 5), 5);
  assert.equal(S.countSolutions(withClues([]), 100), 36);
});

test('contradicting clues have no solution', () => {
  const p = withClues([...unique, { t: 'is', a: [0, 0], b: [1, 0] }]);
  assert.equal(S.countSolutions(p), 0);
  assert.equal(S.solve(p), null);
});

test('or, next and before clues prune too', () => {
  const clues = [
    { t: 'or', a: [0, 0], b: [1, 1], c: [1, 0] },   // Ana is cat or dog
    { t: 'is', a: [0, 2], b: [1, 0] },              // Cal dog
    { t: 'next', a: [0, 0], b: [0, 2] },            // Ana next to Cal
    { t: 'before', a: [0, 1], b: [0, 2] },          // Ben left of Cal
    { t: 'is', a: [0, 1], b: [1, 2] },              // Ben rabbit
    { t: 'left', a: [0, 2], b: [0, 0] },            // Cal directly left of Ana
  ];
  const p = withClues(clues);
  assert.equal(S.countSolutions(p, 10), 1);
  const sol = S.solve(p);
  assert.deepEqual(sol[1], [1, 2, 0]);
  assert.ok(S.holds({ ...p, solution: sol }, clues[3]));
});

test('clues about one category only are checked at the start', () => {
  const p = withClues([{ t: 'next', a: [0, 0], b: [0, 1] }]);
  assert.equal(S.countSolutions(p, 1000), 24);
});

test('a clue naming an unassigned item can never hold when it contradicts itself', () => {
  const p = withClues([{ t: 'is', a: [0, 0], b: [0, 1] }]);
  assert.equal(S.countSolutions(p), 0);
});
