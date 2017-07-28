const craftingTable = require('./crafting-table');

const objectsLib = options => [
  craftingTable,
].map(objectLib => objectLib(options));

module.exports = objectsLib;
