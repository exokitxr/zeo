const prettyBytes = require('pretty-bytes');

const pathJoin = (a, b) => a + (!/\/$/.test(a) ? '/' : '') + b;
const clone = o => JSON.parse(JSON.stringify(o));
const cleanMods = mods => mods.map(({name, description, installed}) => ({name, description, installed}));
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
};
const keyPathEquals = (a, b) => a.length === b.length && a.every((ai, i) => {
  const bi = b[i];
  return ai === bi;
});
const isSubKeyPath = (a, b) => {
  return a.length >= b.length && b.every((bi, i) => {
    const ai = a[i];
    return bi === ai;
  });
};
const parseKeyPath = s => s.split(':').map(p => {
  if (/^[0-9]+$/.test(p)) {
    return parseInt(p, 10);
  } else {
    return p;
  }
});
const insertElementAtKeyPath = (root, keyPath) => {
  const element = {
    tag: 'new-element',
    attributes: {
      position: {
        type: 'position',
        value: [1, 2, 3].join(' '),
      },
    },
    children: [],
  };

  const targetElement = getElementKeyPath(root, keyPath);
  targetElement.children.push(element);
};
const castValueStringToValue = (s, type, min, max, options) => {
  switch (type) {
    case 'position':
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

module.exports = {
  pathJoin,
  clone,
  cleanMods,
  cleanFiles,
  getKeyPath,
  getElementKeyPath,
  moveElementKeyPath,
  keyPathEquals,
  isSubKeyPath,
  parseKeyPath,
  insertElementAtKeyPath,
  castValueStringToValue,
  castValueValueToString,
};
