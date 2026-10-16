// Computer player for Wars of the Roses: chooseMove(board, house, difficulty, rng).
// Randomness comes from the injected rng (a () => [0, 1) function) so tests are
// deterministic. No DOM; loaded as a plain <script> (window.RosesAI) or via require().
(function (root) {
  const Logic = typeof module !== 'undefined' && module.exports
    ? require('./logic.js')
    : root.RosesLogic;
  const { LINES, opponent, findWinner } = Logic;

  const LEVELS = ['easy', 'medium', 'hard'];
  const CORNERS = [0, 2, 6, 8];

  const emptyCells = (board) => {
    const out = [];
    board.forEach((cell, i) => { if (cell === null) out.push(i); });
    return out;
  };
  const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

  // A cell that completes a line for `house`, or -1.
  function completingMove(board, house) {
    for (const line of LINES) {
      const mine = line.filter((i) => board[i] === house);
      const open = line.filter((i) => board[i] === null);
      if (mine.length === 2 && open.length === 1) return open[0];
    }
    return -1;
  }

  // Full minimax, scored for the house to move. Faster wins and slower losses score
  // better; the filled-cell count stands in for depth, so positions can be cached.
  const cache = new Map();
  function score(board, turn) {
    const key = board.map((c) => (c === null ? '.' : c[0])).join('') + turn[0];
    if (cache.has(key)) return cache.get(key);
    const filled = board.filter((c) => c !== null).length;
    const found = findWinner(board);
    let best;
    if (found) {
      best = found.winner === turn ? 10 - filled : filled - 10;
    } else if (filled === 9) {
      best = 0;
    } else {
      best = -Infinity;
      for (const i of emptyCells(board)) {
        const next = board.slice();
        next[i] = turn;
        best = Math.max(best, -score(next, opponent(turn)));
      }
    }
    cache.set(key, best);
    return best;
  }

  function hardMove(board, house, rng) {
    const scored = emptyCells(board).map((i) => {
      const next = board.slice();
      next[i] = house;
      return { i, s: -score(next, opponent(house)) };
    });
    const top = Math.max(...scored.map((m) => m.s));
    return pick(scored.filter((m) => m.s === top).map((m) => m.i), rng);
  }

  function mediumMove(board, house, rng) {
    for (const who of [house, opponent(house)]) {
      const cell = completingMove(board, who);
      if (cell !== -1) return cell;
    }
    for (const tier of [[4], CORNERS, emptyCells(board)]) {
      const available = tier.filter((i) => board[i] === null);
      if (available.length) return pick(available, rng);
    }
  }

  function easyMove(board, house, rng) {
    if (rng() < 0.5) {
      const cell = completingMove(board, house);
      if (cell !== -1) return cell;
    }
    return pick(emptyCells(board), rng);
  }

  // Picks a cell index for `house`, or null if the battle cannot continue.
  function chooseMove(board, house, difficulty, rng = Math.random) {
    if (findWinner(board) || !emptyCells(board).length) return null;
    if (difficulty === 'hard') return hardMove(board, house, rng);
    if (difficulty === 'easy') return easyMove(board, house, rng);
    return mediumMove(board, house, rng);
  }

  const api = { LEVELS, chooseMove };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RosesAI = api;
})(this);
