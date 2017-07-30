const wood = require('./wood');
const stone = require('./stone');
const craftingTable = require('./crafting-table');
const torch = require('./torch');

const objectsLib = options => [
  wood,
  stone,
  craftingTable,
  torch,
].map(objectLib => objectLib(options));

module.exports = objectsLib;
