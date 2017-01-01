const prettyBytes = require('pretty-bytes');

const zeoElementClasses = new Map();
const _makeZeoElementClass = ({tag, attributeNames}) => {
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
    const attributeNames = Object.keys(elementApiAttributes);
    zeoElementClass = _makeZeoElementClass({tag, attributeNames});
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
const _makeZeoElementInstanceClass = ({tag, attributeNames, baseClass}) => {
  class ZeoElementInstance extends baseClass {
    get observedAttributes() {
      return attributeNames;
    }
  }

  const ZeoElementInstanceConstructor = document.registerElement('z-i-' + tag, ZeoElementInstance);
  return ZeoElementInstanceConstructor;
};
const _makeZeoElementInstance = ({tag, elementApiAttributes, attributeValues, baseClass}) => {
  let zeoElementInstanceClass = zeoElementInstanceClasses.get(tag);
  if (!zeoElementInstanceClass) {
    const attributeNames = Object.keys(elementApiAttributes);
    zeoElementInstanceClass = _makeZeoElementInstanceClass({tag, attributeNames, baseClass});
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
const cleanMods = mods => mods.map(({name, description, installed}) => ({name, description, installed}));
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
const jsonToElements = (modApis, elementsJson) => elementsJson.map(elementJson => {
  const {tag, attributes, children} = elementJson;
  const match = tag.match(/^([^\.]+?)(?:\.([^\.]+?))?$/);
  const mainTag = match[1];
  const subTag = match[2] || null;

  const modApi = modApis.get(mainTag);
  const {elements: modElements} = modApi;
  const elementApi = modElements.find(modElement => modElement.tag === tag);
  const {attributes: elementApiAttributes} = elementApi;

  const attributeValues = attributes;

  const element = _makeZeoElement({
    tag,
    elementApiAttributes,
    attributeValues,
  });

  const childNodes = jsonToElements(modApis, children);
  for (let i = 0; i < childNodes.length; i++) {
    const childNode = childNodes[i];
    element.appendChild(childNode);
  }

  return element;
});
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
const getKeyPath = (root, keyPath) => {
  const _recurse = (root, i) => {
    if (i === keyPath.length) {
      return root;
    } else {
      return _recurse(root.childNodes[keyPath[i]], i + 1);
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
  return getKeyPath({childNodes}, keyPath);
};
const moveElementKeyPath = (spec, oldKeyPath, newKeyPath) => {
  const oldKeyPathHead = oldKeyPath.slice(0, -1);
  const oldKeyPathTail = oldKeyPath[oldKeyPath.length - 1];
  const oldParentElement = getElementKeyPath(spec, oldKeyPathHead);
  const element = oldParentElement.childNodes[oldKeyPathTail];
  oldParentElement.removeChild(element);

  const newKeyPathHead = newKeyPath.slice(0, -1);
  const newKeyPathTail = newKeyPath[newKeyPath.length - 1];
  const newParentElement = getElementKeyPath(spec, newKeyPathHead);
  newParentElement.insertBefore(element, newParentElement.childNodes[newKeyPathTail]);

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
    case 'position': {
      const match = s.match(/^([0-9\.]+),([0-9\.]+),([0-9\.]+)$/);
      if (match) {
        return [match[1], match[2], match[3]];
      } else {
        return null;
      }
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
    default: {
      return s;
    }
  }
};
const castValueValueToString = (s, type) => String(s);
const constructElement = (modApis, element) => {
  const {tagName, childNodes} = element;
  const match = tagName.match(/^z-([^\.]+?)(?:\.([^\.]+?))?$/i);
  const mainTag = match[1].toLowerCase();
  const subTag = match[2] ? match[2].toLowerCase() : null;
  const tag = mainTag + ((subTag !== null) ? ('.' + subTag) : '');

  const modApi = modApis.get(mainTag);
  const {elements: modElements} = modApi;
  const elementApi = modElements.find(modElement => modElement.tag === tag);
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

  const childNodeInstances = constructElements(modApis, Array.from(childNodes));
  for (let i = 0; i < childNodeInstances.length; i++) {
    const childNodeInstance = childNodeInstances[i];
    elementInstance.appendChild(childNodeInstance);
  }

  return elementInstance;
};
const constructElements = (modApis, elements) => elements.map(element => constructElement(modApis, element));
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
  cleanMods,
  elementsToJson,
  jsonToElements,
  elementsToState,
  cleanFiles,
  getKeyPath,
  getElementKeyPath,
  moveElementKeyPath,
  copyElementKeyPath,
  removeElementKeyPath,
  keyPathEquals,
  isSubKeyPath,
  isAdjacentKeyPath,
  parseKeyPath,
  insertElementAtKeyPath,
  castValueStringToValue,
  castValueValueToString,
  constructElement,
  constructElements,
  destructElement,
};
