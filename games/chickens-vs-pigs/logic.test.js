const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SIZE, CHICKEN, PIG, DRAW_AFTER_QUIET_MOVES,
  createState, stateFrom, opponent, isDark, legalMoves, applyMove, winner,
  movesFrom, findMove, countPieces, squareAt, moveCursor,
} = require('./logic.js');

const sq = (r, c) => ({ r, c });
const dests = (moves) => moves.map((m) => m.path[m.path.length - 1]).map(({ r, c }) => `${r},${c}`).sort();

test('createState puts 12 pigs on top, 12 chickens on the bottom, dark squares only', () => {
  const s = createState();
  assert.equal(s.turn, CHICKEN);
  assert.equal(s.quietMoves, 0);
  let chickens = 0, pigs = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = s.board[r][c];
      if (!p) continue;
      assert.ok(isDark(r, c), `piece at ${r},${c} is on a dark square`);
      assert.equal(p.king, false);
      if (p.side === PIG) { pigs++; assert.ok(r <= 2); }
      else { chickens++; assert.ok(r >= 5); }
    }
  }
  assert.deepEqual([chickens, pigs], [12, 12]);
  assert.deepEqual(countPieces(s), { chicken: 12, pig: 12 });
});

test('opponent swaps sides', () => {
  assert.equal(opponent(CHICKEN), PIG);
  assert.equal(opponent(PIG), CHICKEN);
});

test('chickens have 7 opening moves, all one step forward (up)', () => {
  const moves = legalMoves(createState());
  assert.equal(moves.length, 7);
  for (const m of moves) {
    assert.equal(m.path.length, 1);
    assert.equal(m.path[0].r, m.from.r - 1);
    assert.equal(m.captures.length, 0);
  }
});

test('men only move forward; pigs move down', () => {
  const s = stateFrom([[3, 4, CHICKEN], [4, 1, PIG]], CHICKEN);
  assert.deepEqual(dests(legalMoves(s)), ['2,3', '2,5']);
  s.turn = PIG;
  assert.deepEqual(dests(legalMoves(s)), ['5,0', '5,2']);
});

test('kings (Roosters and Boars) move both ways', () => {
  const s = stateFrom([[3, 4, CHICKEN, true], [0, 1, PIG]], CHICKEN);
  assert.deepEqual(dests(legalMoves(s)), ['2,3', '2,5', '4,3', '4,5']);
});

test('pieces cannot move off the board or onto occupied squares', () => {
  const s = stateFrom([[7, 0, CHICKEN], [6, 1, CHICKEN], [0, 7, PIG]], CHICKEN);
  assert.deepEqual(dests(legalMoves(s)), ['5,0', '5,2']);
});

test('a single jump captures the enemy piece', () => {
  const s = stateFrom([[5, 2, CHICKEN], [4, 3, PIG], [0, 1, PIG]], CHICKEN);
  const moves = legalMoves(s);
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0].path, [sq(3, 4)]);
  assert.deepEqual(moves[0].captures, [sq(4, 3)]);
  const next = applyMove(s, moves[0]);
  assert.equal(next.board[4][3], null);
  assert.equal(next.board[5][2], null);
  assert.deepEqual(next.board[3][4], { side: CHICKEN, king: false });
  assert.equal(next.turn, PIG);
  assert.equal(s.board[4][3].side, PIG, 'applyMove does not mutate the old state');
});

test('cannot jump your own piece or land on an occupied square', () => {
  const s = stateFrom([[5, 2, CHICKEN], [4, 3, CHICKEN], [4, 1, PIG], [3, 0, PIG]], CHICKEN);
  assert.ok(legalMoves(s).every((m) => m.captures.length === 0));
});

test('captures are mandatory: simple moves are not offered when a jump exists', () => {
  const s = stateFrom([[5, 2, CHICKEN], [5, 6, CHICKEN], [4, 3, PIG], [0, 1, PIG]], CHICKEN);
  const moves = legalMoves(s);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].captures.length, 1);
});

test('multi-jumps continue in one move', () => {
  const s = stateFrom([[7, 0, CHICKEN], [6, 1, PIG], [4, 3, PIG], [0, 7, PIG]], CHICKEN);
  const moves = legalMoves(s);
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0].path, [sq(5, 2), sq(3, 4)]);
  assert.deepEqual(moves[0].captures, [sq(6, 1), sq(4, 3)]);
  const next = applyMove(s, moves[0]);
  assert.deepEqual(countPieces(next), { chicken: 1, pig: 1 });
});

test('branching jump chains each become their own move', () => {
  const s = stateFrom([[7, 2, CHICKEN], [6, 3, PIG], [4, 3, PIG], [4, 5, PIG]], CHICKEN);
  const moves = legalMoves(s);
  assert.deepEqual(dests(moves), ['3,2', '3,6']);
  assert.ok(moves.every((m) => m.captures.length === 2));
});

test('a king can jump backwards and cannot capture the same piece twice', () => {
  // Four pigs in a diamond below the king: it loops round and lands back where it started.
  const s = stateFrom([[2, 3, CHICKEN, true], [3, 2, PIG], [3, 4, PIG], [5, 2, PIG], [5, 4, PIG]], CHICKEN);
  const moves = legalMoves(s);
  assert.equal(moves.length, 2);
  for (const m of moves) {
    assert.deepEqual(m.path[m.path.length - 1], sq(2, 3));
    const keys = m.captures.map(({ r, c }) => `${r},${c}`);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(m.captures.length, 4);
  }
});

