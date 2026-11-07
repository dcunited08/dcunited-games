const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');

const SOLUTION = ['001011', '001101', '110010', '010011', '101100', '110100'];
const withClues = (clues) => {
  const rows = SOLUTION.map((row) => [...row]);
  const keep = new Set(clues.map(([r, c]) => `${r},${c}`));
  return rows.map((row, r) => row.map((ch, c) => (keep.has(`${r},${c}`) ? ch : '.')).join(''));
};
const EMPTY6 = Array(6).fill('......');

test('solve returns the grid for a uniquely solvable puzzle and null for a broken one', () => {
  const all = SOLUTION.map((row) => row.replace(/./g, (ch) => ch));
  assert.deepEqual(S.solve(all), SOLUTION.map((row) => [...row].map(Number)));
  assert.equal(S.solve(['000...', '......', '......', '......', '......', '......']), null);
});

test('countSolutions counts up to the limit', () => {
  assert.equal(S.countSolutions(SOLUTION), 1);
  assert.equal(S.countSolutions(EMPTY6, 2), 2);
  assert.equal(S.countSolutions(EMPTY6, 5), 5);
  assert.equal(S.countSolutions(['00.000', ...EMPTY6.slice(1)]), 0);
  assert.equal(S.countSolutions(['0011..', ...EMPTY6.slice(1)], 1), 1);
});

test('unique rows rule is enforced by the solver', () => {
  // 72 of the 4x4 grids pass every rule (checked by brute force)
  assert.equal(S.countSolutions(Array(4).fill('....'), 1000), 72);
  // 0011 / 0011 would be fine without the unique rule, so only the other shape remains
  assert.equal(S.countSolutions(['0011', '0011', '....', '....'], 10), 0);
});

test('nextDeduction: pair rule', () => {
  const g = S.gridOf(['00....', ...EMPTY6.slice(1)]);
  const d = S.nextDeduction(6, g);
  assert.deepEqual([d.r, d.c, d.value, d.rule], [0, 2, 1, 'pair']);
  assert.match(d.reason, /Two suns side by side, so the next one is a moon/);
  const g2 = S.gridOf(['..11..', ...EMPTY6.slice(1)]);
  const d2 = S.nextDeduction(6, g2);
  assert.equal(d2.rule, 'pair');
  assert.match(d2.reason, /Two moons side by side, so the next one is a sun/);
});

test('nextDeduction: pair works in columns', () => {
  const g = S.gridOf(['1.....', '1.....', '......', '......', '......', '......']);
  const d = S.nextDeduction(6, g);
  assert.deepEqual([d.r, d.c, d.value], [2, 0, 0]);
});

test('nextDeduction: sandwich rule', () => {
  const g = S.gridOf(['0.0...', ...EMPTY6.slice(1)]);
  const d = S.nextDeduction(6, g);
  assert.deepEqual([d.r, d.c, d.value, d.rule], [0, 1, 1, 'gap']);
  assert.match(d.reason, /between two suns must be a moon/);
  const d2 = S.nextDeduction(6, S.gridOf(['1.1...', ...EMPTY6.slice(1)]));
  assert.match(d2.reason, /between two moons must be a sun/);
});

test('nextDeduction: count rule for rows and columns', () => {
  const row = S.nextDeduction(6, S.gridOf(['01010.', ...EMPTY6.slice(1)]));
  assert.equal(row.rule, 'count');
  assert.match(row.reason, /This row already has all its suns, so the rest are moons/);
  const colRows = ['1.....', '0.....', '1.....', '0.....', '1.....', '......'];
  const col = S.nextDeduction(6, S.gridOf(colRows));
  assert.equal(col.rule, 'count');
  assert.match(col.reason, /This column already has all its moons, so the rest are suns/);
  assert.equal(S.nextDeduction(6, S.gridOf(EMPTY6)), null);
});

test('simpleSolve reports whether the simple rules solve a puzzle', () => {
  const rows = SOLUTION.map((row) => row.split(''));
  [[0, 2], [1, 3], [2, 1], [3, 4]].forEach(([r, c]) => { rows[r][c] = '.'; });
  const easy = S.simpleSolve(rows.map((row) => row.join('')));
  assert.equal(easy.solved, true);
  assert.ok(easy.steps > 0);
  const hopeless = S.simpleSolve(EMPTY6);
  assert.equal(hopeless.solved, false);
  assert.equal(hopeless.steps, 0);
  assert.deepEqual(S.difficultyScore(EMPTY6), { solved: false, steps: 0 });
});

test('every simple deduction agrees with the real solution', () => {
  const sol = S.solve(SOLUTION);
  for (const clues of [[[0, 0], [1, 2], [3, 3], [4, 4]], [[0, 2], [2, 0], [5, 5], [3, 1], [1, 4]]]) {
    let g = S.gridOf(withClues(clues));
    if (S.solve(withClues(clues)) === null) continue;
    for (let d = S.nextDeduction(6, g); d; d = S.nextDeduction(6, g)) {
      assert.equal(d.value, S.solve(withClues(clues))[d.r][d.c]);
      g = g.slice(); g[d.r * 6 + d.c] = d.value;
    }
  }
  assert.ok(sol);
});

test('hint: fixes a wrong square first', () => {
  const puzzle = withClues([[0, 0], [1, 2], [3, 3], [4, 4], [5, 0], [2, 5]]);
  const sol = S.solve(puzzle);
  let st = L.createState(puzzle);
  const wrongVal = sol[0][1] === 0 ? 'moon' : 'sun';
  st = L.setCell(st, 0, 1, wrongVal);
  const h = S.hint(puzzle, st);
  assert.deepEqual([h.r, h.c, h.value], [0, 1, 'empty']);
  assert.match(h.reason, /wrong/);
});

test('hint: logical deduction, then solution fallback, then null', () => {
  const puzzle = ['00....', ...EMPTY6.slice(1)];
  const h = S.hint(withClues([[0, 0], [0, 1], [3, 3], [4, 4], [5, 0], [2, 5], [1, 2]]), L.createState(withClues([[0, 0], [0, 1], [3, 3], [4, 4], [5, 0], [2, 5], [1, 2]])));
  assert.ok(h && h.reason && ['sun', 'moon'].includes(h.value));
  assert.ok(puzzle.length === 6);
  // a puzzle needing a guess falls back to the solution
  const hard = withClues([[0, 0]]);
  const hh = S.hint(hard, L.createState(hard));
  assert.match(hh.reason, /^Only a (sun|moon) fits here/);
  const sol = S.solve(hard);
  assert.equal(hh.value, sol[hh.r][hh.c] === 0 ? 'sun' : 'moon');
  // finished board has no hint
  const done = L.createState(SOLUTION);
  assert.equal(S.hint(SOLUTION, done), null);
  // a puzzle without any answer has no hint
  assert.equal(S.hint(['000...', ...EMPTY6.slice(1)], L.createState(['000...', ...EMPTY6.slice(1)])), null);
});
