const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class El {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.className = ''; this.textContent = ''; }
  setAttribute(k, v) { this.attrs[k] = v; }
  append(...c) { this.children.push(...c); }
  replaceChildren(...c) { this.children = c; }
  addEventListener(t, f) { this.listeners[t] = f; }
}
const all = (el, out = []) => { out.push(el); el.children.forEach((c) => all(c, out)); return out; };

function load() {
  const window = { LogicKit: require('./kit.js') };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'picker.js'), 'utf8'), {
    window, document: { createElement: (t) => new El(t) },
  });
  return window.LogicPicker;
}

test('picker renders tabs and numbered puzzle buttons', () => {
  const picked = [];
  const box = new El('div');
  load().render(box, {
    counts: { easy: 3, medium: 2, hard: 1 },
    isSolved: (id) => id === 'easy-2',
    current: 'easy-3',
    onPick: (id) => picked.push(id),
  });
  const els = all(box);
  const tabs = els.filter((e) => e.className.startsWith('level-tab ') || e.className === 'level-tab');
  assert.deepEqual(tabs.map((t) => t.textContent), ['Easy 1/3', 'Medium 0/2', 'Hard 0/1']);
  assert.equal(tabs[0].attrs['aria-selected'], 'true');
  const btns = els.filter((e) => e.className.includes('puzzle-btn'));
  assert.equal(btns.length, 3);
  assert.ok(btns[1].className.includes('solved'));
  assert.match(btns[1].textContent, /✓/);
  assert.ok(btns[2].className.includes('current'));
  btns[0].listeners.click();
  assert.deepEqual(picked, ['easy-1']);
  tabs[1].listeners.click();
  const btns2 = all(box).filter((e) => e.className.includes('puzzle-btn'));
  assert.equal(btns2.length, 2);
});

test('picker starts on the level of the current puzzle and works without onPick', () => {
  const box = new El('div');
  load().render(box, { counts: { easy: 1, medium: 2, hard: 1 }, isSolved: () => false, current: 'medium-1' });
  const btns = all(box).filter((e) => e.className.includes('puzzle-btn'));
  assert.equal(btns.length, 2);
  btns[0].listeners.click();
});
