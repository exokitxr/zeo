class Tutorial {
  mount() {
    const {three, render, input, pose, utils: {vrid: vridUtils}} = zeo;
    const {THREE, scene} = three;
    const {vridApi} = vridUtils;

    const _requestImage = url => new Promise((accept, reject) => {
      const img = new Image();
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(img);
      };
      img.src = url;
    });
    const _requestImageBitmap = src => _requestImage(src)
      .then(img => createImageBitmap(img, 0, 0, img.width, img.height, {
        imageOrientation: 'flipY',
      }));
    const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
      for (let i = 0; i < src.length; i++) {
        dst[startIndexIndex + i] = src[i] + startAttributeIndex;
      }
    };
    const _loadTutorial = () => _requestImageBitmap('/archae/tutorial/img/controls-atlas.png')
      .then(controlsAtlasImg => {
        if (live) {
          const width = 0.2;
          const height = width * 2 * (74 / 1024);
          const planeGeometry = new THREE.PlaneBufferGeometry(width, height);
          const planeGeometryPositions = planeGeometry.getAttribute('position').array;
          const planeGeometryUvs = planeGeometry.getAttribute('uv').array;
          const planeGeometryIndex = planeGeometry.index.array;

          const totalNumPlanes = 12;
          const widths = [
            0.65,
            0.75,
            0.7,
            0.55,
            0.55,
            0.35,
            0.55,
            0.9,
            0.85,
            0.5,
            0.55,
            0.55,
          ];

          const _makeGeometry = planes => {
            const numPlanes = planes.length;
            const positions = new Float32Array(planeGeometryPositions.length * numPlanes);
            const uvs = new Float32Array(planeGeometryUvs.length * numPlanes);
            const indices = new Uint16Array(planeGeometryIndex.length * numPlanes);
            let attributeIndex = 0;
            let uvIndex = 0;
            let indexIndex = 0;

            for (let i = 0; i < planes.length; i++) {
              const [planeIndex, dx, dy, dz] = planes[i];
              const newPositions = planeGeometryPositions.slice();
              const numNewPositions = newPositions.length / 3;
              for (let j = 0; j < numNewPositions; j++) {
                newPositions[j * 3 + 0] *= widths[planeIndex];

                newPositions[j * 3 + 0] += dx;
                newPositions[j * 3 + 1] += dy;
                newPositions[j * 3 + 2] += dz;
              }
              positions.set(newPositions, attributeIndex);

              const newUvs = planeGeometryUvs.slice();
              const numNewUvs = newUvs.length / 2;
              for (let j = 0; j < numNewUvs; j++) {
                newUvs[j * 2 + 0] *= widths[planeIndex];
                newUvs[j * 2 + 1] = 1 - (planeIndex / totalNumPlanes + (1 - newUvs[j * 2 + 1]) / totalNumPlanes);
              }
              uvs.set(newUvs, uvIndex);

              const newIndices = planeGeometryIndex;
              _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

              attributeIndex += newPositions.length;
              uvIndex += newUvs.length;
              indexIndex += newIndices.length;
            }

            const geometry = new THREE.BufferGeometry();
            geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            geometry.setIndex(new THREE.BufferAttribute(indices, 1));
            return geometry;
          };
          const hmdGeometry = _makeGeometry([
            [5, -0.2, 0.15, -0.2],
            [1, 0, -0.08, -0.2],
            [2, 0, -0.12, -0.2],
            [10, 0, -0.16, -0.2],
          ]);
          const leftControllerGeometry = _makeGeometry([
            [9, 0.05, -0.05, 0.02],
          ]);
          const rightControllerGeometry = _makeGeometry([
            [6, 0, 0.12, 0],
            [7, 0, 0.09, 0],
            [8, 0, 0.06, 0],
            [11, -0.05, -0.05, 0.02],
            [4, 0, 0.022, 0.02],
            [0, 0, 0.022, 0.05],
            [3, -0.08, -0.015, 0.07],
          ]);

          const texture = new THREE.Texture(
            controlsAtlasImg,
            THREE.UVMapping,
            THREE.ClampToEdgeWrapping,
            THREE.ClampToEdgeWrapping,
            THREE.LinearFilter,
            THREE.LinearFilter,
            THREE.RGBAFormat,
            THREE.UnsignedByteType,
            1
          );
          texture.needsUpdate = true;
          const material = new THREE.MeshBasicMaterial({
            // color: 0x333333,
            map: texture,
            transparent: true,
            depthWrite: false,
          });

          const hmdMesh = new THREE.Mesh(hmdGeometry, material);
          scene.add(hmdMesh);
          const leftControllerMesh = new THREE.Mesh(leftControllerGeometry, material);
          scene.add(leftControllerMesh);
          const rightControllerMesh = new THREE.Mesh(rightControllerGeometry, material);
          scene.add(rightControllerMesh);

          const _update = () => {
            const {hmd, gamepads} = pose.getStatus();
            const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmd;
            const {left: leftGamepad, right: rightGamepad} = gamepads;
            const {worldPosition: leftControllerPosition, worldRotation: leftControllerRotation} = leftGamepad;
            const {worldPosition: rightControllerPosition, worldRotation: rightControllerRotation} = rightGamepad;

            hmdMesh.position.copy(hmdPosition);
            hmdMesh.quaternion.copy(hmdRotation);
            hmdMesh.updateMatrixWorld();

            leftControllerMesh.position.copy(leftControllerPosition);
            leftControllerMesh.quaternion.copy(leftControllerRotation);
            leftControllerMesh.updateMatrixWorld();

            rightControllerMesh.position.copy(rightControllerPosition);
            rightControllerMesh.quaternion.copy(rightControllerRotation);
            rightControllerMesh.updateMatrixWorld();
          };
          render.on('update', _update);

          _destroy = () => {
            scene.remove(hmdMesh);
            scene.remove(leftControllerMesh);
            scene.remove(rightControllerMesh);

            hmdGeometry.dispose();
            leftControllerGeometry.dispose();
            rightControllerGeometry.dispose();
            texture.dispose();
            material.dispose();

            render.removeListener('update', _update);
          };
        }
      });
    const _unloadTutorial = () => {
      _destroy();
      _destroy = null;

      return Promise.resolve();
    };

    let loading = true;
    vridApi.get('tutorial')
      .then(tutorialFlag => {
        if (tutorialFlag || tutorialFlag === undefined) {
          _loadTutorial()
            .then(() => {
              loading = false;
            });
        } else {
          loading = false;
        }
      });

    const _keydown = e => {
      if (e.event.key === 'F1') {
        if (!loading) {
          loading = true;

          vridApi.get('tutorial')
            .then(tutorialFlag => {
              tutorialFlag = !tutorialFlag;

              (tutorialFlag ? _loadTutorial : _unloadTutorial)()
                .then(() => {
                  vridApi.set('tutorial', tutorialFlag)
                    .then(() => {
                      loading = false;
                    })
                    .catch(err => {
                      console.warn(err);

                      loading = false;
                    });
                });
            })
            .catch(err => {
              console.warn(err);

              loading = false;
            });
        }

        e.preventDefault();
      }
    };
    input.on('keydown', _keydown);

    let live = true;
    this._cleanup = () => {
      live = false;

      _destroy && _destroy();

      input.removeListener('_keydown', _keydown);
    };
    let _destroy = null;
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Tutorial;
