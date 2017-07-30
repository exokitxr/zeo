const render = require('../worker/render');
const Anchor = require('../worker/anchor');

const rasterize = () => {
  return {
    rasterize: (src, width, height) => render(src, width, height)
      .then(({
        imageArrayBuffer,
        anchors,
      }) => Promise.all([
        createImageBitmap(new Blob([imageArrayBuffer], {type: 'image/png'}), 0, 0, width, height, {
          imageOrientation: 'flipY',
        }),
        Promise.resolve(anchors.map(([left, right, top, bottom, onclick, onmousedown, onmouseup]) =>
          new Anchor(left, right, top, bottom, onclick, onmousedown, onmouseup)
        )),
      ]))
      .then(([
        imageBitmap,
        anchors,
      ]) => ({
        imageBitmap,
        anchors,
      })),
  };
};

module.exports = rasterize;
