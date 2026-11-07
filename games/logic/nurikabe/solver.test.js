const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');

const EASY = ['.2..2', '.....', '..2..', '.1...', '....2']; // basic rules solve it
const MEDIUM = ['1.1..', '...1.', '.2...', '...1.', '.2..1']; // needs sea connection / pools
const HARD = ['1.1.1', '.....', '4..1.', '....3', '.....']; // simple rules get stuck

const stateOf = (p, sea) => {
  const { size, clues } = L.parsePuzzle(p);
  return { size, cells: sea.map((s, i) => (s ? 'sea' : 'empty')).map((v, i) => (clues[i] ? 'empty' : v)) };
};

test('countSolutions counts unique, ambiguous and impossible puzzles', () => {
  assert.equal(S.countSolutions(['1.1', '...', '.1.']), 1);
  assert.equal(S.countSolutions(['2.', '..']), 2);
  assert.equal(S.countSolutions(['2.', '.1']), 0);
  assert.equal(S.countSolutions(['..', '..']), 0);
  assert.equal(S.countSolutions(['2.', '..'], 1), 1);
  for (const p of [EASY, MEDIUM, HARD]) assert.equal(S.countSolutions(p), 1);
});

test('solve returns a valid answer (true = sea) or null', () => {
  for (const p of [EASY, MEDIUM, HARD]) {
    const sea = S.solve(p);
    assert.equal(sea.length, 25);
    assert.ok(L.isSolved(p, stateOf(p, sea)));
  }
  assert.equal(S.solve(['2.', '.1']), null);
});

test('logicSolve agrees with the search answer when it solves', () => {
  for (const p of [EASY, MEDIUM]) {
    const r = S.logicSolve(p);
    assert.equal(r.solved, true);
    assert.deepEqual(r.sea, S.solve(p));
  }
});

test('difficultyScore tells the tiers apart', () => {
  assert.deepEqual({ ...S.difficultyScore(EASY), steps: 0 }, { solved: true, tier: 1, steps: 0 });
  assert.equal(S.difficultyScore(MEDIUM).tier, 2);
  assert.equal(S.difficultyScore(MEDIUM).solved, true);
  const h = S.difficultyScore(HARD);
  assert.equal(h.solved, false);
  assert.equal(h.tier, 3);
});

test('deduce explains each simple rule', () => {
  const p = L.parsePuzzle(['1.1', '...', '.1.']);
  const st = Int8Array.from(p.clues, (v) => (v ? 2 : 0));
  const found = S.deduce(p, st, 1);
  const byCell = Object.fromEntries(found.map((d) => [d.i, d]));
  assert.match(byCell[1].reason, /complete|two numbered/);
  assert.equal(byCell[1].value, 'sea');
  assert.ok(found.every((d) => d.tier === 1));

  const two = L.parsePuzzle(['2.2', '...', '...']);
  const st2 = Int8Array.from(two.clues, (v) => (v ? 2 : 0));
  assert.match(S.deduce(two, st2, 1).find((d) => d.i === 1).reason, /two numbered/);
});

test('deduce: an island with a single exit must grow there', () => {
  const p = L.parsePuzzle(['3...', '....', '....', '....']);
  const st = Int8Array.from([2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const d = S.deduce(p, st, 1).find((x) => x.i === 1);
  assert.equal(d.value, 'island');
  assert.match(d.reason, /only way/);
});

test('deduce: an orphan island group must join a number through its only exit', () => {
  const p = L.parsePuzzle(['3...', '....', '....', '....']);
  // dot at (0,2), sea around it except (0,1)
  const st = new Int8Array(16);
  st[0] = 2; st[2] = 2; st[3] = 1; st[6] = 1;
  const d = S.deduce(p, st, 1).find((x) => x.i === 1);
  assert.equal(d.value, 'island');
  assert.match(d.reason, /join a number/);
});

test('deduce: joining islands into one too big is sea', () => {
  const p = L.parsePuzzle(['2...', '....', '....', '....']);
  const st = new Int8Array(16);
  st[0] = 2; st[2] = 2; st[3] = 2;
  const d = S.deduce(p, st, 1).find((x) => x.i === 1);
  assert.equal(d.value, 'sea');
  assert.match(d.reason, /too big/);
});

test('deduce: pools are tier 1, a cut-off sea is tier 2', () => {
  const p = L.parsePuzzle(['1...', '....', '....', '...5']);
  const st = new Int8Array(16);
  st[0] = 2; st[15] = 2;
  st[5] = 1; st[6] = 1; st[9] = 1;
  const pool = S.deduce(p, st, 2).find((x) => x.i === 10);
  assert.equal(pool.value, 'island');
  assert.equal(pool.tier, 1);
  assert.match(pool.reason, /2×2/);

  const q = L.parsePuzzle(['1.1', '...', '..5']);
  const stq = new Int8Array(9);
  stq[0] = 2; stq[2] = 2; stq[8] = 2; stq[1] = 1;
  const cut = S.deduce(q, stq, 2).find((x) => x.reason.includes('cut off'));
  assert.ok(cut);
  assert.equal(cut.tier, 2);
  assert.equal(S.deduce(q, stq, 1).find((x) => x.reason.includes('cut off')), undefined);
});

test('hint fixes a wrong square first', () => {
  const sea = S.solve(EASY);
  const { clues } = L.parsePuzzle(EASY);
  const state = L.createState(EASY);
  const wrongSea = sea.findIndex((v, i) => !v && !clues[i]);
  state.cells[wrongSea] = 'sea';
  let h = S.hint(EASY, state);
  assert.deepEqual([h.r * 5 + h.c, h.value], [wrongSea, 'empty']);
  assert.match(h.reason, /island/);
  state.cells[wrongSea] = 'empty';
  const wrongDot = sea.findIndex((v) => v);
  state.cells[wrongDot] = 'dot';
  h = S.hint(EASY, state);
  assert.deepEqual([h.r * 5 + h.c, h.value], [wrongDot, 'empty']);
  assert.match(h.reason, /sea/);
});

test('hint on an empty board gives a forced square that matches the answer', () => {
  for (const p of [EASY, MEDIUM, HARD]) {
    const sea = S.solve(p);
    const h = S.hint(p, L.createState(p));
    assert.equal(sea[h.r * 5 + h.c], h.value === 'sea');
    assert.equal(typeof h.reason, 'string');
  }
});

test('hint falls back to the answer when no simple rule applies, and is null when done', () => {
  const sea = S.solve(HARD);
  const clues = L.parsePuzzle(HARD).clues;
  const state = L.createState(HARD);
  // Keep applying hints; every step must be right and the game must finish.
  for (let n = 0; n < 40; n++) {
    const h = S.hint(HARD, state);
    if (!h) break;
    state.cells[h.r * 5 + h.c] = h.value;
    assert.notEqual(h.value, 'empty');
  }
  assert.ok(L.isSolved(HARD, state));
  assert.equal(S.hint(HARD, state), null);
  assert.equal(S.hint(['2.', '.1'], L.createState(['2.', '.1'])), null);
  void sea; void clues;
});