test('a man reaching the far row is crowned', () => {
  const s = stateFrom([[1, 2, CHICKEN], [7, 0, PIG]], CHICKEN);
  const move = legalMoves(s).find((m) => m.path[0].c === 1);
  const next = applyMove(s, move);
  assert.deepEqual(next.board[0][1], { side: CHICKEN, king: true });
  assert.equal(move.crowned, true);
});

test('pigs are crowned on the bottom row', () => {
  const s = stateFrom([[6, 1, PIG], [0, 7, CHICKEN]], PIG);
  const next = applyMove(s, legalMoves(s)[0]);
  assert.equal(next.board[7][0]?.king || next.board[7][2]?.king, true);
});

test('crowning ends the turn even if another jump would be possible', () => {
  // Chicken jumps 1,2 and lands on 0,3; a king there could jump 1,4 next, but the turn ends.
  const s = stateFrom([[2, 1, CHICKEN], [1, 2, PIG], [1, 4, PIG]], CHICKEN);
  const moves = legalMoves(s);
  assert.equal(moves.length, 1);
  const m = moves[0];
  assert.deepEqual(m.path, [sq(0, 3)]);
  assert.equal(m.crowned, true);
});

test('a king does not get "crowned" again', () => {
  const s = stateFrom([[1, 2, CHICKEN, true], [7, 0, PIG]], CHICKEN);
  const m = legalMoves(s).find((x) => x.path[0].r === 0);
  assert.equal(m.crowned, false);
});

test('winner: a side with no pieces loses', () => {
  assert.equal(winner(stateFrom([[3, 4, CHICKEN]], PIG)), CHICKEN);
  assert.equal(winner(stateFrom([[3, 4, PIG]], CHICKEN)), PIG);
  assert.equal(winner(createState()), null);
});

test('winner: a side with no legal moves loses', () => {
  // The chicken on 7,0 is blocked by a pig it cannot jump (6,1 then 5,2 occupied).
  const s = stateFrom([[7, 0, CHICKEN], [6, 1, PIG], [5, 2, PIG]], CHICKEN);
  assert.equal(legalMoves(s).length, 0);
  assert.equal(winner(s), PIG);
});

test('draw after too many king moves without a capture or man move', () => {
  const s = stateFrom([[0, 1, CHICKEN, true], [7, 6, PIG, true]], CHICKEN);
  s.quietMoves = DRAW_AFTER_QUIET_MOVES - 1;
  assert.equal(winner(s), null);
  const next = applyMove(s, legalMoves(s)[0]);
  assert.equal(next.quietMoves, DRAW_AFTER_QUIET_MOVES);
  assert.equal(winner(next), 'draw');
});

test('man moves and captures reset the quiet move counter', () => {
  const s = stateFrom([[5, 2, CHICKEN], [0, 1, PIG, true]], CHICKEN);
  s.quietMoves = 10;
  assert.equal(applyMove(s, legalMoves(s)[0]).quietMoves, 0);
  const k = stateFrom([[5, 2, CHICKEN, true], [4, 3, PIG]], CHICKEN);
  k.quietMoves = 10;
  assert.equal(applyMove(k, legalMoves(k)[0]).quietMoves, 0);
});

test('movesFrom and findMove pick moves for the click-to-move UI', () => {
  const s = createState();
  const all = legalMoves(s);
  assert.deepEqual(dests(movesFrom(all, sq(5, 2))), ['4,1', '4,3']);
  assert.deepEqual(movesFrom(all, sq(4, 1)), []);
  assert.deepEqual(findMove(all, sq(5, 2), sq(4, 3)).path, [sq(4, 3)]);
  assert.equal(findMove(all, sq(5, 2), sq(3, 3)), null);
});

test('squareAt maps canvas pixels to board squares, optionally flipped', () => {
  assert.deepEqual(squareAt(5, 5, 400), sq(0, 0));
  assert.deepEqual(squareAt(399, 399, 400), sq(7, 7));
  assert.deepEqual(squareAt(60, 110, 400), sq(2, 1));
  assert.deepEqual(squareAt(5, 5, 400, true), sq(7, 7));
  assert.equal(squareAt(-1, 5, 400), null);
  assert.equal(squareAt(5, 400, 400), null);
});

test('moveCursor walks the keyboard cursor and stops at the edges', () => {
  assert.deepEqual(moveCursor(sq(0, 0), 'up'), sq(0, 0));
  assert.deepEqual(moveCursor(sq(0, 0), 'down'), sq(1, 0));
  assert.deepEqual(moveCursor(sq(0, 0), 'right'), sq(0, 1));
  assert.deepEqual(moveCursor(sq(7, 7), 'right'), sq(7, 7));
  assert.deepEqual(moveCursor(sq(3, 3), 'left'), sq(3, 2));
  assert.deepEqual(moveCursor(sq(3, 3), 'up'), sq(2, 3));
  assert.deepEqual(moveCursor(sq(3, 3), 'nope'), sq(3, 3));
  // On a flipped board, "up" on screen means down the rows.
  assert.deepEqual(moveCursor(sq(3, 3), 'up', true), sq(4, 3));
  assert.deepEqual(moveCursor(sq(3, 3), 'right', true), sq(3, 2));
});
