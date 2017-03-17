const zeoModuleElementClasses = new Map();
const _makeZeoModuleElementClass = ({tag, baseObject}) => {
  class ZeoModuleElement extends HTMLElement {
    entityAddedCallback(entityElement) {
      if (baseObject.entityAddedCallback) {
        baseObject.entityAddedCallback.call(this, entityElement);
      }
    }

    entityRemovedCallback(entityElement) {
      if (baseObject.entityRemovedCallback) {
        baseObject.entityRemovedCallback.call(this, entityElement);
      }
    }

    entityAttributeValueChangedCallback(entityElement, attribute, oldValue, newValue) {
      if (baseObject.entityAttributeValueChangedCallback) {
        baseObject.entityAttributeValueChangedCallback.call(this, entityElement, attribute, oldValue, newValue);
      }
    }
  }

  const ZeoModuleElementConstructor = document.registerElement('z-module-' + tag, ZeoModuleElement);
  return ZeoModuleElementConstructor;
};
const makeZeoModuleElement = ({tag, baseObject}) => { // XXX rename this to makeZeoComponentElement
  let zeoModuleElementClass = zeoModuleElementClasses.get(tag);
  if (!zeoModuleElementClass) {
    zeoModuleElementClass = _makeZeoModuleElementClass({tag, baseObject});
    zeoModuleElementClasses.set(tag, zeoModuleElementClass);
  }

  const zeoModuleElement = new zeoModuleElementClass();
  return zeoModuleElement;
};

const zeoEntityElementConstructor = (() => {
  class ZeoEntityElement extends HTMLElement {}

  const ZeoEntityElementConstructor = document.registerElement('z-entity', ZeoEntityElement);
  return ZeoEntityElementConstructor;
})();
const makeZeoEntityElement = () => new zeoEntityElementConstructor();

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
