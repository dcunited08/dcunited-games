const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const AI = require('./ai.js');

const { YORK: Y, LANCASTER: B } = L; // B for the red (Lancaster) rose
const board = (s) => s.replace(/\s/g, '').split('').map((ch) => (ch === 'Y' ? Y : ch === 'L' ? B : null));
const fixed = (v) => () => v;
const empties = (b) => b.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);

test('exposes the three difficulty levels', () => {
  assert.deepEqual(AI.LEVELS, ['easy', 'medium', 'hard']);
});

test('returns null when there is no move to make', () => {
  const full = board('YLYYLLLYY');
  for (const level of AI.LEVELS) assert.equal(AI.chooseMove(full, Y, level, fixed(0)), null);
  const won = board('YYYLL.L..');
  assert.equal(AI.chooseMove(won, B, 'hard', fixed(0)), null);
});

test('unknown difficulty falls back to medium', () => {
  const b = board('YY. LL. ...');
  assert.equal(AI.chooseMove(b, Y, 'nonsense', fixed(0)), 2);
});

test('hard takes a win', () => {
  assert.equal(AI.chooseMove(board('YY. LL. ...'), Y, 'hard', fixed(0)), 2);
  assert.equal(AI.chooseMove(board('YY. LL. ...'), B, 'hard', fixed(0)), 5);
});

test('hard blocks a loss', () => {
  assert.equal(AI.chooseMove(board('YY. .L. ...'), B, 'hard', fixed(0)), 2);
});

test('hard prefers an immediate win over a later one', () => {
  // Lancaster wins at once on 5 even though Yorkist threat on 1 exists.
  assert.equal(AI.chooseMove(board('Y.Y LL. ...'), B, 'hard', fixed(0)), 5);
});

test('hard uses rng only to choose among equally good moves', () => {
  const b = Array(9).fill(null);
  const a = AI.chooseMove(b, Y, 'hard', fixed(0));
  const z = AI.chooseMove(b, Y, 'hard', fixed(0.999));
  assert.ok(b[a] === null && b[z] === null);
  // Every opening move draws with perfect play, so rng picks different cells.
  assert.notEqual(a, z);
});

// Every position reachable when `human` plays all possible moves and `side` answers with
// hard AI. Returns the outcomes seen.
function explore(side, state, rng, outcomes) {
  if (L.isOver(state)) {
    outcomes.add(state.winner || 'draw');
    return;
  }
  if (state.turn === side) {
    const move = AI.chooseMove(state.board, side, 'hard', rng);
    explore(side, L.play(state, move), rng, outcomes);
  } else {
    for (const m of L.legalMoves(state)) explore(side, L.play(state, m), rng, outcomes);
  }
}

for (const side of [Y, B]) {
  for (const first of [Y, B]) {
    for (const [name, rng] of [['low', fixed(0)], ['high', fixed(0.999)], ['mid', fixed(0.5)]]) {
      test(`hard as ${side}, ${first} moving first, never loses (rng ${name})`, () => {
        const outcomes = new Set();
        explore(side, L.createGame(first), rng, outcomes);
        assert.ok(!outcomes.has(L.opponent(side)), `hard lost; outcomes ${[...outcomes]}`);
        assert.ok(outcomes.size > 0);
      });
    }
  }
}

test('hard against hard always draws', () => {
  for (const first of [Y, B]) {
    for (const v of [0, 0.3, 0.7, 0.999]) {
      let g = L.createGame(first);
      while (!L.isOver(g)) g = L.play(g, AI.chooseMove(g.board, g.turn, 'hard', fixed(v)));
      assert.equal(g.draw, true);
    }
  }
});

test('medium wins if it can, ahead of blocking', () => {
  assert.equal(AI.chooseMove(board('YY. LL. ...'), B, 'medium', fixed(0)), 5);
  assert.equal(AI.chooseMove(board('YY. LL. ...'), Y, 'medium', fixed(0)), 2);
});

test('medium blocks an opponent win', () => {
  assert.equal(AI.chooseMove(board('YY. ... ..L'), B, 'medium', fixed(0)), 2);
  assert.equal(AI.chooseMove(board('Y.. Y.. .L.'), B, 'medium', fixed(0)), 6);
});

test('medium takes the centre, then a corner', () => {
  assert.equal(AI.chooseMove(Array(9).fill(null), Y, 'medium', fixed(0)), 4);
  assert.equal(AI.chooseMove(board('... .Y. ...'), B, 'medium', fixed(0)), 0);
  assert.equal(AI.chooseMove(board('... .Y. ...'), B, 'medium', fixed(0.999)), 8);
});

test('easy takes an immediate win when rng is under one half', () => {
  assert.equal(AI.chooseMove(board('YY. LL. ...'), Y, 'easy', fixed(0.1)), 2);
});

test('easy otherwise picks a random empty cell with rng', () => {
  const b = board('YY. LL. ...'); // empty: 2, 5, 6, 7, 8
  assert.equal(AI.chooseMove(b, Y, 'easy', fixed(0.5)), 6);
  assert.equal(AI.chooseMove(b, Y, 'easy', fixed(0.999)), 8);
  assert.equal(AI.chooseMove(Array(9).fill(null), Y, 'easy', fixed(0.5)), 4);
});

test('easy with no winning move falls through to random', () => {
  assert.equal(AI.chooseMove(board('... .Y. ...'), B, 'easy', fixed(0.1)), 0);
});

test('no level ever returns a taken cell or crashes, across random playouts', () => {
  let seed = 12345;
  const rng = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (const level of AI.LEVELS) {
    for (let n = 0; n < 40; n++) {
      let g = L.createGame(n % 2 ? Y : B);
      while (!L.isOver(g)) {
        const m = AI.chooseMove(g.board, g.turn, level, rng);
        assert.ok(empties(g.board).includes(m));
        g = L.play(g, m);
      }
    }
  }
});
