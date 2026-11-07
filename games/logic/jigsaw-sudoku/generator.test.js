const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./generator.js');
const S = require('./solver.js');

function connected(cells) {
  const set = new Set(cells), seen = new Set([cells[0]]), stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop();
    for (const j of G.neighbours(i)) if (set.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
  }
  return seen.size === set.size;
}

function checkRegions(regions) {
  assert.equal(regions.length, 81);
  for (let k = 0; k < 9; k++) {
    const cells = [];
    regions.forEach((r, i) => { if (r === k) cells.push(i); });
    assert.equal(cells.length, 9, 'region ' + k + ' size');
    assert.ok(connected(cells), 'region ' + k + ' connected');
  }
}

const isBox = (regions, k) => {
  const cells = [];
  regions.forEach((r, i) => { if (r === k) cells.push(i); });
  const rows = cells.map((i) => Math.floor(i / 9)), cols = cells.map((i) => i % 9);
  return Math.max(...rows) - Math.min(...rows) === 2 && Math.max(...cols) - Math.min(...cols) === 2;
};

test('mulberry32 is repeatable and in [0, 1)', () => {
  const a = G.mulberry32(7), b = G.mulberry32(7);
  for (let i = 0; i < 20; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(G.mulberry32(8)(), G.mulberry32(7)());
});

test('neighbours handles corners and edges', () => {
  assert.deepEqual(G.neighbours(0).sort((a, b) => a - b), [1, 9]);
  assert.deepEqual(G.neighbours(80).sort((a, b) => a - b), [71, 79]);
  assert.equal(G.neighbours(40).length, 4);
});

test('makeRegions gives nine connected shapes of nine cells that are clearly wiggly', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const regions = G.makeRegions(G.mulberry32(seed));
    checkRegions(regions);
    const boxes = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((k) => isBox(regions, k)).length;
    assert.ok(boxes <= 2, 'seed ' + seed + ' has ' + boxes + ' box-like shapes');
  }
});

test('makeRegions is repeatable', () => {
  assert.deepEqual(G.makeRegions(G.mulberry32(3)), G.makeRegions(G.mulberry32(3)));
  assert.notDeepEqual(G.makeRegions(G.mulberry32(3)), G.makeRegions(G.mulberry32(4)));
});

test('makeLayout returns a layout with a full solution, or null when the budget is too small', () => {
  let ok = null;
  for (let seed = 5; !ok; seed++) ok = G.makeLayout(G.mulberry32(seed), 200000);
  checkRegions(ok.regions);
  assert.equal(ok.solution.length, 81);
  assert.equal(S.countSolutions(ok.regions, ok.solution), 1);
  assert.equal(G.makeLayout(G.mulberry32(5), 1), null);
});

test('generatePuzzle: unique answer, consistent givens and shapes', () => {
  for (const level of ['easy', 'medium', 'hard']) {
    const p = G.generatePuzzle(42, level);
    assert.equal(p.difficulty, level);
    checkRegions(p.regions);
    assert.equal(p.givens.length, 81);
    p.givens.forEach((d, i) => assert.ok(d === 0 || d === p.solution[i]));
    assert.equal(S.countSolutions(p.regions, p.givens), 1);
    const n = p.givens.filter(Boolean).length;
    const target = G.TARGETS[level];
    assert.ok(n >= target && n <= target + 8, level + ' has ' + n + ' givens');
  }
});

test('generatePuzzle is repeatable and rejects an unknown level', () => {
  assert.deepEqual(G.generatePuzzle(9, 'easy'), G.generatePuzzle(9, 'easy'));
  assert.throws(() => G.generatePuzzle(1, 'nope'));
});
