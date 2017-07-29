const craftingTable = require('./crafting-table');
const torch = require('./torch');

const objectsLib = options => [
  craftingTable,
  torch,
].map(objectLib => objectLib(options));

module.exports = objectsLib;
