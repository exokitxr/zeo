const {
  WIDTH,
  HEIGHT,
} = require('../constants/constants');

const getCommentSrc = ({text}) => {
  text = text || ' ';

  console.log('render text', {text});

  return `<div style="width: ${WIDTH}px; height: ${HEIGHT}px; padding: 30px; font-size: 30px;">${text}</div>`;
};

module.exports = {
  getCommentSrc,
};
