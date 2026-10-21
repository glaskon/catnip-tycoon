const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function createGame() {
  const storage = new Map();
  const context = vm.createContext({
    console, Date,
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
    render() {}, showToast() {},
  });
  context.window = context;
  for (const file of ['constants', 'album-state', 'game', 'achievements']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js', file + '.js'), 'utf8'), context);
  }
  context.initGame();
  return context;
}

module.exports = { createGame };
