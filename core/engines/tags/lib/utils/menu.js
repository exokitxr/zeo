const makeUtils = ({THREE, scene}) => {

const makeZeoComponentElement = baseObject => {
  const entityApis = new Map();

  const componentElement = document.createElement('z-component');
  componentElement.entityAddedCallback = function(entityElement) {
    // per-component properties
    let entityApi = entityApis.get(entityElement);
    if (!entityApi) {
      let entityApiComponentApi = {};
      entityApi = Object.create(entityElement, {
        // bind old methods
        getAttribute: {
          value: entityElement.getAttribute.bind(entityElement),
        },
        setAttribute: {
          value: entityElement.setAttribute.bind(entityElement),
        },
        removeAttribute: {
          value: entityElement.removeAttribute.bind(entityElement),
        },
        hasAttribute: {
          value: entityElement.hasAttribute.bind(entityElement),
        },
        addEventListener: {
          value: entityElement.addEventListener.bind(entityElement),
        },
        removeEventListener: {
          value: entityElement.removeEventListener.bind(entityElement),
        },
        dispatchEvent: {
          value: entityElement.dispatchEvent.bind(entityElement),
        },

        // extensions
        getEntityApi: {
          value: () => entityApiComponentApi,
        },
        setEntityApi: {
          value: newEntityApiComponentApi => {
            entityApiComponentApi = newEntityApiComponentApi;
          },
        },
        getObject: {
          value: () => {
            let {_object: object} = entityElement;

            if (object === null) {
              object = new THREE.Object3D();
              scene.add(object);

              entityElement._object = object;
            }

            return object;
          },
        },
        getData: {
          value: () => _jsonParse(entityElement.innerHTML),
        },
        setData: {
          value: data => {
            entityElement.innerText = JSON.stringify(data, null, 2);
          },
        },
      });
      entityApis.set(entityElement, entityApi);
    }

    if (baseObject.entityAddedCallback) {
      baseObject.entityAddedCallback.call(this, entityApi);
    }
  };
  componentElement.entityRemovedCallback = function(entityElement) {
    const entityApi = entityApis.get(entityElement);
    entityApis.delete(entityElement);

    if (baseObject.entityRemovedCallback) {
      baseObject.entityRemovedCallback.call(this, entityApi);
    }
  };
  componentElement.entityAttributeValueChangedCallback = function(entityElement, attribute, oldValue, newValue) {
    const entityApi = entityApis.get(entityElement);

    if (baseObject.entityAttributeValueChangedCallback) {
      baseObject.entityAttributeValueChangedCallback.call(this, entityApi, attribute, oldValue, newValue);
    }
  };

  componentElement._baseObject = baseObject;

  return componentElement;
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
  debounce,
};

};

module.exports = {
  makeUtils,
};
