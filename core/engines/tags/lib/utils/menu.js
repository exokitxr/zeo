const makeUtils = ({fs}) => {

const zeoComponentElementClasses = new Map();
const zeoComponentElementConstructor = (() => {
  const entityApis = new Map();

  class ZeoComponentElement extends HTMLElement {
    entityAddedCallback(entityElement) {
      let entityApi = entityApis.get(entityElement);
      if (!entityApi) {
        const entityApiData = {};
        entityApi = Object.create(entityElement, {
          getComponentApi: {
            value: () => entityApiData,
          },
          getObject: {
            value: () => entityElement._object,
          },
          getData: {
            value: () => _jsonParse(entityElement.innerHTML),
          },
          setData: {
            value: data => {
              entityElement.innerHTML = JSON.stringify(data, null, 2);
            },
          },
        });
        entityApis.set(entityElement, entityApi);
      }

      const {_baseObject: baseObject} = this;
      if (baseObject.entityAddedCallback) {
        baseObject.entityAddedCallback.call(this, entityApi);
      }
    }

    entityRemovedCallback(entityElement) {
      const entityApi = entityApis.get(entityElement);
      entityApis.delete(entityElement);

      const {_baseObject: baseObject} = this;
      if (baseObject.entityRemovedCallback) {
        baseObject.entityRemovedCallback.call(this, entityApi);
      }
    }

    entityAttributeValueChangedCallback(entityElement, attribute, oldValue, newValue) {
      const entityApi = entityApis.get(entityElement);

      const {_baseObject: baseObject} = this;
      if (baseObject.entityAttributeValueChangedCallback) {
        baseObject.entityAttributeValueChangedCallback.call(this, entityApi, attribute, oldValue, newValue);
      }
    }

    entityDataChangedCallback(entityElement, oldValue, newValue) {
      const entityApi = entityApis.get(entityElement);

      const {_baseObject: baseObject} = this;
      if (baseObject.entityDataChangedCallback) {
        baseObject.entityDataChangedCallback.call(this, entityApi, oldValue, newValue);
      }
    }
  }

  const ZeoComponentElementConstructor = document.registerElement('z-component', ZeoComponentElement);
  return ZeoComponentElementConstructor;
})();
const makeZeoComponentElement = ({baseObject}) => {
  const zeoComponentElement = new zeoComponentElementConstructor();
  zeoComponentElement._baseObject = baseObject;
  return zeoComponentElement;
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
      return fs.makeFile(s);
    }
    default: {
      return s;
    }
  }
};
const castValueToCallbackValue = (value, type) => {
  switch (type) {
    case 'file':
      return fs.makeFile(value);
    default:
      return value;
  }
};
const castValueValueToString = (s, type) => {
  if (typeof s === 'string') {
    return s;
  } else {
    return JSON.stringify(s);
  }
};

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
    return undefined;
  }
};

return {
  makeZeoComponentElement,
  castValueStringToValue,
  castValueToCallbackValue,
  castValueValueToString,
  debounce,
};

};

module.exports = {
  makeUtils,
};
