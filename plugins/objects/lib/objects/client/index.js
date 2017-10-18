const stick = require('./stick');
const stone = require('./stone');
// const grass = require('./grass');
// const tree = require('./tree');
const trees = require('./trees');
const wood = require('./wood');
const coal = require('./coal');
const flintSteel = require('./flint-steel');
const apple = require('./apple');
const craftingTable = require('./crafting-table');
const chest = require('./chest');
const mirror = require('./mirror');
const paper = require('./paper');
const map = require('./map');
const drone = require('./drone');
const monitor = require('./monitor');
const camera = require('./camera');
const videoCamera = require('./video-camera');
const torch = require('./torch');
const fire = require('./fire');
const firework = require('./firework');
const house = require('./house');
const bigHouse = require('./big-house');

const objectsLib = options => [
  stick,
  stone,
  // grass,
  // tree,
  trees,
  wood,
  coal,
  flintSteel,
  apple,
  craftingTable,
  chest,
  mirror,
  paper,
  map,
  drone,
  monitor,
  camera,
  videoCamera,
  torch,
  fire,
  firework,
  house,
  bigHouse,
].map(objectLib => objectLib(options));

module.exports = objectsLib;
