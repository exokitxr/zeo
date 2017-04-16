import {
  WIDTH,
  HEIGHT,
} from '../constants/menu';

const makeRenderer = ({creatureUtils}) => {

const getLabelSrc = ({label: {username}}) => {
  return `\
    <div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; justify-content: center; align-items: center;">
      <div style="display: flex; justify-content: center; align-items: center;">
        <img src="${creatureUtils.makeStaticCreature('user:' + username)}" width="${HEIGHT}" height="${HEIGHT}" style="margin-left: -${HEIGHT}px; margin-right: 20px; image-rendering: pixelated;" />
        <span style="font-size: ${HEIGHT * 0.6}px; white-space: nowrap; text-overflow: ellipsis;">${username}</span>
      </div>
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
