const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

// 4x4: pair 1 on the left edge (cells 0 and 12), pair 2 on the right edge (3 and 15).
const P4 = L.parsePuzzle(['1..2', '....', '....', '1..2']);
// 3x3 with a single answer: 1 = 0,1,2,5   2 = 4,3,6,7,8
const P3 = L.parsePuzzle(['1..', '.21', '..2']);
const SOL3 = { 1: [0, 1, 2, 5], 2: [4, 3, 6, 7, 8] };

const draw = (puzzle, state, ...strokes) => strokes.reduce((s, cells) => L.applyStroke(puzzle, s, cells), state);
const fresh = (puzzle) => L.createState(puzzle);

test('idChar uses 1-9 then letters', () => {
  assert.deepEqual([0, 8, 9, 10, 11].map(L.idChar), ['1', '9', 'A', 'B', 'C']);
});

test('parsePuzzle reads dots and ids', () => {
  assert.equal(P4.size, 4);
  assert.deepEqual(P4.ids, ['1', '2']);
  assert.deepEqual(P4.dots, { 1: [0, 12], 2: [3, 15] });
  assert.equal(P4.dotAt[0], '1');
  assert.equal(P4.dotAt[5], null);
  assert.equal(L.parsePuzzle(P4).size, 4); // already parsed
  const big = L.parsePuzzle(['AB.', 'AB.', '...']);
  assert.deepEqual(big.ids, ['A', 'B']);
});

test('parsePuzzle rejects bad puzzles', () => {
  assert.throws(() => L.parsePuzzle('nope'), /array/);
  assert.throws(() => L.parsePuzzle(['11', '1']), /square/);
  assert.throws(() => L.parsePuzzle(['1.', '.?']), /Bad character/);
  assert.throws(() => L.parsePuzzle(['1.', '..']), /exactly twice/);
  assert.throws(() => L.parsePuzzle(['11', '1.']), /exactly twice/);
  assert.throws(() => L.parsePuzzle(['..', '..']), /at least one pair/);
});

test('a stroke must begin on a dot or on a line', () => {
  assert.equal(L.beginStroke(P4, fresh(P4), 5), null);
  const b = L.beginStroke(P4, fresh(P4), 0);
  assert.deepEqual(b.state.lines[1], [0]);
  assert.equal(b.stroke.id, '1');
});

test('drawing along a column joins a pair', () => {
  const s = draw(P4, fresh(P4), [0, 4, 8, 12]);
  assert.deepEqual(s.lines[1], [0, 4, 8, 12]);
  assert.equal(L.isJoined(P4, s, '1'), true);
  assert.equal(L.isJoined(P4, s, '2'), false);
});

test('a drag can start from either dot', () => {
  const s = draw(P4, fresh(P4), [12, 8, 4, 0]);
  assert.deepEqual(s.lines[1], [12, 8, 4, 0]);
  assert.equal(L.isJoined(P4, s, '1'), true);
});

test('fast drags are filled in along straight lines', () => {
  assert.deepEqual(draw(P4, fresh(P4), [0, 12]).lines[1], [0, 4, 8, 12]);
  assert.deepEqual(draw(P4, fresh(P4), [0, 2]).lines[1], [0, 1, 2]);
});

test('diagonal jumps go round a corner, other jumps are ignored', () => {
  const d = draw(P4, fresh(P4), [0, 5]).lines[1];
  assert.equal(d.length, 3);
  assert.equal(d[2], 5);
  assert.deepEqual(draw(P4, fresh(P4), [0, 1, 10]).lines[1], [0, 1]);
});

test('a diagonal jump avoids cutting lines or stepping on dots when it can', () => {
  // 0 -> 5 could go through 1 or 4. 1 is held by line 2 so it goes through 4.
  const s = L.applyStroke(P4, fresh(P4), [3, 2, 1]);
  assert.deepEqual(draw(P4, s, [0, 5]).lines[1], [0, 4, 5]);
  assert.deepEqual(draw(P4, s, [0, 5]).lines[2], [3, 2, 1]);
  // 2 -> 7 : 3 is a dot of pair 2 itself (fine); from pair 1, 2 -> 7 via 3 is blocked, so via 6
  const t = draw(P4, fresh(P4), [0, 1, 2, 7]);
  assert.deepEqual(t.lines[1], [0, 1, 2, 6, 7]);
  // both corners are dots of another pair: nothing happens
  const q = L.parsePuzzle(['12..', '2...', '....', '...1']);
  assert.deepEqual(draw(q, fresh(q), [0, 5]).lines[1], []);
});

test('moving back over your own line shortens it', () => {
  assert.deepEqual(draw(P4, fresh(P4), [0, 1, 2, 1]).lines[1], [0, 1]);
  assert.deepEqual(draw(P4, fresh(P4), [0, 1, 2, 1, 0]).lines[1], []);
});

