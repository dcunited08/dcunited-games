// Jigsaw Sudoku game state and rules, free of DOM. Loaded as a plain <script>
// (window.JigsawLogic) or via require() in Node. Cells are indexes 0-80, row by
// row. Notes are bitmasks (bit d-1 = digit d). Functions return new state and
// never mutate their arguments. A "shape" is one of the nine irregular regions.
(function (root) {
  const LEVELS = ['easy', 'medium', 'hard'];
  const SAVE_VERSION = 1;

  const row = (i) => Math.floor(i / 9);
  const col = (i) => i % 9;
  const sees = (regions, a, b) => row(a) === row(b) || col(a) === col(b) || regions[a] === regions[b];
  const validIdx = (i) => Number.isInteger(i) && i >= 0 && i < 81;
  const validDigit = (d) => Number.isInteger(d) && d >= 1 && d <= 9;

  // Expands a stored puzzle ({ regions: '81 digits 0-8', givens: '81 digits', solution: '81 digits' }).
  function normalisePuzzle(p) {
    const givens = {};
    String(p.givens).split('').forEach((ch, i) => { if (ch !== '0') givens[i] = Number(ch); });
    return {
      id: p.id,
      difficulty: p.difficulty,
      regions: String(p.regions).split('').map(Number),
      givens,
      solution: String(p.solution).split('').map(Number),
    };
  }

  // The state keeps a shared reference to the shape layout so setDigit can
  // clear shape notes without being handed the puzzle.
  function createGame(puzzle) {
    const values = new Array(81).fill(0);
    const given = new Array(81).fill(false);
    for (const [k, d] of Object.entries(puzzle.givens)) {
      values[Number(k)] = d;
      given[Number(k)] = true;
    }
    return { puzzleId: puzzle.id, values, notes: new Array(81).fill(0), given, regions: puzzle.regions };
  }

  const regionOf = (puzzle, idx) => (validIdx(idx) ? puzzle.regions[idx] : -1);
  const hasNote = (state, idx, d) => (state.notes[idx] & (1 << (d - 1))) !== 0;
  const noteDigits = (state, idx) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => hasNote(state, idx, d));

  // Sets a digit (no checks) and strips it from the notes of every peer.
  function place(state, idx, d) {
    const values = state.values.slice();
    const notes = state.notes.slice();
    values[idx] = d;
    notes[idx] = 0;
    if (d) {
      const bit = ~(1 << (d - 1));
      for (let i = 0; i < 81; i++) if (sees(state.regions, i, idx)) notes[i] &= bit;
    }
    return Object.assign({}, state, { values, notes });
  }

  function setDigit(state, idx, d) {
    if (!validIdx(idx) || !validDigit(d) || state.given[idx]) return state;
    return place(state, idx, state.values[idx] === d ? 0 : d);
  }

  function toggleNote(state, idx, d) {
    if (!validIdx(idx) || !validDigit(d) || state.given[idx] || state.values[idx]) return state;
    const notes = state.notes.slice();
    notes[idx] ^= 1 << (d - 1);
    return Object.assign({}, state, { notes });
  }

  function erase(state, idx) {
    if (!validIdx(idx) || state.given[idx]) return state;
    if (!state.values[idx] && !state.notes[idx]) return state;
    const values = state.values.slice();
    const notes = state.notes.slice();
    values[idx] = 0;
    notes[idx] = 0;
    return Object.assign({}, state, { values, notes });
  }

  // Sorted cell indexes whose digit repeats in their row, column or shape.
  function conflicts(state, puzzle) {
    const bad = new Set();
    const v = state.values;
    for (let a = 0; a < 81; a++) {
      if (!v[a]) continue;
      for (let b = a + 1; b < 81; b++) {
        if (v[b] === v[a] && sees(puzzle.regions, a, b)) { bad.add(a); bad.add(b); }
      }
    }
    return [...bad].sort((a, b) => a - b);
  }

  const isSolved = (state, puzzle) => state.values.every((d) => d > 0) && conflicts(state, puzzle).length === 0;

  // Fills one cell with the solution digit. Prefers `idx` when it is empty or wrong.
  function hint(state, puzzle, idx) {
    const needs = (i) => !state.given[i] && state.values[i] !== puzzle.solution[i];
    let target = validIdx(idx) && needs(idx) ? idx : -1;
    for (let i = 0; target < 0 && i < 81; i++) if (needs(i)) target = i;
    if (target < 0) return { state, idx: -1 };
    return { state: place(state, target, puzzle.solution[target]), idx: target };
  }

  // counts[d] = how many times digit d is on the board (index 0 unused).
  function digitCounts(state) {
    const counts = new Array(10).fill(0);
    for (const d of state.values) if (d) counts[d]++;
    return counts;
  }

  function toSave(state) {
    return {
      v: SAVE_VERSION,
      puzzleId: state.puzzleId,
      values: state.values.slice(),
      notes: state.notes.slice(),
      given: state.given.slice(),
    };
  }

  const isArr = (a, test) => Array.isArray(a) && a.length === 81 && a.every(test);

  // Pass the puzzle to restore the shape layout; a save for another puzzle gives null.
  function fromSave(obj, puzzle) {
    let o = obj;
    if (typeof o === 'string') {
      try { o = JSON.parse(o); } catch (e) { return null; }
    }
    if (!o || typeof o !== 'object' || o.v !== SAVE_VERSION || typeof o.puzzleId !== 'string') return null;
    if (!isArr(o.values, (d) => Number.isInteger(d) && d >= 0 && d <= 9)) return null;
    if (!isArr(o.notes, (n) => Number.isInteger(n) && n >= 0 && n <= 511)) return null;
    if (!isArr(o.given, (g) => typeof g === 'boolean')) return null;
    if (puzzle && puzzle.id !== o.puzzleId) return null;
    const state = { puzzleId: o.puzzleId, values: o.values.slice(), notes: o.notes.slice(), given: o.given.slice() };
    if (puzzle) state.regions = puzzle.regions;
    return state;
  }

  // Which sides of each cell touch another shape (or the board edge): where the thick line goes.
  function regionBorders(puzzle) {
    const g = puzzle.regions;
    const out = [];
    for (let i = 0; i < 81; i++) {
      const r = row(i), c = col(i);
      out.push({
        t: r === 0 || g[i - 9] !== g[i],
        r: c === 8 || g[i + 1] !== g[i],
        b: r === 8 || g[i + 9] !== g[i],
        l: c === 0 || g[i - 1] !== g[i],
      });
    }
    return out;
  }

  // Cells that share a row, column or shape with idx (including idx), sorted.
  function relatedCells(puzzle, idx) {
    if (!validIdx(idx)) return [];
    const out = [];
    for (let i = 0; i < 81; i++) if (sees(puzzle.regions, i, idx)) out.push(i);
    return out;
  }

  // Filled, non-given cells whose digit differs from the solution.
  function wrongCells(state, puzzle) {
    const out = [];
    for (let i = 0; i < 81; i++) {
      if (!state.given[i] && state.values[i] && state.values[i] !== puzzle.solution[i]) out.push(i);
    }
    return out;
  }

  // Levels to try for "Next puzzle": this level first, then the others in order.
  function levelOrder(level) {
    const at = LEVELS.indexOf(level);
    return at < 0 ? LEVELS.slice() : LEVELS.slice(at).concat(LEVELS.slice(0, at));
  }

  const getPuzzle = (list, id) => list.find((p) => p.id === id) || null;

  function levelCounts(list) {
    const counts = {};
    for (const l of LEVELS) counts[l] = list.filter((p) => p.difficulty === l).length;
    return counts;
  }

  const api = {
    LEVELS, normalisePuzzle, createGame, setDigit, toggleNote, erase, conflicts, isSolved,
    hint, digitCounts, regionOf, hasNote, noteDigits, toSave, fromSave,
    getPuzzle, levelCounts, regionBorders, relatedCells, wrongCells, levelOrder,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JigsawLogic = api;
})(this);
