const geometryutils = require('geometryutils');

class AmbientLight {
  mount() {
    const {three: {THREE, scene, camera}, elements} = zeo;

    const geometryUtils = geometryutils({THREE});

    const ambientLightEntity = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
        color: {
          type: 'color',
          value: '#FFFFFF',
        },
        intensity: {
          type: 'number',
          value: 0.2,
          min: 0,
          max: 2,
          step: 0.1,
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();
        const entityObject = entityElement.getObject();

        const mesh = (() => {
          const geometry = (() => {
            const coreSize = 0.1;
            const arrowSize = 0.05;
            const offsetSize = coreSize + (arrowSize / 2);
            const coreGeometry = new THREE.SphereBufferGeometry(coreSize, 0);
            const _makeArrowGeometry = ({position, rotation}) => new THREE.CylinderBufferGeometry(0, sq(arrowSize / 2), arrowSize, 4, 1)
              .applyMatrix(new THREE.Matrix4().makeRotationY(-Math.PI * (3 / 12)))
              .applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2))
              .applyMatrix(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler().fromArray([rotation[0], rotation[1], rotation[2], camera.rotation.order])))
              .applyMatrix(new THREE.Matrix4().makeTranslation(position[0] * offsetSize, position[1] * offsetSize, position[2] * offsetSize));
            const arrowGeometries = [
              _makeArrowGeometry({
                position: [0, 0, -1],
                rotation: [0, Math.PI, 0],
              }),
              _makeArrowGeometry({
                position: [0, 0, 1],
                rotation: [0, 0, 0],
              }),
              _makeArrowGeometry({
                position: [-1, 0, 0],
                rotation: [0, -Math.PI / 2, 0],
              }),
              _makeArrowGeometry({
                position: [1, 0, 0],
                rotation: [0, Math.PI / 2, 0],
              }),
              _makeArrowGeometry({
                position: [0, -1, 0],
                rotation: [Math.PI / 2, 0, 0],
              }),
              _makeArrowGeometry({
                position: [0, 1, 0],
                rotation: [-Math.PI / 2, 0, 0],
              }),
            ];

            return geometryUtils.concatBufferGeometry([coreGeometry].concat(arrowGeometries));
          })();
          const material = new THREE.MeshPhongMaterial({
            color: 0xFFEB3B,
            shininess: 10,
            shading: THREE.FlatShading,
          });

          return new THREE.Mesh(geometry, material);
        })();
        entityObject.add(mesh);
        entityApi.mesh = mesh;

        const light = new THREE.AmbientLight(0xFFFFFF, 0.2);
        scene.add(light);
        entityApi.light = light;

        entityApi._cleanup = () => {
          entityObject.remove(mesh);
          scene.remove(light);
        };
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();

        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getEntityApi();

        switch (name) {
          case 'position': {
            const {mesh, light} = entityApi;

            mesh.position.set(newValue[0], newValue[1], newValue[2]);
            mesh.updateMatrixWorld();

            light.position.copy(mesh.position);
            light.updateMatrixWorld();

            break;
          }
          case 'color': {
            const {light} = entityApi;

            light.color.setStyle(newValue);
            light.updateMatrixWorld();

            break;
          }
          case 'intensity': {
            const {light} = entityApi;

            light.intensity = newValue;

            break;
          }
        }
      }
    }
    elements.registerEntity(this, ambientLightEntity);

    this._cleanup = () => {
      elements.unregisterEntity(this, ambientLightEntity);
    };
  }

  unount() {
    this._cleanup();
  }
}

const sq = n => Math.sqrt((n * n) + (n * n));

module.exports = AmbientLight;
