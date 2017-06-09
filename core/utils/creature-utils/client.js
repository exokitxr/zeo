const creature = require('creaturejs');

window.creature = creature;

const creatureUtils = () => ({
  mount() {
    const {makeAnimatedCreature, makeStaticCreature, makeCanvasCreature} = creature;
    return {
      makeAnimatedCreature,
      makeStaticCreature,
      makeCanvasCreature,
    };
  },
});

module.exports = creatureUtils;
