const modelsPath = '/archae/models/models/';

const MODELS = {
  cloud: {
    path: 'https://cdn.rawgit.com/modulesio/zeo-data/8a67c22f91517e457ddadd9241f594ed5180077f/models/cloud/cloud.json',
    position: [-1, 1, -1],
    rotation: [0, Math.PI, 0],
    scale: [0.5, 0.5, 0.5],
  },
  /* lightning: {
    path: 'lightning/lightning.json',
    position: [0, 0.75, -1],
    rotation: [0, Math.PI, 0],
    scale: [0.015, 0.015, 0.015],
  },
  vanille: {
    path: 'vanille/vanille.json',
    position: [0, 0.75, -1],
    rotation: [0, Math.PI, 0],
    scale: [0.015, 0.015, 0.015],
  },
  ellie: {
    path: 'ellie/ellie.json',
    position: [0, 0.2, -1],
    rotation: [-Math.PI / 2, 0, 0],
    scale: [0.8, 0.8, 0.8],
  },
  pc: {
    path: 'pc/pc.json',
    position: [0, 0, -1],
    rotation: [0, Math.PI, 0],
    scale: [0.025, 0.025, 0.025],
  }, */
};

const modelName = 'cloud';

class Models {
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

        return {
          getModel: _getModel,
          requestModelJson: _requestModelJson,
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

module.exports = Models;
