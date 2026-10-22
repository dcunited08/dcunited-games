// Geometry for the thorny rose stem drawn over a winning line.
// Pure maths in 3x3 board units (cell i centre = (i % 3 + 0.5, floor(i / 3) + 0.5)); no DOM.
(function (root) {
  'use strict';

  const r = (n) => Math.round(n * 1000) / 1000;
  const centre = (i) => ({ x: (i % 3) + 0.5, y: Math.floor(i / 3) + 0.5 });
  const add = (p, v, k = 1) => ({ x: p.x + v.x * k, y: p.y + v.y * k });
  const deg = (rad) => r((rad * 180) / Math.PI);

  function bezier(p0, p1, p2, p3, t) {
    const u = 1 - t;
    const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return {
      x: w[0] * p0.x + w[1] * p1.x + w[2] * p2.x + w[3] * p3.x,
      y: w[0] * p0.y + w[1] * p1.y + w[2] * p2.y + w[3] * p3.y,
    };
  }

  function bezierTangent(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return {
      x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
      y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
    };
  }

  // Returns the stem path, key points, thorns and leaves for a winning line, or null.
  function stemShape(line) {
    if (!Array.isArray(line) || line.length !== 3) return null;
    if (!line.every((i) => Number.isInteger(i) && i >= 0 && i <= 8)) return null;
    const [a, b, c] = [...line].sort((x, y) => x - y);
    const A = centre(a), B = centre(b), C = centre(c);
    const step = { x: B.x - A.x, y: B.y - A.y };       // one cell along the line
    const len = Math.hypot(step.x, step.y);
    const n = { x: -step.y / len, y: step.x / len };   // unit sideways direction
    const wave = 0.16;
    const ext = 0.25;

    const S = add(A, step, -ext);
    const E = add(C, step, ext);
    const third = { x: step.x / 3, y: step.y / 3 };
    // Two cubic curves that bulge to opposite sides and join smoothly at the middle rose.
    const seg1 = [S, add(add(S, third, 1.25), n, wave), add(add(B, third, -1), n, wave), B];
    const seg2 = [B, add(add(B, third, 1), n, -wave), add(add(E, third, -1.25), n, -wave), E];
    const f = (p) => `${r(p.x)} ${r(p.y)}`;
    const q = (p) => ({ x: r(p.x), y: r(p.y) });
    const d = `M${f(seg1[0])} C${f(seg1[1])} ${f(seg1[2])} ${f(seg1[3])} ` +
      `C${f(seg2[1])} ${f(seg2[2])} ${f(seg2[3])}`;

    // Thorns alternate sides along the stem, pointing away from it.
    const thorns = [];
    [seg1, seg2].forEach((seg, k) => {
      [0.15, 0.35, 0.65, 0.85].forEach((t, j) => {
        const p = bezier(seg[0], seg[1], seg[2], seg[3], t);
        const tan = bezierTangent(seg[0], seg[1], seg[2], seg[3], t);
        const side = (j + k) % 2 === 0 ? 1 : -1;
        const base = Math.atan2(tan.y, tan.x);
        thorns.push({ x: r(p.x), y: r(p.y), angle: deg(base + side * (Math.PI / 2 - 0.35)) });
      });
    });

    // One leaf in each gap between roses, tilted away from the stem.
    const leaves = [[seg1, 0.6, 1], [seg2, 0.4, -1]].map(([seg, t, side]) => {
      const p = bezier(seg[0], seg[1], seg[2], seg[3], t);
      const tan = bezierTangent(seg[0], seg[1], seg[2], seg[3], t);
      const base = Math.atan2(tan.y, tan.x);
      return { x: r(p.x), y: r(p.y), angle: deg(base + side * 0.9) };
    });

    return { d, points: { start: q(S), mid: q(B), end: q(E) }, thorns, leaves };
  }

  const api = { stemShape };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RosesStem = api;
})(this);
