const wood = require('./wood');
const stone = require('./stone');
const tree = require('./tree');
const craftingTable = require('./crafting-table');
const torch = require('./torch');

const objectsLib = options => [
  wood,
  stone,
  tree,
  craftingTable,
  torch,
].map(objectLib => objectLib(options));

module.exports = objectsLib;
