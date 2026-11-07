// Nonogram line solver, free of DOM. Loaded as a plain <script> (window.NonogramSolver)
// and via require() in Node tests. Proves puzzles can be solved by line logic alone.
//
// Solver cells: 0 unknown, 1 filled, 2 empty. A line with no filled cells has
// the clue [].
(function (root) {
  const UNKNOWN = 0;
  const FILLED = 1;
  const EMPTY = 2;

  // Run lengths of the truthy cells in a line.
  function clues(lineCells) {
    const out = [];
    let run = 0;
    for (const c of lineCells) {
      if (c) run++;
      else if (run) { out.push(run); run = 0; }
    }
    if (run) out.push(run);
    return out;
  }

  // Given a clue and a line of UNKNOWN/FILLED/EMPTY, returns the line with every
  // forced cell set, or null if no placement fits.
  function solveLine(clue, line) {
    const n = line.length;
    const canFill = new Array(n).fill(false);
    const canEmpty = new Array(n).fill(false);
    let found = false;
    const placed = new Array(n).fill(false);

    // suffixFilled[i] = any known-filled cell at index >= i
    const suffixFilled = new Array(n + 1).fill(false);
    for (let i = n - 1; i >= 0; i--) suffixFilled[i] = suffixFilled[i + 1] || line[i] === FILLED;
    // tail[k] = minimum cells needed for clue[k..]
    const tail = new Array(clue.length + 1).fill(0);
    for (let k = clue.length - 1; k >= 0; k--) tail[k] = clue[k] + (k < clue.length - 1 ? 1 : 0) + tail[k + 1];

    function finish(from) {
      if (suffixFilled[from]) return;
      found = true;
      for (let i = 0; i < n; i++) (placed[i] ? canFill : canEmpty)[i] = true;
    }

    function rec(k, pos) {
      if (k === clue.length) { finish(pos); return; }
      const len = clue[k];
      const lastStart = n - tail[k];
      for (let s = pos; s <= lastStart; s++) {
        // cells pos..s-1 stay empty
        let ok = true;
        for (let i = pos; i < s; i++) if (line[i] === FILLED) { ok = false; break; }
        if (!ok) break; // a later start would skip the same filled cell
        for (let i = s; i < s + len; i++) if (line[i] === EMPTY) { ok = false; break; }
        if (!ok) continue;
        if (s + len < n && line[s + len] === FILLED) continue;
        for (let i = s; i < s + len; i++) placed[i] = true;
        // gap cell after the run is empty
        const next = s + len + (k < clue.length - 1 ? 1 : 0);
        rec(k + 1, next);
        for (let i = s; i < s + len; i++) placed[i] = false;
      }
    }
    rec(0, 0);
    if (!found) return null;
    return line.map((v, i) => {
      if (canFill[i] && !canEmpty[i]) return FILLED;
      if (canEmpty[i] && !canFill[i]) return EMPTY;
      return v;
    });
  }

  // Row and column clues for a picture given as strings of '#' and '.'.
  function picture(rows) {
    const grid = rows.map((r) => [...r].map((ch) => (ch === '#' ? 1 : 0)));
    const cols = grid[0].map((_, c) => clues(grid.map((row) => row[c])));
    return { rows: grid.map(clues), cols };
  }

  // Repeats line solving over rows and columns until nothing changes.
  function solvePuzzle(rowClues, colClues) {
    const h = rowClues.length;
    const w = colClues.length;
    const grid = Array.from({ length: h }, () => new Array(w).fill(UNKNOWN));
    let changed = true;
    while (changed) {
      changed = false;
      for (let r = 0; r < h; r++) {
        const res = solveLine(rowClues[r], grid[r]);
        if (!res) return { solved: false, grid: toPlain(grid), contradiction: true };
        for (let c = 0; c < w; c++) if (res[c] !== grid[r][c]) { grid[r][c] = res[c]; changed = true; }
      }
      for (let c = 0; c < w; c++) {
        const res = solveLine(colClues[c], grid.map((row) => row[c]));
        if (!res) return { solved: false, grid: toPlain(grid), contradiction: true };
        for (let r = 0; r < h; r++) if (res[r] !== grid[r][c]) { grid[r][c] = res[r]; changed = true; }
      }
    }
    const solved = grid.every((row) => row.every((v) => v !== UNKNOWN));
    return { solved, grid: toPlain(grid), contradiction: false };
  }

  // 1 for filled, 0 for empty, null for unknown.
  const toPlain = (grid) => grid.map((row) => row.map((v) => (v === FILLED ? 1 : v === EMPTY ? 0 : null)));

  const api = { UNKNOWN, FILLED, EMPTY, clues, solveLine, picture, solvePuzzle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NonogramSolver = api;
})(this);
