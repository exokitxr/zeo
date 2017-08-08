const stick = require('./stick');
const stone = require('./stone');
const grass = require('./grass');
const tree = require('./tree');
const craftingTable = require('./crafting-table');
const torch = require('./torch');
const fire = require('./fire');

const objectsLib = options => [
  stick,
  stone,
  grass,
  tree,
  craftingTable,
  torch,
  fire,
].map(objectLib => objectLib(options));

module.exports = objectsLib;
