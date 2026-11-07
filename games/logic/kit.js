// Shared helpers for the Logic puzzles. Browser: window.LogicKit. Node: require('./kit.js').
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LogicKit = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  const PREFIX = 'dcunited-games.logic.';

  function formatTime(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '0:00';
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  }

  function createHistory(limit = 500) {
    const stack = [];
    return {
      push(snapshot) {
        stack.push(JSON.parse(JSON.stringify(snapshot)));
        while (stack.length > limit) stack.shift();
      },
      undo() { return stack.pop(); },
      canUndo() { return stack.length > 0; },
      clear() { stack.length = 0; },
    };
  }

  const LEVELS = ['easy', 'medium', 'hard'];
  const LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

  function puzzleId(level, n) { return `${level}-${n}`; }

  function parsePuzzleId(id) {
    const m = /^(easy|medium|hard)-([1-9]\d*)$/.exec(typeof id === 'string' ? id : '');
    return m ? { level: m[1], n: Number(m[2]) } : null;
  }

  function defaultStorage() {
    try { return globalThis.localStorage || null; } catch { return null; }
  }

  function createProgress(name, storage) {
    const store = storage === undefined ? defaultStorage() : storage;
    const base = `${PREFIX}${name}.`;
    const read = (key) => { try { return store.getItem(base + key); } catch { return null; } };
    const write = (key, value) => { try { store.setItem(base + key, value); } catch {} };
    const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };

    function solvedIds() {
      const ids = parse(read('solved-ids'));
      return Array.isArray(ids) ? ids : [];
    }
    function solvedCount() {
      const n = Number(read('solved'));
      return Number.isInteger(n) && n > 0 ? n : 0;
    }
    return {
      solvedCount,
      isSolved: (id) => solvedIds().includes(id),
      markSolved(id) {
        if (typeof id !== 'string' || !id) return solvedCount();
        const ids = solvedIds();
        if (!ids.includes(id)) {
          ids.push(id);
          write('solved-ids', JSON.stringify(ids));
          write('solved', String(ids.length));
        }
        return ids.length;
      },
      loadSave: (id) => parse(read(`save.${id}`)),
      save(id, obj) {
        try { write(`save.${id}`, JSON.stringify(obj)); } catch {}
      },
      clearSave(id) { try { store.removeItem(`${base}save.${id}`); } catch {} },
      lastPlayed: () => read('last'),
      setLastPlayed(id) { write('last', String(id)); },
    };
  }

  function levelTotal(counts, level) {
    const n = counts && counts[level];
    return Number.isInteger(n) && n > 0 ? n : 0;
  }

  function pickerModel(counts, isSolved) {
    return LEVELS.map((level) => {
      const total = levelTotal(counts, level);
      const puzzles = [];
      for (let n = 1; n <= total; n++) {
        const id = puzzleId(level, n);
        puzzles.push({ id, n, solved: !!isSolved(id) });
      }
      return { level, label: LABELS[level], solved: puzzles.filter((p) => p.solved).length, total, puzzles };
    });
  }

  function nextUnsolved(counts, isSolved, level) {
    const entry = pickerModel(counts, isSolved).find((m) => m.level === level);
    const next = entry && entry.puzzles.find((p) => !p.solved);
    return next ? next.id : null;
  }

  return { LEVELS, formatTime, createHistory, puzzleId, parsePuzzleId, createProgress, pickerModel, nextUnsolved };
}));
