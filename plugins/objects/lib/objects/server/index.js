const stick = require('./stick');
const stone = require('./stone');
const grass = require('./grass');
// const pixelgrass = require('./pixelgrass');
// const tree = require('./tree');
const trees = require('./trees');
const wood = require('./wood');
const coal = require('./coal');
const apple = require('./apple');
const craftingTable = require('./crafting-table');
const chest = require('./chest');
const mirror = require('./mirror');
const paper = require('./paper');
const drone = require('./drone');
const monitor = require('./monitor');
const torch = require('./torch');
const fire = require('./fire');
const house = require('./house');
const bigHouse = require('./big-house');

const objectsLib = options => [
  stick,
  stone,
  grass,
  // pixelgrass,
  // tree,
  trees,
  wood,
  coal,
  apple,
  craftingTable,
  chest,
  mirror,
  paper,
  drone,
  monitor,
  torch,
  fire,
  house,
  bigHouse,
].map(objectLib => objectLib(options));

module.exports = objectsLib;
