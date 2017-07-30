const AutoWs = require('autows');
const Anchor = require('../worker/anchor');

const rasterize = () => {
  const queue = [];
  const connection = new AutoWs(_wsUrl('/rasterizeWs'));

  connection.on('message', e => {
    queue.shift()(e.data);
  });

  return {
    rasterize: (src, width, height) => {
      connection.send(JSON.stringify([width, height]) + src);

      return Promise.all([
        new Promise((accept, reject) => {
          queue.push(imageArrayBuffer => {
            createImageBitmap(new Blob([imageArrayBuffer], {type: 'image/png'}), 0, 0, width, height, {
              imageOrientation: 'flipY',
            })
              .then(accept)
              .catch(reject);
          });
        }),
        new Promise((accept, reject) => {
          queue.push(anchorsJson => {
            const anchors = JSON.parse(anchorsJson)
              .map(([left, right, top, bottom, onclick, onmousedown, onmouseup]) =>
                new Anchor(left, right, top, bottom, onclick, onmousedown, onmouseup)
              );
            accept(anchors);
          });
        })
      ])
        .then(([
          imageBitmap,
          anchors,
        ]) => ({
          imageBitmap,
          anchors,
        }));
    },
  };
};
const _wsUrl = s => {
  const l = window.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + s;
};

module.exports = rasterize;
