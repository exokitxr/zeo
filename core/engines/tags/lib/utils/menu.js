const zeoModuleElementClasses = new Map();
const _makeZeoModuleElementClass = ({tag, baseClass}) => {
  class ZeoModuleElement extends baseClass {
    entityAddedCallback(entityElement, attribute, value) {
      if (typeof super.entityAddedCallback === 'function') {
        super.entityAddedCallback(entityElement, attribute, value);
      }
    }

    entityRemovedCallback(entityElement) {
      if (typeof super.entityRemovedCallback === 'function') {
        super.entityRemovedCallback(entityElement);
      }
    }

    entityAttributeChangedCallback(entityElement, attribute, oldValue, newValue) {
      if (typeof super.entityAttributeChangedCallback === 'function') {
        super.entityAttributeChangedCallback(entityElement, attribute, oldValue, newValue);
      }
    }
  }

  const ZeoElementConstructor = document.registerElement('z-module-' + tag, ZeoModuleElement);
  return ZeoElementConstructor;
};
const makeZeoModuleElement = ({tag, baseClass}) => {
  let zeoModuleElementClass = zeoModuleElementClasses.get(tag);
  if (!zeoModuleElementClass) {
    zeoModuleElementClass = _makeZeoModuleElementClass({tag, baseClass});
    zeoModuleElementClasses.set(tag, zeoModuleElementClass);
  }

  const zeoModuleElement = new zeoModuleElementClass();
  return zeoModuleElement;
};

const zeoEntityElementClasses = new Map();
const _makeZeoEntityElementClass = ({tag, attributes, baseClass}) => {
  const attributeNames = Object.keys(attributes);

  class ZeoEntityElement extends baseClass {
    get observedAttributes() {
      return attributeNames;
    }

    setAttribute(name, value) {
      this.onsetattribute(name, value);
    }

    setAttributeRaw(name, value) {
      super.setAttribute(name, value);
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (typeof super.attributeChangedCallback === 'function') {
        super.attributeChangedCallback(name, oldValue, newValue);
      }

      if (typeof super.attributeValueChangedCallback === 'function') {
        const attribute = attributes[name];
        const {type, min, max, step, options} = attribute;

        const _castValue = s => {
          if (s !== null) {
            return castValueStringToCallbackValue(s.replace(/^"([\s\S]*)"$/, '$1'), type, min, max, step, options);
          } else {
            return null;
          }
        }

        super.attributeValueChangedCallback(name, _castValue(oldValue), _castValue(newValue));
      }
    }
  }

  const ZeoEntityElementConstructor = document.registerElement('z-entity' + tag, ZeoEntityElement);
  return ZeoEntityElementConstructor;
};
const makeZeoEntityElement = ({tag, attributes, baseClass}) => {
  let zeoEntityElementClass = zeoEntityElementClasses.get(tag);
  if (!zeoEntityElementClass) {
    zeoEntityElementClass = _makeZeoEntityElementClass({tag, attributes, baseClass});
    zeoEntityElementClasses.set(tag, zeoEntityElementClass);
  }

  const zeoElement = new zeoEntityElementClass();

  for (const attributeName in attributes) {
    const attribute = attributes[attributeName];
    const {value: attributeValue} = attribute;
    zeoElement.setAttributeRaw(attributeName, JSON.stringify(attributeValue));
  }

  return zeoElement;
};

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
const castValueStringToCallbackValue = (s, type, min, max, step, options) => {
  switch (type) {
    case 'file': {
      const url = /^\//.test(s) ? ('/archae/fs' + s) : s;
      return new FakeFile(url);
    }
    default:
      return castValueStringToValue(s, type, min, max, step, options);
  }
};
const castValueValueToString = (s, type) => {
  if (typeof s === 'string') {
    return s;
  } else {
    return JSON.stringify(s);
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

const debounce = fn => {
  let running = false;
  let queued = false;

  const _go = () => {
    if (!running) {
      running = true;

      fn(() => {
        running = false;

        if (queued) {
          queued = false;

          _go();
        }
      });
    } else {
      queued = true;
    }
  };
  return _go;
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
  makeZeoModuleElement,
  makeZeoEntityElement,
  castValueStringToValue,
  castValueStringToCallbackValue,
  castValueValueToString,
  debounce,
};
