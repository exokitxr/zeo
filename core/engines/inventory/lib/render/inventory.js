const rowHeight = 100;

const renderAttributes = (ctx, attributes, attributeSpecs, fontSize, w, h, menuState, {arrowDownImg, linkImg}) => {
  ctx.font = `${fontSize}px Open sans`;

  const attributeNames = Object.keys(attributeSpecs);
  for (let i = attributeNames.length - 1; i >= 0; i--) {
    const attributeName = attributeNames[i];
    const attributeSpec = attributeSpecs[attributeName];
    const {type} = attributeSpec;

    const attributeObject = attributes[attributeName] || {};
    let {value} = attributeObject;
    if (value === undefined) {
      value = attributeSpec.value;
    }

    if (type === 'matrix') {
      ctx.fillStyle = '#EEE';
      ctx.fillRect(w, h + i*rowHeight, 640, fontSize*2);
      ctx.fillStyle = '#111';
      ctx.fillText(value.join(','), w, h + fontSize*2 - fontSize*0.3 + i*rowHeight, 640);
    } else if (type === 'vector') {
      ctx.fillStyle = '#EEE';
      ctx.fillRect(w, h + i*rowHeight, 640, fontSize*2);
      ctx.fillStyle = '#111';
      ctx.fillText(value.join(','), w, h + fontSize*2 - fontSize*0.3 + i*rowHeight, 640);
    } else if (type === 'text') {
      ctx.fillStyle = '#EEE';
      ctx.fillRect(w, h + i*rowHeight, 640, fontSize*2);
      ctx.fillStyle = '#111';
      ctx.fillText(value, w, h + fontSize*2 - fontSize*0.3 + i*rowHeight, 640);
    } else if (type === 'number') {
      const {min, max} = attributeSpec;

      if (min === undefined) {
        min = 0;
      }
      if (max === undefined) {
        max = 10;
      }

      const factor = (value - min) / (max - min);

      ctx.fillStyle = '#CCC';
      ctx.fillRect(w, h + i*rowHeight, 640, 5);
      ctx.fillStyle = '#ff4b4b';
      ctx.fillRect(w + (factor * 640), h - 25 + i*rowHeight, 5, 25 + 5 + 25);
    } else if (type === 'select') {
      if (menuState.focus !== attributeName) {
        ctx.fillStyle = '#FFF';
        ctx.fillRect(w, h + i*rowHeight, 640, fontSize*2);

        ctx.fillStyle = '#111';
        ctx.fillText(value, w, h + fontSize*2 - fontSize*0.5 + i*rowHeight, 640);
        ctx.drawImage(arrowDownImg, w + 640 - fontSize*2, h + i*rowHeight, fontSize*2, fontSize*2);

        ctx.strokeStyle = '#111';
        ctx.lineWidth = 3;
        ctx.strokeRect(w, h + i*rowHeight, 640, fontSize*2);
      } else {
        const {options} = attributeSpec;

        ctx.fillStyle = '#FFF';
        ctx.fillRect(w, h + i*rowHeight, 640, Math.max(options.length, 1) * fontSize*2);

        for (let j = 0; j < options.length; j++) {
          const option = options[j];

          if (value === option) {
            ctx.fillStyle = '#EEE';
            ctx.fillRect(w, h + i*rowHeight + j*fontSize*2, 640, fontSize*2);
          }

          ctx.fillStyle = '#111';
          ctx.fillText(option, w, h + fontSize*2 - fontSize*0.5 + i*rowHeight + j*fontSize*2, 640);
        }

        ctx.strokeStyle = '#111';
        ctx.lineWidth = 3;
        ctx.strokeRect(w, h + i*rowHeight, 640, Math.max(options.length, 1) * fontSize*2);
      }
    } else if (type === 'color') {
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 3;
      ctx.strokeRect(w, h + i*rowHeight, fontSize*2, fontSize*2);
      ctx.fillStyle = value;
      ctx.fillRect(w + 5, h + 5 + i*rowHeight, fontSize*2 - 5*2, fontSize*2 - 5*2);
      ctx.fillStyle = '#EEE';
      ctx.fillRect(w + fontSize*2, h + i*rowHeight, 640 - fontSize*2, fontSize*2);
      ctx.fillStyle = '#111';
      ctx.fillText(value, w + fontSize*2, h + fontSize*2 - fontSize*0.3 + i*rowHeight, 640);
    } else if (type === 'checkbox') {
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 3;
      ctx.strokeRect(w, h + i*rowHeight, 60, 30);
      ctx.fillStyle = '#111';
      ctx.fillRect(w + 5, h + 5 + i*rowHeight, (60 - 5*2)/2, 30 - 5*2);
    } else if (type === 'file') {
      ctx.fillStyle = '#EEE';
      ctx.fillRect(w, h + i*rowHeight, 640 - fontSize*2, fontSize*2);
      ctx.fillStyle = '#111';
      ctx.fillText(value, w, h + fontSize*2 - fontSize*0.3 + i*rowHeight, 640);
      ctx.drawImage(linkImg, w + 640 - fontSize*2, h + i*rowHeight, fontSize*2, fontSize*2);
    }
  }
};

const getAttributesAnchors = (attributeSpecs, fontSize, w, h, menuState, {focus}) => {
  const result = [];

  const _pushAnchor = (x, y, w, h, name, type) => {
    result.push({
      left: x,
      right: x + w,
      top: y,
      bottom: y + h,
      triggerdown: (e, hoverState) => {
        const fx = (hoverState.x - x) / w;
        const fy = (hoverState.y - y) / h;

        focus({
          name,
          type,
          fx,
          fy,
        });
      },
    });
  };

  let i = 0;
  for (const name in attributeSpecs) {
    const attributeSpec = attributeSpecs[name];
    const {type} = attributeSpec;

    if (type === 'matrix') {
      _pushAnchor(w, h + i*rowHeight, 640, fontSize*2, name, type);
    } else if (type === 'vector') {
      _pushAnchor(w, h + i*rowHeight, 640, fontSize*2, name, type);
    } else if (type === 'text') {
      _pushAnchor(w, h + i*rowHeight, 640, fontSize*2, name, type);
    } else if (type === 'number') {
      _pushAnchor(w, h - 25 + i*rowHeight, 640, 25 + 5 + 25, name, type);
    } else if (type === 'select') {
      if (menuState.focus !== name) {
        _pushAnchor(w, h + i*rowHeight, 640, fontSize*2, name, type);
      } else {
        const {options} = attributeSpec;
        for (let j = 0; j < options.length; j++) {
          _pushAnchor(w, h + i*rowHeight + j*fontSize*2, 640, fontSize*2, name, type);
        }
      }
    } else if (type === 'color') {
      _pushAnchor(w, h + i*rowHeight, fontSize*2, fontSize*2, name, type);
      _pushAnchor(w + fontSize*2, h + i*rowHeight, 640 - fontSize*2, fontSize*2, name, type);
    } else if (type === 'checkbox') {
      _pushAnchor(w, h + i*rowHeight, 640, 30, name, type);
    } else if (type === 'file') {
      _pushAnchor(w, h + i*rowHeight, 640 - fontSize*2, fontSize*2, name, type);
    }

    i++;
  }

  return result;
};

module.exports = {
  renderAttributes,
  getAttributesAnchors,
};
