class Tutorial {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose} = zeo;
    const {THREE, scene} = three;

    const upVector = new THREE.Vector3(0, 1, 0);
    const localVector = new THREE.Vector3();

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
              const planeIndex = planes[i];
              const newPositions = planeGeometryPositions.slice();
              const numNewPositions = newPositions.length / 3;
              for (let j = 0; j < numNewPositions; j++) {
                newPositions[j * 3 + 0] *= widths[planeIndex];
                newPositions[j * 3 + 1] += (height * numPlanes / 2) - (i * height);
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
            0,
          ]);
          const leftControllerGeometry = _makeGeometry([
            1,
            2,
            3,
            4,
            5,
          ]);
          const rightControllerGeometry = _makeGeometry([
            6,
            7,
            8,
            9,
            10,
            11,
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

            hmdMesh.position.copy(hmdPosition)
              .add(localVector.set(-0.16, 0.135, -0.2).applyQuaternion(hmdRotation));
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

          this._cleanup = () => {
            scene.remove(hmdMesh);
            scene.remove(leftControllerMesh);
            scene.remove(rightControllerMesh);

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
