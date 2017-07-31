const wood = require('./wood');
const stone = require('./stone');
const grass = require('./grass');
const tree = require('./tree');
const craftingTable = require('./crafting-table');
const torch = require('./torch');

const objectsLib = options => [
  wood,
  stone,
  grass,
  tree,
  craftingTable,
  torch,
].map(objectLib => objectLib(options));

module.exports = objectsLib;
