const test = require('node:test');
const assert = require('node:assert/strict');
const kit = require('./kit.js');

const memory = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
};
const broken = {
  getItem() { throw new Error('no'); },
  setItem() { throw new Error('no'); },
  removeItem() { throw new Error('no'); },
};

test('formatTime formats minutes and seconds', () => {
  assert.equal(kit.formatTime(0), '0:00');
  assert.equal(kit.formatTime(5000), '0:05');
  assert.equal(kit.formatTime(65000), '1:05');
  assert.equal(kit.formatTime(59999), '0:59');
  assert.equal(kit.formatTime(3599000), '59:59');
});

test('formatTime uses h:mm:ss from one hour', () => {
  assert.equal(kit.formatTime(3600000), '1:00:00');
  assert.equal(kit.formatTime(3723000), '1:02:03');
});

test('formatTime guards bad input', () => {
  for (const v of [-1, NaN, Infinity, -Infinity, undefined, 'x']) {
    assert.equal(kit.formatTime(v), '0:00');
  }
});

test('history undoes in reverse order', () => {
  const h = kit.createHistory();
  assert.equal(h.canUndo(), false);
  assert.equal(h.undo(), undefined);
  h.push({ a: 1 });
  h.push({ a: 2 });
  assert.equal(h.canUndo(), true);
  assert.deepEqual(h.undo(), { a: 2 });
  assert.deepEqual(h.undo(), { a: 1 });
  assert.equal(h.canUndo(), false);
});

test('history stores deep copies', () => {
  const h = kit.createHistory();
  const s = { grid: [1, 2] };
  h.push(s);
  s.grid.push(3);
  assert.deepEqual(h.undo(), { grid: [1, 2] });
});

test('history drops the oldest past the limit and can clear', () => {
  const h = kit.createHistory(2);
  h.push(1); h.push(2); h.push(3);
  assert.equal(h.undo(), 3);
  assert.equal(h.undo(), 2);
  assert.equal(h.undo(), undefined);
  h.push(4);
  h.clear();
  assert.equal(h.canUndo(), false);
});

test('default history limit is 500', () => {
  const h = kit.createHistory();
  for (let i = 0; i < 510; i++) h.push(i);
  let n = 0;
  while (h.canUndo()) { h.undo(); n++; }
  assert.equal(n, 500);
});

test('LEVELS lists the three levels', () => {
  assert.deepEqual(kit.LEVELS, ['easy', 'medium', 'hard']);
});

test('puzzleId builds ids and parsePuzzleId reads them back', () => {
  assert.equal(kit.puzzleId('easy', 1), 'easy-1');
  assert.deepEqual(kit.parsePuzzleId('medium-12'), { level: 'medium', n: 12 });
  assert.deepEqual(kit.parsePuzzleId(kit.puzzleId('hard', 50)), { level: 'hard', n: 50 });
});

test('parsePuzzleId rejects invalid ids', () => {
  for (const v of ['', 'easy', 'easy-0', 'easy-01', 'easy--1', 'expert-1', 'easy-1x', 'Easy-1', 'easy-1.5', null, undefined, 5]) {
    assert.equal(kit.parsePuzzleId(v), null, String(v));
  }
});

test('progress marks puzzles solved without double counting', () => {
  const s = memory();
  const p = kit.createProgress('killer-sudoku', s);
  assert.equal(p.solvedCount(), 0);
  assert.equal(p.isSolved('easy-1'), false);
  assert.equal(p.markSolved('easy-1'), 1);
  assert.equal(p.markSolved('easy-1'), 1);
  assert.equal(p.markSolved('hard-3'), 2);
  assert.equal(p.isSolved('easy-1'), true);
  assert.equal(p.isSolved('easy-2'), false);
  assert.equal(p.solvedCount(), 2);
  assert.equal(s.getItem('dcunited-games.logic.killer-sudoku.solved'), '2');
  assert.deepEqual(JSON.parse(s.getItem('dcunited-games.logic.killer-sudoku.solved-ids')), ['easy-1', 'hard-3']);
});

test('progress ignores empty or non-string ids when marking solved', () => {
  const p = kit.createProgress('a', memory());
  assert.equal(p.markSolved(''), 0);
  assert.equal(p.markSolved(7), 0);
  assert.equal(p.solvedCount(), 0);
});

test('progress saves, loads and clears each puzzle separately', () => {
  const s = memory();
  const p = kit.createProgress('nonograms', s);
  assert.equal(p.loadSave('easy-1'), null);
  p.save('easy-1', { x: [1, 2] });
  p.save('easy-2', { y: 1 });
  assert.equal(s.getItem('dcunited-games.logic.nonograms.save.easy-1'), '{"x":[1,2]}');
  assert.deepEqual(p.loadSave('easy-1'), { x: [1, 2] });
  p.clearSave('easy-1');
  assert.equal(p.loadSave('easy-1'), null);
  assert.deepEqual(p.loadSave('easy-2'), { y: 1 });
});

