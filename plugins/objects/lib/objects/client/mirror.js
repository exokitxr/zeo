const ThreeExtraMirror = require('../../three-extra/Mirror');

const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const mirror = objectApi => {
  const {three, elements, render, input, pose, items} = zeo;
  const {THREE, scene, camera, renderer} = three;

  const oneVector = new THREE.Vector3(1, 1, 1);
  const localVector = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const localEuler = new THREE.Euler();

  const THREEMirror = ThreeExtraMirror(THREE);

  const _requestImage = src => new Promise((accept, reject) => {
    const img = new Image();
    img.onload = () => {
      accept(img);
    };
    img.onerror = err => {
      reject(img);
    };
    img.src = src;
  });

  return () => _requestImage('/archae/objects/img/wood.png')
    .then(mirrorImg => objectApi.registerTexture('mirror', mirrorImg))
    .then(() => objectApi.registerGeometry('mirror', (args) => {
      const {THREE, getUv} = args;
      const mirrorUvs = getUv('mirror');
      const uvWidth = mirrorUvs[2] - mirrorUvs[0];
      const uvHeight = mirrorUvs[3] - mirrorUvs[1];

      const PORTAL_SIZE = 2;
      const PORTAL_BORDER_SIZE = PORTAL_SIZE * 0.1;
      const width = PORTAL_SIZE / 2;
      const height = PORTAL_SIZE;
      const border = PORTAL_BORDER_SIZE;
      const NUM_POSITIONS = 10 * 1024;

      const geometry = (() => {
        const leftGeometry = new THREE.BoxBufferGeometry(border, height, border)
          .applyMatrix(new THREE.Matrix4().makeTranslation(-(width / 2) - (border / 2), PORTAL_SIZE/2 + PORTAL_BORDER_SIZE/2, -(border / 2)));

        const rightGeometry = new THREE.BoxBufferGeometry(border, height, border)
          .applyMatrix(new THREE.Matrix4().makeTranslation((width / 2) + (border / 2), PORTAL_SIZE/2 + PORTAL_BORDER_SIZE/2, -(border / 2)));

        const topGeometry = new THREE.BoxBufferGeometry(width + (border * 2), border, border)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, PORTAL_SIZE/2 + PORTAL_BORDER_SIZE/2 + (height / 2) + (border / 2), -(border / 2)));

        const bottomGeometry = new THREE.BoxBufferGeometry(width + (border * 2), border, border)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, PORTAL_SIZE/2 + PORTAL_BORDER_SIZE/2 - (height / 2) - (border / 2), -(border / 2)));

        const backGeometry = new THREE.PlaneBufferGeometry(width, height)
          .applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI))
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, PORTAL_SIZE/2 + PORTAL_BORDER_SIZE/2, -(border / 2)));

        const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
          for (let i = 0; i < src.length; i++) {
            dst[startIndexIndex + i] = src[i] + startAttributeIndex;
          }
        };

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(NUM_POSITIONS);
        const normals = new Float32Array(NUM_POSITIONS);
        const uvs = new Float32Array(NUM_POSITIONS);
        const indices = new Uint16Array(NUM_POSITIONS);
        let attributeIndex = 0;
        let uvIndex = 0;
        let indexIndex = 0;
        [
          leftGeometry,
          rightGeometry,
          topGeometry,
          bottomGeometry,
          backGeometry,
        ].forEach(newGeometry => {
          const newPositions = newGeometry.getAttribute('position').array;
          positions.set(newPositions, attributeIndex);
          const newNormals = newGeometry.getAttribute('normal').array;
          normals.set(newNormals, attributeIndex);
          const newUvs = newGeometry.getAttribute('uv').array;
          uvs.set(newUvs, uvIndex);
          const newIndices = newGeometry.index.array;
          _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

          attributeIndex += newPositions.length;
          uvIndex += newUvs.length;
          indexIndex += newIndices.length;
        });
        geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
        geometry.addAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals.buffer, normals.byteOffset, attributeIndex), 3));
        geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs.buffer, uvs.byteOffset, uvIndex), 2));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices.buffer, indices.byteOffset, indexIndex), 1));
        return geometry;
      })();
      const uvs = geometry.getAttribute('uv').array;
      const numUvs = uvs.length / 2;
      for (let i = 0; i < numUvs; i++) {
        uvs[i * 2 + 0] = mirrorUvs[0] + (uvs[i * 2 + 0] * uvWidth);
        uvs[i * 2 + 1] = (mirrorUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
      }

      return geometry;
    }))
    .then(() => {
      const PORTAL_SIZE = 2;
      const PORTAL_BORDER_SIZE = PORTAL_SIZE * 0.1;
      const width = PORTAL_SIZE / 2;
      const height = PORTAL_SIZE;
      const rendererSize = renderer.getSize();
      const rendererPixelRatio = renderer.getPixelRatio();
      const resolutionWidth = rendererSize.width * rendererPixelRatio;
      const resolutionHeight = rendererSize.height * rendererPixelRatio;

      const offsetVector = new THREE.Vector3(0, height/2 + PORTAL_BORDER_SIZE/2, 0);

      const _makeRenderTarget = () => {
        const renderTarget = new THREE.WebGLRenderTarget(resolutionWidth, resolutionHeight, {
          minFilter: THREE.NearestFilter,
          magFilter: THREE.NearestFilter,
          format: THREE.RGBFormat,
          stencilBuffer: false,
          // depthBuffer: false,
        });
        renderTarget.textureMatrix = new THREE.Matrix4();
        return renderTarget;
      };

      const mirrorItemApi = {
        asset: 'ITEM.MIRROR',
        itemAddedCallback(grabbable) {
          const _triggerdown = e => {
            const {side} = e;

            if (grabbable.getGrabberSide() === side) {
              const heightfieldElement = elements.getEntitiesElement().querySelector(HEIGHTFIELD_PLUGIN);
              localVector.set(
                grabbable.position.x,
                heightfieldElement ? heightfieldElement.getElevation(grabbable.position.x, grabbable.position.z) : 0,
                grabbable.position.z
              );
              localEuler.setFromQuaternion(grabbable.rotation, camera.rotation.order);
              localEuler.x = 0;
              localEuler.z = 0;
              localQuaternion.setFromEuler(localEuler);
              objectApi.addObject('mirror', localVector, localQuaternion);

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

          delete grabbable[dataSymbol];
        },
      };
      items.registerItem(this, mirrorItemApi);

      const mirrors = {};
      const mirrorObjectApi = {
        object: 'mirror',
        addedCallback(id, position, rotation) {
          const renderTargets = {
            left: _makeRenderTarget(),
            right: _makeRenderTarget(),
          };
          const mirrorMesh = new THREEMirror(width, height, {
            clipBias: 0.003,
            textureWidth: resolutionWidth,
            textureHeight: resolutionHeight,
            color: 0x808080,
            renderTargets,
          });
          mirrorMesh.position.copy(position)
            .add(offsetVector);
          mirrorMesh.quaternion.copy(rotation);
          // mirrorMesh.scale.copy(scale);
          scene.add(mirrorMesh);
          mirrorMesh.updateMatrixWorld();

          const updateEye = camera => {
            mirrorMesh.renderEye(renderer, scene, camera, renderTargets[camera.name]);
          };
          updateEyes.push(updateEye);

          const mirror = {
            cleanup() {
              scene.remove(mirrorMesh);
              renderTargets.left.dispose();
              renderTargets.right.dispose();

              updateEyes.splice(updateEyes.indexOf(updateEye), 1);
            },
          };
          mirrors[id] = mirror;
        },
        removedCallback(id) {
          mirrors[id].cleanup();
        },
        gripCallback(id, side, x, z, objectIndex) {
          const itemId = _makeId();
          const asset = 'ITEM.MIRROR';
          const assetInstance = items.makeItem({
            type: 'asset',
            id: itemId,
            name: asset,
            displayName: asset,
            attributes: {
              type: {value: 'asset'},
              value: {value: asset},
              position: {value: DEFAULT_MATRIX},
              quantity: {value: 1},
              owner: {value: null},
              bindOwner: {value: null},
              physics: {value: false},
            },
          });
          assetInstance.grab(side);

          objectApi.removeObject(x, z, objectIndex);
        },
      };
      objectApi.registerObject(mirrorObjectApi);

      const updateEyes = [];
      const _updateEye = camera => {
        for (let i = 0; i < updateEyes.length; i++) {
          updateEyes[i](camera);
        }
      };
      render.on('updateEye', _updateEye);

      return () => {
        objectApi.unregisterObject(mirrorObjectApi);

        render.removeListener('updateEye', _updateEye);
      };
    });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = mirror;
