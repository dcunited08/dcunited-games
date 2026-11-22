// Numberlink board rules, kept free of DOM so they can be unit tested. Loaded
// as a plain <script> in the browser (exposes window.NumberlinkLogic) and via
// require() in Node tests.
//
// A puzzle is an array of row strings: '.' is empty, '1'-'9' then 'A', 'B', ...
// are dots, and every id appears exactly twice. Cells are indexes r * size + c.
// Board state is { size, lines } where lines maps each id to the ordered list
// of cells drawn so far, starting on one of that id's dots. State is never
// mutated: every function returns a new state (or the same one when nothing
// changed).
(function (root) {
  const ALPHABET = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const idChar = (i) => ALPHABET[i];

  // Accepts row strings or an already parsed puzzle. Throws on a bad puzzle.
  function parsePuzzle(input) {
    if (input && !Array.isArray(input) && input.dotAt) return input;
    if (!Array.isArray(input)) throw new Error('Puzzle must be an array of row strings');
    const size = input.length;
    if (!input.every((row) => typeof row === 'string' && row.length === size)) throw new Error('Puzzle must be square');
    const dots = {};
    const dotAt = Array(size * size).fill(null);
    input.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.') return;
      if (!ALPHABET.includes(ch)) throw new Error(`Bad character ${ch}`);
      (dots[ch] = dots[ch] || []).push(r * size + c);
      dotAt[r * size + c] = ch;
    }));
    const ids = Object.keys(dots).sort((a, b) => ALPHABET.indexOf(a) - ALPHABET.indexOf(b));
    if (!ids.length) throw new Error('Puzzle needs at least one pair');
    if (!ids.every((id) => dots[id].length === 2)) throw new Error('Every id must appear exactly twice');
    return { size, rows: input.slice(), ids, dots, dotAt };
  }

  function createState(puzzle) {
    const p = parsePuzzle(puzzle);
    const lines = {};
    p.ids.forEach((id) => { lines[id] = []; });
    return { size: p.size, lines };
  }

  const withLines = (state, lines) => ({ size: state.size, lines });
  const copyLines = (lines) => {
    const out = {};
    Object.keys(lines).forEach((id) => { out[id] = lines[id].slice(); });
    return out;
  };

  // Which id's line covers each cell (null when none).
  function ownerMap(puzzle, state) {
    const owner = Array(state.size * state.size).fill(null);
    Object.keys(state.lines).forEach((id) => state.lines[id].forEach((c) => { owner[c] = id; }));
    return owner;
  }

  const filledCount = (state) => Object.values(state.lines).reduce((n, line) => n + line.length, 0);

  function isJoined(puzzle, state, id) {
    const line = state.lines[id];
    const [a, b] = parsePuzzle(puzzle).dots[id];
    if (line.length < 2) return false;
    const first = line[0];
    const last = line[line.length - 1];
    return (first === a && last === b) || (first === b && last === a);
  }

  const allJoined = (puzzle, state) => parsePuzzle(puzzle).ids.every((id) => isJoined(puzzle, state, id));

  const isSolved = (puzzle, state) =>
    allJoined(puzzle, state) && filledCount(state) === state.size * state.size;

  // 'solved', 'joined' (every pair linked but squares left empty) or 'open'.
  function status(puzzle, state) {
    if (!allJoined(puzzle, state)) return 'open';
    return filledCount(state) === state.size * state.size ? 'solved' : 'joined';
  }

  const adjacent = (n, a, b) => {
    const dr = Math.abs(Math.floor(a / n) - Math.floor(b / n));
    const dc = Math.abs((a % n) - (b % n));
    return dr + dc === 1;
  };

  // --- drawing -------------------------------------------------------------

  // Start a stroke on cell. Returns { state, stroke } or null when the cell is
  // neither a dot nor part of a line. A dot starts its line afresh; any other
  // line cell cuts that line back to the cell and continues from there.
  function beginStroke(puzzle, state, cell) {
    const p = parsePuzzle(puzzle);
    const lines = copyLines(state.lines);
    const dotId = p.dotAt[cell];
    if (dotId) {
      lines[dotId] = [cell];
      return { state: withLines(state, lines), stroke: { id: dotId, done: false, moved: false } };
    }
    const id = p.ids.find((k) => lines[k].includes(cell));
    if (!id) return null;
    lines[id] = lines[id].slice(0, lines[id].indexOf(cell) + 1);
    return { state: withLines(state, lines), stroke: { id, done: false, moved: false } };
  }

  // One step onto a cell next to the line's end. Returns { state, stroke } or null if not allowed.
  function stepOnce(p, state, stroke, cell) {
    const line = state.lines[stroke.id];
    if (!adjacent(state.size, line[line.length - 1], cell)) return null;
    const dotId = p.dotAt[cell];
    if (dotId && dotId !== stroke.id) return null;
    const lines = copyLines(state.lines);
    const at = line.indexOf(cell);
    if (at >= 0) {
      lines[stroke.id] = line.slice(0, at + 1);
      return { state: withLines(state, lines), stroke: { ...stroke, moved: true } };
    }
    const other = p.ids.find((k) => k !== stroke.id && lines[k].includes(cell));
    if (other) lines[other] = lines[other].slice(0, lines[other].indexOf(cell));
    lines[stroke.id] = line.concat(cell);
    return { state: withLines(state, lines), stroke: { ...stroke, moved: true, done: dotId === stroke.id } };
  }

  // The cells to walk through to get from one cell to a farther one: straight
  // lines are filled in, a diagonal neighbour goes round a corner (preferring a
  // corner that does not cut another line). null when there is no sensible route.
  function route(p, state, stroke, from, to) {
    const n = state.size;
    const [r1, c1, r2, c2] = [Math.floor(from / n), from % n, Math.floor(to / n), to % n];
    if (r1 === r2 || c1 === c2) {
      const out = [];
      const dr = Math.sign(r2 - r1);
      const dc = Math.sign(c2 - c1);
      for (let r = r1 + dr, c = c1 + dc; r !== r2 || c !== c2; r += dr, c += dc) out.push(r * n + c);
      return out.concat(to);
    }
    if (Math.abs(r1 - r2) !== 1 || Math.abs(c1 - c2) !== 1) return null;
    const corners = [r1 * n + c2, r2 * n + c1].filter((k) => !p.dotAt[k] || p.dotAt[k] === stroke.id);
    const owned = (k) => Object.keys(state.lines).some((id) => id !== stroke.id && state.lines[id].includes(k));
    const best = corners.find((k) => !owned(k)) ?? corners[0];
    return best === undefined ? null : [best, to];
  }

  // Move the stroke to cell (which may be several cells away on a fast drag).
  function stepStroke(puzzle, state, stroke, cell) {
    const p = parsePuzzle(puzzle);
    const n = state.size;
    const line = state.lines[stroke.id];
    const tail = line[line.length - 1];
    if (stroke.done || !(cell >= 0 && cell < n * n) || cell === tail) return { state, stroke };
    const cells = adjacent(n, tail, cell) ? [cell] : route(p, state, stroke, tail, cell);
    let cur = { state, stroke };
    for (const k of cells || []) {
      if (cur.stroke.done) break;
      const next = stepOnce(p, cur.state, cur.stroke, k);
      if (!next) break;
      cur = next;
    }
    return cur;
  }

  // End of a stroke: a line of just one dot is no line at all.
  function finishStroke(state) {
    const lines = copyLines(state.lines);
    Object.keys(lines).forEach((id) => { if (lines[id].length < 2) lines[id] = []; });
    return withLines(state, lines);
  }

  // A whole stroke in one call: begin on cells[0], move through the rest, finish.
  function applyStroke(puzzle, state, cells) {
    const begun = beginStroke(puzzle, state, cells[0]);
    if (!begun) return state;
    let cur = begun;
    for (const cell of cells.slice(1)) cur = stepStroke(puzzle, cur.state, cur.stroke, cell);
    return finishStroke(cur.state);
  }

  const clearAll = (puzzle) => createState(puzzle);

  // --- checking and hints --------------------------------------------------

  // Sorted cells on a line whose id differs from the answer's id there.
  // `solution` maps each id to its full path.
  function findMistakes(puzzle, state, solution) {
    const answer = ownerMap(puzzle, { size: state.size, lines: solution });
    const bad = [];
    Object.keys(state.lines).forEach((id) => state.lines[id].forEach((c) => { if (answer[c] !== id) bad.push(c); }));
    return bad.sort((a, b) => a - b);
  }

  function sameLine(line, path) {
    if (line.length !== path.length) return false;
    return line.every((c, i) => c === path[i]) || line.every((c, i) => c === path[path.length - 1 - i]);
  }

  // Redraw one not-yet-correct id from the answer. Returns { state, id, reason } or null.
  function hint(puzzle, state, solution) {
    const p = parsePuzzle(puzzle);
    const wrong = p.ids.filter((id) => !sameLine(state.lines[id], solution[id]));
    if (!wrong.length) return null;
    const answer = ownerMap(p, { size: state.size, lines: solution });
    const hasMistake = (id) => state.lines[id].some((c) => answer[c] !== id);
    const drawn = (id) => state.lines[id].length > 0;
    const id = wrong.find(hasMistake) || wrong.find(drawn) || wrong[0];
    const path = solution[id];
    const lines = copyLines(state.lines);
    p.ids.forEach((k) => {
      if (k === id) return;
      const hit = lines[k].findIndex((c) => path.includes(c));
      if (hit >= 0) lines[k] = hit < 2 ? [] : lines[k].slice(0, hit);
    });
    lines[id] = path.slice();
    const reason = hasMistake(id)
      ? `Line ${id} took a wrong turn, so it was redrawn.`
      : `Here is the way for line ${id}.`;
    return { state: withLines(state, lines), id, reason };
  }

  // --- saves ---------------------------------------------------------------

  // Returns a state for lines (a map of id to cell list), or null if it is not
  // a valid set of lines for this puzzle.
  function validateLines(puzzle, lines) {
    const p = parsePuzzle(puzzle);
    const n = p.size;
    if (!lines || typeof lines !== 'object' || Array.isArray(lines)) return null;
    const out = {};
    p.ids.forEach((id) => { out[id] = []; });
    const used = new Set();
    for (const id of Object.keys(lines)) {
      const line = lines[id];
      if (!p.ids.includes(id) || !Array.isArray(line)) return null;
      if (line.length === 0) continue;
      if (line.length < 2 || !line.every((c) => Number.isInteger(c) && c >= 0 && c < n * n)) return null;
      if (!p.dots[id].includes(line[0])) return null;
      const end = p.dots[id].find((c) => c !== line[0]);
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (used.has(c)) return null;
        used.add(c);
        if (i > 0 && !adjacent(n, line[i - 1], c)) return null;
        if (i > 0 && p.dotAt[c] && (p.dotAt[c] !== id || c !== end || i !== line.length - 1)) return null;
      }
      out[id] = line.slice();
    }
    return { size: n, lines: out };
  }

  const api = {
    idChar, parsePuzzle, createState, ownerMap, filledCount, isJoined, allJoined, isSolved, status,
    beginStroke, stepStroke, finishStroke, applyStroke, clearAll, findMistakes, hint, validateLines,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NumberlinkLogic = api;
})(this);
