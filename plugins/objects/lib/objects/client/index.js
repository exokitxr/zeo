const stick = require('./stick');
const stone = require('./stone');
const grass = require('./grass');
const tree = require('./tree');
const wood = require('./wood');
const apple = require('./apple');
const craftingTable = require('./crafting-table');
const torch = require('./torch');
const fire = require('./fire');

const objectsLib = options => [
  stick,
  stone,
  grass,
  tree,
  wood,
  apple,
  craftingTable,
  torch,
  fire,
].map(objectLib => objectLib(options));

module.exports = objectsLib;
