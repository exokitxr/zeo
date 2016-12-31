const prettyBytes = require('pretty-bytes');

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
const cleanElements = elements => elements.map(({tag, attributes, children}) => ({
  tag,
  attributes,
  children: cleanElements(children),
}));
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
      return _recurse(root.children[keyPath[i]], i + 1);
    }
  };
  return _recurse(root, 0);
};
const getElementKeyPath = (spec, keyPath) => {
  const children = (() => {
    const result = {};
    for (const k in spec) {
      result[k] = {
        children: spec[k],
      };
    }
    return result;
  })();
  return getKeyPath({children}, keyPath);
};
const moveElementKeyPath = (spec, oldKeyPath, newKeyPath) => {
  const oldKeyPathHead = oldKeyPath.slice(0, -1);
  const oldKeyPathTail = oldKeyPath[oldKeyPath.length - 1];
  const oldParentElement = getElementKeyPath(spec, oldKeyPathHead);
  const element = oldParentElement.children[oldKeyPathTail];

  const newKeyPathHead = newKeyPath.slice(0, -1);
  const newKeyPathTail = newKeyPath[newKeyPath.length - 1];
  const newParentElement = getElementKeyPath(spec, newKeyPathHead);
  newParentElement.children.splice(newKeyPathTail, 0, element);

  oldParentElement.children.splice(oldKeyPathTail + ((keyPathEquals(newKeyPathHead, oldKeyPathHead) && newKeyPathTail <= oldKeyPathTail) ? 1 : 0), 1);

  return element;
};
const copyElementKeyPath = (spec, oldKeyPath, newKeyPath) => {
  const oldKeyPathHead = oldKeyPath.slice(0, -1);
  const oldKeyPathTail = oldKeyPath[oldKeyPath.length - 1];
  const oldParentElement = getElementKeyPath(spec, oldKeyPathHead);
  const oldElement = oldParentElement.children[oldKeyPathTail];

  const _cloneElement = oldElement => {
    const {tag: oldTag, attributes: oldAttributes, children: oldChildren} = oldElement;
    return {
      tag: oldTag,
      attributes: clone(oldAttributes),
      children: oldChildren.map(_cloneElement),
    };
  };
  const newElement = _cloneElement(oldElement);

  const newKeyPathHead = newKeyPath.slice(0, -1);
  const newKeyPathTail = newKeyPath[newKeyPath.length - 1];
  const newParentElement = getElementKeyPath(spec, newKeyPathHead);
  newParentElement.children.splice(newKeyPathTail, 0, newElement);

  return newElement;
};
const removeElementKeyPath = (spec, keyPath) => {
  const keyPathHead = keyPath.slice(0, -1);
  const keyPathTail = keyPath[keyPath.length - 1];
  const oldParentElement = getElementKeyPath(spec, keyPathHead);
  const element = oldParentElement.children[keyPathTail];

  oldParentElement.children.splice(keyPathTail, 1);

  return element;
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
const insertElementAtKeyPath = (root, keyPath, element) => {
  const keyPathHead = keyPath.slice(0, -1);
  const keyPathTail = keyPath[keyPath.length - 1];
  const targetParentElement = getElementKeyPath(root, keyPathHead);
  targetParentElement.children.splice(keyPathTail, 0, element);
};
const castValueStringToValue = (s, type, min, max, options) => {
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
        return n;
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
  const {tag, attributes, children} = element;
  const match = tag.match(/^([^:]+?)(?::([^:]+?))?$/);
  const mainTag = match[1];
  const subTag = match[2] || null;

  const modApi = modApis.get(mainTag);
  const {elements: modElements} = modApi;
  const elementKey = mainTag + ((subTag !== null) ? (':' + subTag) : '');
  const elementApi = modElements.find(modElement => modElement.tag === elementKey);

  const initialAttributes = (() => {
    const result = {};
    for (const attributeName in attributes) {
      const {value: attributeValue} = attributes[attributeName];
      result[attributeName] = attributeValue;
    }
    return result;
  })();
  const elementInstance = new elementApi(initialAttributes);

  for (const attributeName in attributes) {
    const {value: attributeValue} = attributes[attributeName];
    elementInstance[attributeName] = attributeValue;
  }

  elementInstance.children = constructElements(modApis, children);

  return elementInstance;
};
const constructElements = (modApis, elements) => elements.map(element => constructElement(modApis, element));
const destructElement = instance => {
  const {children} = instance;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    destructElement(child);
  }

  instance.destructor();
};

module.exports = {
  pathJoin,
  clone,
  debounce,
  cleanMods,
  cleanElements,
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
