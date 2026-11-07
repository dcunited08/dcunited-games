// Binairo board rules, kept free of DOM so they can be unit tested. Loaded as a
// plain <script> in the browser (exposes window.BinairoLogic) and via require()
// in Node tests.
//
// A puzzle is an array of row strings: '.' empty, '0' sun, '1' moon. Board
// state is { size, cells, given } where cells is a flat row-major array of
// 'empty' | 'sun' | 'moon' and given[i] says the square is a locked clue.
// Cell keys everywhere are indexes r * size + c. All functions return new
// state and never mutate their arguments.
(function (root) {
  const EMPTY = 'empty';
  const SUN = 'sun';
  const MOON = 'moon';
  const VALUES = [EMPTY, SUN, MOON];
  const CYCLE = { [EMPTY]: SUN, [SUN]: MOON, [MOON]: EMPTY };
  const FROM_CHAR = { '.': EMPTY, 0: SUN, 1: MOON };

  // Returns { size, rows } for a valid puzzle; throws otherwise.
  function parsePuzzle(input) {
    if (!Array.isArray(input)) throw new Error('Puzzle must be an array of row strings');
    if (!input.every((row) => typeof row === 'string')) throw new Error('Rows must be strings');
    const size = input.length;
    if (size < 2 || size % 2 !== 0) throw new Error('Puzzle size must be even');
    if (!input.every((row) => row.length === size)) throw new Error('Puzzle must be square');
    if (!/^[.01]*$/.test(input.join(''))) throw new Error('Puzzle may only use the characters . 0 1');
    return { size, rows: input };
  }

  const createState = (puzzle) => {
    const { size, rows } = parsePuzzle(puzzle);
    const cells = [...rows.join('')].map((ch) => FROM_CHAR[ch]);
    return { size, cells, given: cells.map((v) => v !== EMPTY) };
  };

  const getCell = (state, r, c) => state.cells[r * state.size + c];

  function setCell(state, r, c, value) {
    if (!VALUES.includes(value)) throw new Error(`Bad cell value: ${value}`);
    if (r < 0 || c < 0 || r >= state.size || c >= state.size) throw new Error('Cell out of range');
    const i = r * state.size + c;
    if (state.given[i]) return state;
    const cells = state.cells.slice();
    cells[i] = value;
    return { size: state.size, cells, given: state.given };
  }

  const cycleCell = (state, r, c) => setCell(state, r, c, CYCLE[getCell(state, r, c)]);

  const clearBoard = (state) => ({
    size: state.size,
    cells: state.cells.map((v, i) => (state.given[i] ? v : EMPTY)),
    given: state.given,
  });

  // Index lists for every row and then every column.
  function lines(size) {
    const out = [];
    for (let r = 0; r < size; r++) out.push(Array.from({ length: size }, (_, c) => r * size + c));
    for (let c = 0; c < size; c++) out.push(Array.from({ length: size }, (_, r) => r * size + c));
    return out;
  }

  // Sorted indexes of squares that break a rule: three of one symbol in a
  // line, more than half of one symbol in a line, or a full line identical to
  // another full line of the same direction. The puzzle is only used to check
  // that the state fits it.
  function findConflicts(puzzle, state) {
    const { size } = parsePuzzle(puzzle);
    const bad = new Set();
    const all = lines(size);
    const full = [];
    all.forEach((line, n) => {
      const vals = line.map((i) => state.cells[i]);
      for (let k = 0; k + 2 < size; k++) {
        if (vals[k] !== EMPTY && vals[k] === vals[k + 1] && vals[k] === vals[k + 2]) {
          bad.add(line[k]); bad.add(line[k + 1]); bad.add(line[k + 2]);
        }
      }
      for (const sym of [SUN, MOON]) {
        if (vals.filter((v) => v === sym).length > size / 2) {
          line.forEach((i, k) => { if (vals[k] === sym) bad.add(i); });
        }
      }
      if (!vals.includes(EMPTY)) full.push({ n, line, key: vals.join() });
    });
    full.forEach((a, x) => {
      for (const b of full.slice(x + 1)) {
        if ((a.n < size) === (b.n < size) && a.key === b.key) {
          a.line.forEach((i) => bad.add(i));
          b.line.forEach((i) => bad.add(i));
        }
      }
    });
    return [...bad].sort((a, b) => a - b);
  }

  const isSolved = (puzzle, state) =>
    !state.cells.includes(EMPTY) && findConflicts(puzzle, state).length === 0;

  const serialize = (state) => JSON.stringify({ size: state.size, cells: state.cells });

  // Returns a state, or null when the text is not a valid save for this puzzle
  // (wrong size, bad values, or a clue square that changed).
  function deserialize(json, puzzle) {
    const start = createState(puzzle);
    let data;
    try { data = JSON.parse(json); } catch (e) { return null; }
    if (!data || data.size !== start.size || !Array.isArray(data.cells)
        || data.cells.length !== start.cells.length || !data.cells.every((v) => VALUES.includes(v))) {
      return null;
    }
    if (start.given.some((g, i) => g && data.cells[i] !== start.cells[i])) return null;
    return { size: start.size, cells: data.cells.slice(), given: start.given };
  }

  const api = {
    EMPTY, SUN, MOON,
    parsePuzzle, createState, getCell, setCell, cycleCell, clearBoard,
    findConflicts, isSolved, serialize, deserialize,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BinairoLogic = api;
})(this);
