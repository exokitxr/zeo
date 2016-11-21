const asyncJsonParse = require('async-json-parse');

const modelsPath = '/archae/models/models/';

const MODELS = {
  cloud: {
    path: 'cloud/cloud.json',
    position: [0, 0.5, -1],
    rotation: [0, Math.PI, 0],
    scale: [0.6, 0.6, 0.6],
  },
  lightning: {
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
  },
};

const models = archae => ({
  mount() {
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

        const _parseMesh = o => {
          const geometries = o.geometries.map(geometry => {
            const {data, uuid} = geometry;
            const {attributes, index} = data;
            const {position, normal, uv} = attributes;

            const numVertices = index.array.length;
            const positions = new Float32Array(numVertices * 3);
            const normals = new Float32Array(numVertices * 3);
            const uvs = uv ? new Float32Array(numVertices * 2) : null;
            for (let i = 0; i < numVertices; i++) {
              const vertexIndex = index.array[i];

              positions[(i * 3) + 0] = position.array[(vertexIndex * 3) + 0];
              positions[(i * 3) + 1] = position.array[(vertexIndex * 3) + 1];
              positions[(i * 3) + 2] = position.array[(vertexIndex * 3) + 2];

              normals[(i * 3) + 0] = normal.array[(vertexIndex * 3) + 0];
              normals[(i * 3) + 1] = normal.array[(vertexIndex * 3) + 1];
              normals[(i * 3) + 2] = normal.array[(vertexIndex * 3) + 2];

              if (uvs) {
                uvs[(i * 2) + 0] = uv.array[(vertexIndex * 2) + 0];
                uvs[(i * 2) + 1] = uv.array[(vertexIndex * 2) + 1];
              }
            }

            const result = new THREE.BufferGeometry();
            result.addAttribute('position', new THREE.BufferAttribute(positions, 3));
            result.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
            if (uvs) {
              result.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            }
            result.uuid = uuid;
            return result;
          });
          const geometryIndex = _indexByUuid(geometries);
          const images = o.images.map(image => {
            const {url, uuid} = image;

            const img = new Image();
            img.src = url;
            img.uuid = uuid;
            return img;
          });
          const imageIndex = _indexByUuid(images);
          const textures = o.textures.map(texture => {
            const {image, uuid} = texture;

            const img = imageIndex[image];
            if (!img.complete) {
              const onload = () => {
                result.needsUpdate = true;

                img.removeEventListener('load', onload);
              };
              img.addEventListener('load', onload);
            }
            const result = new THREE.Texture(
              img,
              THREE.UVMapping,
              THREE.ClampToEdgeWrapping,
              THREE.ClampToEdgeWrapping,
              THREE.LinearFilter,
              THREE.LinearFilter,
              THREE.RGBAFormat,
              THREE.UnsignedByteType,
              16
            );
            result.needsUpdate = true;
            result.uuid = uuid;
            return result;
          });
          const textureIndex = _indexByUuid(textures);
          const materials = o.materials.map(material => {
            const {map, uuid} = material;

            const texture = textureIndex[map];
            const o = {
              shininess: 0,
              side: THREE.DoubleSide,
              transparent: true,
              alphaTest: 0.5,
            };
            if (texture) {
              o.map = texture;
            }
            const result = new THREE.MeshPhongMaterial(o);
            result.uuid = uuid;
            return result;
          });
          const materialIndex = _indexByUuid(materials);
          const meshes = o.object.children.map(child => {
            const {uuid, geometry, material} = child;

            const geo = geometryIndex[geometry];
            const mat = materialIndex[material];
            const result = new THREE.Mesh(geo, mat);
            result.uuid = uuid;
            return result;
          });

          const mesh = (() => {
            const result = new THREE.Object3D();

            for (let i = 0; i < meshes.length; i++) {
              result.add(meshes[i]);
            }

            return result;
          })();
          return mesh;

          function _indexByUuid(a) {
            const result = {};

            for (let i = 0; i < a.length; i++) {
              const e = a[i];
              result[e.uuid] = e;
            }

            return result;
          }
        };

        const model = MODELS['cloud'];
        const modelPath = _getModelPath(model);
        fetch(modelPath)
          .then(res => {
            res.text()
              .then(s => {
                asyncJsonParse(s)
                  .then(json => {
                    const loader = new THREE.ObjectLoader();

                    loader.setTexturePath(_getTexturePath(modelPath));
                    loader.parse(json, mesh => {
                      mesh.rotation.order = camera.rotation.order;

                      mesh.position.fromArray(model.position);
                      mesh.rotation.fromArray(model.rotation);
                      mesh.scale.fromArray(model.scale);

                      scene.add(mesh);

                      this._cleanup = () => {
                        scene.remove(mesh);
                      };
                    });
                  })
                  .catch(err => {
                    console.warn(err);
                  });
              })
              .catch(err => {
                console.warn(err);
              });
          })
          .catch(err => {
            console.warn(err);
          });
      }
    });
  },
  unmount() {
    this._cleanup();
  },
});

const _getModelPath = model => modelsPath + model.path;
const _getTexturePath = url => url.substring(0, url.lastIndexOf('/') + 1);

module.exports = models;
