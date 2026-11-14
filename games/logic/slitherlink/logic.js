// Slitherlink board rules, kept free of DOM so they can be unit tested. Loaded
// as a plain <script> in the browser (exposes window.SlitherlinkLogic) and via
// require() in Node tests.
//
// A puzzle is an array of row strings: '.' = no clue, '0'-'3' = clue. A grid of
// rows x cols cells has (rows+1) x (cols+1) dots. Edges are numbered: the
// horizontal ones first, H(r, c) = r * cols + c (r in 0..rows, c in 0..cols-1),
// then the vertical ones, V(r, c) = nH + r * (cols + 1) + c (r in 0..rows-1,
// c in 0..cols). Dot (r, c) is r * (cols + 1) + c. Cells are r * cols + c.
// Board state is { edges } with 'empty' | 'line' | 'x' per edge. Functions
// return new state and never mutate their arguments.
(function (root) {
  const EMPTY = 'empty';
  const LINE = 'line';
  const X = 'x';
  const VALUES = [EMPTY, LINE, X];
  const CYCLE = { [EMPTY]: LINE, [LINE]: X, [X]: EMPTY };

  // Accepts an array of row strings or an already parsed puzzle (returned as
  // is). Also precomputes the topology: cellE (4 edges per cell: top, bottom,
  // left, right), dotE (edges at each dot), edgeD (the 2 dots of an edge) and
  // edgeC (the 1 or 2 cells next to an edge). Throws on an invalid puzzle.
  function parsePuzzle(input) {
    if (input && typeof input === 'object' && !Array.isArray(input) && input.clues) return input;
    if (!Array.isArray(input) || input.length === 0) throw new Error('puzzle must be a non-empty array of rows');
    const rows = input.length;
    const cols = typeof input[0] === 'string' ? input[0].length : 0;
    const clues = [];
    input.forEach((row) => {
      if (typeof row !== 'string' || row.length !== cols || cols === 0) throw new Error('rows must be equal-length strings');
      for (const ch of row) {
        if (ch === '.') clues.push(-1);
        else if (ch >= '0' && ch <= '3') clues.push(Number(ch));
        else throw new Error(`bad clue "${ch}"`);
      }
    });
    const nH = (rows + 1) * cols;
    const nV = rows * (cols + 1);
    const H = (r, c) => r * cols + c;
    const V = (r, c) => nH + r * (cols + 1) + c;
    const dot = (r, c) => r * (cols + 1) + c;
    const cellE = [];
    const dotE = Array.from({ length: (rows + 1) * (cols + 1) }, () => []);
    const edgeD = new Array(nH + nV);
    const edgeC = Array.from({ length: nH + nV }, () => []);
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c < cols; c++) edgeD[H(r, c)] = [dot(r, c), dot(r, c + 1)];
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= cols; c++) edgeD[V(r, c)] = [dot(r, c), dot(r + 1, c)];
    }
    edgeD.forEach((ds, e) => ds.forEach((d) => dotE[d].push(e)));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const es = [H(r, c), H(r + 1, c), V(r, c), V(r, c + 1)];
        cellE.push(es);
        es.forEach((e) => edgeC[e].push(r * cols + c));
      }
    }
    return { rows, cols, clues, nH, nV, edgeCount: nH + nV, cellE, dotE, edgeD, edgeC };
  }

  const dotRC = (p, d) => [Math.floor(d / (p.cols + 1)), d % (p.cols + 1)];

  const createState = (p) => ({ edges: new Array(p.edgeCount).fill(EMPTY) });
  const validEdge = (state, e) => Number.isInteger(e) && e >= 0 && e < state.edges.length;

  function setEdge(state, e, value) {
    if (!validEdge(state, e) || state.edges[e] === value) return state;
    const edges = state.edges.slice();
    edges[e] = value;
    return { edges };
  }
  const cycleEdge = (state, e) => (validEdge(state, e) ? setEdge(state, e, CYCLE[state.edges[e]]) : state);

  // Draw (erase = false: empty and X edges become lines) or erase (lines
  // become empty) along a list of edges. X marks survive an erase stroke.
  function setPath(state, list, erase) {
    const edges = state.edges.slice();
    list.forEach((e) => {
      if (!validEdge(state, e)) return;
      if (erase) { if (edges[e] === LINE) edges[e] = EMPTY; } else edges[e] = LINE;
    });
    return { edges };
  }
  const clearBoard = (state) => ({ edges: state.edges.map(() => EMPTY) });
  const lineFlags = (state) => state.edges.map((v) => v === LINE);

  // `lines` is an array of booleans per edge.
  function cluesMet(p, lines) {
    return p.clues.every((n, cell) => n < 0 || p.cellE[cell].filter((e) => lines[e]).length === n);
  }

  // True when the line edges make exactly one closed loop (every touched dot
  // has two lines and they are all connected).
  function isSingleLoop(p, lines) {
    const used = [];
    p.dotE.forEach((es, d) => {
      const n = es.filter((e) => lines[e]).length;
      if (n > 0) used.push([d, n]);
    });
    if (used.length === 0 || used.some(([, n]) => n !== 2)) return false;
    const seen = new Set([used[0][0]]);
    const stack = [used[0][0]];
    while (stack.length) {
      const d = stack.pop();
      for (const e of p.dotE[d]) {
        if (!lines[e]) continue;
        const o = p.edgeD[e][0] === d ? p.edgeD[e][1] : p.edgeD[e][0];
        if (!seen.has(o)) { seen.add(o); stack.push(o); }
      }
    }
    return seen.size === used.length;
  }

  const isSolved = (p, state) => {
    const lines = lineFlags(state);
    return isSingleLoop(p, lines) && cluesMet(p, lines);
  };

  // { cells, dots }: clue cells that have too many lines or too many X's to
  // ever be met, and dots with three or more lines.
  function findConflicts(p, state) {
    const cells = [];
    p.clues.forEach((n, cell) => {
      if (n < 0) return;
      const vals = p.cellE[cell].map((e) => state.edges[e]);
      const lines = vals.filter((v) => v === LINE).length;
      const xs = vals.filter((v) => v === X).length;
      if (lines > n || 4 - xs < n) cells.push(cell);
    });
    const dots = [];
    p.dotE.forEach((es, d) => {
      if (es.filter((e) => state.edges[e] === LINE).length >= 3) dots.push(d);
    });
    return { cells, dots };
  }

  // Geometry in cell units: dot (r, c) is at x = c, y = r. Returns the edge
  // whose midpoint is nearest, or -1 when the point is more than half a cell
  // outside the board.
  function nearestEdge(p, x, y) {
    if (x < -0.5 || y < -0.5 || x > p.cols + 0.5 || y > p.rows + 0.5) return -1;
    let best = -1;
    let bestD = Infinity;
    p.edgeD.forEach((ds, e) => {
      const [r1, c1] = dotRC(p, ds[0]);
      const [r2, c2] = dotRC(p, ds[1]);
      const d = (x - (c1 + c2) / 2) ** 2 + (y - (r1 + r2) / 2) ** 2;
      if (d < bestD) { bestD = d; best = e; }
    });
    return best;
  }

  // Nearest dot within `radius` cell units, else -1.
  function nearestDot(p, x, y, radius) {
    const c = Math.round(x);
    const r = Math.round(y);
    if (r < 0 || c < 0 || r > p.rows || c > p.cols) return -1;
    return Math.hypot(x - c, y - r) <= radius ? r * (p.cols + 1) + c : -1;
  }

  function edgeBetween(p, a, b) {
    return p.dotE[a].find((e) => p.edgeD[e][0] === b || p.edgeD[e][1] === b) ?? -1;
  }

  // Dots to visit going from dot `from` to dot `to` one neighbour at a time
  // (the longer axis first), excluding `from`.
  function dotPath(p, from, to) {
    let [r, c] = dotRC(p, from);
    const [tr, tc] = dotRC(p, to);
    const out = [];
    while (r !== tr || c !== tc) {
      if (Math.abs(tr - r) >= Math.abs(tc - c)) r += Math.sign(tr - r);
      else c += Math.sign(tc - c);
      out.push(r * (p.cols + 1) + c);
    }
    return out;
  }

  const serialize = (state) => JSON.stringify({ edges: state.edges });

  // State from serialize() output, or null if it does not fit the puzzle.
  function deserialize(text, puzzle) {
    let data;
    try { data = JSON.parse(text); } catch { return null; }
    const p = parsePuzzle(puzzle);
    if (!data || !Array.isArray(data.edges) || data.edges.length !== p.edgeCount) return null;
    if (!data.edges.every((v) => VALUES.includes(v))) return null;
    return { edges: data.edges.slice() };
  }

  const api = {
    EMPTY, LINE, X, parsePuzzle, dotRC, createState, setEdge, cycleEdge, setPath, clearBoard,
    lineFlags, cluesMet, isSingleLoop, isSolved, findConflicts, nearestEdge, nearestDot,
    edgeBetween, dotPath, serialize, deserialize,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SlitherlinkLogic = api;
})(this);