test('progress remembers the last played puzzle', () => {
  const s = memory();
  const p = kit.createProgress('a', s);
  assert.equal(p.lastPlayed(), null);
  p.setLastPlayed('medium-4');
  assert.equal(p.lastPlayed(), 'medium-4');
  assert.equal(s.getItem('dcunited-games.logic.a.last'), 'medium-4');
});

test('progress survives corrupt stored data', () => {
  const s = memory();
  s.setItem('dcunited-games.logic.a.solved', 'abc');
  s.setItem('dcunited-games.logic.a.solved-ids', '{nope');
  s.setItem('dcunited-games.logic.a.save.easy-1', '{nope');
  const p = kit.createProgress('a', s);
  assert.equal(p.solvedCount(), 0);
  assert.equal(p.isSolved('easy-1'), false);
  assert.equal(p.loadSave('easy-1'), null);
  assert.equal(p.markSolved('easy-1'), 1);
  s.setItem('dcunited-games.logic.a.solved-ids', '{"a":1}');
  assert.equal(p.isSolved('a'), false);
});

test('progress ignores negative or fractional stored counts', () => {
  const s = memory();
  s.setItem('dcunited-games.logic.a.solved', '-4');
  assert.equal(kit.createProgress('a', s).solvedCount(), 0);
  s.setItem('dcunited-games.logic.a.solved', '2.5');
  assert.equal(kit.createProgress('a', s).solvedCount(), 0);
});

test('progress never throws when storage throws', () => {
  const p = kit.createProgress('a', broken);
  assert.equal(p.solvedCount(), 0);
  assert.equal(p.isSolved('easy-1'), false);
  assert.equal(p.markSolved('easy-1'), 1);
  assert.equal(p.loadSave('easy-1'), null);
  assert.equal(p.lastPlayed(), null);
  p.save('easy-1', { a: 1 });
  p.clearSave('easy-1');
  p.setLastPlayed('easy-1');
});

test('progress never throws when there is no storage', () => {
  const p = kit.createProgress('a', null);
  assert.equal(p.solvedCount(), 0);
  assert.equal(p.markSolved('easy-1'), 1);
  assert.equal(p.loadSave('easy-1'), null);
  assert.equal(p.lastPlayed(), null);
  p.save('easy-1', {});
  p.clearSave('easy-1');
  p.setLastPlayed('easy-1');
});

test('progress save ignores values that cannot be serialized', () => {
  const p = kit.createProgress('a', memory());
  const cyc = {}; cyc.self = cyc;
  p.save('easy-1', cyc);
  assert.equal(p.loadSave('easy-1'), null);
});

test('pickerModel lists each level with totals, solved counts and puzzles', () => {
  const solved = new Set(['easy-1', 'easy-3', 'hard-2']);
  const model = kit.pickerModel({ easy: 3, medium: 2, hard: 2 }, (id) => solved.has(id));
  assert.deepEqual(model.map((m) => [m.level, m.label, m.solved, m.total]),
    [['easy', 'Easy', 2, 3], ['medium', 'Medium', 0, 2], ['hard', 'Hard', 1, 2]]);
  assert.deepEqual(model[0].puzzles, [
    { id: 'easy-1', n: 1, solved: true },
    { id: 'easy-2', n: 2, solved: false },
    { id: 'easy-3', n: 3, solved: true },
  ]);
});

test('pickerModel treats missing or bad counts as zero', () => {
  const model = kit.pickerModel({ easy: 1, hard: -2 }, () => false);
  assert.deepEqual(model.map((m) => m.total), [1, 0, 0]);
  assert.deepEqual(kit.pickerModel(undefined, () => false).map((m) => m.total), [0, 0, 0]);
});

test('nextUnsolved finds the first unsolved puzzle in a level', () => {
  const solved = new Set(['easy-1', 'easy-2']);
  const is = (id) => solved.has(id);
  assert.equal(kit.nextUnsolved({ easy: 4 }, is, 'easy'), 'easy-3');
  assert.equal(kit.nextUnsolved({ easy: 2 }, is, 'easy'), null);
  assert.equal(kit.nextUnsolved({ easy: 2 }, is, 'medium'), null);
  assert.equal(kit.nextUnsolved({ easy: 2 }, is, 'bogus'), null);
});

test('progress defaults to globalThis.localStorage when present', () => {
  const s = memory();
  globalThis.localStorage = s;
  try {
    const p = kit.createProgress('g');
    p.markSolved('easy-1');
    assert.equal(s.getItem('dcunited-games.logic.g.solved'), '1');
  } finally {
    delete globalThis.localStorage;
  }
  assert.equal(kit.createProgress('g').solvedCount(), 0);
});

test('accessing localStorage may throw and is handled', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
  try {
    assert.equal(kit.createProgress('g').solvedCount(), 0);
  } finally {
    delete globalThis.localStorage;
  }
});
