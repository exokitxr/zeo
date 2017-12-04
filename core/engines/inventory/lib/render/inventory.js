const {
  ITEM_MENU_SIZE,
  ITEM_MENU_INNER_SIZE,
  ITEM_MENU_WORLD_SIZE,
} = require('../constants/menu');

const rowHeight = 100;

const _roundToDecimals = (value, decimals) => Number(Math.round(value+'e'+decimals)+'e-'+decimals);

module.exports = THREE => {
  const localColor = new THREE.Color();

  const renderAttributes = (ctx, attributes, attributeSpecs, fontSize, w, h, menuState, {arrowDownImg, colorWheelImg, linkImg}) => {
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
        ctx.fillRect(w, h + i*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2);
        ctx.fillStyle = '#111';
        ctx.fillText(value.join(','), w, h + fontSize*2 - fontSize*0.3 + i*rowHeight, ITEM_MENU_INNER_SIZE);
      } else if (type === 'vector') {
        ctx.fillStyle = '#EEE';
        ctx.fillRect(w, h + i*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2);
        ctx.fillStyle = '#111';
        ctx.fillText(value.join(','), w, h + fontSize*2 - fontSize*0.3 + i*rowHeight, ITEM_MENU_INNER_SIZE);
      } else if (type === 'text') {
        ctx.fillStyle = '#EEE';
        ctx.fillRect(w, h + i*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2);
        ctx.fillStyle = '#111';
        ctx.fillText(value, w, h + fontSize*2 - fontSize*0.3 + i*rowHeight, ITEM_MENU_INNER_SIZE);
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
        ctx.fillRect(w, h + i*rowHeight, ITEM_MENU_INNER_SIZE, 5);
        ctx.fillStyle = '#ff4b4b';
        ctx.fillRect(w + (factor * ITEM_MENU_INNER_SIZE), h - 25 + i*rowHeight, 5, 25 + 5 + 25);
      } else if (type === 'select') {
        if (menuState.focus !== attributeName) {
          ctx.fillStyle = '#FFF';
          ctx.fillRect(w, h + i*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2);

          ctx.fillStyle = '#111';
          ctx.fillText(value, w, h + fontSize*2 - fontSize*0.5 + i*rowHeight, ITEM_MENU_INNER_SIZE);
          ctx.drawImage(arrowDownImg, w + ITEM_MENU_INNER_SIZE - fontSize*2, h + i*rowHeight, fontSize*2, fontSize*2);

          ctx.strokeStyle = '#111';
          ctx.lineWidth = 3;
          ctx.strokeRect(w, h + i*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2);
        } else {
          const {options} = attributeSpec;

          ctx.fillStyle = '#FFF';
          ctx.fillRect(w, h + i*rowHeight, ITEM_MENU_INNER_SIZE, Math.max(options.length, 1) * fontSize*2);

          for (let j = 0; j < options.length; j++) {
            const option = options[j];

            if (value === option) {
              ctx.fillStyle = '#EEE';
              ctx.fillRect(w, h + i*rowHeight + j*fontSize*2, ITEM_MENU_INNER_SIZE, fontSize*2);
            }

            ctx.fillStyle = '#111';
            ctx.fillText(option, w, h + fontSize*2 - fontSize*0.5 + i*rowHeight + j*fontSize*2, ITEM_MENU_INNER_SIZE);
          }

          ctx.strokeStyle = '#111';
          ctx.lineWidth = 3;
          ctx.strokeRect(w, h + i*rowHeight, ITEM_MENU_INNER_SIZE, Math.max(options.length, 1) * fontSize*2);
        }
      } else if (type === 'color') {
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 3;
        ctx.strokeRect(w, h + i*rowHeight, fontSize*2, fontSize*2);
        ctx.fillStyle = value;
        ctx.fillRect(w + 5, h + 5 + i*rowHeight, fontSize*2 - 5*2, fontSize*2 - 5*2);
        ctx.fillStyle = '#EEE';
        ctx.fillRect(w + fontSize*2, h + i*rowHeight, ITEM_MENU_INNER_SIZE - fontSize*2, fontSize*2);
        ctx.fillStyle = '#111';
        ctx.fillText(value, w + fontSize*2, h + fontSize*2 - fontSize*0.3 + i*rowHeight, ITEM_MENU_INNER_SIZE);

        if (menuState.focus === attributeName) {
          ctx.drawImage(colorWheelImg, w, h + i*rowHeight, 256, 256);
        }
      } else if (type === 'checkbox') {
        if (value) {
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 3;
          ctx.strokeRect(w, h + i*rowHeight, 60, 30);

          ctx.fillStyle = '#111';
          ctx.fillRect(w + 30, h + 5 + i*rowHeight, (60 - 5*2)/2, 30 - 5*2);
        } else {
          ctx.strokeStyle = '#CCC';
          ctx.lineWidth = 3;
          ctx.strokeRect(w, h + i*rowHeight, 60, 30);

          ctx.fillStyle = '#CCC';
          ctx.fillRect(w + 5, h + 5 + i*rowHeight, (60 - 5*2)/2, 30 - 5*2);
        }
      } else if (type === 'file') {
        ctx.fillStyle = '#EEE';
        ctx.fillRect(w, h + i*rowHeight, ITEM_MENU_INNER_SIZE - fontSize*2, fontSize*2);
        ctx.fillStyle = '#111';
        ctx.fillText(value, w, h + fontSize*2 - fontSize*0.3 + i*rowHeight, ITEM_MENU_INNER_SIZE);
        ctx.drawImage(linkImg, w + ITEM_MENU_INNER_SIZE - fontSize*2, h + i*rowHeight, fontSize*2, fontSize*2);
      }
    }

    ctx.fillStyle = '#CCC';
    ctx.fillRect(ITEM_MENU_SIZE - 60, ITEM_MENU_SIZE*0.05, 30, ITEM_MENU_SIZE*0.9);
    ctx.fillStyle = '#ff4b4b';
    ctx.fillRect(ITEM_MENU_SIZE - 60, ITEM_MENU_SIZE*0.05, 30, ITEM_MENU_SIZE*0.9 / 2);
  };

  const getAttributesAnchors = (attributes, attributeSpecs, fontSize, w, h, menuState, {colorWheelImg}, {focus}) => {
    const result = [];

    const _pushAnchor = (x, y, w, h, triggerdown) => {
      result.push({
        left: x,
        right: x + w,
        top: y,
        bottom: y + h,
        triggerdown,
      });
    };
    const _pushAttributeAnchor = (x, y, w, h, name, type, newValue) => {
      _pushAnchor(x, y, w, h, (e, hoverState) => {
        if (type === 'number') {
          const attributeSpec = attributeSpecs[name];
          const {min, max, step} = attributeSpecs[name];

          const fx = (hoverState.x - x) / w;

          newValue = min + (fx * (max - min));
          if (step > 0) {
            newValue = _roundToDecimals(Math.round(newValue / step) * step, 8);
          }
        } else if (type === 'select') {
          // nothing
        } else if (type === 'color') {
          if (typeof newValue === 'function') {
            const fx = (hoverState.x - x) / w;
            const fy = (hoverState.y - y) / h;

            newValue = newValue(fx, fy);
          }
        } else if (type === 'checkbox') {
          // nothing
        }

        focus({
          name,
          type,
          newValue,
        });
      });
    };

    let i = 0;
    for (const attributeName in attributeSpecs) {
      const attributeSpec = attributeSpecs[attributeName];
      const {type} = attributeSpec;

      const attributeObject = attributes[attributeName] || {};
      let {value} = attributeObject;
      if (value === undefined) {
        value = attributeSpec.value;
      }

      if (type === 'matrix') {
        _pushAttributeAnchor(w, h + i*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2, attributeName, type);
      } else if (type === 'vector') {
        _pushAttributeAnchor(w, h + i*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2, attributeName, type);
      } else if (type === 'text') {
        _pushAttributeAnchor(w, h + i*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2, attributeName, type);
      } else if (type === 'number') {
        _pushAttributeAnchor(w, h - 25 + i*rowHeight, ITEM_MENU_INNER_SIZE, 25 + 5 + 25, attributeName, type);
      } else if (type === 'select') {
        if (menuState.focus !== attributeName) {
          _pushAttributeAnchor(w, h + i*rowHeight, ITEM_MENU_INNER_SIZE, fontSize*2, attributeName, type);
        } else {
          const {options} = attributeSpec;
          for (let j = 0; j < options.length; j++) {
            _pushAttributeAnchor(w, h + i*rowHeight + j*fontSize*2, ITEM_MENU_INNER_SIZE, fontSize*2, attributeName, type, options[j]);
          }
        }
      } else if (type === 'color') {
        if (menuState.focus === attributeName) {
          _pushAttributeAnchor(w, h + i*rowHeight, 256, 256, attributeName, type, (fx, fy) => '#' + localColor.setHex(colorWheelImg.getColor(fx, fy)).getHexString());
        }

        _pushAttributeAnchor(w, h + i*rowHeight, fontSize*2, fontSize*2, attributeName, type);
        _pushAttributeAnchor(w + fontSize*2, h + i*rowHeight, ITEM_MENU_INNER_SIZE - fontSize*2, fontSize*2, attributeName, type);
      } else if (type === 'checkbox') {
        _pushAttributeAnchor(w, h + i*rowHeight, ITEM_MENU_INNER_SIZE, 30, attributeName, type, !value);
      } else if (type === 'file') {
        _pushAttributeAnchor(w, h + i*rowHeight, ITEM_MENU_INNER_SIZE - fontSize*2, fontSize*2, attributeName, type);
      }

      i++;
    }

    _pushAnchor(ITEM_MENU_SIZE - 60, ITEM_MENU_SIZE*0.05, 30, ITEM_MENU_SIZE*0.9, () => {
      console.log('trigger down'); // XXX
    });

    return result;
  };

  return {
    renderAttributes,
    getAttributesAnchors,
  };
};