test('you cannot move onto another pair\'s dot', () => {
  assert.deepEqual(draw(P4, fresh(P4), [0, 1, 2, 3]).lines[1], [0, 1, 2]);
});

test('moving onto another line cuts that line back', () => {
  const s = draw(P4, fresh(P4), [3, 2, 6, 10, 14, 15]);
  assert.equal(L.isJoined(P4, s, '2'), true);
  const t = draw(P4, s, [0, 1, 5, 9, 10]);
  assert.deepEqual(t.lines[2], [3, 2, 6]);
  assert.deepEqual(t.lines[1], [0, 1, 5, 9, 10]);
});

test('a line cut down to its dot disappears', () => {
  const s = draw(P4, fresh(P4), [3, 7, 11, 15]);
  const t = draw(P4, s, [0, 4, 5, 6, 7]);
  assert.deepEqual(t.lines[2], []);
  assert.deepEqual(t.lines[1], [0, 4, 5, 6, 7]);
});

test('after reaching the partner dot, the rest of the drag is ignored', () => {
  assert.deepEqual(draw(P4, fresh(P4), [0, 4, 8, 12, 13, 9]).lines[1], [0, 4, 8, 12]);
});

test('a drag from the loose end continues the line', () => {
  const s = draw(P4, fresh(P4), [0, 1]);
  assert.deepEqual(draw(P4, s, [1, 2]).lines[1], [0, 1, 2]);
});

test('a drag from the middle of a line cuts it back there', () => {
  const s = draw(P4, fresh(P4), [0, 1, 2, 6]);
  assert.deepEqual(draw(P4, s, [1, 5]).lines[1], [0, 1, 5]);
  assert.deepEqual(draw(P4, s, [2]).lines[1], [0, 1, 2]);
});

test('a drag from a dot starts the line again; a tap clears it', () => {
  const s = draw(P4, fresh(P4), [0, 1, 2]);
  assert.deepEqual(draw(P4, s, [0]).lines[1], []);
  assert.deepEqual(draw(P4, s, [0, 4]).lines[1], [0, 4]);
  const full = draw(P4, fresh(P4), [0, 4, 8, 12]);
  assert.deepEqual(draw(P4, full, [12]).lines[1], []);
  assert.deepEqual(draw(P4, full, [12, 8]).lines[1], [12, 8]);
});

test('moves outside the board or to the same cell do nothing', () => {
  const b = L.beginStroke(P4, fresh(P4), 0);
  const same = L.stepStroke(P4, b.state, b.stroke, 0);
  assert.equal(same.state, b.state);
  const out = L.stepStroke(P4, b.state, b.stroke, -1);
  assert.equal(out.state, b.state);
  assert.equal(L.stepStroke(P4, b.state, b.stroke, 99).state, b.state);
});

test('stepStroke does not change the state it was given', () => {
  const b = L.beginStroke(P4, fresh(P4), 0);
  const before = JSON.stringify(b.state);
  const next = L.stepStroke(P4, b.state, b.stroke, 1);
  assert.equal(JSON.stringify(b.state), before);
  assert.deepEqual(next.state.lines[1], [0, 1]);
  assert.equal(next.stroke.moved, true);
});

test('applyStroke with no starting cell on a line changes nothing', () => {
  const s = fresh(P4);
  assert.equal(L.applyStroke(P4, s, [5, 6]), s);
});

test('ownerMap and filled count', () => {
  const s = draw(P4, fresh(P4), [0, 1]);
  const owner = L.ownerMap(P4, s);
  assert.equal(owner[0], '1');
  assert.equal(owner[1], '1');
  assert.equal(owner[2], null);
  assert.equal(L.filledCount(s), 2);
});

test('status: open, joined, solved', () => {
  assert.equal(L.status(P4, fresh(P4)), 'open');
  const joined = draw(P4, fresh(P4), [0, 4, 8, 12], [3, 7, 11, 15]);
  assert.equal(L.allJoined(P4, joined), true);
  assert.equal(L.isSolved(P4, joined), false);
  assert.equal(L.status(P4, joined), 'joined');
  const solved = draw(P3, fresh(P3), [0, 1, 2, 5], [4, 3, 6, 7, 8]);
  assert.equal(L.isSolved(P3, solved), true);
  assert.equal(L.status(P3, solved), 'solved');
  const wrongFill = draw(P3, fresh(P3), [0, 1, 2, 5], [4, 7, 8]);
  assert.equal(L.status(P3, wrongFill), 'joined');
});

test('findMistakes lists cells that disagree with the answer', () => {
  assert.deepEqual(L.findMistakes(P3, fresh(P3), SOL3), []);
  const s = draw(P3, fresh(P3), [0, 3, 6]);
  // cell 3 and 6 belong to line 2 in the answer; cell 0 is dot 1 (fine)
  assert.deepEqual(L.findMistakes(P3, s, SOL3), [3, 6]);
  const good = draw(P3, fresh(P3), [2, 1, 0]);
  assert.deepEqual(L.findMistakes(P3, good, SOL3), []);
});

