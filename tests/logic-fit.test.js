const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const logicDir = path.join(__dirname, '..', 'games', 'logic');
const read = (...p) => fs.readFileSync(path.join(logicDir, ...p), 'utf8');

// On iPad Safari, 100vh is taller than the visible page (the toolbar covers part of it),
// so a board sized from 100vh pushes the buttons off screen. 100dvh is the visible height.
const sizeRules = (text) => text.split('\n').filter((l) => /--size\s*:/.test(l) && /vh/.test(l));

test('shared puzzle board sizes itself from the visible height (dvh)', () => {
  const rules = sizeRules(read('logic.css'));
  assert.ok(rules.length > 0);
  assert.ok(rules.some((r) => r.includes('100dvh')), 'a dvh size rule exists');
  assert.ok(rules[rules.length - 1].includes('100dvh'), 'the dvh rule comes last so it wins');
});

test('star-battle board leaves room for the buttons and level tabs under it', () => {
  const rules = sizeRules(read('star-battle', 'index.html'));
  assert.ok(rules.length > 0);
  // The first dvh rule is the portrait one; a later landscape rule puts the controls beside the board.
  const portrait = rules.filter((r) => r.includes('100dvh'))[0];
  assert.ok(portrait, 'uses dvh');
  const overhead = Number(portrait.match(/100dvh\s*-\s*(\d+)px/)[1]);
  assert.ok(overhead >= 480, `reserves at least 480px for the other controls (got ${overhead})`);
});

test('nurikabe board leaves room for the buttons and level tabs under it', () => {
  const rules = sizeRules(read('nurikabe', 'index.html'));
  assert.ok(rules.length > 0);
  const portrait = rules.filter((r) => r.includes('100dvh'))[0];
  assert.ok(portrait, 'uses dvh');
  const overhead = Number(portrait.match(/100dvh\s*-\s*(\d+)px/)[1]);
  assert.ok(overhead >= 480, `reserves at least 480px for the other controls (got ${overhead})`);
});

test('binairo board leaves room for the buttons and level tabs under it', () => {
  const rules = sizeRules(read('binairo', 'index.html'));
  assert.ok(rules.length > 0);
  const portrait = rules.filter((r) => r.includes('100dvh'))[0];
  assert.ok(portrait, 'uses dvh');
  const overhead = Number(portrait.match(/100dvh\s*-\s*(\d+)px/)[1]);
  assert.ok(overhead >= 480, `reserves at least 480px for the other controls (got ${overhead})`);
});
