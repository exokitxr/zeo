const modelsPath = '/archae/models/models/';

const MODELS = { // XXX fold these transforms into the models themselves
  cloud: {
    path: 'https://cdn.rawgit.com/modulesio/zeo-data/29412380b29e98b18c746a373bdb73aeff59e27a/models/cloud/cloud.json',
    position: [0, 0.65, 0],
    rotation: [0, Math.PI, 0],
    scale: [0.5, 0.5, 0.5],
  },
  lightning: {
    path: 'lightning/lightning.json',
    position: [0, 0.8, 0],
    rotation: [0, Math.PI, 0],
    scale: [0.014, 0.014, 0.014],
  },
  vanille: {
    path: 'vanille/vanille.json',
    position: [0, 0.8, 0],
    rotation: [0, Math.PI, 0],
    scale: [0.014, 0.014, 0.014],
  },
  ellie: {
    path: 'ellie/ellie.json',
    position: [0, 0, 0],
    rotation: [-Math.PI / 2, 0, 0],
    scale: [1, 1, 1],
  },
  pc: {
    path: 'pc/pc.json',
    position: [0, 0, 0],
    rotation: [0, Math.PI, 0],
    scale: [0.025, 0.025, 0.025],
  },
};

const symbol = Symbol();

class Model {
  mount() {
    const {three: {THREE, scene}, elements} = zeo;
 
    const _requestModel = file => file.fetch({
      type: 'json',
    }).then(modelJson => new Promise((accept, reject) => {
      const loader = new THREE.ObjectLoader();
      loader.crossOrigin = true;
      const {url} = file;
      const texturePath = url.substring(0, url.lastIndexOf('/') + 1);
      loader.setTexturePath(texturePath);
      loader.parse(modelJson, accept);
    }));

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
        }
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
            _requestModel(file)
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
