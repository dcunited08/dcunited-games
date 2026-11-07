// Browser-only puzzle picker. Logic lives in LogicKit.pickerModel; this just draws it.
(function () {
  function el(tag, className, text) {
    const e = document.createElement(tag);
    e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function render(container, opts) {
    const kit = window.LogicKit;
    const model = kit.pickerModel(opts.counts, opts.isSolved);
    const cur = kit.parsePuzzleId(opts.current);
    let active = cur ? cur.level : model[0].level;

    function draw() {
      const picker = el('div', 'picker');
      const tabs = el('div', 'level-tabs');
      tabs.setAttribute('role', 'tablist');
      const list = el('div', 'puzzle-list');
      model.forEach((m) => {
        const tab = el('button', 'level-tab' + (m.level === active ? ' active' : ''), `${m.label} ${m.solved}/${m.total}`);
        tab.setAttribute('type', 'button');
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', String(m.level === active));
        tab.addEventListener('click', () => { active = m.level; draw(); });
        tabs.append(tab);
        if (m.level !== active) return;
        m.puzzles.forEach((p) => {
          const cls = 'puzzle-btn' + (p.solved ? ' solved' : '') + (p.id === opts.current ? ' current' : '');
          const btn = el('button', cls, p.solved ? `${p.n} ✓` : String(p.n));
          btn.setAttribute('type', 'button');
          btn.setAttribute('aria-label', `${m.label} puzzle ${p.n}${p.solved ? ', solved' : ''}`);
          btn.addEventListener('click', () => { if (opts.onPick) opts.onPick(p.id); });
          list.append(btn);
        });
      });
      picker.append(tabs, list);
      container.replaceChildren(picker);
    }
    draw();
  }

  window.LogicPicker = { render };
}());
