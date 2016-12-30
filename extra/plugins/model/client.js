const modelsPath = '/archae/models/models/';

const MODELS = {
  cloud: {
    path: 'https://cdn.rawgit.com/modulesio/zeo-data/8a67c22f91517e457ddadd9241f594ed5180077f/models/cloud/cloud.json',
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

const modelName = 'cloud';

class Model {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestEngines([
      '/core/engines/zeo',
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = zeo;

        const _getModel = modelName => MODELS[modelName];
        const _requestModelJson = model => {
          const modelPath = _getModelPath(model);

          return fetch(modelPath).then(res => res.text().then(s => _asyncJsonParse(s)));
        };
        const _requestModelMeshFromSpec = (modelJson, texturePath) => new Promise((accept, reject) => {
          const loader = new THREE.ObjectLoader();

          loader.setTexturePath(texturePath);
          loader.parse(modelJson, accept);
        });
        const _requestModel = model => _requestModelJson(model).then(modelJson => {
          const modelPath = _getModelPath(model);
          const texturePath = _getTexturePath(modelPath); 

          return _requestModelMeshFromSpec(modelJson, texturePath);
        });

        return {
          getModel: _getModel,
          requestModelJson: _requestModelJson,
          elements: [
            class ModelElement {
              static get tag() {
                return 'model';
              }
              static get attributes() {
                return {
                  position: {
                    type: 'position',
                    value: [0, 0, 0],
                  },
                  model: {
                    type: 'text',
                    value: 'cloud.mdl',
                  },
                };
              }

              constructor() {
                console.log('model constructor');

                let live = true;
                this._cleanup = () => {
                  live = false;
                };

                const model = _getModel(modelName);
                _requestModel(model)
                  .then(mesh => {
                    if (live) {
                      mesh.position.fromArray(model.position);
                      mesh.rotation.fromArray(model.rotation.concat(camera.rotation.order));
                      mesh.scale.fromArray(model.scale);

                      scene.add(mesh);

                      this._cleanup = () => {
                        scene.remove(mesh);
                      };
                    }
                  })
                  .catch(err => {
                    console.warn(err);
                  });
              }

              destructor() {
                this._cleanup();
              }
            }
          ],
          templates: [
            {
              tag: 'model',
              attributes: {},
              children: [],
            },
          ],
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _asyncJsonParse = s => new Response(s).json();
const _getModelPath = model  => {
  const {path} = model;
  if (/^.*?:\/\//.test(path)) {
    return path;
  } else {
    return modelsPath + path;
  }
};
const _getTexturePath = url => url.substring(0, url.lastIndexOf('/') + 1);

module.exports = Model;
