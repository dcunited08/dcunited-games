const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');

// Tiny deterministic random numbers for building test puzzles.
function lcg(seed) {
  let a = seed;
  return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
}

function randomPuzzle(size, rand) {
  const rows = [];
  for (let r = 0; r < size; r++) {
    let row = '';
    for (let c = 0; c < size; c++) {
      const x = rand();
      row += x < 0.2 ? '#' : x < 0.3 ? String(Math.floor(rand() * 3)) : '.';
    }
    rows.push(row);
  }
  return rows;
}

// A puzzle with random walls and bulbs, every wall numbered from the bulbs.
function derivedPuzzle(size, rand) {
  const rows = randomPuzzle(size, rand).map((row) => row.replace(/[0-9]/g, '.'));
  const p = L.parsePuzzle(rows);
  let s = L.createState(p);
  for (const i of p.wall.map((_, k) => k).filter((k) => !p.wall[k]).sort(() => rand() - 0.5)) {
    if (L.litMap(p, s)[i] === 0) s = L.setCell(p, s, Math.floor(i / size), i % size, 'bulb');
  }
  return rows.map((row, r) => [...row].map((ch, c) => {
    if (ch !== '#') return ch;
    let n = 0;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const rr = r + dr; const cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < size && cc < size && s.cells[rr * size + cc] === 'bulb') n++;
    }
    return String(n);
  }).join(''));
}

// Counts solutions by trying every set of bulbs.
function bruteCount(rows) {
  const p = L.parsePuzzle(rows);
  const whites = [];
  p.wall.forEach((w, i) => { if (!w) whites.push(i); });
  let count = 0;
  for (let mask = 0; mask < (1 << whites.length); mask++) {
    const cells = Array(p.size * p.size).fill('empty');
    whites.forEach((w, k) => { if (mask & (1 << k)) cells[w] = 'bulb'; });
    if (L.isSolved(p, { size: p.size, cells })) count++;
  }
  return count;
}

test('countSolutions agrees with brute force on random small puzzles', () => {
  const rand = lcg(7);
  const seen = new Set();
  for (let n = 0; n < 80; n++) {
    const rows = randomPuzzle(4 + (n % 2), rand);
    const p = L.parsePuzzle(rows);
    if (p.wall.filter((w) => !w).length > 16) continue;
    const brute = bruteCount(rows);
    seen.add(Math.min(brute, 3));
    assert.equal(S.countSolutions(rows, 1000), brute, rows.join('/'));
    assert.equal(S.countSolutions(rows, 2), Math.min(brute, 2), rows.join('/'));
  }
  assert.ok(seen.has(0) && seen.has(1), 'covers unsolvable and unique puzzles');
});

test('countSolutions stops at the limit', () => {
  assert.equal(S.countSolutions(['...', '.#.', '...'], 2), 2);
  assert.equal(S.countSolutions(['...', '.#.', '...'], 1), 1);
  assert.equal(S.countSolutions(['...', '.#.', '...'], 100), 7);
});

test('impossible puzzles have no solution', () => {
  assert.equal(S.countSolutions(['4.', '..']), 0);
  assert.equal(S.solve(['4.', '..']), null);
  assert.equal(S.hint(['4.', '..'], L.createState(['4.', '..'])), null);
});

test('solve returns the sorted bulb cells of the unique answer', () => {
  const rows = ['.3.', '...', '...'];
  assert.deepEqual(S.solve(rows), [0, 2, 4]);
  assert.equal(S.countSolutions(rows), 1);
});

test('a puzzle that is all walls is solved by no bulbs', () => {
  assert.deepEqual(S.solve(['##', '##']), []);
  assert.equal(S.countSolutions(['##', '##']), 1);
});

const ONE = ['.3.', '...', '...'];

function stateWith(rows, spec) {
  let s = L.createState(rows);
  for (const [r, c, v] of spec) s = L.setCell(rows, s, r, c, v);
  return s;
}

