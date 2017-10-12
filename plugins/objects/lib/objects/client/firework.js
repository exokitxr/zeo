const NUM_POSITIONS = 100 * 1024;
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const firework = objectApi => {
  const {three, elements, pose, input, render, items} = zeo;
  const {THREE, scene, camera, renderer} = three;

  const zeroQuaternion = new THREE.Quaternion();
  const oneVector = new THREE.Vector3(1, 1, 1);
  const particleOffsetVector = new THREE.Vector3(0, -0.2/2, 0);
  const gravity = -9.8 / 100;
  const fireworkSpeed = 0.2;
  const localVector = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const localEuler = new THREE.Euler();

  const fireworkColor = new THREE.Color(0x2196F3);
  const particleColors = [
    new THREE.Color(0xF44336), // red
    new THREE.Color(0xFFC107), // orange
    new THREE.Color(0x2196F3), // blue
    new THREE.Color(0xE91E63), // pink
    new THREE.Color(0x673AB7), // purple
    new THREE.Color(0x4CAF50), // green
  ];

  const fireworkGeometry = (() => {
    const geometry = new THREE.BoxBufferGeometry(0.02, 0.2, 0.02);
    const colors = new Float32Array(geometry.getAttribute('position').array.length);
    geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
    const numColors = colors.length / 3;
    for (let i = 0; i < numColors; i++) {
      const baseIndex = i * 3;
      colors[baseIndex + 0] = fireworkColor.r;
      colors[baseIndex + 1] = fireworkColor.g;
      colors[baseIndex + 2] = fireworkColor.b;
    }
    return geometry;
  })();

  return () => new Promise((accept, reject) => {
    class Particle {
      constructor(position, velocity, color, large, endTime) {
        this.position = position;
        this.velocity = velocity;
        this.color = color;
        this.large = large;
        this.endTime = endTime;
      }
    }

    const fireworks = [];
    const particles = [];
    const material = new THREE.MeshBasicMaterial({
      vertexColors: THREE.VertexColors,
    });

    const fireworkItemApi = {
      asset: 'ITEM.FIREWORK',
      itemAddedCallback(grabbable) {
        const _triggerdown = e => {
          const {side} = e;

          if (grabbable.getGrabberSide() === side) {
            localEuler.setFromQuaternion(grabbable.rotation, camera.rotation.order);
            localEuler.x = 0;
            localEuler.z = 0;
            localQuaternion.setFromEuler(localEuler);

            const geometry = fireworkGeometry;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(grabbable.position);
            mesh.quaternion.setFromEuler(localEuler);
            mesh.updateMatrixWorld();
            mesh.velocity = new THREE.Vector3();
            mesh.endTime = Date.now() + 1000 + 2000 * Math.random();
            scene.add(mesh);

            fireworks.push(mesh);

            items.destroyItem(grabbable);

            e.stopImmediatePropagation();
          }
        };
        input.on('triggerdown', _triggerdown);

        grabbable[dataSymbol] = {
          cleanup: () => {
            input.removeListener('triggerdown', _triggerdown);
          },
        };
      },
      itemRemovedCallback(grabbable) {
        const {[dataSymbol]: {cleanup}} = grabbable;
        cleanup();
      },
    };
    items.registerItem(this, fireworkItemApi);

    const particleGeometry = new THREE.BoxBufferGeometry(0.02, 0.02, 0.02);
    const particleGeometryPositions = particleGeometry.getAttribute('position').array;
    const numParticleGeometryPositions = particleGeometryPositions.length / 3;
    const particleGeometryIndices = particleGeometry.index.array;
    const numParticleGeometryIndices = particleGeometryIndices.length;
    const particleGeometryPositionsLarge = new THREE.BoxBufferGeometry(0.2, 0.2, 0.2).getAttribute('position').array;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(NUM_POSITIONS);
    const positionsAttribute = new THREE.BufferAttribute(positions, 3);
    geometry.addAttribute('position', positionsAttribute);
    const colors = new Float32Array(NUM_POSITIONS);
    const colorsAttribute = new THREE.BufferAttribute(colors, 3);
    geometry.addAttribute('color', colorsAttribute);
    const indices = new Uint16Array(NUM_POSITIONS / 3);
    const indexAttribute = new THREE.BufferAttribute(indices, 1);
    geometry.setIndex(indexAttribute);
    geometry.setDrawRange(0, 0);
    const particlesMesh = new THREE.Mesh(geometry, material);
    particlesMesh.frustumCulled = false;

    let lastUpdateTime = Date.now();
    const _update = () => {
      const now = Date.now();
      const timeDiff = (now - lastUpdateTime) / 1000;

      const _updateFireworks = () => {
        if (fireworks.length > 0) {
          const removedFireworks = [];
          for (let i = 0; i < fireworks.length; i++) {
            const firework = fireworks[i];
            const {endTime} = firework;
            if (now < endTime) {
              const {position, velocity} = firework;
              position.add(velocity);
              velocity.y += fireworkSpeed * timeDiff;
              firework.updateMatrixWorld();
            } else {
              const numParticles = Math.floor(200 + Math.random() * 200);
              for (let j = 0; j < numParticles; j++) {
                const endTime = Date.now() + 1500 + Math.random() * 1500;
                const particle = new Particle(
                  firework.position.clone(),
                  new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(Math.random() * 0.2),
                  particleColors[Math.floor(Math.random() * particleColors.length)],
                  true,
                  endTime
                );
                particles.push(particle);
              }
              scene.remove(firework);
              removedFireworks.push(firework);
            }
          }
          for (let i = 0; i < removedFireworks.length; i++) {
            fireworks.splice(particles.indexOf(removedFireworks[i]), 1);
          }
        }
      };
      const _addParticles = () => {
        for (let i = 0; i < fireworks.length; i++) {
          const firework = fireworks[i];
          const endTime = Date.now() + 500 + Math.random() * 500;
          const particle = new Particle(
            firework.position.clone().add(particleOffsetVector),
            new THREE.Vector3((Math.random() - 0.5) * 0.01, 0, (Math.random() - 0.5) * 0.01),
            particleColors[Math.floor(Math.random() * particleColors.length)],
            false,
            endTime
          );
          particles.push(particle);
        }
      };
      const _updateParticles = () => {
        if (particles.length > 0) {
          const removedParticles = [];
          for (let i = 0; i < particles.length; i++) {
            const particle = particles[i];
            const {endTime} = particle;

            if (now < endTime) {
              const {position, velocity} = particle;
              position.add(velocity);
              velocity.y += gravity * timeDiff;
            } else {
              removedParticles.push(particle);
            }
          }
          for (let i = 0; i < removedParticles.length; i++) {
            particles.splice(particles.indexOf(removedParticles[i]), 1);
          }
        }
      };
      const _renderParticles = () => {
        let attributeIndex = 0;
        let indexIndex = 0;

        for (let i = 0; i < particles.length; i++) {
          const {position, color, large} = particles[i];
          const newGeometryPositions = large ? particleGeometryPositionsLarge : particleGeometryPositions;
          const newGeometryIndices = particleGeometryIndices;

          for (let j = 0; j < numParticleGeometryPositions; j++) {
            const baseIndex = attributeIndex + j * 3;
            const srcBaseIndex = j * 3;
            positions[baseIndex + 0] = newGeometryPositions[srcBaseIndex + 0] + position.x;
            positions[baseIndex + 1] = newGeometryPositions[srcBaseIndex + 1] + position.y;
            positions[baseIndex + 2] = newGeometryPositions[srcBaseIndex + 2] + position.z;

            colors[baseIndex + 0] = color.r;
            colors[baseIndex + 1] = color.g;
            colors[baseIndex + 2] = color.b;
          }

          for (let j = 0; j < numParticleGeometryIndices; j++) {
            const baseIndex = indexIndex + j;
            const baseAttributeIndex = attributeIndex / 3;
            indices[baseIndex] = newGeometryIndices[j] + baseAttributeIndex;
          }

          attributeIndex += numParticleGeometryPositions * 3;
          indexIndex += numParticleGeometryIndices;
        }
        geometry.setDrawRange(0, indexIndex);

        positionsAttribute.needsUpdate = true;
        colorsAttribute.needsUpdate = true;
        indexAttribute.needsUpdate = true;
      };
      const _updateParticlesMesh = () => {
        if (particles.length > 0 && !particlesMesh.parent) {
          scene.add(particlesMesh);
        } else if (particles.length === 0 && particlesMesh.parent) {
          scene.remove(particlesMesh);
        }
      };

      _updateFireworks();
      _addParticles();
      _updateParticles();
      _renderParticles();
      _updateParticlesMesh();

      lastUpdateTime = now;
    };
    render.on('update', _update);

    const fireworkRecipe = {
      output: 'ITEM.FIREWORK',
      width: 1,
      height: 3,
      input: [
        'ITEM.COAL',
        'ITEM.COAL',
        'ITEM.WOOD',
      ],
    };
    objectApi.registerRecipe(fireworkRecipe);

    accept(() => {
      fireworkGeometry.dispose();
      material.dispose();
      if (particlesMesh.parent) {
        scene.remove(particlesMesh);
      }

      items.unregisterItem(this, fireworkItemApi);
      objectApi.unregisterRecipe(fireworkRecipe);

      render.removeListener('update', _update);
    });
  });
};

module.exports = firework;
