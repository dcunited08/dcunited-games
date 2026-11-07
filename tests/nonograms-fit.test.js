const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'games', 'logic', 'nonograms', 'index.html'), 'utf8');

// On iPad Safari 100vh is taller than the visible page, so a board sized from it pushes the
// buttons off screen. 100dvh is the visible height. (Same rule as the other logic puzzles.)
const cellRules = html.split('\n').filter((l) => /--cell\s*:/.test(l));

test('nonograms cell size is capped by the visible height (dvh)', () => {
  const withDvh = cellRules.filter((r) => r.includes('100dvh'));
  assert.ok(withDvh.length >= 2, 'portrait and landscape rules both use dvh');
  assert.ok(cellRules[0].includes('100vh'), 'a plain vh rule comes first as a fallback');
});

test('nonograms puts the controls beside the board in landscape', () => {
  assert.match(html, /@media \(min-aspect-ratio: 11\/10\)/);
  assert.match(html, /main \{ display: contents; \}/);
});
