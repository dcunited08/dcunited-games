// Chickens vs Pigs checkers rules (American / English draughts), kept free of
// DOM and canvas so they can be unit tested. Loaded as a plain <script> in the
// browser (exposes window.ChickensPigsLogic, which also works from file://) and
// via require() in Node tests.
//
// Board squares are { r, c } with row 0 at the top. Pigs start on top and move
// down; chickens start at the bottom, move up, and go first.
(function (root) {
  const SIZE = 8;
  const CHICKEN = 'chicken';
  const PIG = 'pig';
  // 40 moves each with only king moves and no captures ends in a draw.
  const DRAW_AFTER_QUIET_MOVES = 80;

  const opponent = (side) => (side === CHICKEN ? PIG : CHICKEN);
  const isDark = (r, c) => (r + c) % 2 === 1;
  const onBoard = (r, c) => r >= 0 && c >= 0 && r < SIZE && c < SIZE;
  const forward = (side) => (side === CHICKEN ? -1 : 1);
  const crownRow = (side) => (side === CHICKEN ? 0 : SIZE - 1);

  function emptyBoard() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  }

  function createState() {
    const board = emptyBoard();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!isDark(r, c)) continue;
        if (r <= 2) board[r][c] = { side: PIG, king: false };
        else if (r >= SIZE - 3) board[r][c] = { side: CHICKEN, king: false };
      }
    }
    return { board, turn: CHICKEN, quietMoves: 0 };
  }

  // Builds a position from [r, c, side, king?] entries; handy for tests.
  function stateFrom(pieces, turn = CHICKEN) {
    const board = emptyBoard();
    for (const [r, c, side, king = false] of pieces) board[r][c] = { side, king };
    return { board, turn, quietMoves: 0 };
  }

  function directions(piece) {
    const f = forward(piece.side);
    const rows = piece.king ? [f, -f] : [f];
    return rows.flatMap((dr) => [{ dr, dc: -1 }, { dr, dc: 1 }]);
  }

  // Every jump chain for one piece. Captured pieces stay on the board until the
  // move ends (so they can't be jumped twice or landed on), and the moving piece
  // has left its start square, so a king may loop back to it.
  function jumpsFrom(board, from, piece) {
    const results = [];
    const walk = (at, path, captures) => {
      let extended = false;
      for (const { dr, dc } of directions(piece)) {
        const over = { r: at.r + dr, c: at.c + dc };
        const to = { r: at.r + 2 * dr, c: at.c + 2 * dc };
        if (!onBoard(to.r, to.c)) continue;
        const victim = board[over.r][over.c];
        if (!victim || victim.side === piece.side) continue;
        if (captures.some((s) => s.r === over.r && s.c === over.c)) continue;
        const target = board[to.r][to.c];
        if (target && !(to.r === from.r && to.c === from.c)) continue;
        extended = true;
        const nextPath = [...path, to];
        const nextCaptures = [...captures, over];
        // A man that reaches the far row is crowned and its turn ends there.
        if (!piece.king && to.r === crownRow(piece.side)) {
          results.push({ from, path: nextPath, captures: nextCaptures, crowned: true });
        } else {
          walk(to, nextPath, nextCaptures);
        }
      }
      if (!extended && captures.length) {
        results.push({ from, path, captures, crowned: false });
      }
    };
    walk(from, [], []);
    return results;
  }

  function stepsFrom(board, from, piece) {
    const moves = [];
    for (const { dr, dc } of directions(piece)) {
      const to = { r: from.r + dr, c: from.c + dc };
      if (!onBoard(to.r, to.c) || board[to.r][to.c]) continue;
      const crowned = !piece.king && to.r === crownRow(piece.side);
      moves.push({ from, path: [to], captures: [], crowned });
    }
    return moves;
  }

  // All legal moves for the side to move. Jumps are mandatory.
  function legalMoves(state) {
    const { board, turn } = state;
    const jumps = [];
    const steps = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const piece = board[r][c];
        if (!piece || piece.side !== turn) continue;
        const from = { r, c };
        jumps.push(...jumpsFrom(board, from, piece));
        steps.push(...stepsFrom(board, from, piece));
      }
    }
    return jumps.length ? jumps : steps;
  }

  // Returns the next state; the given state is left untouched.
  function applyMove(state, move) {
    const board = state.board.map((row) => row.slice());
    const piece = board[move.from.r][move.from.c];
    const to = move.path[move.path.length - 1];
    board[move.from.r][move.from.c] = null;
    for (const { r, c } of move.captures) board[r][c] = null;
    board[to.r][to.c] = { side: piece.side, king: piece.king || move.crowned };
    const quiet = piece.king && move.captures.length === 0;
    return {
      board,
      turn: opponent(state.turn),
      quietMoves: quiet ? state.quietMoves + 1 : 0,
    };
  }

  function countPieces(state) {
    const counts = { [CHICKEN]: 0, [PIG]: 0 };
    for (const row of state.board) for (const p of row) if (p) counts[p.side]++;
    return counts;
  }

  // 'chicken', 'pig', 'draw' or null while the game is still going.
  function winner(state) {
    const counts = countPieces(state);
    if (!counts[CHICKEN]) return PIG;
    if (!counts[PIG]) return CHICKEN;
    if (!legalMoves(state).length) return opponent(state.turn);
    if (state.quietMoves >= DRAW_AFTER_QUIET_MOVES) return 'draw';
    return null;
  }

  const same = (a, b) => a.r === b.r && a.c === b.c;
  const landing = (move) => move.path[move.path.length - 1];

  function movesFrom(moves, from) {
    return moves.filter((m) => same(m.from, from));
  }

  function findMove(moves, from, to) {
    return moves.find((m) => same(m.from, from) && same(landing(m), to)) || null;
  }

  // Canvas pixel -> board square. A flipped board shows the pigs at the bottom.
  function squareAt(x, y, boardPx, flipped = false) {
    if (x < 0 || y < 0 || x >= boardPx || y >= boardPx) return null;
    const cell = boardPx / SIZE;
    const r = Math.floor(y / cell);
    const c = Math.floor(x / cell);
    return flipped ? { r: SIZE - 1 - r, c: SIZE - 1 - c } : { r, c };
  }

  const CURSOR_STEPS = {
    up: { dr: -1, dc: 0 },
    down: { dr: 1, dc: 0 },
    left: { dr: 0, dc: -1 },
    right: { dr: 0, dc: 1 },
  };

  // Moves the keyboard cursor in screen directions, clamped to the board.
  function moveCursor(at, dir, flipped = false) {
    const step = CURSOR_STEPS[dir];
    if (!step) return at;
    const sign = flipped ? -1 : 1;
    const clamp = (v) => Math.max(0, Math.min(SIZE - 1, v));
    return { r: clamp(at.r + sign * step.dr), c: clamp(at.c + sign * step.dc) };
  }

  const api = {
    SIZE, CHICKEN, PIG, DRAW_AFTER_QUIET_MOVES,
    createState, stateFrom, opponent, isDark, legalMoves, applyMove, winner,
    movesFrom, findMove, landing, countPieces, squareAt, moveCursor,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChickensPigsLogic = api;
})(this);
