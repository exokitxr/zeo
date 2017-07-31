const wood = require('./wood');
const stone = require('./stone');
const grass = require('./grass');
const tree = require('./tree');

const objectsLib = options => [
  wood,
  stone,
  grass,
  tree,
].map(objectLib => objectLib(options));

module.exports = objectsLib;
