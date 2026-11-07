// Futoshiki game state and rules, free of DOM. Loaded as a plain <script>
// (window.FutoshikiLogic) or via require() in Node. Cells are indexes 0..n*n-1,
// row by row. Notes are bitmasks (bit d-1 = digit d). Functions return new
// state and never mutate their arguments.
(function (root) {
  const LEVELS = ['easy', 'medium', 'hard'];
  const SAVE_VERSION = 1;

  // Stored puzzle: { id, difficulty, size, givens: 'n*n chars, . = empty',
  //   h: 'n*(n-1) chars, sign between a square and the one to its right',
  //   v: '(n-1)*n chars, sign between a square and the one below it',
  //   solution: 'n*n digits' }. A sign '<' means the first square is smaller.
  function withConstraints(p) {
    const n = p.size;
    const lt = [];
    const add = (a, b, ch) => { if (ch === '<') lt.push([a, b]); else if (ch === '>') lt.push([b, a]); };
    for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) add(r * n + c, r * n + c + 1, p.h[r * (n - 1) + c]);
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) add(r * n + c, (r + 1) * n + c, p.v[r * n + c]);
    return Object.assign({}, p, { lt });
  }

  function normalisePuzzle(p) {
    return withConstraints({
      id: p.id,
      difficulty: p.difficulty,
      size: p.size,
      givens: String(p.givens).split('').map((ch) => (ch === '.' ? 0 : Number(ch))),
      h: p.h,
      v: p.v,
      solution: String(p.solution).split('').map(Number),
    });
  }

  const signOk = (a, b, ch) => !a || !b || ch === '.' || (ch === '<' ? a < b : a > b);

  function createGame(puzzle) {
    const total = puzzle.size * puzzle.size;
    const values = puzzle.givens.slice();
    return {
      puzzleId: puzzle.id,
      size: puzzle.size,
      values,
      notes: new Array(total).fill(0),
      given: values.map((d) => d > 0),
    };
  }

  const validIdx = (state, i) => Number.isInteger(i) && i >= 0 && i < state.values.length;
  const validDigit = (state, d) => Number.isInteger(d) && d >= 1 && d <= state.size;
  const hasNote = (state, idx, d) => (state.notes[idx] & (1 << (d - 1))) !== 0;
  const noteDigits = (state, idx) => {
    const out = [];
    for (let d = 1; d <= state.size; d++) if (hasNote(state, idx, d)) out.push(d);
    return out;
  };

  function place(state, idx, d) {
    const n = state.size;
    const values = state.values.slice();
    const notes = state.notes.slice();
    values[idx] = d;
    notes[idx] = 0;
    if (d) {
      const bit = ~(1 << (d - 1));
      const r = Math.floor(idx / n), c = idx % n;
      for (let k = 0; k < n; k++) { notes[r * n + k] &= bit; notes[k * n + c] &= bit; }
    }
    return Object.assign({}, state, { values, notes });
  }

  function setDigit(state, idx, d) {
    if (!validIdx(state, idx) || !validDigit(state, d) || state.given[idx]) return state;
    return place(state, idx, state.values[idx] === d ? 0 : d);
  }

  function toggleNote(state, idx, d) {
    if (!validIdx(state, idx) || !validDigit(state, d) || state.given[idx] || state.values[idx]) return state;
    const notes = state.notes.slice();
    notes[idx] ^= 1 << (d - 1);
    return Object.assign({}, state, { notes });
  }

  function erase(state, idx) {
    if (!validIdx(state, idx) || state.given[idx]) return state;
    if (!state.values[idx] && !state.notes[idx]) return state;
    const values = state.values.slice();
    const notes = state.notes.slice();
    values[idx] = 0;
    notes[idx] = 0;
    return Object.assign({}, state, { values, notes });
  }

  // Signs that are false for the numbers placed so far: [{ kind: 'h'|'v', r, c }].
  function brokenSigns(state, puzzle) {
    const n = puzzle.size, out = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n - 1; c++) {
        if (!signOk(state.values[r * n + c], state.values[r * n + c + 1], puzzle.h[r * (n - 1) + c])) out.push({ kind: 'h', r, c });
      }
    }
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n; c++) {
        if (!signOk(state.values[r * n + c], state.values[(r + 1) * n + c], puzzle.v[r * n + c])) out.push({ kind: 'v', r, c });
      }
    }
    return out;
  }

  // Cells that repeat a number in their row or column, or touch a broken sign.
  function conflicts(state, puzzle) {
    const n = puzzle.size, bad = new Set();
    for (let a = 0; a < n; a++) {
      for (const cell of [(k) => a * n + k, (k) => k * n + a]) {
        const seen = new Map();
        for (let k = 0; k < n; k++) {
          const i = cell(k), d = state.values[i];
          if (!d) continue;
          if (seen.has(d)) { bad.add(i); bad.add(seen.get(d)); } else seen.set(d, i);
        }
      }
    }
    for (const s of brokenSigns(state, puzzle)) {
      const i = s.r * n + s.c;
      bad.add(i);
      bad.add(s.kind === 'h' ? i + 1 : i + n);
    }
    return Array.from(bad).sort((a, b) => a - b);
  }

  function isSolved(state, puzzle) {
    return state.values.every((d) => d > 0) && conflicts(state, puzzle).length === 0;
  }

  function wrongCells(state, puzzle) {
    const out = [];
    state.values.forEach((d, i) => { if (d && d !== puzzle.solution[i]) out.push(i); });
    return out;
  }

  // Fills the selected square (if editable and not already right), else the
  // first wrong square, else the first empty one. idx -1 means nothing to do.
  function hint(state, puzzle, selected) {
    const needs = (i) => validIdx(state, i) && !state.given[i] && state.values[i] !== puzzle.solution[i];
    let idx = -1;
    if (needs(selected)) idx = selected;
    else {
      idx = wrongCells(state, puzzle).find((i) => !state.given[i]);
      if (idx === undefined) idx = state.values.findIndex((d, i) => needs(i));
    }
    if (idx < 0) return { idx: -1, state };
    return { idx, state: place(state, idx, puzzle.solution[idx]) };
  }

  function digitCounts(state, size) {
    const counts = new Array(size + 1).fill(0);
    for (const d of state.values) if (d) counts[d]++;
    return counts;
  }

  function toSave(state) {
    return { v: SAVE_VERSION, values: state.values.slice(), notes: state.notes.slice() };
  }

  function fromSave(save, puzzle) {
    const total = puzzle.size * puzzle.size;
    if (!save || save.v !== SAVE_VERSION || !Array.isArray(save.values) || !Array.isArray(save.notes)) return null;
    if (save.values.length !== total || save.notes.length !== total) return null;
    const maxNote = (1 << puzzle.size) - 1;
    if (!save.values.every((d) => Number.isInteger(d) && d >= 0 && d <= puzzle.size)) return null;
    if (!save.notes.every((m) => Number.isInteger(m) && m >= 0 && m <= maxNote)) return null;
    const game = createGame(puzzle);
    if (!game.given.every((g, i) => !g || save.values[i] === game.values[i])) return null;
    return Object.assign(game, { values: save.values.slice(), notes: save.notes.slice() });
  }

  function levelCounts(list) {
    const counts = { easy: 0, medium: 0, hard: 0 };
    for (const p of list) if (counts[p.difficulty] !== undefined) counts[p.difficulty]++;
    return counts;
  }

  const getPuzzle = (list, id) => list.find((p) => p.id === id) || null;
  const levelOrder = (level) => {
    const i = LEVELS.indexOf(level);
    return LEVELS.slice(i).concat(LEVELS.slice(0, i));
  };

  const api = {
    LEVELS, normalisePuzzle, withConstraints, signOk, createGame, setDigit, toggleNote, erase, brokenSigns,
    conflicts, isSolved, wrongCells, hint, digitCounts, toSave, fromSave, levelCounts, getPuzzle,
    levelOrder, hasNote, noteDigits,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FutoshikiLogic = api;
})(typeof self !== 'undefined' ? self : this);
