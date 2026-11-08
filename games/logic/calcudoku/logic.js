// Calcudoku game state and rules, free of DOM. Loaded as a plain <script>
// (window.CalcudokuLogic) or via require() in Node. Cells are indexes 0..n*n-1,
// row by row. Notes are bitmasks (bit d-1 = number d). Functions return new state
// and never mutate their arguments. Signs are '+', '-', '*', '/' and '' (single cell).
(function (root) {
  const LEVELS = ['easy', 'medium', 'hard'];
  const SAVE_VERSION = 1;
  const SIGNS = { '+': '+', '-': '−', '*': '×', '/': '÷', '': '' };

  // Expands a stored puzzle ({ size, cages: [{ o, t, c }], solution: 'digits' }).
  function normalisePuzzle(p) {
    return {
      id: p.id,
      difficulty: p.difficulty,
      size: p.size,
      cages: p.cages.map((cg) => ({ op: cg.o, target: cg.t, cells: cg.c.slice() })),
      solution: String(p.solution).split('').map(Number),
    };
  }

  function createGame(puzzle) {
    const n = puzzle.size;
    return { puzzleId: puzzle.id, size: n, values: new Array(n * n).fill(0), notes: new Array(n * n).fill(0) };
  }

  const validIdx = (state, i) => Number.isInteger(i) && i >= 0 && i < state.size * state.size;
  const validDigit = (state, d) => Number.isInteger(d) && d >= 1 && d <= state.size;
  const sameLine = (n, a, b) => Math.floor(a / n) === Math.floor(b / n) || a % n === b % n;

  const cageOf = (puzzle, idx) => puzzle.cages.find((cg) => cg.cells.includes(idx)) || null;
  const cageLabelCell = (cage) => Math.min(...cage.cells);
  const cageLabel = (cage) => String(cage.target) + SIGNS[cage.op];
  const hasNote = (state, idx, d) => (state.notes[idx] & (1 << (d - 1))) !== 0;
  const noteDigits = (state, idx) => {
    const out = [];
    for (let d = 1; d <= state.size; d++) if (hasNote(state, idx, d)) out.push(d);
    return out;
  };

  // True when the numbers meet the cage's sign and target.
  function cageHolds(op, target, vals) {
    if (op === '+') return vals.reduce((a, b) => a + b, 0) === target;
    if (op === '*') return vals.reduce((a, b) => a * b, 1) === target;
    if (op === '-') return Math.abs(vals[0] - vals[1]) === target;
    if (op === '/') return Math.max(vals[0], vals[1]) === target * Math.min(vals[0], vals[1]);
    return vals[0] === target;
  }

  // Sets a number (no checks) and strips it from the notes of its row and column.
  function place(state, idx, d) {
    const n = state.size;
    const values = state.values.slice();
    const notes = state.notes.slice();
    values[idx] = d;
    notes[idx] = 0;
    if (d) {
      const bit = ~(1 << (d - 1));
      for (let i = 0; i < n * n; i++) if (sameLine(n, i, idx)) notes[i] &= bit;
    }
    return Object.assign({}, state, { values, notes });
  }

  function setDigit(state, idx, d) {
    if (!validIdx(state, idx) || !validDigit(state, d)) return state;
    return place(state, idx, state.values[idx] === d ? 0 : d);
  }

  function toggleNote(state, idx, d) {
    if (!validIdx(state, idx) || !validDigit(state, d) || state.values[idx]) return state;
    const notes = state.notes.slice();
    notes[idx] ^= 1 << (d - 1);
    return Object.assign({}, state, { notes });
  }

  function erase(state, idx) {
    if (!validIdx(state, idx)) return state;
    if (!state.values[idx] && !state.notes[idx]) return state;
    const values = state.values.slice();
    const notes = state.notes.slice();
    values[idx] = 0;
    notes[idx] = 0;
    return Object.assign({}, state, { values, notes });
  }

  // Sorted cell indexes that break a rule: repeats in a row or column, and full cages off target.
  function conflicts(state, puzzle) {
    const n = state.size, v = state.values;
    const bad = new Set();
    for (let a = 0; a < n * n; a++) {
      if (!v[a]) continue;
      for (let b = a + 1; b < n * n; b++) {
        if (v[b] === v[a] && sameLine(n, a, b)) { bad.add(a); bad.add(b); }
      }
    }
    for (const cg of puzzle.cages) {
      const vals = cg.cells.map((i) => v[i]);
      if (vals.every(Boolean) && !cageHolds(cg.op, cg.target, vals)) cg.cells.forEach((i) => bad.add(i));
    }
    return [...bad].sort((a, b) => a - b);
  }

  const isSolved = (state, puzzle) => state.values.every((d) => d > 0) && conflicts(state, puzzle).length === 0;

  // Fills one cell with the answer. Prefers `idx` when it is empty or wrong.
  function hint(state, puzzle, idx) {
    const needs = (i) => state.values[i] !== puzzle.solution[i];
    let target = validIdx(state, idx) && needs(idx) ? idx : -1;
    for (let i = 0; target < 0 && i < state.values.length; i++) if (needs(i)) target = i;
    if (target < 0) return { state, idx: -1 };
    return { state: place(state, target, puzzle.solution[target]), idx: target };
  }

  // counts[d] = how many times number d is on the board (index 0 unused).
  function digitCounts(state) {
    const counts = new Array(state.size + 1).fill(0);
    for (const d of state.values) if (d) counts[d]++;
    return counts;
  }

  function toSave(state) {
    return { v: SAVE_VERSION, puzzleId: state.puzzleId, size: state.size, values: state.values.slice(), notes: state.notes.slice() };
  }

  // A save for another puzzle (or a damaged one) gives null.
  function fromSave(obj, puzzle) {
    let o = obj;
    if (typeof o === 'string') {
      try { o = JSON.parse(o); } catch (e) { return null; }
    }
    if (!o || typeof o !== 'object' || o.v !== SAVE_VERSION || typeof o.puzzleId !== 'string') return null;
    const n = o.size;
    if (!Number.isInteger(n) || n < 2 || n > 9) return null;
    const isArr = (a, test) => Array.isArray(a) && a.length === n * n && a.every(test);
    if (!isArr(o.values, (d) => Number.isInteger(d) && d >= 0 && d <= n)) return null;
    if (!isArr(o.notes, (m) => Number.isInteger(m) && m >= 0 && m < (1 << n))) return null;
    if (puzzle && (puzzle.id !== o.puzzleId || puzzle.size !== n)) return null;
    return { puzzleId: o.puzzleId, size: n, values: o.values.slice(), notes: o.notes.slice() };
  }

  // Which sides of each cell touch another cage (or the board edge): where the thick outline goes.
  function cageBorders(puzzle) {
    const n = puzzle.size;
    const owner = new Array(n * n).fill(-1);
    puzzle.cages.forEach((cg, k) => cg.cells.forEach((i) => { owner[i] = k; }));
    const out = [];
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n;
      const diff = (ok, j) => !ok || owner[j] !== owner[i];
      out.push({ t: diff(r > 0, i - n), r: diff(c < n - 1, i + 1), b: diff(r < n - 1, i + n), l: diff(c > 0, i - 1) });
    }
    return out;
  }

  // Cells that share a row, column or cage with idx (including idx), sorted.
  function relatedCells(puzzle, idx) {
    const n = puzzle.size;
    if (!Number.isInteger(idx) || idx < 0 || idx >= n * n) return [];
    const cage = cageOf(puzzle, idx);
    const out = [];
    for (let i = 0; i < n * n; i++) if (sameLine(n, i, idx) || (cage && cage.cells.includes(i))) out.push(i);
    return out;
  }

  // Filled cells whose number differs from the answer.
  function wrongCells(state, puzzle) {
    const out = [];
    for (let i = 0; i < state.values.length; i++) {
      if (state.values[i] && state.values[i] !== puzzle.solution[i]) out.push(i);
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
    LEVELS, normalisePuzzle, createGame, setDigit, toggleNote, erase, conflicts, isSolved, hint,
    digitCounts, cageOf, cageLabelCell, cageLabel, cageHolds, hasNote, noteDigits, toSave, fromSave,
    getPuzzle, levelCounts, cageBorders, relatedCells, wrongCells, levelOrder,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CalcudokuLogic = api;
})(this);
