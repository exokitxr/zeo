const stick = require('./stick');
const stone = require('./stone');
// const grass = require('./grass');
const tree = require('./tree');
const wood = require('./wood');
const apple = require('./apple');
const craftingTable = require('./crafting-table');
const mirror = require('./mirror');
const paper = require('./paper');
const monitor = require('./monitor');
const torch = require('./torch');
const fire = require('./fire');
const house = require('./house');
const bigHouse = require('./big-house');

const objectsLib = options => [
  stick,
  stone,
  // grass,
  tree,
  wood,
  apple,
  craftingTable,
  mirror,
  paper,
  monitor,
  torch,
  fire,
  house,
  bigHouse,
].map(objectLib => objectLib(options));

module.exports = objectsLib;
