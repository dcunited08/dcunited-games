// Nonogram game rules, free of DOM. Loaded as a plain <script> (window.NonogramLogic)
// and via require() in Node tests. All functions return new plain-data state.
//
// A puzzle is { id, name, level, rows: ['.#.', ...] }. Game state is
// { w, h, puzzle, clues, cells } where cells[r][c] is 'empty', 'filled' or 'cross'.
(function (root) {
  const EMPTY = 'empty';
  const FILLED = 'filled';
  const CROSS = 'cross';
  const TOOL_VALUE = { fill: FILLED, cross: CROSS, clear: EMPTY };
  const CHAR = { [EMPTY]: '.', [FILLED]: '#', [CROSS]: 'x' };
  const FROM_CHAR = { '.': EMPTY, '#': FILLED, x: CROSS };

  const runs = (flags) => {
    const out = [];
    let n = 0;
    for (const f of flags) {
      if (f) n++;
      else if (n) { out.push(n); n = 0; }
    }
    if (n) out.push(n);
    return out;
  };
  const picture = (puzzle) => puzzle.rows.map((r) => [...r].map((ch) => ch === '#'));

  function cluesFor(puzzle) {
    const grid = picture(puzzle);
    return {
      rows: grid.map(runs),
      cols: grid[0].map((_, c) => runs(grid.map((row) => row[c]))),
    };
  }

  function createGame(puzzle) {
    const h = puzzle.rows.length;
    const w = puzzle.rows[0].length;
    return {
      w, h, puzzle, clues: cluesFor(puzzle),
      cells: Array.from({ length: h }, () => new Array(w).fill(EMPTY)),
    };
  }

  function applyTool(state, cells, tool) {
    const value = TOOL_VALUE[tool];
    if (value === undefined) throw new Error('Unknown tool: ' + tool);
    const next = state.cells.map((row) => row.slice());
    for (const { r, c } of cells) {
      if (r >= 0 && r < state.h && c >= 0 && c < state.w) next[r][c] = value;
    }
    return { ...state, cells: next };
  }

  // Paint a drag: the first cell always takes the action; the rest change only if
  // they held the same value as the first cell, so a swipe never wipes other marks.
  function dragPaint(state, cells, tool) {
    if (cells.length === 0) return state;
    const first = state.cells[cells[0].r][cells[0].c];
    const same = cells.filter(({ r, c }, i) => i === 0 || state.cells[r][c] === first);
    return applyTool(state, same, tool);
  }

  // What a drag that starts on a cell holding `current` paints.
  function dragAction(current, tool) {
    const same = (tool === 'fill' && current === FILLED) || (tool === 'cross' && current === CROSS);
    return same ? 'clear' : tool;
  }

  // Straight run of cells from start to end, snapped to the dominant axis.
  function lineCells(start, end) {
    const dr = end.r - start.r;
    const dc = end.c - start.c;
    const out = [];
    if (Math.abs(dc) >= Math.abs(dr)) {
      const step = dc < 0 ? -1 : 1;
      for (let c = start.c; c !== end.c + step; c += step) out.push({ r: start.r, c });
    } else {
      const step = dr < 0 ? -1 : 1;
      for (let r = start.r; r !== end.r + step; r += step) out.push({ r, c: start.c });
    }
    return out;
  }

  const sameRuns = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  const rowComplete = (s, r) => sameRuns(runs(s.cells[r].map((v) => v === FILLED)), s.clues.rows[r]);
  const colComplete = (s, c) => sameRuns(runs(s.cells.map((row) => row[c] === FILLED)), s.clues.cols[c]);

  function isSolved(s) {
    for (let r = 0; r < s.h; r++) if (!rowComplete(s, r)) return false;
    for (let c = 0; c < s.w; c++) if (!colComplete(s, c)) return false;
    return true;
  }

  // Filled cells outside the picture, and crosses on picture cells.
  function wrongCells(s) {
    const pic = picture(s.puzzle);
    const out = [];
    for (let r = 0; r < s.h; r++) {
      for (let c = 0; c < s.w; c++) {
        const v = s.cells[r][c];
        if ((v === FILLED && !pic[r][c]) || (v === CROSS && pic[r][c])) out.push({ r, c });
      }
    }
    return out;
  }

  // One cell to fix: a wrong cell first, otherwise an unfilled picture cell
  // (the first, or one chosen with rng). { r, c, value } or null when nothing is left.
  function hintCell(s, rng) {
    const wrong = wrongCells(s);
    if (wrong.length) {
      const { r, c } = wrong[0];
      return { r, c, value: s.cells[r][c] === FILLED ? EMPTY : FILLED };
    }
    const pic = picture(s.puzzle);
    const missing = [];
    for (let r = 0; r < s.h; r++) {
      for (let c = 0; c < s.w; c++) if (pic[r][c] && s.cells[r][c] !== FILLED) missing.push({ r, c });
    }
    if (!missing.length) return null;
    const pick = rng ? missing[Math.floor(rng() * missing.length)] : missing[0];
    return { r: pick.r, c: pick.c, value: FILLED };
  }

  const serialize = (s) => s.cells.map((row) => row.map((v) => CHAR[v]).join('')).join('');

  // Rebuilds a game from a saved string, or null if it doesn't fit the puzzle.
  function deserialize(puzzle, str) {
    if (!puzzle || typeof str !== 'string') return null;
    const state = createGame(puzzle);
    if (str.length !== state.w * state.h) return null;
    for (let i = 0; i < str.length; i++) {
      const v = FROM_CHAR[str[i]];
      if (v === undefined) return null;
      state.cells[Math.floor(i / state.w)][i % state.w] = v;
    }
    return state;
  }

  const api = {
    cluesFor, createGame, applyTool, dragPaint, dragAction, lineCells,
    rowComplete, colComplete, isSolved, wrongCells, hintCell, serialize, deserialize,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NonogramLogic = api;
})(this);