test('hint redraws one wrong line from the answer', () => {
  const s = draw(P3, fresh(P3), [4, 7, 8]);
  const h = L.hint(P3, s, SOL3);
  assert.equal(h.id, '2');
  assert.deepEqual(h.state.lines[2], SOL3[2]);
  assert.match(h.reason, /2/);
});

test('hint prefers a line with a mistake, and cuts lines in its way', () => {
  // line 1 correct but not drawn; line 2 drawn through cell 1 wrongly
  const s = draw(P3, fresh(P3), [4, 3, 0]);
  const wrong = L.hint(P3, s, SOL3);
  assert.equal(wrong.id, '2');
  const s2 = draw(P3, fresh(P3), [0, 1, 2, 5], [4, 3, 6, 7]);
  const h2 = L.hint(P3, s2, SOL3);
  assert.equal(h2.id, '2');
  assert.deepEqual(h2.state.lines[2], SOL3[2]);
  assert.deepEqual(h2.state.lines[1], SOL3[1]);
  // a wrong line 1 through 7 gets cut when line 2 is redrawn
  const s3 = draw(P3, fresh(P3), [5, 8, 7]);
  const h3 = L.hint(P3, s3, SOL3);
  assert.equal(h3.id, '1');
  assert.deepEqual(h3.state.lines[1], SOL3[1]);
  const s4 = draw(P3, fresh(P3), [0, 1, 2], [4, 3, 6, 7, 8]);
  const h4 = L.hint(P3, s4, SOL3);
  assert.equal(h4.id, '1'); // line 1 stops short of its dot
  assert.deepEqual(h4.state.lines[2], SOL3[2]);
});

test('hint cuts another pair\'s line that is in the way', () => {
  const s = draw(P3, fresh(P3), [5, 8, 7, 6]);
  // line 1 goes 5,8,7,6 (wrong, covers cells line 2 needs); no line 2 yet
  const h = L.hint(P3, s, SOL3);
  assert.equal(h.id, '1');
  assert.deepEqual(h.state.lines[1], SOL3[1]);
  const t = draw(P3, fresh(P3), [4, 1], [0, 3]);
  // hint for the first wrong line, preferring ones with a mistake; line 2 [4,1] has a mistake at 1
  const ht = L.hint(P3, t, SOL3);
  assert.ok(['1', '2'].includes(ht.id));
  const cut = L.hint(P3, draw(P3, fresh(P3), [8, 7, 6, 3]), SOL3);
  assert.equal(cut.id, '2');
  assert.deepEqual(cut.state.lines[2], SOL3[2]);
});

test('hint returns null when everything is right', () => {
  assert.equal(L.hint(P3, draw(P3, fresh(P3), [0, 1, 2, 5], [4, 3, 6, 7, 8]), SOL3), null);
});

test('clearAll empties every line', () => {
  const s = draw(P4, fresh(P4), [0, 4, 8, 12]);
  assert.deepEqual(L.clearAll(P4, s).lines, { 1: [], 2: [] });
});

test('validateLines accepts good lines and rejects bad ones', () => {
  const ok = L.validateLines(P4, { 1: [0, 4, 8, 12] });
  assert.deepEqual(ok.lines, { 1: [0, 4, 8, 12], 2: [] });
  assert.equal(L.validateLines(P4, null), null);
  assert.equal(L.validateLines(P4, []), null);
  assert.equal(L.validateLines(P4, { 9: [0, 1] }), null, 'unknown id');
  assert.equal(L.validateLines(P4, { 1: 'x' }), null, 'not a list');
  assert.equal(L.validateLines(P4, { 1: [0, 1.5] }), null, 'not integers');
  assert.equal(L.validateLines(P4, { 1: [0, 99] }), null, 'out of range');
  assert.equal(L.validateLines(P4, { 1: [4, 5] }), null, 'does not start at a dot');
  assert.equal(L.validateLines(P4, { 1: [0, 5] }), null, 'not adjacent');
  assert.equal(L.validateLines(P4, { 1: [0, 4, 0] }), null, 'repeats a cell');
  assert.equal(L.validateLines(P4, { 1: [0, 1, 2, 3] }), null, 'runs onto another dot');
  assert.equal(L.validateLines(P4, { 1: [0, 4, 8, 12, 13] }), null, 'goes on past its end dot');
  assert.equal(L.validateLines(P4, { 1: [0, 1, 5], 2: [3, 7, 6, 5] }), null, 'two lines share a cell');
  assert.equal(L.validateLines(P4, { 1: [0] }), null, 'too short');
  assert.deepEqual(L.validateLines(P4, { 1: [] }).lines[1], []);
});
