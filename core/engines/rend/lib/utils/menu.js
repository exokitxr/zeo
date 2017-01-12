const prettyBytes = require('pretty-bytes');

const zeoElementClasses = new Map();
const _makeZeoElementClass = ({tag, elementApiAttributes}) => {
  const attributeNames = Object.keys(elementApiAttributes);

  class ZeoElement extends HTMLElement {
    get observedAttributes() {
      return attributeNames;
    }
  }

  const ZeoElementConstructor = document.registerElement('z-' + tag, ZeoElement);
  return ZeoElementConstructor;
};
const _makeZeoElement = ({tag, elementApiAttributes, attributeValues}) => {
  let zeoElementClass = zeoElementClasses.get(tag);
  if (!zeoElementClass) {
    zeoElementClass = _makeZeoElementClass({tag, elementApiAttributes});
    zeoElementClasses.set(tag, zeoElementClass);
  }

  const zeoElement = new zeoElementClass();

  zeoElement.attributeConfigs = clone(elementApiAttributes);

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

const zeoElementInstanceClasses = new Map();
const _makeZeoElementInstanceClass = ({tag, elementApiAttributes, baseClass}) => {
  const attributeNames = Object.keys(elementApiAttributes);

  class ZeoElementInstance extends baseClass {
    get observedAttributes() {
      return attributeNames;
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (typeof super.attributeChangedCallback === 'function') {
        super.attributeChangedCallback(name, oldValue, newValue);
      }

      if (typeof super.attributeValueChangedCallback === 'function') {
        const attributeConfig = elementApiAttributes[name];
        const {type, min, max, step, options} = attributeConfig;

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

  const ZeoElementInstanceConstructor = document.registerElement('z-i-' + tag, ZeoElementInstance);
  return ZeoElementInstanceConstructor;
};
const _makeZeoElementInstance = ({tag, elementApiAttributes, attributeValues, baseClass}) => {
  let zeoElementInstanceClass = zeoElementInstanceClasses.get(tag);
  if (!zeoElementInstanceClass) {
    zeoElementInstanceClass = _makeZeoElementInstanceClass({tag, elementApiAttributes, baseClass});
    zeoElementInstanceClasses.set(tag, zeoElementInstanceClass);
  }

  const zeoElementInstance = new zeoElementInstanceClass();

  zeoElementInstance.attributeConfigs = clone(elementApiAttributes);

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

class FakeElement {
  constructor({childNodes}) {
    this.childNodes = childNodes;
  }

  insertBefore(element, beforeElement) {
    const {childNodes} = this;

    let beforeElementIndex = childNodes.indexOf(beforeElement);
    if (beforeElementIndex === -1) {
      beforeElementIndex = 0;
    }

    childNodes.splice(beforeElementIndex, 0, element);
  }

  removeChild(element) {
    const {childNodes} = this;

    const beforeElementIndex = childNodes.indexOf(element);
    if (beforeElementIndex !== -1) {
      childNodes.splice(beforeElementIndex, 1);
    }
  }
}

class FakeState {
  constructor({children}) {
    this.children = children;
  }
}

const pathJoin = (a, b) => a + (!/\/$/.test(a) ? '/' : '') + b;
const clone = o => JSON.parse(JSON.stringify(o));
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
const elementsToJson = elements => elements.map(element => {
  const {tagName, attributes, childNodes} = element;

  const _attributesToJson = attributes => {
    const result = {};
    for (let i = 0; i < attributes.length; i++) {
      const {name: attributeName, value: attributeValue} = attributes[i];
      result[attributeName] = JSON.parse(attributeValue || 'null');
    }
    return result;
  };

  return {
    tag: tagName.match(/^z-(.+)$/i)[1].toLowerCase(),
    attributes: _attributesToJson(attributes),
    children: elementsToJson(Array.from(childNodes)),
  };
});
const jsonToElements = (modElementApis, elementsJson) => {
  const _recurse = elementsJson => elementsJson.map(elementJson => {
    const {tag, attributes, children} = elementJson;
    // const match = tag.match(/^([^\.]+?)(?:\.([^\.]+?))?$/);
    // const mainTag = match[1];
    // const subTag = match[2] || null;

    const elementApi = modElementApis[tag];
    const {attributes: elementApiAttributes} = elementApi;

    const attributeValues = attributes;

    const element = _makeZeoElement({
      tag,
      elementApiAttributes,
      attributeValues,
    });

    const childNodes = _recurse(children);
    for (let i = 0; i < childNodes.length; i++) {
      const childNode = childNodes[i];
      element.appendChild(childNode);
    }

    return element;
  });

  return _recurse(elementsJson);
};
const elementApiToElement = elementApi => {
  const {tag, attributes: elementApiAttributes} = elementApi;
  const attributeValues = {};

  return _makeZeoElement({
    tag,
    elementApiAttributes,
    attributeValues,
  });
};
const elementsToState = elements => {
  const elementsJson = elementsToJson(elements);

  const _recurse = (elementsJson, elements) => elementsJson.map((elementJson, i) => {
    const element = elements[i];

    const attributesSpec = (() => {
      const result = {};

      const {attributes} = elementJson;
      const {attributeConfigs} = element;
      for (const attributeName in attributeConfigs) {
        const attributeSpec = (() => {
          const result = {
            value: attributes[attributeName],
          };

          const attributeConfig = attributeConfigs[attributeName];
          for (const attributeConfigKey in attributeConfig) {
            if (attributeConfigKey !== 'value') {
              result[attributeConfigKey] = attributeConfig[attributeConfigKey];
            }
          }

          return result;
        })();
        result[attributeName] = attributeSpec;
      }

      return result;
    })();
    elementJson.attributes = attributesSpec;

    _recurse(elementJson.children, element.childNodes);
  });
  _recurse(elementsJson, elements);

  return elementsJson;
};
const cleanFiles = files => files.map(file => {
  const {name, type, size} = file;
  const description = (() => {
    if (type === 'file') {
      if (size !== null) {
        return prettyBytes(size);
      } else {
        return '';
      }
    } else {
      return 'Directory';
    }
  })();

  return {
    name,
    type,
    description,
  };
});
const getKeyPath = (root, keyPath, childrenKey) => {
  const _recurse = (root, i) => {
    if (i === keyPath.length) {
      return root;
    } else {
      return _recurse(root[childrenKey][keyPath[i]], i + 1);
    }
  };
  return _recurse(root, 0);
};
const getElementKeyPath = (spec, keyPath) => {
  const childNodes = (() => {
    const result = {};
    for (const k in spec) {
      result[k] = new FakeElement({
        childNodes: spec[k],
      });
    }
    return result;
  })();
  return getKeyPath(new FakeElement({childNodes}), keyPath, 'childNodes');
};
const getStateKeyPath = (spec, keyPath) => {
  const children  = (() => {
    const result = {};
    for (const k in spec) {
      result[k] = new FakeState({
        children: spec[k],
      });
    }
    return result;
  })();
  return getKeyPath(new FakeState({children}), keyPath, 'children');
};
const moveElementKeyPath = (spec, oldKeyPath, newKeyPath) => {
  const oldKeyPathHead = oldKeyPath.slice(0, -1);
  const oldKeyPathTail = oldKeyPath[oldKeyPath.length - 1];
  const oldParentElement = getElementKeyPath(spec, oldKeyPathHead);
  const element = oldParentElement.childNodes[oldKeyPathTail];

  const newKeyPathHead = newKeyPath.slice(0, -1);
  const newKeyPathTail = newKeyPath[newKeyPath.length - 1];
  const newParentElement = getElementKeyPath(spec, newKeyPathHead);

  newParentElement.insertBefore(element, newParentElement.childNodes[newKeyPathTail]);
  oldParentElement.removeChild(element);

  return element;
};
const copyElementKeyPath = (spec, oldKeyPath, newKeyPath) => {
  const oldKeyPathHead = oldKeyPath.slice(0, -1);
  const oldKeyPathTail = oldKeyPath[oldKeyPath.length - 1];
  const oldParentElement = getElementKeyPath(spec, oldKeyPathHead);
  const oldElement = oldParentElement.childNodes[oldKeyPathTail];

  const newElement = oldElement.cloneNode(true);
  newElement.attributeConfigs = clone(oldElement.attributeConfigs);

  const newKeyPathHead = newKeyPath.slice(0, -1);
  const newKeyPathTail = newKeyPath[newKeyPath.length - 1];
  const newParentElement = getElementKeyPath(spec, newKeyPathHead);
  newParentElement.insertBefore(newElement, newParentElement.childNodes[newKeyPathTail]);

  return newElement;
};
const removeElementKeyPath = (spec, keyPath) => {
  const keyPathHead = keyPath.slice(0, -1);
  const keyPathTail = keyPath[keyPath.length - 1];
  const oldParentElement = getElementKeyPath(spec, keyPathHead);
  const element = oldParentElement.childNodes[keyPathTail];

  oldParentElement.removeChild(oldParentElement.childNodes[keyPathTail]);

  return element;
};
const insertElementAtKeyPath = (root, keyPath, element) => {
  const keyPathHead = keyPath.slice(0, -1);
  const keyPathTail = keyPath[keyPath.length - 1];
  const targetParentElement = getElementKeyPath(root, keyPathHead);

  targetParentElement.insertBefore(element, targetParentElement.childNodes[keyPathTail]);
};
const keyPathEquals = (a, b) => a.length === b.length && a.every((ai, i) => {
  const bi = b[i];
  return ai === bi;
});
const isSubKeyPath = (a, b) =>
  a.length >= b.length &&
  b.every((bi, i) => {
    const ai = a[i];
    return bi === ai;
  });
const isAdjacentKeyPath = (a, b) => {
  if (a.length === b.length) {
    for (let i = 0; i < a.length - 1; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    const lastA = a[a.length - 1];
    const lastB = b[b.length - 1];
    return (lastA === lastB) ||  (lastA === (lastB + 1));
  } else {
    return false;
  }
};
const parseKeyPath = s => s.split(':').map(p => {
  if (/^[0-9]+$/.test(p)) {
    return parseInt(p, 10);
  } else {
    return p;
  }
});
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
const constructElement = (modElementApis, element) => {
  const {tagName, childNodes} = element;
  const match = tagName.match(/^z-(.+)$/i);
  const tag = match[1].toLowerCase();
  // const mainTag = match[1].toLowerCase();
  // const subTag = match[2] ? match[2].toLowerCase() : null;
  // const tag = mainTag + ((subTag !== null) ? ('.' + subTag) : '');

  const elementApi = modElementApis[tag];
  const {attributes: elementApiAttributes} = elementApi;

  const attributeValues = (() => {
    const result = {};
    for (const attributeName in elementApiAttributes) {
      const value = JSON.parse(element.getAttribute(attributeName) || 'null');
      result[attributeName] = value;
    }
    return result;
  })();

  const baseClass = elementApi;

  const elementInstance = _makeZeoElementInstance({tag, elementApiAttributes, attributeValues, baseClass});

  const childNodeInstances = constructElements(modElementApis, Array.from(childNodes));
  for (let i = 0; i < childNodeInstances.length; i++) {
    const childNodeInstance = childNodeInstances[i];
    elementInstance.appendChild(childNodeInstance);
  }

  return elementInstance;
};
const constructElements = (modElementApis, elements) => elements.map(element => constructElement(modElementApis, element));
const destructElement = instance => {
  const {childNodes} = instance;

  for (let i = 0; i < childNodes.length; i++) {
    const childNode = childNodes[i];
    destructElement(childNode);
  }

  instance.destructor();
};

module.exports = {
  pathJoin,
  clone,
  debounce,
  elementsToJson,
  jsonToElements,
  elementApiToElement,
  elementsToState,
  cleanFiles,
  getKeyPath,
  getElementKeyPath,
  getStateKeyPath,
  moveElementKeyPath,
  copyElementKeyPath,
  removeElementKeyPath,
  keyPathEquals,
  isSubKeyPath,
  isAdjacentKeyPath,
  parseKeyPath,
  insertElementAtKeyPath,
  castValueStringToValue,
  castValueStringToCallbackValue,
  castValueValueToString,
  constructElement,
  constructElements,
  destructElement,
};
