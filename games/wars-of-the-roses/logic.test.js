const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

const { YORK, LANCASTER } = L;

// Plays a list of cell indexes in order, starting with `first`.
function playAll(cells, first = YORK) {
  return cells.reduce((s, i) => L.play(s, i), L.createGame(first));
}

test('createGame gives an empty board with the starting house to move', () => {
  const g = L.createGame();
  assert.deepEqual(g.board, Array(9).fill(null));
  assert.equal(g.turn, YORK);
  assert.equal(g.winner, null);
  assert.equal(g.line, null);
  assert.equal(g.draw, false);
  assert.equal(L.createGame(LANCASTER).turn, LANCASTER);
});

test('play places a rose and switches turn without mutating the old state', () => {
  const g = L.createGame();
  const next = L.play(g, 4);
  assert.equal(next.board[4], YORK);
  assert.equal(next.turn, LANCASTER);
  assert.equal(g.board[4], null);
  assert.equal(g.turn, YORK);
});

test('illegal moves are rejected and leave the state unchanged', () => {
  const g = L.play(L.createGame(), 0);
  assert.equal(L.play(g, 0), g);
  assert.equal(L.play(g, -1), g);
  assert.equal(L.play(g, 9), g);
  assert.equal(L.play(g, 1.5), g);
  assert.equal(L.play(g, '1'), g);
  const won = playAll([0, 3, 1, 4, 2]);
  assert.equal(L.play(won, 8), won);
});

