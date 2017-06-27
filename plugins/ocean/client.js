const murmur = require('murmurhash');

const NUM_CELLS = 100;
const SCALE = 2;

const OCEAN_SHADER = {
  uniforms: {
    worldTime: {
      type: 'f',
      value: 0,
    },
  },
  vertexShader: [
    "uniform float worldTime;",
    "attribute vec3 wave;",
    "void main() {",
    "  float ang = wave[0];",
    "  float amp = wave[1];",
    "  float speed = wave[2];",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, ((sin(ang + (speed * worldTime))) * amp), position.z, 1.0);",
    "}"
  ].join("\n"),
  fragmentShader: [
    "void main() {",
    "  gl_FragColor = vec4(0.25, 0.25, 0.5, 0.98);",
    "}"
  ].join("\n")
};
const DATA = {
  amplitude: 0.5,
  amplitudeVariance: 0.3,
  speed: 1,
  speedVariance: 2,
};
const DIRECTIONS = (() => {
  const result = [];
  const size = 2;
  for (let x = -size; x <= size; x++) {
    for (let y = -size; y <= size; y++) {
      result.push([x, y]);
    }
  }
  return result;
})();

class Ocean {
  mount() {
    const {three: {THREE}, render, elements, world} = zeo;

    const updates = [];
    const _update = () => {
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        update();
      }
    };

    const oceanEntity = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();
        const entityObject = entityElement.getObject();

        const _makeOceanMesh = (ox, oy) => {
          const geometry = new THREE.PlaneBufferGeometry(NUM_CELLS * SCALE, NUM_CELLS * SCALE, NUM_CELLS, NUM_CELLS);
          geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
          geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 0));
          const waves = (() => {
            const positions = geometry.getAttribute('position').array;
            const numPositions = positions.length / 3;
            const result = new Float32Array(numPositions * 3);
            for (let i = 0; i < numPositions; i++) {
              const baseIndex = i * 3;
              const x = positions[baseIndex + 0];
              const y = positions[baseIndex + 2];
              const key = `${x + (ox * NUM_CELLS * SCALE)}:${y + (oy * NUM_CELLS  * SCALE)}`;
              result[baseIndex + 0] = (murmur(key + ':ang') / 0xFFFFFFFF) * Math.PI * 2; // ang
              result[baseIndex + 1] = DATA.amplitude + (murmur(key + ':amp') / 0xFFFFFFFF) * DATA.amplitudeVariance; // amp
              result[baseIndex + 2] = (DATA.speed + (murmur(key + ':speed') / 0xFFFFFFFF) * DATA.speedVariance) / 1000; // speed
            }
            return result;
          })();
          geometry.addAttribute('wave', new THREE.BufferAttribute(waves, 3));

          const uniforms = THREE.UniformsUtils.clone(OCEAN_SHADER.uniforms);
          const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: OCEAN_SHADER.vertexShader,
            fragmentShader: OCEAN_SHADER.fragmentShader,
            transparent: true,
            // depthTest: false,
          });

          const result = new THREE.Mesh(geometry, material);
          result.position.set(ox * NUM_CELLS * SCALE, 0, oy * NUM_CELLS * SCALE);
          result.updateMatrixWorld();
          return result;
        };
        const meshes = [];
        DIRECTIONS.forEach(([x, y]) => {
          const mesh = _makeOceanMesh(x, y);
          entityObject.add(mesh);
          meshes.push(mesh);
        });

        const update = () => {
          for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            const {material: meshMaterial} = mesh;
            const worldTime = world.getWorldTime();
            meshMaterial.uniforms.worldTime.value = worldTime;
          }
        };
        updates.push(update);
      
        entityApi._cleanup = () => {
          for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            entityObject.remove(mesh);
          }

          updates.splice(updates.indexOf(update), 1);
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
            const {mesh} = entityApi;

            mesh.position.set(newValue[0], newValue[1], newValue[2]);
            mesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
            mesh.scale.set(newValue[7], newValue[8], newValue[9]);

            break;
          }
        }
      },
    };
    elements.registerEntity(this, oceanEntity);

    render.on('update', _update);

    this._cleanup = () => {
      elements.unregisterEntity(this, oceanEntity);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Ocean;
