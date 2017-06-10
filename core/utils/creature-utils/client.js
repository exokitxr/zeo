const creature = require('creaturejs');

const creatureUtils = () => ({
  mount() {
    const {makeAnimatedCreature, makeStaticCreature, makeCanvasCreature, makeSvgCreature} = creature;
    return {
      makeAnimatedCreature,
      makeStaticCreature,
      makeCanvasCreature,
      makeSvgCreature,
    };
  },
});

module.exports = creatureUtils;
