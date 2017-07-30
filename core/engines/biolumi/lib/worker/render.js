(() => {

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

const render = (src, width, height) => {
  const xmlSrc = (() => {
    const el = document.createElement('div');
    el.setAttribute('style', rootCss);
    el.innerHTML = src;
    return new XMLSerializer().serializeToString(el);
  })();
  const cleanSrc = xmlSrc
    .replace(/([^\x00-\x7F])/g, (all, c) => ('&#' + c.charCodeAt(0) + ';')) // convert non-ascii to HTML entities
    .replace(/#/g, '%23'); // firefox gets confused if we don't escape hashes in the data url

  const _requestImageArrayBuffer = () => new Promise((accept, reject) => {
    const wrappedSrc = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
      '<foreignObject width="100%" height="100%" x="0" y="0">' +
        cleanSrc +
      '</foreignObject>' +
    '</svg>';

    const img = new Image();
    img.src = wrappedSrc;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      fetch(dataUrl)
        .then(res => res.arrayBuffer())
        .then(accept)
        .catch(reject);
    };
    img.onerror = err => {
      reject(err);
    };
  });
  const _requestAnchors = () => {
    const divEl = (() => {
      const el = document.createElement('div');
      el.style.cssText = 'position: absolute; top: 0; left: 0; width: ' + width + 'px;';
      el.innerHTML = cleanSrc;
      return el;
    })();
    document.body.appendChild(divEl);

    const anchors = Array.from(divEl.querySelectorAll('a'))
      .map(a => {
        if (a.style.display !== 'none' && a.style.visibility !== 'hidden') {
          const rect = a.getBoundingClientRect();
          const {left, right, top, bottom} = rect;
          const onclick = a.getAttribute('onclick') || null;
          const onmousedown = a.getAttribute('onmousedown') || null;
          const onmouseup = a.getAttribute('onmouseup') || null;

          return [left, right, top, bottom, onclick, onmousedown, onmouseup];
        } else {
          return null;
        }
      })
      .filter(anchor => anchor !== null);

    document.body.removeChild(divEl);

    return Promise.resolve(anchors);
  };

  return Promise.all([
    _requestImageArrayBuffer(),
    _requestAnchors()
  ])
    .then(([
      imageArrayBuffer,
      anchors,
    ]) => ({
      imageArrayBuffer,
      anchors,
    }));
};

const fonts = `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`;
const monospaceFonts = `Consolas, "Liberation Mono", Menlo, Courier, monospace`;
const fontWeight = 300;
const fontStyle = 'normal';
const rootCss = `margin: 0px; padding: 0px; height: 100%; width: 100%; font-family: ${fonts}; font-weight: ${fontWeight}; overflow: visible; user-select: none;`;

module.exports = render;

})();
