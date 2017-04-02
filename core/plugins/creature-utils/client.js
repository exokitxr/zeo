const creature = require('creaturejs');

const creatureUtils = () => ({
  mount() {
    const {makeAnimatedCreature, makeStaticCreature} = creature;

    return {
      makeAnimatedCreature,
      makeStaticCreature,
    };
  },
});

module.exports = creatureUtils;
