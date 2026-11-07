// Star Battle board rules, kept free of DOM so they can be unit tested. Loaded
// as a plain <script> in the browser (exposes window.StarBattleLogic) and via
// require() in Node tests.
//
// A puzzle is { size, regions } where regions is an array of `size` strings of
// region letters ('A', 'B', ...). parsePuzzle turns it into numeric regions.
// Board state is { size, cells } where cells is a flat row-major array of
// 'empty' | 'x' | 'star'. Cell keys everywhere are indexes r * size + c.
// All functions return new state and never mutate their arguments.
(function (root) {
  const EMPTY = 'empty';
  const X = 'x';
  const STAR = 'star';
  const VALUES = [EMPTY, X, STAR];
  const CYCLE = { [EMPTY]: X, [X]: STAR, [STAR]: EMPTY };

  // Every region must be one orthogonally connected blob.
  function isContiguous(grid, size, id) {
    const cells = [];
    grid.forEach((row, r) => row.forEach((v, c) => { if (v === id) cells.push([r, c]); }));
    const seen = new Set([cells[0].join()]);
    const stack = [cells[0]];
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nc >= 0 && nr < size && nc < size && grid[nr][nc] === id
            && !seen.has(`${nr},${nc}`)) {
          seen.add(`${nr},${nc}`);
          stack.push([nr, nc]);
        }
      }
    }
    return seen.size === cells.length;
  }

  // Accepts an array of strings, a { size, regions: strings } puzzle, or an
  // already parsed puzzle (returned as is). Throws on an invalid puzzle.
  function parsePuzzle(input) {
    const rows = Array.isArray(input) ? input : input && input.regions;
    if (!Array.isArray(rows)) throw new Error('Puzzle must be an array of row strings');
    if (rows.length && typeof rows[0] !== 'string') return input;
    const size = rows.length;
    if (!rows.every((row) => row.length === size)) throw new Error('Puzzle must be square');
    const letters = [...new Set(rows.join(''))].sort();
    if (letters.length !== size) {
      throw new Error(`Puzzle needs exactly ${size} regions, found ${letters.length}`);
    }
    if (!letters.every((ch) => /^[A-Z]$/.test(ch))) throw new Error('Regions must be letters A-Z');
    const regions = rows.map((row) => [...row].map((ch) => letters.indexOf(ch)));
    for (let id = 0; id < size; id++) {
      if (!isContiguous(regions, size, id)) throw new Error(`Region ${letters[id]} is not contiguous`);
    }
    return { size, regions };
  }

  const createState = (puzzle) => {
    const size = parsePuzzle(puzzle).size;
    return { size, cells: Array(size * size).fill(EMPTY) };
  };

  const inRange = (state, r, c) => r >= 0 && c >= 0 && r < state.size && c < state.size;
  const getCell = (state, r, c) => state.cells[r * state.size + c];

  function setCell(state, r, c, value) {
    if (!VALUES.includes(value)) throw new Error(`Bad cell value: ${value}`);
    if (!inRange(state, r, c)) throw new Error('Cell out of range');
    const cells = state.cells.slice();
    cells[r * state.size + c] = value;
    return { size: state.size, cells };
  }

  const cycleCell = (state, r, c) => setCell(state, r, c, CYCLE[getCell(state, r, c)]);

  // Drag-to-X: marks the given [r, c] cells, touching only empty ones.
  function markX(state, list) {
    const cells = state.cells.slice();
    for (const [r, c] of list) {
      if (inRange(state, r, c) && cells[r * state.size + c] === EMPTY) cells[r * state.size + c] = X;
    }
    return { size: state.size, cells };
  }

  const clearBoard = (state) => ({ size: state.size, cells: Array(state.cells.length).fill(EMPTY) });

  const starsOf = (state) => {
    const out = [];
    state.cells.forEach((v, i) => {
      if (v === STAR) out.push({ i, r: Math.floor(i / state.size), c: i % state.size });
    });
    return out;
  };

  // Sorted indexes of stars that share a row, column or region with another
  // star, or touch one (diagonals included).
  function findConflicts(puzzle, state) {
    const { regions } = parsePuzzle(puzzle);
    const stars = starsOf(state);
    const bad = new Set();
    stars.forEach((a, n) => {
      for (const b of stars.slice(n + 1)) {
        const clash = a.r === b.r || a.c === b.c
          || regions[a.r][a.c] === regions[b.r][b.c]
          || (Math.abs(a.r - b.r) <= 1 && Math.abs(a.c - b.c) <= 1);
        if (clash) { bad.add(a.i); bad.add(b.i); }
      }
    });
    return [...bad].sort((a, b) => a - b);
  }

  const isSolved = (puzzle, state) =>
    starsOf(state).length === state.size && findConflicts(puzzle, state).length === 0;

  const serialize = (state) => JSON.stringify({ size: state.size, cells: state.cells });

  // Returns a state, or null when the text is not a valid save for this puzzle.
  function deserialize(json, puzzle) {
    const size = parsePuzzle(puzzle).size;
    let data;
    try { data = JSON.parse(json); } catch (e) { return null; }
    if (!data || data.size !== size || !Array.isArray(data.cells)
        || data.cells.length !== size * size || !data.cells.every((v) => VALUES.includes(v))) {
      return null;
    }
    return { size, cells: data.cells.slice() };
  }

  const api = {
    EMPTY, X, STAR,
    parsePuzzle, createState, getCell, setCell, cycleCell, markX, clearBoard,
    findConflicts, isSolved, serialize, deserialize,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StarBattleLogic = api;
})(this);
