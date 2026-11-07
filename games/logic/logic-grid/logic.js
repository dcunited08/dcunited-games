// Logic Grid rules without the DOM: themes, grid layout, marks, checking and
// clue sentences. Loaded as a plain <script> in the browser (window.LogicGridLogic)
// and via require() in Node tests.
(function (root) {
  // Each theme: category name, a sentence template for "the one with this item",
  // and five items (w = word, e = emoji). Emoji are all distinct across themes.
  const THEMES = {
    pets: { name: 'Pets', tpl: 'the {e} {w} owner', items: [
      { w: 'dog', e: '🐶' }, { w: 'cat', e: '🐱' }, { w: 'rabbit', e: '🐰' }, { w: 'bird', e: '🐦' }, { w: 'fish', e: '🐟' }] },
    drinks: { name: 'Drinks', tpl: 'the {e} {w} drinker', items: [
      { w: 'coffee', e: '☕' }, { w: 'tea', e: '🍵' }, { w: 'milk', e: '🥛' }, { w: 'juice', e: '🧃' }, { w: 'water', e: '💧' }] },
    fruit: { name: 'Fruit', tpl: 'the {e} {w} eater', items: [
      { w: 'apple', e: '🍎' }, { w: 'banana', e: '🍌' }, { w: 'grape', e: '🍇' }, { w: 'orange', e: '🍊' }, { w: 'berry', e: '🍓' }] },
    colors: { name: 'Colors', tpl: 'the person wearing {e} {w}', items: [
      { w: 'red', e: '🟥' }, { w: 'blue', e: '🟦' }, { w: 'green', e: '🟩' }, { w: 'yellow', e: '🟨' }, { w: 'purple', e: '🟪' }] },
    hobbies: { name: 'Hobbies', tpl: 'the {e} {w} lover', items: [
      { w: 'art', e: '🎨' }, { w: 'reading', e: '📚' }, { w: 'soccer', e: '⚽' }, { w: 'puzzle', e: '🧩' }, { w: 'darts', e: '🎯' }] },
    snacks: { name: 'Snacks', tpl: 'the one who snacks on {e} {w}', items: [
      { w: 'pizza', e: '🍕' }, { w: 'cookie', e: '🍪' }, { w: 'popcorn', e: '🍿' }, { w: 'donut', e: '🍩' }, { w: 'pretzel', e: '🥨' }] },
    travel: { name: 'Travel', tpl: 'the one who travels by {e} {w}', items: [
      { w: 'car', e: '🚗' }, { w: 'bike', e: '🚲' }, { w: 'bus', e: '🚌' }, { w: 'train', e: '🚂' }, { w: 'scooter', e: '🛵' }] },
    music: { name: 'Music', tpl: 'the {e} {w} player', items: [
      { w: 'guitar', e: '🎸' }, { w: 'drums', e: '🥁' }, { w: 'piano', e: '🎹' }, { w: 'trumpet', e: '🎺' }, { w: 'violin', e: '🎻' }] },
    flowers: { name: 'Flowers', tpl: 'the {e} {w} grower', items: [
      { w: 'rose', e: '🌹' }, { w: 'sunflower', e: '🌻' }, { w: 'tulip', e: '🌷' }, { w: 'daisy', e: '🌼' }, { w: 'blossom', e: '🌸' }] },
  };

  const NAMES = ['Ana', 'Ben', 'Cal', 'Dan', 'Eva', 'Fay', 'Gus', 'Hal', 'Ian', 'Joy', 'Kim', 'Leo',
    'Mia', 'Ned', 'Pam', 'Ray', 'Sue', 'Tom', 'Uma', 'Val', 'Wes', 'Zoe', 'Amy', 'Bob', 'Cara', 'Dina', 'Finn', 'Gina'];

  // Who holds `item` of category `cat` (an index into the people list).
  function personOf(puzzle, cat, item) {
    return puzzle.solution[cat].indexOf(item);
  }

  // Staircase grid. Rows: People, then the last category down to the third.
  // Columns: categories 2..n. Block (row i, column j) exists when j < n-1-i.
  function layout(puzzle) {
    const n = puzzle.cats.length;
    const k = puzzle.cats[0].items.length;
    const rowCats = [0];
    for (let c = n - 1; c >= 2; c--) rowCats.push(c);
    const colCats = [];
    for (let c = 1; c < n; c++) colCats.push(c);
    const blocks = [];
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - 1 - i; j++) blocks.push({ rc: rowCats[i], cc: colCats[j], ri: i, ci: j });
    }
    return { n, k, rowCats, colCats, blocks, size: { rows: (n - 1) * k, cols: (n - 1) * k } };
  }

  function hasBlock(lay, ri, ci) {
    return ri >= 0 && ci >= 0 && ri < lay.n - 1 && ci < lay.n - 1 - ri;
  }

  // Is the cell (row item r of block.rc, column item c of block.cc) a true match?
  function cellTruth(puzzle, block, r, c) {
    return personOf(puzzle, block.rc, r) === personOf(puzzle, block.cc, c);
  }

  function createState(puzzle) {
    const lay = layout(puzzle);
    return { k: lay.k, cells: lay.blocks.map(() => new Array(lay.k * lay.k).fill('')) };
  }

  const copy = (state) => ({ k: state.k, cells: state.cells.map((c) => c.slice()) });

  function setCell(state, b, r, c, value) {
    const next = copy(state);
    next.cells[b][r * state.k + c] = value;
    return next;
  }

  // empty -> x -> o -> empty. Placing o also puts x in the empty cells of its row and column.
  function cycleCell(state, b, r, c) {
    const k = state.k;
    const cur = state.cells[b][r * k + c];
    if (cur === '') return setCell(state, b, r, c, 'x');
    if (cur === 'o') return setCell(state, b, r, c, '');
    return placeO(state, b, r, c);
  }

  function placeO(state, b, r, c) {
    const k = state.k;
    const next = setCell(state, b, r, c, 'o');
    const cells = next.cells[b];
    for (let i = 0; i < k; i++) {
      if (cells[r * k + i] === '') cells[r * k + i] = 'x';
      if (cells[i * k + c] === '') cells[i * k + c] = 'x';
    }
    return next;
  }

  function eachCell(puzzle, state, fn) {
    layout(puzzle).blocks.forEach((blk, b) => {
      for (let r = 0; r < state.k; r++) {
        for (let c = 0; c < state.k; c++) fn(blk, b, r, c, state.cells[b][r * state.k + c], cellTruth(puzzle, blk, r, c));
      }
    });
  }

  function isSolved(puzzle, state) {
    let ok = true;
    eachCell(puzzle, state, (blk, b, r, c, v, truth) => { if ((v === 'o') !== truth) ok = false; });
    return ok;
  }

  function mistakes(puzzle, state) {
    const bad = [];
    eachCell(puzzle, state, (blk, b, r, c, v, truth) => {
      if ((v === 'o' && !truth) || (v === 'x' && truth)) bad.push({ b, r, c });
    });
    return bad;
  }

  // What to show in a row/column header: emoji and word (names and house numbers have no emoji).
  function headerLabel(puzzle, cat, item) {
    const it = puzzle.cats[cat].items[item];
    return { e: it.e || '', w: it.w };
  }

  const isPeople = (ref) => ref[0] === 0;

  // "the 🐶 dog owner", "Ana", "the person in house 3".
  function phrase(puzzle, ref) {
    const cat = puzzle.cats[ref[0]];
    const it = cat.items[ref[1]];
    if (ref[0] === 0) return it.w;
    if (cat.ordered) return `the person in house ${it.w}`;
    return THEMES[cat.kind].tpl.replace('{e}', it.e).replace('{w}', it.w);
  }

  const isHouse = (puzzle, ref) => !!puzzle.cats[ref[0]].ordered;
  const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const houseNo = (puzzle, ref) => puzzle.cats[ref[0]].items[ref[1]].w;

  function clueText(puzzle, clue) {
    let { a, b } = clue;
    const P = (ref) => phrase(puzzle, ref);
    const subject = (ref) => capital(P(ref));
    switch (clue.t) {
      case 'is':
      case 'not': {
        const neg = clue.t === 'not';
        if (isPeople(b) && !isPeople(a)) [a, b] = [b, a];
        if (isHouse(puzzle, a) && !isHouse(puzzle, b)) [a, b] = [b, a];
        if (isHouse(puzzle, b)) return `${subject(a)} ${neg ? 'does not live' : 'lives'} in house ${houseNo(puzzle, b)}.`;
        return `${subject(a)} is ${neg ? 'not ' : ''}${P(b)}.`;
      }
      case 'or': {
        const c = clue.c;
        if (isHouse(puzzle, b)) return `${subject(a)} lives in either house ${houseNo(puzzle, b)} or house ${houseNo(puzzle, c)}.`;
        return `${subject(a)} is either ${P(b)} or ${P(c)}.`;
      }
      case 'next': return `${subject(a)} lives next to ${P(b)}.`;
      case 'left': return `${subject(a)} lives directly left of ${P(b)}.`;
      default: return `${subject(a)} lives somewhere left of ${P(b)}.`;
    }
  }

  const api = {
    THEMES, NAMES, personOf, layout, hasBlock, cellTruth, createState, setCell, cycleCell, placeO,
    isSolved, mistakes, headerLabel, phrase, clueText,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LogicGridLogic = api;
})(this);
