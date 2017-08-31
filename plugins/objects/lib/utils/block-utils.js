const parseBlueprint = s => {
  const lines = s.split('\n');
  const legend = (() => {
    const result = {};
    const headerString = lines[0];
    const legendEntries = headerString.split('|');
    for (let i = 0; i < legendEntries.length; i++) {
      const match = legendEntries[i].match(/^(.)=(.+)$/);
      result[match[1]] = match[2];
    }
    return result;
  })();

  const result = [];
  let currentLayer = null;
  const layersLines = lines.slice(1);
  for (let i = 0; i < layersLines.length; i++) {
    const layerLine = layersLines[i];

    if (layerLine[0] === '|') {
      if (currentLayer) {
        result.push(currentLayer);
        currentLayer = null;
      }
    } else {
      if (!currentLayer) {
        currentLayer = [];
      }

      const row = [];
      for (let j = 0; j < layerLine.length; j++) {
        const c = layerLine[j];
        row.push(c === ' ' ? null : legend[c]);
      }
      currentLayer.push(row);
    }
  }
  if (currentLayer) {
    result.push(currentLayer);
    currentLayer = null;
  }
  return result;
};

module.exports = {
  parseBlueprint,
};
