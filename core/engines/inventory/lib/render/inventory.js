const renderAttributes = (ctx, attributes, attributeSpecs, fontSize, w, h, {arrowDownImg, linkImg}) => {
  const rowHeight = 100;

  ctx.font = `${fontSize}px Open sans`;

  let i = 0;
  for (const name in attributeSpecs) {
    const attributeSpec = attributeSpecs[name];
    const {type} = attributeSpec;

    const attributeObject = attributes[name] || {};
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
      ctx.fillRect(w + (factor / 640), h - 25 + i*rowHeight, 5, 25 + 5 + 25);
    } else if (type === 'select') {
      const {options} = attributeSpec;

      ctx.strokeStyle = '#111';
      ctx.lineWidth = 3;
      ctx.strokeRect(w, h + i*rowHeight, 640, fontSize*2);
      ctx.fillStyle = '#111';
      ctx.fillText(value, w, h + fontSize*2 - fontSize*0.3 + i*rowHeight, 640);
      ctx.drawImage(arrowDownImg, w + 640 - fontSize*2, h + i*rowHeight, fontSize*2, fontSize*2);
    } else if (type === 'color') {
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 3;
      ctx.strokeRect(w, h + i*rowHeight, fontSize*2, fontSize*2);
      ctx.fillStyle = value;
      ctx.fillRect(w + 5, h + 5 + i*rowHeight, fontSize*2 - 5*2, fontSize*2 - 5*2);
      ctx.fillStyle = '#EEE';
      ctx.fillRect(w + fontSize*2, h + i*rowHeight, 640, fontSize*2);
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
      ctx.fillRect(w, h + i*rowHeight, 640 - fontSize*2, fontSize * 2);
      ctx.fillStyle = '#111';
      ctx.fillText(value, w, h + fontSize*2 - fontSize*0.3 + i*rowHeight, 640);
      ctx.drawImage(linkImg, w + 640 - fontSize*2, h + i*rowHeight, fontSize*2, fontSize*2);
    }

    i++;
  }
};

module.exports = {
  renderAttributes,
};
