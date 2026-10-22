const test = require('node:test');
const assert = require('node:assert/strict');
const { stemShape } = require('./stem.js');

const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const centre = (i) => ({ x: (i % 3) + 0.5, y: Math.floor(i / 3) + 0.5 });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const nums = (d) => d.match(/-?\d+(?:\.\d+)?/g).map(Number);

function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

test('stemShape returns null for missing or invalid lines', () => {
  assert.equal(stemShape(null), null);
  assert.equal(stemShape(undefined), null);
  assert.equal(stemShape([]), null);
  assert.equal(stemShape([0, 1]), null);
  assert.equal(stemShape('abc'), null);
  assert.equal(stemShape([0, 1, 9]), null);
  assert.equal(stemShape([0, 1, 1.5]), null);
  assert.equal(stemShape([0, 1, 'x']), null);
});

for (const line of WIN_LINES) {
  test(`stem for ${line} stays on the board and links the roses`, () => {
    const s = stemShape(line);
    assert.match(s.d, /^M/);
    for (const n of nums(s.d)) assert.ok(n >= 0 && n <= 3, `${n} outside board`);

    const first = centre(line[0]), mid = centre(line[1]), last = centre(line[2]);
    assert.ok(dist(s.points.start, first) < 0.5);
    assert.ok(dist(s.points.end, last) < 0.5);
    assert.ok(dist(s.points.mid, mid) < 0.01);
    // the path really contains its key points
    const n = nums(s.d);
    assert.deepEqual([n[0], n[1]], [s.points.start.x, s.points.start.y]);
    assert.ok(n.join(',').includes(`${s.points.mid.x},${s.points.mid.y}`));
    assert.deepEqual([n[n.length - 2], n[n.length - 1]], [s.points.end.x, s.points.end.y]);

    assert.ok(s.thorns.length >= 4);
    for (const t of s.thorns) {
      assert.ok(distToSegment(t, first, last) < 0.3, 'thorn off the stem');
      assert.equal(typeof t.angle, 'number');
    }

    assert.ok(s.leaves.length >= 2 && s.leaves.length <= 3);
    const gaps = [[line[0], line[1]], [line[1], line[2]]].map(([a, b]) => ({
      x: (centre(a).x + centre(b).x) / 2, y: (centre(a).y + centre(b).y) / 2,
    }));
    for (const l of s.leaves) {
      for (const i of line) assert.ok(dist(l, centre(i)) > 0.3, 'leaf on a rose');
      assert.ok(gaps.some((g) => dist(l, g) < 0.25), 'leaf not between squares');
      assert.equal(typeof l.angle, 'number');
    }
  });

  test(`stem for ${line} is the same when reversed`, () => {
    assert.deepEqual(stemShape([...line].reverse()), stemShape(line));
  });
}
