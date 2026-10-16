// Wars of the Roses tic tac toe rules, kept free of DOM so they can be unit
// tested. Loaded as a plain <script> in the browser (exposes window.RosesLogic,
// which also works from file://) and via require() in Node tests.
//
// Cells are indexes 0-8, row by row from the top left. A cell holds null,
// 'york' (white rose) or 'lancaster' (red rose). All functions return new
// state and never mutate their arguments.
(function (root) {
  const YORK = 'york';
  const LANCASTER = 'lancaster';
  const TUDOR = 'tudor';
  const STALEMATE = 'stalemate';
  const BATTLES = ['St Albans', 'Wakefield', 'Towton', 'Barnet', 'Tewkesbury', 'Bosworth'];
  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  const ROSE_NAMES = { [YORK]: 'white rose of York', [LANCASTER]: 'red rose of Lancaster' };
  const POSITIONS = [
    'Top left', 'Top middle', 'Top right',
    'Middle left', 'Centre', 'Middle right',
    'Bottom left', 'Bottom middle', 'Bottom right',
  ];

  const opponent = (house) => (house === YORK ? LANCASTER : YORK);

  // { winner, line } for the first complete line, or null.
  function findWinner(board) {
    for (const line of LINES) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], line };
      }
    }
    return null;
  }

  const isDraw = (board) => board.every((cell) => cell !== null) && !findWinner(board);

  function createGame(first = YORK) {
    return { board: Array(9).fill(null), turn: first, winner: null, line: null, draw: false };
  }

  const isOver = (state) => state.winner !== null || state.draw;

  function legalMoves(state) {
    if (isOver(state)) return [];
    const moves = [];
    state.board.forEach((cell, i) => { if (cell === null) moves.push(i); });
    return moves;
  }

  // Places the current house's rose. Illegal moves return the same state object.
  function play(state, index) {
    if (isOver(state) || !Number.isInteger(index) || index < 0 || index > 8) return state;
    if (state.board[index] !== null) return state;
    const board = state.board.slice();
    board[index] = state.turn;
    const found = findWinner(board);
    return {
      board,
      turn: opponent(state.turn),
      winner: found ? found.winner : null,
      line: found ? found.line : null,
      draw: !found && isDraw(board),
    };
  }

  function cellLabel(index, house) {
    return `${POSITIONS[index]}, ${house ? ROSE_NAMES[house] : 'empty'}`;
  }

  const CURSOR_STEPS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

  // Moves the keyboard cursor in screen directions, clamped to the board.
  function moveCursor(index, dir) {
    const step = CURSOR_STEPS[dir];
    if (!step) return index;
    const clamp = (v) => Math.max(0, Math.min(2, v));
    const r = clamp(Math.floor(index / 3) + step[0]);
    const c = clamp((index % 3) + step[1]);
    return r * 3 + c;
  }

  // ---------- campaign ----------

  function createCampaign({ target = 3, single = false, firstMover = YORK } = {}) {
    return {
      battleIndex: 0,
      score: { [YORK]: 0, [LANCASTER]: 0 },
      firstMover,
      target,
      single,
      history: [],
      over: false,
      champion: null,
    };
  }

  const battleName = (campaign) => BATTLES[Math.min(campaign.battleIndex, BATTLES.length - 1)];

  // Folds a finished battle into the campaign. The loser moves first next; after a
  // draw the first mover alternates. Returns the same object if nothing can be recorded.
  function recordBattle(campaign, battle) {
    if (campaign.over || !isOver(battle)) return campaign;
    const result = battle.winner || 'draw';
    const score = { ...campaign.score };
    if (battle.winner) score[battle.winner] += 1;
    const firstMover = campaign.firstMover;
    const history = [...campaign.history, { battle: battleName(campaign), result, firstMover }];
    const battleIndex = campaign.battleIndex + 1;
    const nextFirst = battle.winner ? opponent(battle.winner) : opponent(firstMover);

    let champion = null;
    if (score[YORK] >= campaign.target) champion = YORK;
    else if (score[LANCASTER] >= campaign.target) champion = LANCASTER;
    const out = campaign.single || battleIndex >= BATTLES.length;
    if (!champion && out) {
      if (score[YORK] === score[LANCASTER]) champion = campaign.single ? STALEMATE : TUDOR;
      else champion = score[YORK] > score[LANCASTER] ? YORK : LANCASTER;
    }
    return {
      ...campaign,
      battleIndex,
      score,
      firstMover: nextFirst,
      history,
      over: champion !== null,
      champion,
    };
  }

  const CROWN_TEXT = {
    [YORK]: 'Edward of York is King',
    [LANCASTER]: 'Henry of Lancaster is King',
    [TUDOR]: 'The Tudor rose unites the realm',
    [STALEMATE]: 'Stalemate on the field',
  };
  const crownText = (champion) => CROWN_TEXT[champion];

  const api = {
    YORK, LANCASTER, TUDOR, STALEMATE, BATTLES, LINES,
    opponent, findWinner, isDraw, isOver, createGame, legalMoves, play,
    cellLabel, moveCursor,
    createCampaign, battleName, recordBattle, crownText,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RosesLogic = api;
})(this);
