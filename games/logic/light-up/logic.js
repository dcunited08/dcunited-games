// Light Up (Akari) board rules, kept free of DOM so they can be unit tested.
// Loaded as a plain <script> in the browser (exposes window.LightUpLogic) and
// via require() in Node tests.
//
// A puzzle is an array of equal-length row strings: '.' is a white cell, '#'
// a wall with no number and '0'-'4' a wall showing how many bulbs touch it.
// parsePuzzle turns it into { size, wall, num } with flat row-major arrays.
// Board state is { size, cells } where cells is a flat row-major array of
// 'empty' | 'bulb' | 'dot'. Cell keys everywhere are indexes r * size + c.
// All functions return new state and never mutate their arguments.
(function (root) {
  const EMPTY = 'empty';
  const BULB = 'bulb';
  const DOT = 'dot';
  const VALUES = [EMPTY, BULB, DOT];
  const CYCLE = { [EMPTY]: BULB, [BULB]: DOT, [DOT]: EMPTY };
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  // Accepts an array of row strings or an already parsed puzzle (returned as
  // is). Throws on an invalid puzzle.
  function parsePuzzle(input) {
    if (input && Array.isArray(input.wall) && Array.isArray(input.num)) return input;
    if (!Array.isArray(input)) throw new Error('Puzzle must be an array of row strings');
    if (input.length === 0) throw new Error('Puzzle is empty');
    const size = input.length;
    if (!input.every((row) => row.length === size)) throw new Error('Puzzle must be square');
    const wall = [];
    const num = [];
    for (const row of input) {
      for (const ch of row) {
        if (!/^[.#0-4]$/.test(ch)) throw new Error(`Bad cell character: ${ch}`);
        wall.push(ch !== '.');
        num.push(/[0-4]/.test(ch) ? Number(ch) : -1);
      }
    }
    return { size, wall, num };
  }

  const createState = (puzzle) => {
    const size = parsePuzzle(puzzle).size;
    return { size, cells: Array(size * size).fill(EMPTY) };
  };

  const inRange = (state, r, c) => r >= 0 && c >= 0 && r < state.size && c < state.size;
  const getCell = (state, r, c) => state.cells[r * state.size + c];

  // Walls cannot hold marks: the state comes back unchanged.
  function setCell(puzzle, state, r, c, value) {
    if (!VALUES.includes(value)) throw new Error(`Bad cell value: ${value}`);
    if (!inRange(state, r, c)) throw new Error('Cell out of range');
    if (parsePuzzle(puzzle).wall[r * state.size + c]) return state;
    const cells = state.cells.slice();
    cells[r * state.size + c] = value;
    return { size: state.size, cells };
  }

  const cycleCell = (puzzle, state, r, c) => setCell(puzzle, state, r, c, CYCLE[getCell(state, r, c)]);

  // Drag-to-dot: dots the given [r, c] cells, touching only empty white ones.
  function markDot(puzzle, state, list) {
    const { wall } = parsePuzzle(puzzle);
    const cells = state.cells.slice();
    for (const [r, c] of list) {
      if (!inRange(state, r, c)) continue;
      const i = r * state.size + c;
      if (!wall[i] && cells[i] === EMPTY) cells[i] = DOT;
    }
    return { size: state.size, cells };
  }

  const clearBoard = (state) => ({ size: state.size, cells: Array(state.cells.length).fill(EMPTY) });

  // Indexes of the white cell i and every white cell it can see along its row
  // and column before a wall. A wall gives [].
  function lineOfSight(puzzle, i) {
    const { size, wall } = parsePuzzle(puzzle);
    if (wall[i]) return [];
    const r0 = Math.floor(i / size);
    const c0 = i % size;
    const out = [i];
    for (const [dr, dc] of DIRS) {
      let r = r0 + dr;
      let c = c0 + dc;
      while (r >= 0 && c >= 0 && r < size && c < size && !wall[r * size + c]) {
        out.push(r * size + c);
        r += dr;
        c += dc;
      }
    }
    return out;
  }

  // How many bulbs light each cell (a bulb lights its own cell). Walls give 0.
  function litMap(puzzle, state) {
    const p = parsePuzzle(puzzle);
    const lit = Array(state.cells.length).fill(0);
    state.cells.forEach((v, i) => {
      if (v === BULB && !p.wall[i]) for (const j of lineOfSight(p, i)) lit[j]++;
    });
    return lit;
  }

  const countUnlit = (puzzle, state) => {
    const p = parsePuzzle(puzzle);
    return litMap(p, state).filter((n, i) => n === 0 && !p.wall[i]).length;
  };

  // For each cell: null for white cells and unnumbered walls, otherwise for a
  // numbered wall 'done' (exactly its count), 'over' (too many bulbs), 'short'
  // (even if every open neighbor got a bulb it could not reach its number) or
  // 'open' (still possible).
  function wallStatus(puzzle, state) {
    const p = parsePuzzle(puzzle);
    const { size } = p;
    return state.cells.map((_, i) => {
      if (!p.wall[i] || p.num[i] < 0) return null;
      let bulbs = 0;
      let empties = 0;
      for (const [dr, dc] of DIRS) {
        const r = Math.floor(i / size) + dr;
        const c = (i % size) + dc;
        if (r < 0 || c < 0 || r >= size || c >= size || p.wall[r * size + c]) continue;
        const v = state.cells[r * size + c];
        if (v === BULB) bulbs++;
        else if (v === EMPTY) empties++;
      }
      if (bulbs > p.num[i]) return 'over';
      if (bulbs + empties < p.num[i]) return 'short';
      return bulbs === p.num[i] ? 'done' : 'open';
    });
  }

  // Sorted indexes of bulbs that see another bulb, plus numbered walls that
  // have too many bulbs or can no longer reach their number.
  function findConflicts(puzzle, state) {
    const p = parsePuzzle(puzzle);
    const bad = new Set();
    state.cells.forEach((v, i) => {
      if (v !== BULB) return;
      if (lineOfSight(p, i).some((j) => j !== i && state.cells[j] === BULB)) bad.add(i);
    });
    wallStatus(p, state).forEach((s, i) => { if (s === 'over' || s === 'short') bad.add(i); });
    return [...bad].sort((a, b) => a - b);
  }

  function isSolved(puzzle, state) {
    const p = parsePuzzle(puzzle);
    if (countUnlit(p, state) > 0) return false;
    if (findConflicts(p, state).length > 0) return false;
    return wallStatus(p, state).every((s) => s === null || s === 'done');
  }

  const serialize = (state) => JSON.stringify({ size: state.size, cells: state.cells });

  // Returns a state, or null when the text is not a valid save for this puzzle.
  function deserialize(json, puzzle) {
    const p = parsePuzzle(puzzle);
    let data;
    try { data = JSON.parse(json); } catch (e) { return null; }
    if (!data || data.size !== p.size || !Array.isArray(data.cells)
        || data.cells.length !== p.size * p.size || !data.cells.every((v) => VALUES.includes(v))
        || data.cells.some((v, i) => v !== EMPTY && p.wall[i])) {
      return null;
    }
    return { size: p.size, cells: data.cells.slice() };
  }

  const api = {
    EMPTY, BULB, DOT,
    parsePuzzle, createState, getCell, setCell, cycleCell, markDot, clearBoard,
    lineOfSight, litMap, countUnlit, wallStatus, findConflicts, isSolved, serialize, deserialize,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LightUpLogic = api;
})(this);
