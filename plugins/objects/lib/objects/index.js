const stone = require('./stone');
const craftingTable = require('./crafting-table');
const torch = require('./torch');

const objectsLib = options => [
  stone,
  craftingTable,
  torch,
].map(objectLib => objectLib(options));

module.exports = objectsLib;
