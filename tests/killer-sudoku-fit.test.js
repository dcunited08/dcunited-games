const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'games', 'logic', 'killer-sudoku', 'index.html'), 'utf8');

// On iPad Safari, 100vh is taller than the visible page, so the board must be sized from
// 100dvh and leave room for everything else on the page (title, buttons, pad, puzzle picker).
const dvhRules = html.split('\n').filter((l) => /--size\s*:/.test(l) && /100dvh/.test(l));
const overhead = (rule) => Number(rule.match(/100dvh\s*-\s*(\d+)px/)[1]);

test('killer sudoku portrait board leaves room for every control below it', () => {
  assert.ok(dvhRules.length > 0, 'uses dvh');
  const portrait = overhead(dvhRules[0]);
  assert.ok(portrait >= 470, `reserves at least 470px in portrait (got ${portrait})`);
});

test('killer sudoku landscape board fits the visible height', () => {
  assert.ok(dvhRules.length > 1, 'has a landscape dvh rule');
  const landscape = overhead(dvhRules[1]);
  assert.ok(landscape >= 150, `reserves at least 150px in landscape (got ${landscape})`);
});
