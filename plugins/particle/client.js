const SIDES = ['left', 'right'];

class Particle {
  mount() {
    const {three: {THREE, scene, camera}, elements, render, pose, input, world, ui, sound, utils: {geometry: geometryUtils}} = zeo;

    const patricleMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5,
    });

    const particleComponent = {
      selector: 'patricle[position]',
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
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        const mesh = (() => {
          const halfSq = sq(0.1) / 2;

          class Particle {
            constructor(startTime) {
              const sizeFactor = 0.025;
              this.size = [
                new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(sizeFactor),
                new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(sizeFactor),
                new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(sizeFactor),
              ];
              this.position = new THREE.Vector3(
                -2 + (Math.random() * 4),
                (Math.random() * 2),
                -2 + (Math.random() * 4)
              );
              this.rotation = new THREE.Vector3(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
              );
              const linearSpeed = (0.1 + Math.random() * 0.9) * 0.0001;
              this.linearVelocity = new THREE.Vector3(
                Math.random() * linearSpeed,
                Math.random() * linearSpeed,
                Math.random() * linearSpeed
              );
              const angularSpeed = (0.1 + Math.random() * 0.9) * (0.0005 * Math.PI * 2);
              this.angularVelocity = new THREE.Vector3(
                Math.random() * angularSpeed,
                Math.random() * angularSpeed,
                Math.random() * angularSpeed
              );
              this.startTime = startTime;
              this.ttl = (0.2 + (0.8 * Math.random())) * (30 * 1000);
            }
          }

          const numParticles = 50;
          const particles = (() => {
            const result = Array(numParticles);

            const startTime = Date.now();
            for (let i = 0; i < numParticles; i++) {
              result[i] = new Particle(startTime);
            }

            return result;
          })();

          const geometry = (() => {
            const geometry = new THREE.BufferGeometry();
            geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(numParticles * 3 * 6), 3));
            return geometry;
          })();
          const material = patricleMaterial;

          const mesh = new THREE.LineSegments(geometry, material);
          mesh.rotation.order = camera.rotation.order;

          let lastUpdateTime = Date.now();
          mesh.update = () => {
            const now = Date.now();
            const timeDiff = now - lastUpdateTime;
            const positionsAttribute = geometry.getAttribute('position');
            const {array: positions} = positionsAttribute;

            for (let i = 0; i < numParticles; i++) {
              let particle = particles[i];
              const {startTime, ttl} = particle;
              if ((now - startTime) >= ttl) {
                particle = new Particle(now);
                particles[i] = particle;
              }

              const {size, position, rotation, linearVelocity, angularVelocity} = particle;

              position.add(linearVelocity.clone().multiplyScalar(timeDiff));
              rotation.add(angularVelocity.clone().multiplyScalar(timeDiff));

              const euler = new THREE.Euler(rotation.x, rotation.y, rotation.z, camera.rotation.order);
              const rotatedSizes = [
                size[0].clone().applyEuler(euler),
                size[1].clone().applyEuler(euler),
                size[2].clone().applyEuler(euler),
              ];
              const newPoints = [
                position.clone().add(rotatedSizes[0]),
                position.clone().add(rotatedSizes[1]),
                position.clone().add(rotatedSizes[2]),
              ];

              const baseIndex = i * 3 * 6;
              positions[baseIndex + 0] = newPoints[0].x;
              positions[baseIndex + 1] = newPoints[0].y;
              positions[baseIndex + 2] = newPoints[0].z;
              positions[baseIndex + 3] = newPoints[1].x;
              positions[baseIndex + 4] = newPoints[1].y;
              positions[baseIndex + 5] = newPoints[1].z;

              positions[baseIndex + 6] = newPoints[1].x;
              positions[baseIndex + 7] = newPoints[1].y;
              positions[baseIndex + 8] = newPoints[1].z;
              positions[baseIndex + 9] = newPoints[2].x;
              positions[baseIndex + 10] = newPoints[2].y;
              positions[baseIndex + 11] = newPoints[2].z;

              positions[baseIndex + 12] = newPoints[2].x;
              positions[baseIndex + 13] = newPoints[2].y;
              positions[baseIndex + 14] = newPoints[2].z;
              positions[baseIndex + 15] = newPoints[0].x;
              positions[baseIndex + 16] = newPoints[0].y;
              positions[baseIndex + 17] = newPoints[0].z;
            }

            positionsAttribute.needsUpdate = true;

            lastUpdateTime = now;
          };

          return mesh;
        })();
        entityObject.add(mesh);
        entityApi.mesh = mesh;

        const _update = () => {
          mesh.update();
        };
        render.on('update', _update);

        entityApi._cleanup = () => {
          entityObject.remove(mesh);

          render.removeListener('update', _update);
        };
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getComponentApi();

        switch (name) {
          /* case 'position': { // XXX re-enable this
            const position = newValue;

            if (position) {
              const {mesh} = entityApi;

              mesh.position.set(position[0], position[1], position[2]);
              mesh.quaternion.set(position[3], position[4], position[5], position[6]);
              mesh.scale.set(position[7], position[8], position[9]);
            }

            break;
          } */
        }
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();

        entityApi._cleanup();
      },
    };
    elements.registerComponent(this, particleComponent);

    this._cleanup = () => {
      elements.unregisterComponent(this, particleComponent);
    };
  }

  unmount() {
    this._cleanup();
  }
}

const sq = n => Math.sqrt((n * n) + (n * n));

module.exports = Particle;
