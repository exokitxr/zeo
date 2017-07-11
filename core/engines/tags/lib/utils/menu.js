class ComponentApi {
  constructor(baseObject) {
    this.attributes = baseObject.attributes || {};
    this.entityAddedCallback = baseObject.entityAddedCallback || nop;
    this.entityRemovedCallback = baseObject.entityRemovedCallback || nop;
    this.entityAttributeValueChangedCallback = baseObject.entityAttributeValueChangedCallback || nop;
  }
}

const normalizeComponentApi = baseObject => new ComponentApi(baseObject);
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
const nop = () => {};

module.exports = {
  normalizeComponentApi,
  debounce,
};
