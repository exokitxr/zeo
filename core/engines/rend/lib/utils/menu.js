const _makeZeoElement = ({tag, elementApiAttributes, attributeValues}) => {
  const zeoElement = document.createElement('z-' + tag);

  zeoElement.attributeConfigs = _clone(elementApiAttributes);

  for (const attributeName in elementApiAttributes) {
    const value = (() => {
      let result = attributeValues[attributeName];
      if (result === undefined) {
        result = elementApiAttributes[attributeName].value;
      }
      if (result === undefined) {
        result = null;
      }
      return result;
    })();
    zeoElement.setAttribute(attributeName, JSON.stringify(value));
  }

  return zeoElement;
};

const _makeZeoElementInstance = ({tag, elementApiAttributes, attributeValues, baseClass}) => {
  const zeoElementInstance = document.createElement('z-i-' + tag);

  const attributeChangedCallback = (name, oldValue, newValue) => {
    if (typeof baseClass.prototype.attributeChangedCallback === 'function') {
      baseClass.prototype.attributeChangedCallback.call(zeoElementInstance, name, oldValue, newValue);
    }

    if (typeof baseClass.prototype.attributeValueChangedCallback === 'function') {
      const attributeConfig = elementApiAttributes[name];
      const {type, min, max, step, options} = attributeConfig;

      const _castValue = s => {
        if (s !== null) {
          return castValueStringToValue(s.replace(/^"([\s\S]*)"$/, '$1'), type, min, max, step, options);
        } else {
          return null;
        }
      }

      baseClass.prototype.attributeValueChangedCallback.call(zeoElementInstance, name, _castValue(oldValue), _castValue(newValue));
    }
  };
  const mutationObserver = new MutationObserver(mutations => {
    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];

      if (mutation.type === 'attributes') {
        const {attributeName, oldValue} = mutation;
        const newValue = zeoElementInstance.getAttribute(attributeName);
        attributeChangedCallback(attributeName, oldValue, newValue);
      }
    }
  });
  mutationObserver.observe(elementInstance, {
    attributes: true,
    attributeOldValue: true,
  });

  zeoElementInstance.attributeConfigs = _clone(elementApiAttributes);

  for (const attributeName in elementApiAttributes) {
    const value = (() => {
      let result = attributeValues[attributeName];
      if (result === undefined) {
        result = elementApiAttributes[attributeName].value;
      }
      if (result === undefined) {
        result = null;
      }
      return result;
    })();
    zeoElementInstance.setAttribute(attributeName, JSON.stringify(value));
  }

  return zeoElementInstance;
};

const _clone = o => JSON.parse(JSON.stringify(o));
const castValueStringToValue = (s, type, min, max, step, options) => {
  switch (type) {
    case 'matrix': {
      return _jsonParse(s);
    }
    case 'text': {
      return s;
    }
    case 'color': {
      const match = s.match(/^#?([a-f0-9]{3}(?:[a-f0-9]{3})?)$/i);
      if (match) {
        return '#' + match[1];
      } else {
        return null;
      }
    }
    case 'select': {
      if (options.includes(s)) {
        return s;
      } else {
        return null;
      }
    }
    case 'number': {
      const n = parseFloat(s);

      if (!isNaN(n) && n >= min && n <= max) {
        if (step > 0) {
          return Math.floor(n / step) * step;
        } else {
          return n;
        }
      } else {
        return null;
      }
    }
    case 'checkbox': {
      if (s === 'true') {
        return true;
      } else if (s === 'false') {
        return false;
      } else {
        return null;
      }
    }
    case 'file': {
      return s;
    }
    default: {
      return s;
    }
  }
};
class FakeFile {
  constructor(url) {
    this.url = url;
  }

  fetch({type} = {}) {
    const {url} = this;

    return fetch(url)
      .then(res => {
        switch (type) {
          case 'text': return res.text();
          case 'json': return res.json();
          case 'arrayBuffer': return res.arrayBuffer();
          case 'blob': return res.blob();
          default: return res.blob();
        }
      });
  }
}
const castValueValueToString = (s, type) => {
  if (typeof s === 'string') {
    return s;
  } else {
    return JSON.stringify(s);
  }
};
const _jsonParse = s => {
  let error = null;
  let result;
  try {
    result = JSON.parse(s);
  } catch (err) {
    error = err;
  }
  if (!error) {
    return result;
  } else {
    return null;
  }
};

module.exports = {
  castValueStringToValue,
  castValueValueToString,
};
