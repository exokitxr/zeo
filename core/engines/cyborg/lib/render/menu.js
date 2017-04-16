import {
  WIDTH,
  HEIGHT,
} from '../constants/menu';

const makeRenderer = ({creatureUtils}) => {

const getLabelSrc = ({label: {username}}) => {
  return `\
    <div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; align-items: center;">
      <img src="${creatureUtils.makeStaticCreature('user:' + username)}" width="${HEIGHT}" height="${HEIGHT}" style="margin-right: 30px; image-rendering: pixelated;" />
      <span style="font-size: ${HEIGHT * 0.6}px;">${username}</span>
    </div>
  `;
};

return {
  getLabelSrc,
};

};

export default {
  makeRenderer,
};
