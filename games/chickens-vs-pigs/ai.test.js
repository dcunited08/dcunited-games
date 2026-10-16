const test = require('node:test');
const assert = require('node:assert/strict');
const { CHICKEN, PIG, createState, stateFrom, legalMoves, applyMove, winner } = require('./logic.js');
const { DIFFICULTY, evaluate, chooseMove } = require('./ai.js');

const first = () => 0;
const last = () => 0.999;
const key = (m) => JSON.stringify([m.from, m.path]);

test('difficulty levels search deeper as they get harder', () => {
  assert.ok(DIFFICULTY.easy.depth < DIFFICULTY.medium.depth);
  assert.ok(DIFFICULTY.medium.depth < DIFFICULTY.hard.depth);
});

test('evaluate is zero at the start and favors the side with more material', () => {
  const s = createState();
  assert.equal(evaluate(s, CHICKEN), 0);
  const up = stateFrom([[5, 2, CHICKEN], [5, 4, CHICKEN], [2, 1, PIG]]);
  assert.ok(evaluate(up, CHICKEN) > 0);
  assert.ok(evaluate(up, PIG) < 0);
});

test('kings are worth more than men', () => {
  const king = stateFrom([[4, 3, CHICKEN, true], [2, 1, PIG]]);
  const man = stateFrom([[4, 3, CHICKEN], [2, 1, PIG]]);
  assert.ok(evaluate(king, CHICKEN) > evaluate(man, CHICKEN));
});

test('chooseMove always returns one of the legal moves', () => {
  let s = createState();
  for (let i = 0; i < 12 && !winner(s); i++) {
    const m = chooseMove(s, { depth: 2, random: first });
    assert.ok(legalMoves(s).some((x) => key(x) === key(m)));
    s = applyMove(s, m);
  }
});

test('chooseMove returns null when there is nothing to play', () => {
  assert.equal(chooseMove(stateFrom([[3, 4, CHICKEN]], PIG), { depth: 2 }), null);
});

test('takes the longer multi-jump when it can', () => {
  // Two captures available: a single jump, or a double jump.
  const s = stateFrom([[7, 0, CHICKEN], [6, 1, PIG], [4, 3, PIG], [5, 6, CHICKEN], [4, 7, PIG], [0, 1, PIG]]);
  const m = chooseMove(s, { depth: 1, random: first });
  assert.equal(m.captures.length, 2);
});

test('does not walk a piece into a capture', () => {
  // Moving 5,2 -> 4,3 lets the pig on 3,4 jump it; 5,2 -> 4,1 is safe.
  const s = stateFrom([[5, 2, CHICKEN], [3, 4, PIG], [0, 7, PIG]]);
  for (const random of [first, last]) {
    const m = chooseMove(s, { depth: 2, random });
    assert.deepEqual(m.path, [{ r: 4, c: 1 }]);
  }
});

test('finds the move that leaves the pigs with nothing to play', () => {
  // The last pig on 6,7 can only step to 7,6. Blocking that square wins at once.
  const s = stateFrom([[6, 7, PIG], [6, 5, CHICKEN, true]], CHICKEN);
  for (const random of [first, last]) {
    const m = chooseMove(s, { depth: 1, random });
    assert.deepEqual(m.path, [{ r: 7, c: 6 }]);
  }
});

test('a win scores higher the sooner it comes', () => {
  const s = stateFrom([[6, 7, PIG], [6, 5, CHICKEN, true]], CHICKEN);
  const m = chooseMove(s, { depth: 4, random: last });
  assert.deepEqual(m.path, [{ r: 7, c: 6 }]);
});

test('a drawn position scores as even', () => {
  const s = stateFrom([[0, 1, CHICKEN, true], [7, 6, PIG, true]], CHICKEN);
  s.quietMoves = 200;
  const m = chooseMove(s, { depth: 2, slack: 0, random: first });
  assert.ok(m);
});

test('plays as pigs too', () => {
  const s = stateFrom([[2, 1, PIG], [3, 2, CHICKEN], [7, 0, CHICKEN]], PIG);
  const m = chooseMove(s, { depth: 2, random: first });
  assert.deepEqual(m.captures, [{ r: 3, c: 2 }]);
});

test('slack lets easy mode pick among close moves using the random source', () => {
  const s = createState();
  const a = chooseMove(s, { depth: 1, slack: 1000, random: first });
  const b = chooseMove(s, { depth: 1, slack: 1000, random: last });
  assert.notEqual(key(a), key(b));
});

test('a hard search from the opening finishes and returns a legal move', () => {
  const s = createState();
  const m = chooseMove(s, { ...DIFFICULTY.hard, random: first });
  assert.ok(legalMoves(s).some((x) => key(x) === key(m)));
});

test('options default to medium difficulty with Math.random', () => {
  const m = chooseMove(createState());
  assert.ok(m);
});