test('legalMoves lists empty cells, none after the battle ends', () => {
  assert.deepEqual(L.legalMoves(L.createGame()), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(L.legalMoves(L.play(L.createGame(), 4)), [0, 1, 2, 3, 5, 6, 7, 8]);
  assert.deepEqual(L.legalMoves(playAll([0, 3, 1, 4, 2])), []);
});

test('every one of the 8 lines wins and is returned', () => {
  assert.equal(L.LINES.length, 8);
  for (const line of L.LINES) {
    const board = Array(9).fill(null);
    for (const i of line) board[i] = LANCASTER;
    assert.deepEqual(L.findWinner(board), { winner: LANCASTER, line });
  }
});

test('no false wins on mixed or empty lines', () => {
  assert.equal(L.findWinner(Array(9).fill(null)), null);
  const board = [YORK, LANCASTER, YORK, null, null, null, null, null, null];
  assert.equal(L.findWinner(board), null);
});

test('play records the winner and line, and gives the win to the mover', () => {
  const g = playAll([0, 3, 1, 4, 2]);
  assert.equal(g.winner, YORK);
  assert.deepEqual(g.line, [0, 1, 2]);
  assert.equal(g.draw, false);
});

test('a full board with no winner is a draw', () => {
  // Y L Y / Y L L / L Y Y
  const g = playAll([0, 1, 2, 4, 3, 5, 7, 6, 8]);
  assert.equal(g.winner, null);
  assert.equal(g.draw, true);
  assert.equal(L.isOver(g), true);
  assert.equal(L.isOver(L.createGame()), false);
  assert.equal(L.isDraw(g.board), true);
  assert.equal(L.isDraw(Array(9).fill(null)), false);
});

test('a win on the last cell is a win, not a draw', () => {
  // Y L Y / L Y L / L Y Y: York wins the diagonal on the ninth move.
  const g = playAll([0, 1, 2, 3, 4, 5, 7, 6, 8]);
  assert.equal(g.winner, YORK);
  assert.equal(g.draw, false);
});

test('opponent helper', () => {
  assert.equal(L.opponent(YORK), LANCASTER);
  assert.equal(L.opponent(LANCASTER), YORK);
});

test('cell labels name the position and the rose', () => {
  assert.equal(L.cellLabel(0, null), 'Top left, empty');
  assert.equal(L.cellLabel(4, YORK), 'Centre, white rose of York');
  assert.equal(L.cellLabel(8, LANCASTER), 'Bottom right, red rose of Lancaster');
  assert.equal(L.cellLabel(1, null), 'Top middle, empty');
});

test('moveCursor moves in screen directions and clamps at the edges', () => {
  assert.equal(L.moveCursor(4, 'up'), 1);
  assert.equal(L.moveCursor(4, 'down'), 7);
  assert.equal(L.moveCursor(4, 'left'), 3);
  assert.equal(L.moveCursor(4, 'right'), 5);
  assert.equal(L.moveCursor(0, 'up'), 0);
  assert.equal(L.moveCursor(0, 'left'), 0);
  assert.equal(L.moveCursor(8, 'down'), 8);
  assert.equal(L.moveCursor(8, 'right'), 8);
  assert.equal(L.moveCursor(2, 'right'), 2);
  assert.equal(L.moveCursor(3, 'left'), 3);
  assert.equal(L.moveCursor(4, 'sideways'), 4);
});

// ---------- campaign ----------

// Finished battle states with a known result.
const yorkWin = () => playAll([0, 3, 1, 4, 2], YORK);
const lancWin = () => playAll([0, 3, 1, 4, 8, 5], YORK);
const drawn = (first = YORK) => playAll([0, 1, 2, 4, 3, 5, 7, 6, 8], first);
const lancWinFirst = () => playAll([0, 3, 1, 4, 2], LANCASTER); // Lancaster opens and wins

test('battles are named in order from the real war', () => {
  assert.deepEqual(L.BATTLES, ['St Albans', 'Wakefield', 'Towton', 'Barnet', 'Tewkesbury', 'Bosworth']);
});

test('createCampaign starts York at St Albans with no score', () => {
  const c = L.createCampaign();
  assert.equal(c.battleIndex, 0);
  assert.deepEqual(c.score, { york: 0, lancaster: 0 });
  assert.equal(c.firstMover, YORK);
  assert.equal(c.target, 3);
  assert.equal(c.single, false);
  assert.deepEqual(c.history, []);
  assert.equal(c.over, false);
  assert.equal(c.champion, null);
  assert.equal(L.battleName(c), 'St Albans');
});

test('createCampaign accepts a custom target and single battle mode', () => {
  const c = L.createCampaign({ target: 2 });
  assert.equal(c.target, 2);
  assert.equal(L.createCampaign({ single: true }).single, true);
});

test('recording a win scores a point and the loser moves first next', () => {
  const c = L.recordBattle(L.createCampaign(), yorkWin());
  assert.deepEqual(c.score, { york: 1, lancaster: 0 });
  assert.equal(c.firstMover, LANCASTER);
  assert.equal(c.battleIndex, 1);
  assert.equal(L.battleName(c), 'Wakefield');
  assert.deepEqual(c.history, [{ battle: 'St Albans', result: YORK, firstMover: YORK }]);
  const c2 = L.recordBattle(c, lancWinFirst());
  assert.deepEqual(c2.score, { york: 1, lancaster: 1 });
  assert.equal(c2.firstMover, YORK);
});

test('recordBattle does not mutate the old campaign', () => {
  const c = L.createCampaign();
  L.recordBattle(c, yorkWin());
  assert.equal(c.battleIndex, 0);
  assert.deepEqual(c.score, { york: 0, lancaster: 0 });
  assert.deepEqual(c.history, []);
});

test('Lancaster wins are scored for Lancaster', () => {
  const c = L.recordBattle(L.createCampaign(), lancWin());
  assert.deepEqual(c.score, { york: 0, lancaster: 1 });
  assert.equal(c.firstMover, YORK);
});

test('a draw gives no point, counts as played, and alternates the first mover', () => {
  let c = L.recordBattle(L.createCampaign(), drawn(YORK));
  assert.deepEqual(c.score, { york: 0, lancaster: 0 });
  assert.equal(c.battleIndex, 1);
  assert.equal(c.firstMover, LANCASTER);
  assert.equal(c.history[0].result, 'draw');
  c = L.recordBattle(c, drawn(LANCASTER));
  assert.equal(c.firstMover, YORK);
});

test('recordBattle ignores unfinished battles and finished campaigns', () => {
  const c = L.createCampaign();
  assert.equal(L.recordBattle(c, L.createGame()), c);
  let done = c;
  for (let i = 0; i < 3; i++) done = L.recordBattle(done, yorkWin());
  assert.equal(done.over, true);
  assert.equal(L.recordBattle(done, yorkWin()), done);
});

test('first to 3 battle wins takes the crown', () => {
  let c = L.createCampaign();
  c = L.recordBattle(c, yorkWin());
  c = L.recordBattle(c, lancWin());
  c = L.recordBattle(c, yorkWin());
  assert.equal(c.over, false);
  c = L.recordBattle(c, drawn());
  c = L.recordBattle(c, yorkWin());
  assert.equal(c.over, true);
  assert.equal(c.champion, YORK);
  assert.equal(c.score.york, 3);
});

test('Lancaster can take the crown', () => {
  let c = L.createCampaign({ target: 1 });
  c = L.recordBattle(c, lancWin());
  assert.equal(c.over, true);
  assert.equal(c.champion, LANCASTER);
});

test('a level finish after all six battles is the Tudor ending', () => {
  let c = L.createCampaign();
  const results = [yorkWin, lancWin, yorkWin, lancWin, drawn, drawn];
  for (const r of results) c = L.recordBattle(c, r());
  assert.equal(c.battleIndex, 6);
  assert.equal(c.over, true);
  assert.equal(c.champion, L.TUDOR);
  assert.deepEqual(c.score, { york: 2, lancaster: 2 });
});

test('running out of battles with a leader crowns the leader', () => {
  let c = L.createCampaign();
  for (const r of [yorkWin, drawn, drawn, drawn, drawn, drawn]) c = L.recordBattle(c, r());
  assert.equal(c.over, true);
  assert.equal(c.champion, YORK);
  c = L.createCampaign();
  for (const r of [lancWin, drawn, drawn, drawn, drawn, drawn]) c = L.recordBattle(c, r());
  assert.equal(c.champion, LANCASTER);
});

test('a single battle ends the campaign after one battle', () => {
  let c = L.recordBattle(L.createCampaign({ single: true }), yorkWin());
  assert.equal(c.over, true);
  assert.equal(c.champion, YORK);
  c = L.recordBattle(L.createCampaign({ single: true }), lancWin());
  assert.equal(c.champion, LANCASTER);
});

test('a drawn single battle is a stalemate, not the Tudor ending', () => {
  const c = L.recordBattle(L.createCampaign({ single: true }), drawn());
  assert.equal(c.over, true);
  assert.equal(c.champion, L.STALEMATE);
  assert.match(L.crownText(L.STALEMATE), /Stalemate on the field/);
});

test('battleName falls back to the last battle once the list is used up', () => {
  let c = L.createCampaign();
  for (let i = 0; i < 6; i++) c = L.recordBattle(c, drawn());
  assert.equal(L.battleName(c), 'Bosworth');
});

test('crownText describes each ending', () => {
  assert.match(L.crownText(YORK), /Edward of York is King/);
  assert.match(L.crownText(LANCASTER), /Henry of Lancaster is King/);
  assert.match(L.crownText(L.TUDOR), /Tudor rose unites the realm/);
});
