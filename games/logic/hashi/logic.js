// Hashi (Bridges) board rules, kept free of DOM so they can be unit tested.
// Loaded as a plain <script> in the browser (window.HashiLogic) and via
// require() in Node tests.
//
// A puzzle is an array of row strings: '.' is water, '1'..'8' an island with
// that many bridges (all rows the same length; size is the row count, width
// the row length). parsePuzzle gives { size, width, islands, edges, crossings }:
//   islands  [{ r, c, n }] in row-major order
//   edges    [{ a, b, dir, cells }] one per pair of islands that see each other
//            along a row ('h') or column ('v'); a < b; cells are the water
//            cells between them
//   crossings [[e1, e2]] pairs of edges that share a water cell
// Board state is { counts } with 0, 1 or 2 bridges per edge. Functions return
// new state and never mutate their arguments.
(function (root) {
  function parsePuzzle(rows) {
    if (rows && Array.isArray(rows.islands)) return rows;
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('Puzzle must be a list of rows');
    const size = rows.length;
    const width = typeof rows[0] === 'string' ? rows[0].length : 0;
    const islands = [];
    const at = new Map();
    rows.forEach((row, r) => {
      if (typeof row !== 'string' || row.length !== width) throw new Error('Rows must be the same length');
      [...row].forEach((ch, c) => {
        if (ch === '.') return;
        if (!/^[1-8]$/.test(ch)) throw new Error(`Bad character ${ch}`);
        at.set(`${r},${c}`, islands.length);
        islands.push({ r, c, n: Number(ch) });
      });
    });
    const edges = [];
    islands.forEach((isl, a) => {
      [['h', 0, 1], ['v', 1, 0]].forEach(([dir, dr, dc]) => {
        const cells = [];
        for (let r = isl.r + dr, c = isl.c + dc; r < size && c < width; r += dr, c += dc) {
          const b = at.get(`${r},${c}`);
          if (b !== undefined) { edges.push({ a, b, dir, cells }); break; }
          cells.push([r, c]);
        }
      });
    });
    const owner = new Map();
    const crossings = [];
    edges.forEach((e, i) => {
      e.cells.forEach(([r, c]) => {
        const key = `${r},${c}`;
        if (owner.has(key)) crossings.push([owner.get(key), i]);
        else owner.set(key, i);
      });
    });
    return { size, width, islands, edges, crossings };
  }

  const createState = (puzzle) => ({ counts: puzzle.edges.map(() => 0) });

  function edgeBetween(puzzle, a, b) {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return puzzle.edges.findIndex((e) => e.a === lo && e.b === hi);
  }

  // Edge indexes that cross edge `e`.
  const crossersOf = (puzzle, e) => puzzle.crossings
    .filter((x) => x[0] === e || x[1] === e).map((x) => (x[0] === e ? x[1] : x[0]));

  function setEdge(puzzle, state, e, value) {
    if (!Number.isInteger(e) || e < 0 || e >= state.counts.length) return state;
    if (![0, 1, 2].includes(value) || state.counts[e] === value) return state;
    if (value > 0 && crossersOf(puzzle, e).some((x) => state.counts[x] > 0)) return state;
    const counts = state.counts.slice();
    counts[e] = value;
    return { counts };
  }

  const cycleEdge = (puzzle, state, e) => setEdge(puzzle, state, e, (state.counts[e] + 1) % 3);

  function islandTotals(puzzle, state) {
    const totals = puzzle.islands.map(() => 0);
    puzzle.edges.forEach((e, i) => { totals[e.a] += state.counts[i]; totals[e.b] += state.counts[i]; });
    return totals;
  }

  const findConflicts = (puzzle, state) => islandTotals(puzzle, state)
    .reduce((out, t, i) => (t > puzzle.islands[i].n ? out.concat(i) : out), []);

  // Are all islands joined into one group by the built bridges?
  function isConnected(puzzle, state) {
    const n = puzzle.islands.length;
    if (n === 0) return true;
    const seen = new Set([0]);
    const stack = [0];
    while (stack.length) {
      const cur = stack.pop();
      puzzle.edges.forEach((e, i) => {
        if (state.counts[i] === 0 || (e.a !== cur && e.b !== cur)) return;
        const other = e.a === cur ? e.b : e.a;
        if (!seen.has(other)) { seen.add(other); stack.push(other); }
      });
    }
    return seen.size === n;
  }

  function isSolved(puzzle, state) {
    const totals = islandTotals(puzzle, state);
    return puzzle.islands.every((isl, i) => totals[i] === isl.n)
      && puzzle.crossings.every(([x, y]) => !(state.counts[x] > 0 && state.counts[y] > 0))
      && isConnected(puzzle, state);
  }

  const serialize = (state) => JSON.stringify({ counts: state.counts });

  // Returns a state, or null when the text is not a valid save for this puzzle.
  function deserialize(json, puzzle) {
    let data;
    try { data = JSON.parse(json); } catch (e) { return null; }
    if (!data || !Array.isArray(data.counts) || data.counts.length !== puzzle.edges.length
        || !data.counts.every((v) => v === 0 || v === 1 || v === 2)) {
      return null;
    }
    if (puzzle.crossings.some(([x, y]) => data.counts[x] > 0 && data.counts[y] > 0)) return null;
    return { counts: data.counts.slice() };
  }

  const api = {
    parsePuzzle, createState, edgeBetween, crossersOf, setEdge, cycleEdge,
    islandTotals, findConflicts, isConnected, isSolved, serialize, deserialize,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HashiLogic = api;
})(this);
