// Nurikabe board rules, kept free of DOM so they can be unit tested. Loaded as
// a plain <script> in the browser (exposes window.NurikabeLogic) and via
// require() in Node tests.
//
// A puzzle is an array of row strings: '.' is blank, '1'-'9' then 'A'=10,
// 'B'=11 ... (base 36) are island numbers. parsePuzzle turns it into
// { size, clues } with clues a flat row-major array (0 = no number).
// Board state is { size, cells } where cells is a flat row-major array of
// 'empty' | 'sea' | 'dot'. Clue cells stay 'empty' in the state and always
// count as island. Cell keys everywhere are indexes r * size + c.
// All functions return new state and never mutate their arguments.
(function (root) {
  const EMPTY = 'empty';
  const SEA = 'sea';
  const DOT = 'dot';
  const VALUES = [EMPTY, SEA, DOT];
  const CYCLE = { [EMPTY]: SEA, [SEA]: DOT, [DOT]: EMPTY };

  // Accepts an array of row strings or an already parsed puzzle (returned as
  // is). Throws on an invalid puzzle.
  function parsePuzzle(input) {
    if (input && Array.isArray(input.clues)) return input;
    if (!Array.isArray(input)) throw new Error('Puzzle must be an array of row strings');
    const size = input.length;
    if (!input.every((row) => typeof row === 'string' && row.length === size)) {
      throw new Error('Puzzle must be square');
    }
    const clues = [];
    for (const row of input) {
      for (const ch of row) {
        if (ch !== '.' && !/^[1-9A-Z]$/.test(ch)) throw new Error(`Bad clue character: ${ch}`);
        clues.push(ch === '.' ? 0 : parseInt(ch, 36));
      }
    }
    if (clues.reduce((a, b) => a + b, 0) >= size * size) throw new Error('Too many island squares for this board');
    return { size, clues };
  }

  const createState = (puzzle) => {
    const size = parsePuzzle(puzzle).size;
    return { size, cells: Array(size * size).fill(EMPTY) };
  };

  const inRange = (state, r, c) => r >= 0 && c >= 0 && r < state.size && c < state.size;
  const getCell = (state, r, c) => state.cells[r * state.size + c];

  function setCell(puzzle, state, r, c, value) {
    if (!VALUES.includes(value)) throw new Error(`Bad cell value: ${value}`);
    if (!inRange(state, r, c)) throw new Error('Cell out of range');
    const i = r * state.size + c;
    if (parsePuzzle(puzzle).clues[i] || state.cells[i] === value) return state;
    const cells = state.cells.slice();
    cells[i] = value;
    return { size: state.size, cells };
  }

  const cycleCell = (puzzle, state, r, c) => setCell(puzzle, state, r, c, CYCLE[getCell(state, r, c)]);

  // Drag painting: gives every listed [r, c] cell the same value, skipping
  // numbered cells and anything off the board.
  function paint(puzzle, state, list, value) {
    if (!VALUES.includes(value)) throw new Error(`Bad cell value: ${value}`);
    const { clues } = parsePuzzle(puzzle);
    const cells = state.cells.slice();
    for (const [r, c] of list) {
      if (inRange(state, r, c) && !clues[r * state.size + c]) cells[r * state.size + c] = value;
    }
    return { size: state.size, cells };
  }

  const clearBoard = (state) => ({ size: state.size, cells: Array(state.cells.length).fill(EMPTY) });

  function neighbors(size, i) {
    const r = Math.floor(i / size);
    const c = i % size;
    const out = [];
    if (r > 0) out.push(i - size);
    if (r < size - 1) out.push(i + size);
    if (c > 0) out.push(i - 1);
    if (c < size - 1) out.push(i + 1);
    return out;
  }

  // Connected groups of cells for which `member(i)` is true.
  function components(size, member) {
    const comp = Array(size * size).fill(-1);
    const list = [];
    for (let s = 0; s < size * size; s++) {
      if (comp[s] !== -1 || !member(s)) continue;
      const cells = [s];
      comp[s] = list.length;
      for (let k = 0; k < cells.length; k++) {
        for (const n of neighbors(size, cells[k])) {
          if (comp[n] === -1 && member(n)) { comp[n] = list.length; cells.push(n); }
        }
      }
      list.push(cells);
    }
    return { comp, list };
  }

  const pools = (size, isSea) => {
    const out = [];
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const i = r * size + c;
        if (isSea(i) && isSea(i + 1) && isSea(i + size) && isSea(i + size + 1)) out.push([i, i + 1, i + size, i + size + 1]);
      }
    }
    return out;
  };

  // Sorted indexes of cells that break a rule right now:
  //  - sea cells in a 2x2 pool;
  //  - an island group (numbers and dots) joining two numbers or bigger than its number;
  //  - a numbered island walled in (by sea) with too few squares;
  //  - dots in a walled-in group that has no number.
  function findConflicts(puzzle, state) {
    const { size, clues } = parsePuzzle(puzzle);
    const bad = new Set();
    const isSea = (i) => state.cells[i] === SEA;
    pools(size, isSea).forEach((p) => p.forEach((i) => bad.add(i)));

    const sure = components(size, (i) => clues[i] > 0 || state.cells[i] === DOT);
    for (const cells of sure.list) {
      const numbers = cells.filter((i) => clues[i] > 0);
      if (numbers.length > 1 || (numbers.length === 1 && cells.length > clues[numbers[0]])) {
        cells.forEach((i) => bad.add(i));
      }
    }

    const open = components(size, (i) => !isSea(i));
    for (const cells of open.list) {
      const numbers = cells.filter((i) => clues[i] > 0);
      if (numbers.length === 1 && cells.length < clues[numbers[0]]) cells.forEach((i) => bad.add(i));
      if (numbers.length === 0) cells.filter((i) => state.cells[i] === DOT).forEach((i) => bad.add(i));
    }
    return [...bad].sort((a, b) => a - b);
  }

  // Solved when every non-sea group holds exactly one number and has that
  // many squares, the sea is one connected piece, and there is no 2x2 pool.
  // Dots are only notes: any square that is not shaded counts as island.
  function isSolved(puzzle, state) {
    const { size, clues } = parsePuzzle(puzzle);
    const isSea = (i) => state.cells[i] === SEA;
    const islands = components(size, (i) => !isSea(i));
    for (const cells of islands.list) {
      const numbers = cells.filter((i) => clues[i] > 0);
      if (numbers.length !== 1 || cells.length !== clues[numbers[0]]) return false;
    }
    if (components(size, isSea).list.length !== 1) return false;
    return pools(size, isSea).length === 0;
  }

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
    EMPTY, SEA, DOT,
    parsePuzzle, createState, getCell, setCell, cycleCell, paint, clearBoard,
    neighbors, components, findConflicts, isSolved, serialize, deserialize,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NurikabeLogic = api;
})(this);
