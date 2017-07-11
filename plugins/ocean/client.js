const NUM_CELLS = 256;
const SCALE = 4;

const OCEAN_SHADER = {
  uniforms: {
    worldTime: {
      type: 'f',
      value: 0,
    },
    fogColor: {
      type: '3f',
    },
    fogDensity: {
      type: 'f',
    },
  },
  vertexShader: [
    "uniform float worldTime;",
    "attribute vec3 wave;",
    "attribute float color;",
    "varying float vcolor;",
    "varying float fogDepth;",
    "void main() {",
    "  float ang = wave[0];",
    "  float amp = wave[1];",
    "  float speed = wave[2];",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y, ((sin(ang + (speed * worldTime))) * amp), 1.0);",
    "  vcolor = color;",
    "  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
    "  fogDepth = -mvPosition.z;",
    "}"
  ].join("\n"),
  fragmentShader: [
    "#define LOG2 1.442695",
    "#define whiteCompliment(a) ( 1.0 - saturate( a ) )",
		"uniform vec3 fogColor;",
    "uniform float fogDensity;",
    "varying float vcolor;",
    "varying float fogDepth;",
    "void main() {",
    "  gl_FragColor = vec4(vec3(0.25, 0.25, 0.5) * vcolor, 0.95);",
    "  float fogFactor = whiteCompliment( exp2( - fogDensity * fogDensity * fogDepth * fogDepth * LOG2 ) );",
    "  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );",
    "}"
  ].join("\n")
};
const DATA = {
  amplitude: 0.5,
  amplitudeVariance: 0.3,
  speed: 0.5,
  speedVariance: 0.5,
};

class Ocean {
  mount() {
    const {three, render, elements, pose, world, utils: {random: randomUtils, hash: hashUtils}} = zeo;
    const {THREE, scene} = three;
    const {chnkr} = randomUtils;
    const {murmur} = hashUtils;

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
        const chunker = chnkr.makeChunker({
          resolution: NUM_CELLS,
          range: 2,
        });

        const _makeOceanMesh = (ox, oy) => {
          const geometry = new THREE.PlaneBufferGeometry(NUM_CELLS, NUM_CELLS, NUM_CELLS / SCALE, NUM_CELLS / SCALE);
          // geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
          // geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 0));

          const positions = geometry.getAttribute('position').array;
          const numPositions = positions.length / 3;
          const waves = new Float32Array(numPositions * 3);
          const colors = new Float32Array(numPositions);
          for (let i = 0; i < numPositions; i++) {
            const baseIndex = i * 3;
            const x = positions[baseIndex + 0];
            const y = positions[baseIndex + 1];
            const key = `${x + (ox * NUM_CELLS)}:${-y + (oy * NUM_CELLS)}`;
            waves[baseIndex + 0] = (murmur(key + ':ang') / 0xFFFFFFFF) * Math.PI * 2; // ang
            waves[baseIndex + 1] = DATA.amplitude + (murmur(key + ':amp') / 0xFFFFFFFF) * DATA.amplitudeVariance; // amp
            waves[baseIndex + 2] = (DATA.speed + (murmur(key + ':speed') / 0xFFFFFFFF) * DATA.speedVariance) / 1000; // speed
            colors[i] = 0.7 + ((murmur(key + ':color') / 0xFFFFFFFF) * (1 - 0.7));
          }
          geometry.addAttribute('wave', new THREE.BufferAttribute(waves, 3));
          geometry.addAttribute('color', new THREE.BufferAttribute(colors, 1));

          const uniforms = THREE.UniformsUtils.clone(OCEAN_SHADER.uniforms);
          uniforms.fogColor.value = scene.fog.color;
          uniforms.fogDensity.value = scene.fog.density;
          const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: OCEAN_SHADER.vertexShader,
            fragmentShader: OCEAN_SHADER.fragmentShader,
            transparent: true,
            // depthWrite: false,
          });

          const result = new THREE.Mesh(geometry, material);
          result.position.set(ox * NUM_CELLS, 0, oy * NUM_CELLS);
          result.quaternion.set(-0.7071067811865475, 0, 0, 0.7071067811865475);
          result.updateMatrixWorld();

          result.update = () => {
            const worldTime = world.getWorldTime();
            uniforms.worldTime.value = worldTime;
            uniforms.fogColor.value = scene.fog.color;
            uniforms.fogDensity.value = scene.fog.density;
          };
          result.destroy = () => {
            geometry.dispose();
          };

          return result;
        };
        const meshes = [];

        const update = () => {
          const _updateOceanChunks = () => {
            const {hmd} = pose.getStatus();
            const {worldPosition: hmdPosition} = hmd;
            const {added, removed} = chunker.update(hmdPosition.x, hmdPosition.z);

            for (let i = 0; i < added.length; i++) {
              const chunk = added[i];
              const {x, z} = chunk;
              const oceanChunkMesh = _makeOceanMesh(x, z);
              scene.add(oceanChunkMesh);
              meshes.push(oceanChunkMesh);

              chunk.data = oceanChunkMesh;
            }
            for (let i = 0; i < removed.length; i++) {
              const chunk = removed[i];
              const {data: oceanChunkMesh} = chunk;
              scene.remove(oceanChunkMesh);
              oceanChunkMesh.destroy();
              meshes.splice(meshes.indexOf(oceanChunkMesh), 1);
            }
          };
          const _updateMeshes = () => {
            for (let i = 0; i < meshes.length; i++) {
              const mesh = meshes[i];
              mesh.update();
            }
          };

          _updateOceanChunks();
          _updateMeshes();
        };
        updates.push(update);
      
        entityElement._cleanup = () => {
          for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            scene.remove(mesh);
          }

          updates.splice(updates.indexOf(update), 1);
        };
      },
      entityRemovedCallback(entityElement) {
        entityElement._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        switch (name) {
          case 'position': {
            const {mesh} = entityElement;

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
