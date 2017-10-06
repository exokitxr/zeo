class Tutorial {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose} = zeo;
    const {THREE, scene} = three;

    const upVector = new THREE.Vector3(0, 1, 0);

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

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return _requestImageBitmap('/archae/tutorial/img/controls-atlas.png')
      .then(controlsAtlasImg => {
        if (live) {
          const geometry = (() => {
            const width = 0.2;
            const height = width * 2 * (74 / 1024);
            const planeGeometry = new THREE.PlaneBufferGeometry(width, height);
            const planeGeometryPositions = planeGeometry.getAttribute('position').array;
            const planeGeometryUvs = planeGeometry.getAttribute('uv').array;
            const planeGeometryIndex = planeGeometry.index.array;

            const numPlanes = 12;
            const positions = new Float32Array(planeGeometryPositions.length * numPlanes);
            const uvs = new Float32Array(planeGeometryUvs.length * numPlanes);
            const indices = new Uint16Array(planeGeometryIndex.length * numPlanes);
            let attributeIndex = 0;
            let uvIndex = 0;
            let indexIndex = 0;

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

            for (let i = 0; i < numPlanes; i++) {
              const newPositions = planeGeometryPositions.slice();
              const numNewPositions = newPositions.length / 3;
              for (let j = 0; j < numNewPositions; j++) {
                newPositions[j * 3 + 0] *= widths[i];
                newPositions[j * 3 + 1] += 0.5 - (i / numPlanes);
              }
              positions.set(newPositions, attributeIndex);

              const newUvs = planeGeometryUvs.slice();
              const numNewUvs = newUvs.length / 2;
              for (let j = 0; j < numNewUvs; j++) {
                newUvs[j * 2 + 0] *= widths[i];
                newUvs[j * 2 + 1] = 1 - (i / numPlanes + (1 - newUvs[j * 2 + 1]) / numPlanes);
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
          })();

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
          });

          const mesh = new THREE.Mesh(geometry, material);
          scene.add(mesh);

          const _update = () => {
            const {gamepads} = pose.getStatus();
            const gamepad = gamepads.right;
            const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;

            mesh.position.copy(controllerPosition);
            mesh.quaternion.copy(controllerRotation);
            mesh.updateMatrixWorld();
          };
          render.on('update', _update);

          this._cleanup = () => {
            scene.remove(mesh);

            render.removeListener('update', _update);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Tutorial;