test('hint: a wall that needs every open square', () => {
  const h = S.hint(ONE, L.createState(ONE));
  assert.equal(h.value, 'bulb');
  assert.match(h.reason, /3 needs bulbs in all its open squares/);
  assert.ok([[0, 0], [0, 2], [1, 1]].some(([r, c]) => r === h.r && c === h.c));
});

test('hint: a wall that already has its bulbs', () => {
  const rows = ['##..', '..1#', '..1.', '##..'];
  const s = stateWith(rows, [[0, 2, 'bulb']]);
  const h = S.hint(rows, s);
  assert.deepEqual([h.r, h.c, h.value], [1, 1, 'dot']);
  assert.match(h.reason, /This 1 already has its bulbs/);
});

test('hint: a zero wall means dots', () => {
  const rows = ['.0.', '...', '...'];
  const h = S.hint(rows, L.createState(rows));
  assert.equal(h.value, 'dot');
  assert.match(h.reason, /0/);
});

test('hint: only one square can light a dark square', () => {
  // A white cell boxed in by walls can only be lit by a bulb on itself.
  const rows = ['#.#', '###', '...'];
  const h = S.hint(rows, L.createState(rows));
  assert.equal(h.value, 'bulb');
  assert.match(h.reason, /Nothing else can light this square/);
});

test('hint: a different square is the only way to light a dark square', () => {
  const rows = ['#..', '#.0', '..#'];
  const s = stateWith(rows, [[0, 2, 'dot']]);
  const h = S.hint(rows, s);
  assert.deepEqual([h.r, h.c, h.value], [0, 1, 'bulb']);
  assert.match(h.reason, /Only this square can light the dark square at row 1, column 3/);
});

test('hint: falls back to the answer when no simple rule applies', () => {
  const rows = ['...', '.#.', '...'];
  const s = L.createState(rows);
  const h = S.hint(rows, s);
  assert.equal(h.value, 'bulb');
  assert.match(h.reason, /bulb in the answer/);
  const sol = S.solve(rows);
  assert.ok(sol.includes(h.r * 3 + h.c));
});

test('hint: fixes a wrong bulb first', () => {
  const s = stateWith(ONE, [[2, 2, 'bulb']]);
  const h = S.hint(ONE, s);
  assert.deepEqual([h.r, h.c, h.value], [2, 2, 'empty']);
  assert.match(h.reason, /not part of the solution/);
});

test('hint: fixes a dot on a square that needs a bulb', () => {
  const s = stateWith(ONE, [[1, 1, 'dot']]);
  const h = S.hint(ONE, s);
  assert.deepEqual([h.r, h.c, h.value], [1, 1, 'empty']);
  assert.match(h.reason, /bulb belongs here/);
});

test('hint: null once every bulb is placed', () => {
  const s = stateWith(ONE, [[0, 0, 'bulb'], [0, 2, 'bulb'], [1, 1, 'bulb']]);
  assert.equal(S.hint(ONE, s), null);
});

test('hint: following hints to the end solves the puzzle', () => {
  const rand = lcg(11);
  let checked = 0;
  for (let n = 0; n < 200 && checked < 8; n++) {
    const rows = derivedPuzzle(5, rand);
    if (S.countSolutions(rows) !== 1) continue;
    checked++;
    let s = L.createState(rows);
    for (let step = 0; step < 60 && !L.isSolved(rows, s); step++) {
      const h = S.hint(rows, s);
      assert.ok(h, rows.join('/'));
      s = L.setCell(rows, s, h.r, h.c, h.value === 'empty' ? 'empty' : h.value);
      assert.ok(h.reason.length > 0);
    }
    assert.ok(L.isSolved(rows, s), rows.join('/'));
  }
  assert.ok(checked >= 5);
});

test('difficultyScore: simple rules solve an easy puzzle', () => {
  const d = S.difficultyScore(ONE);
  assert.deepEqual([d.simple, d.solved, d.lookaheads], [true, true, 0]);
});

test('difficultyScore: guessing needed beyond simple rules', () => {
  const d = S.difficultyScore(['...', '.#.', '...']); // 4 answers, so not solvable by logic
  assert.equal(d.simple, false);
  assert.equal(d.solved, false);
});
