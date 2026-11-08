// Tents and Trees board rules, kept free of DOM so they can be unit tested.
// Loaded as a plain <script> in the browser (exposes window.TentsLogic) and
// via require() in Node tests.
//
// A puzzle is { grid, rows, cols }: grid is an array of `size` strings made of
// 'T' (tree) and '.' (open ground); rows[r] and cols[c] are the number of
// tents wanted in that row and column. parsePuzzle turns it into
// { size, grid, trees, rows, cols } where trees is a flat row-major boolean list.
// Board state is { size, cells } where cells is a flat row-major array of
// 'empty' | 'grass' | 'tent'. Trees are fixed and always read 'empty' in cells.
// Cell keys everywhere are indexes r * size + c. Functions return new state
// and never mutate their arguments.
(function (root) {
  const EMPTY = 'empty';
  const GRASS = 'grass';
  const TENT = 'tent';
  const VALUES = [EMPTY, GRASS, TENT];
  const CYCLE = { [EMPTY]: GRASS, [GRASS]: TENT, [TENT]: EMPTY };
  const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  // Accepts { grid, rows, cols } or an already parsed puzzle (returned as is).
  // Throws on an invalid puzzle.
  function parsePuzzle(input) {
    if (!input || typeof input !== 'object') throw new Error('Puzzle must be an object');
    if (input.trees) return input;
    const { grid, rows, cols } = input;
    if (!Array.isArray(grid) || !grid.length) throw new Error('Puzzle needs a grid of row strings');
    const size = grid.length;
    if (!grid.every((row) => typeof row === 'string' && row.length === size)) {
      throw new Error('Puzzle must be square');
    }
    if (!grid.every((row) => /^[T.]+$/.test(row))) throw new Error('Grid cells must be T or .');
    const okClues = (list) => Array.isArray(list) && list.length === size
      && list.every((n) => Number.isInteger(n) && n >= 0 && n <= size);
    if (!okClues(rows) || !okClues(cols)) throw new Error('Puzzle needs clues for every row and column');
    const trees = [...grid.join('')].map((ch) => ch === 'T');
    return { size, grid, trees, rows: rows.slice(), cols: cols.slice() };
  }

  const createState = (puzzle) => {
    const size = parsePuzzle(puzzle).size;
    return { size, cells: Array(size * size).fill(EMPTY) };
  };

  const inRange = (size, r, c) => r >= 0 && c >= 0 && r < size && c < size;
  const getCell = (state, r, c) => state.cells[r * state.size + c];

  function setCell(puzzle, state, r, c, value) {
    if (!VALUES.includes(value)) throw new Error(`Bad cell value: ${value}`);
    if (!inRange(state.size, r, c)) throw new Error('Cell out of range');
    const i = r * state.size + c;
    if (parsePuzzle(puzzle).trees[i]) return { size: state.size, cells: state.cells.slice() };
    const cells = state.cells.slice();
    cells[i] = value;
    return { size: state.size, cells };
  }

  const cycleCell = (puzzle, state, r, c) => setCell(puzzle, state, r, c, CYCLE[getCell(state, r, c)]);

  // Drag-to-grass: marks the given [r, c] cells, touching only empty non-tree ones.
  function markGrass(puzzle, state, list) {
    const { trees } = parsePuzzle(puzzle);
    const cells = state.cells.slice();
    for (const [r, c] of list) {
      if (!inRange(state.size, r, c)) continue;
      const i = r * state.size + c;
      if (!trees[i] && cells[i] === EMPTY) cells[i] = GRASS;
    }
    return { size: state.size, cells };
  }

  const clearBoard = (state) => ({ size: state.size, cells: Array(state.cells.length).fill(EMPTY) });

  const tentsOf = (state) => {
    const out = [];
    state.cells.forEach((v, i) => { if (v === TENT) out.push(i); });
    return out;
  };

  // Orthogonal neighbours of cell i that are trees.
  function adjacentTrees(p, i) {
    const r = Math.floor(i / p.size);
    const c = i % p.size;
    const out = [];
    for (const [dr, dc] of ORTHO) {
      if (inRange(p.size, r + dr, c + dc) && p.trees[(r + dr) * p.size + c + dc]) out.push((r + dr) * p.size + c + dc);
    }
    return out;
  }

  function lineCounts(puzzle, state) {
    const n = parsePuzzle(puzzle).size;
    const rows = Array(n).fill(0);
    const cols = Array(n).fill(0);
    for (const i of tentsOf(state)) { rows[Math.floor(i / n)]++; cols[i % n]++; }
    return { rows, cols };
  }

  // 'under' | 'met' | 'over' for every row and column clue.
  function lineStatus(puzzle, state) {
    const p = parsePuzzle(puzzle);
    const counts = lineCounts(p, state);
    const grade = (have, want) => (have === want ? 'met' : have > want ? 'over' : 'under');
    return {
      rows: counts.rows.map((n, i) => grade(n, p.rows[i])),
      cols: counts.cols.map((n, i) => grade(n, p.cols[i])),
    };
  }

  // One-to-one pairing of tents with adjacent trees (bipartite matching).
  // Returns [{ tree, tent }] covering every tree and every tent, or null.
  function pairTrees(puzzle, state) {
    const p = parsePuzzle(puzzle);
    const tents = tentsOf(state);
    const treeCount = p.trees.filter(Boolean).length;
    if (tents.length !== treeCount) return null;
    const owner = new Map(); // tree -> tent
    function assign(tent, seen) {
      for (const tree of adjacentTrees(p, tent)) {
        if (seen.has(tree)) continue;
        seen.add(tree);
        if (!owner.has(tree) || assign(owner.get(tree), seen)) { owner.set(tree, tent); return true; }
      }
      return false;
    }
    for (const tent of tents) if (!assign(tent, new Set())) return null;
    return [...owner].map(([tree, tent]) => ({ tree, tent }));
  }

  // Sorted indexes that break a rule: tents touching another tent (corners
  // too), tents with no tree beside them, tents in a row or column that has
  // too many, and trees that have no room left for a tent.
  function findConflicts(puzzle, state) {
    const p = parsePuzzle(puzzle);
    const n = p.size;
    const tents = tentsOf(state);
    const bad = new Set();
    const status = lineStatus(p, state);
    tents.forEach((a, k) => {
      if (!adjacentTrees(p, a).length) bad.add(a);
      if (status.rows[Math.floor(a / n)] === 'over' || status.cols[a % n] === 'over') bad.add(a);
      for (const b of tents.slice(k + 1)) {
        if (Math.abs(Math.floor(a / n) - Math.floor(b / n)) <= 1 && Math.abs((a % n) - (b % n)) <= 1) {
          bad.add(a);
          bad.add(b);
        }
      }
    });
    p.trees.forEach((isTree, i) => {
      if (!isTree) return;
      const r = Math.floor(i / n);
      const c = i % n;
      const room = ORTHO.some(([dr, dc]) => {
        const j = (r + dr) * n + c + dc;
        return inRange(n, r + dr, c + dc) && !p.trees[j] && state.cells[j] !== GRASS;
      });
      if (!room) bad.add(i);
    });
    return [...bad].sort((a, b) => a - b);
  }

  function isSolved(puzzle, state) {
    const p = parsePuzzle(puzzle);
    const status = lineStatus(p, state);
    if (![...status.rows, ...status.cols].every((s) => s === 'met')) return false;
    const tents = tentsOf(state);
    const n = p.size;
    for (let k = 0; k < tents.length; k++) {
      for (let m = k + 1; m < tents.length; m++) {
        if (Math.abs(Math.floor(tents[k] / n) - Math.floor(tents[m] / n)) <= 1
            && Math.abs((tents[k] % n) - (tents[m] % n)) <= 1) return false;
      }
    }
    return pairTrees(p, state) !== null;
  }

  const serialize = (state) => JSON.stringify({ size: state.size, cells: state.cells });

  // Returns a state, or null when the text is not a valid save for this puzzle.
  function deserialize(json, puzzle) {
    const p = parsePuzzle(puzzle);
    let data;
    try { data = JSON.parse(json); } catch (e) { return null; }
    if (!data || data.size !== p.size || !Array.isArray(data.cells)
        || data.cells.length !== p.size * p.size || !data.cells.every((v) => VALUES.includes(v))
        || data.cells.some((v, i) => p.trees[i] && v !== EMPTY)) {
      return null;
    }
    return { size: p.size, cells: data.cells.slice() };
  }

  const api = {
    EMPTY, GRASS, TENT,
    parsePuzzle, createState, getCell, setCell, cycleCell, markGrass, clearBoard,
    adjacentTrees, lineCounts, lineStatus, pairTrees, findConflicts, isSolved, serialize, deserialize,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TentsLogic = api;
})(this);
