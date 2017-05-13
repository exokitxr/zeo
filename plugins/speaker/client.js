class Speaker {
  mount() {
    const {three: {THREE, scene, camera}, elements, render, pose, input, world, ui, sound, utils: {geometry: geometryUtils}} = zeo;

    /* const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      return {position, rotation, scale};
    }; */

    const speakerGeometry = geometryUtils.concatBufferGeometry([
      new THREE.BoxBufferGeometry(0.5, 1, 0.5),
      new THREE.BoxBufferGeometry(0.5, 0.05, 0.05)
        .applyMatrix(new THREE.Matrix4().makeTranslation(0, (1 / 2) - (0.05 / 2), (0.5 / 2) + (0.05 / 2))),
      new THREE.BoxBufferGeometry(0.5, 0.05, 0.05)
        .applyMatrix(new THREE.Matrix4().makeTranslation(0, -(1 / 2) + (0.05 / 2), (0.5 / 2) + (0.05 / 2))),
      new THREE.BoxBufferGeometry(0.05, 1, 0.05)
        .applyMatrix(new THREE.Matrix4().makeTranslation(-(0.5 / 2) + (0.05 / 2), 0, (0.5 / 2) + (0.05 / 2))),
      new THREE.BoxBufferGeometry(0.05, 1, 0.05)
        .applyMatrix(new THREE.Matrix4().makeTranslation((0.5 / 2) - (0.05 / 2), 0, (0.5 / 2) + (0.05 / 2))),
      (() => {
        const geometry = new THREE.CylinderBufferGeometry(0.2, 0.2, 0.01, 8, 1)
          .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
          .applyMatrix(new THREE.Matrix4().makeRotationZ(Math.PI / 8));

        const _almostZero = v => Math.abs(v) < 0.001;

        const {array: positions} = geometry.getAttribute('position');
        const numPositions = positions.length / 3;
        for (let i = 0; i < numPositions; i++) {
          const baseIndex = i * 3;

          if (_almostZero(positions[baseIndex + 0]) && _almostZero(positions[baseIndex + 1])) {
            positions[baseIndex + 2] -= 0.1;
          }
        }

        geometry.computeVertexNormals();

        return geometry;
      })().applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.15, (0.5 / 2) + (0.1 / 2))),
      (() => {
        const geometry = new THREE.CylinderBufferGeometry(0.1, 0.1, 0.01, 8, 1)
          .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
          .applyMatrix(new THREE.Matrix4().makeRotationZ(Math.PI / 8));

        const _almostZero = v => Math.abs(v) < 0.001;

        const {array: positions} = geometry.getAttribute('position');
        const numPositions = positions.length / 3;
        for (let i = 0; i < numPositions; i++) {
          const baseIndex = i * 3;

          if (_almostZero(positions[baseIndex + 0]) && _almostZero(positions[baseIndex + 1])) {
            positions[baseIndex + 2] -= 0.05;
          }
        }

        geometry.computeVertexNormals();

        return geometry;
      })().applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.25, (0.5 / 2) + (0.05 / 2))),
    ]);
    const speakerMaterial = new THREE.MeshPhongMaterial({
      color: 0x333333,
      shininess: 10,
      shading: THREE.FlatShading,
    });

    const _requestAudio = (audio, src) => new Promise((accept, reject) => {
      audio.crossOrigin = 'Anonymous';
      audio.src = src;

      const _cleanup = () => {
        audio.oncanplaythrough = null;
        audio.onerror = null;
      };

      audio.oncanplaythrough = () => {
        _cleanup();

        accept();
      };
      audio.onerror = err => {
        _cleanup();

        reject(err);
      };
    });

    const speakerComponent = {
      selector: 'speaker[position]',
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 1 / 2, 0,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
        audio: {
          type: 'file',
          value: 'https://cdn.rawgit.com/modulesio/zeo-data/d9a6b67e846a961e20f326e1a98b3725a722ef85/audio/speaker.mp3',
        },
        play: {
          type: 'checkbox',
          value: true,
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        const speakerMesh = (() => {
          const mesh = new THREE.Mesh(speakerGeometry, speakerMaterial);

          mesh.destroy = () => {
            // XXX
          };

          return mesh;
        })();
        entityObject.add(speakerMesh);
        entityApi.speakerMesh = speakerMesh;

        const soundBody = (() => {
          const result = sound.makeBody();

          const audio = document.createElement('audio');
          audio.loop = true;
          result.setInputElement(audio);
          result.audio = audio;

          result.setObject(speakerMesh);

          return result;
        })();
        entityApi.soundBody = soundBody;

        entityApi.audio = null;
        entityApi.play = false;

        entityApi.reload = () => {
          const {audio: src, soundBody} = entityApi;

          if (!soundBody.audio.paused) {
            soundBody.audio.pause();
          }

          if (src) {
            _requestAudio(soundBody.audio, src)
              .then(() => {
                const {play} = entityApi;

                if (play) {
                  soundBody.audio.currentTime = 0;
                  soundBody.audio.play();
                }
              })
              .catch(err => {
                console.warn(err);
              });
          }
        };

        const _update = () => {
          // XXX
        };
        render.on('update', _update);

        entityApi._cleanup = () => {
          entityObject.remove(speakerMesh);
          speakerMesh.destroy();

          const {audio} = soundBody;
          if (!audio.paused) {
            audio.pause();
          }

          render.removeListener('update', _update);
        };
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getComponentApi();

        switch (name) {
          case 'position': {
            const position = newValue;

            if (position) {
              const {speakerMesh} = entityApi;

              speakerMesh.position.set(position[0], position[1], position[2]);
              speakerMesh.quaternion.set(position[3], position[4], position[5], position[6]);
              speakerMesh.scale.set(position[7], position[8], position[9]);
            }

            break;
          }
          case 'audio': {
            const file = newValue;
            entityApi.audio = file ? file.url : null;

            entityApi.reload();

            break;
          }
          case 'play': {
            entityApi.play = newValue;

            entityApi.reload();

            break;
          }
        }
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();

        entityApi._cleanup();
      },
    };
    elements.registerComponent(this, speakerComponent);

    this._cleanup = () => {
      speakerGeometry.dispose();
      speakerMaterial.dispose();

      elements.unregisterComponent(this, speakerComponent);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Speaker;
