const stick = require('./stick');
const stone = require('./stone');
const grass = require('./grass');
const tree = require('./tree');
const wood = require('./wood');
const flintSteel = require('./flint-steel');
const apple = require('./apple');
const craftingTable = require('./crafting-table');
const mirror = require('./mirror');
const paper = require('./paper');
const camera = require('./camera');
const torch = require('./torch');
const fire = require('./fire');

const objectsLib = options => [
  stick,
  stone,
  grass,
  tree,
  wood,
  flintSteel,
  apple,
  craftingTable,
  mirror,
  paper,
  camera,
  torch,
  fire,
].map(objectLib => objectLib(options));

module.exports = objectsLib;
