// Computer player for Chickens vs Pigs: negamax search with alpha-beta pruning.
// No DOM; loaded as a plain <script> (window.ChickensPigsAI) or via require().
(function (root) {
  const Logic = typeof module !== 'undefined' && module.exports
    ? require('./logic.js')
    : root.ChickensPigsLogic;
  const { SIZE, CHICKEN, legalMoves, applyMove, winner } = Logic;

  const MAN = 100;
  const KING = 160;
  const ADVANCE = 3;
  const WIN = 100000;

  // Easy looks one move ahead and picks loosely among decent moves.
  const DIFFICULTY = {
    easy: { depth: 1, slack: 60 },
    medium: { depth: 3, slack: 0 },
    hard: { depth: 6, slack: 0 },
  };

  // Material plus a small bonus for men marching toward their crowning row,
  // scored from `side`'s point of view.
  function evaluate(state, side) {
    let score = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const p = state.board[r][c];
        if (!p) continue;
        const advanced = p.side === CHICKEN ? SIZE - 1 - r : r;
        const value = p.king ? KING : MAN + ADVANCE * advanced;
        score += p.side === side ? value : -value;
      }
    }
    return score;
  }

  // Captures first so alpha-beta prunes more.
  const ordered = (moves) => moves.slice().sort((a, b) => b.captures.length - a.captures.length);

  function negamax(state, depth, alpha, beta, ply) {
    const result = winner(state);
    if (result === 'draw') return 0;
    // Faster wins (and slower losses) score better.
    if (result) return result === state.turn ? WIN - ply : -(WIN - ply);
    if (depth === 0) return evaluate(state, state.turn);
    let best = -Infinity;
    for (const move of ordered(legalMoves(state))) {
      const score = -negamax(applyMove(state, move), depth - 1, -beta, -alpha, ply + 1);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  // Picks a move for the side to move, or null if it has none.
  function chooseMove(state, options = {}) {
    const { depth, slack, random } = { ...DIFFICULTY.medium, random: Math.random, ...options };
    const moves = legalMoves(state);
    if (!moves.length) return null;
    const scored = moves.map((move) => ({
      move,
      score: -negamax(applyMove(state, move), depth - 1, -Infinity, Infinity, 1),
    }));
    const best = Math.max(...scored.map((s) => s.score));
    const candidates = scored.filter((s) => s.score >= best - slack);
    return candidates[Math.floor(random() * candidates.length)].move;
  }

  const api = { DIFFICULTY, evaluate, chooseMove };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChickensPigsAI = api;
})(this);
