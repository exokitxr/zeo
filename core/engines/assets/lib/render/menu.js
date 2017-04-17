import {
  LABEL_WIDTH,
  LABEL_HEIGHT,

  MENU_WIDTH,
  MENU_HEIGHT,
} from '../constants/menu';

const makeRenderer = ({creatureUtils}) => {

const getLabelSrc = ({label: {username}}) => {
  return `\
    <div style="display: flex; width: ${LABEL_WIDTH}px; height: ${LABEL_HEIGHT}px; justify-content: center; align-items: center;">
      <div style="display: flex; justify-content: center; align-items: center;">
        <img src="${creatureUtils.makeStaticCreature('user:' + username)}" width="${LABEL_HEIGHT}" height="${LABEL_HEIGHT}" style="margin-left: ${-LABEL_HEIGHT}px; margin-right: 20px; image-rendering: pixelated;" />
        <span style="font-size: ${LABEL_HEIGHT * 0.6}px; white-space: nowrap; text-overflow: ellipsis;">${username}</span>
      </div>
    </div>
  `;
};

const getMenuSrc = ({menu: {username}}) => {
  return `\
    <div style="display: flex; width: ${MENU_WIDTH}px; height: ${MENU_HEIGHT}px; justify-content: center; align-items: center;">
      <div style="display: flex; justify-content: center; align-items: center;">
        <img src="${creatureUtils.makeStaticCreature('user:' + username)}" width="${MENU_HEIGHT}" height="${MENU_HEIGHT}" style="margin-right: 50px; image-rendering: pixelated;" />
        <span style="font-size: ${200 * 0.6}px; white-space: nowrap; text-overflow: ellipsis;">${username}'s Menu</span>
      </div>
    </div>
  `;
};

return {
  getLabelSrc,
  getMenuSrc,
};

};

export default {
  makeRenderer,
};
