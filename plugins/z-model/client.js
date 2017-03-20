const modelsPath = '/archae/models/models/';

const symbol = Symbol();

class Model {
  mount() {
    const {three: {THREE, scene}, elements} = zeo;

    const modelComponent = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
        model: {
          type: 'file',
          value: 'https://cdn.rawgit.com/modulesio/zeo-data/29412380b29e98b18c746a373bdb73aeff59e27a/models/cloud/cloud.json',
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = {};

        entityApi.position = null;
        entityApi.mesh = null;

        entityApi._cancelRequest = null;

        entityApi._updateMesh = () => {
          const {mesh, position} = entityApi;

          if (mesh && position) {
            mesh.position.set(position[0], position[1], position[2]);
            mesh.quaternion.set(position[3], position[4], position[5], position[6]);
            mesh.scale.set(position[7], position[8], position[9]);
          }
        };

        entityApi._cleanup = () => {
          const {mesh, _cancelRequest: cancelRequest} = entityApi;
          if (mesh) {
            scene.remove(mesh);
          }
          if (cancelRequest) {
            cancelRequest();
          }
        };

        entityElement[symbol] = entityApi;
      },
      entityRemovedCallback(entityElement) {
        const {[symbol]: entityApi} = entityElement;

        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const {[symbol]: entityApi} = entityElement;

        switch (name) {
          case 'position': {
            entityApi.position = newValue;

            entityApi._updateMesh();

            break;
          }
          case 'model': {
            const {mesh: oldMesh, _cancelRequest: cancelRequest} = entityApi;
            if (oldMesh) {
              scene.remove(oldMesh);
              this.mesh = null;
            }
            if (cancelRequest) {
              cancelRequest();
            }

            let live = true;
            entityApi._cancelRequest = () => {
              live = false;
            };

            const file = newValue;
            file.read({type: 'model'})
              .then(mesh => {
                if (live) {
                  scene.add(mesh);
                  entityApi.mesh = mesh;

                  entityApi._updateMesh();

                  entityApi._cancelRequest = null;
                }
              })
              .catch(err => {
                console.warn('failed to load model', err);
              });

            break;
          }
        }
      },
    }
    elements.registerComponent(this, modelComponent);

    this._cleanup = () => {
      elements.unregisterComponent(this, modelComponent);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Model;
