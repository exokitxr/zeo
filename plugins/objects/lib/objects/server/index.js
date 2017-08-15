const stick = require('./stick');
const stone = require('./stone');
// const grass = require('./grass');
const tree = require('./tree');

const objectsLib = options => [
  stick,
  stone,
  // grass,
  tree,
].map(objectLib => objectLib(options));

module.exports = objectsLib;
