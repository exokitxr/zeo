const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const SIDES = ['left', 'right'];

const dataSymbol = Symbol();

const paper = objectApi => {
  const {three, elements, render, input, pose, items, utils: {geometry: geometryUtils}} = zeo;
  const {THREE, scene, camera, renderer} = three;

  const oneVector = new THREE.Vector3(1, 1, 1);
  const localVector = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const localEuler = new THREE.Euler();

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
  const _requestTexture = (src, name) => _requestImage(src)
    .then(img => objectApi.registerTexture(name, img));

  return () => Promise.all([
    _requestTexture('/archae/objects/img/wood.png', 'paper'),
    _requestImage('/archae/objects/img/pencil.png'),
  ])
    .then(([
      paperTexture,
      pencilImg,
    ]) =>
      objectApi.registerGeometry('paper', (args) => {
        const {THREE, getUv} = args;
        const paperUvs = getUv('paper');
        const uvWidth = paperUvs[2] - paperUvs[0];
        const uvHeight = paperUvs[3] - paperUvs[1];

        const PAPER_SIZE = 1;
        const STAND_SIZE = PAPER_SIZE * 2;
        const PAPER_BORDER_SIZE = PAPER_SIZE * 0.1;
        const width = PAPER_SIZE;
        const height = STAND_SIZE;
        const border = PAPER_BORDER_SIZE;
        const NUM_POSITIONS = 10 * 1024;

        const geometry = (() => {
          const leftGeometry = new THREE.BoxBufferGeometry(border, height, border)
            .applyMatrix(new THREE.Matrix4().makeTranslation(-(width / 2) - (border / 2), height/2 + border/2, -(border / 2)));

          const rightGeometry = new THREE.BoxBufferGeometry(border, height, border)
            .applyMatrix(new THREE.Matrix4().makeTranslation((width / 2) + (border / 2), height/2 + border/2, -(border / 2)));

          const bottomGeometry = new THREE.BoxBufferGeometry(width + (border * 2), border / 2, border * 2)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, height/2, border));

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
            bottomGeometry,
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
          uvs[i * 2 + 0] = paperUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (paperUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        return geometry;
      })
      .then(() => {
        const PAPER_SIZE = 1;
        const STAND_SIZE = PAPER_SIZE * 2;
        const PAPER_BORDER_SIZE = PAPER_SIZE * 0.1;
        const width = PAPER_SIZE;
        const height = STAND_SIZE;
        const rendererSize = renderer.getSize();
        const rendererPixelRatio = renderer.getPixelRatio();
        const resolutionWidth = rendererSize.width * rendererPixelRatio;
        const resolutionHeight = rendererSize.height * rendererPixelRatio;

        const offsetVector = new THREE.Vector3(0, height/2 + PAPER_SIZE/2, 0);

        const pencilMaterial = (() => {
          const texture = new THREE.Texture(
            pencilImg,
            THREE.UVMapping,
            THREE.ClampToEdgeWrapping,
            THREE.ClampToEdgeWrapping,
            THREE.NearestFilter,
            THREE.NearestFilter,
            THREE.RGBAFormat,
            THREE.UnsignedByteType,
            1
          );
          texture.needsUpdate = true;
          const material = new THREE.MeshPhongMaterial({
            map: texture,
          });
          return material;
        })();
        const _makePencilMesh = () => {
          const geometry = new THREE.BoxBufferGeometry(0.02, 0.02, 0.2);
          const material = pencilMaterial;
          const mesh = new THREE.Mesh(geometry, material);
          mesh.visible = false;
          return mesh;
        };
        const pencilMeshes = {
          left: _makePencilMesh(),
          right: _makePencilMesh(),
        };
        scene.add(pencilMeshes.left);
        scene.add(pencilMeshes.right);

        const paperItemApi = {
          asset: 'ITEM.PAPER',
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
                objectApi.addObject('paper', localVector, localQuaternion, oneVector);

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
        items.registerItem(this, paperItemApi);

        const papers = [];
        const paperObjectApi = {
          object: 'paper',
          objectAddedCallback(object) {
            object.on('grip', side => {
              const id = _makeId();
              const asset = 'ITEM.PAPER';
              const assetInstance = items.makeItem({
                type: 'asset',
                id: id,
                name: asset,
                displayName: asset,
                attributes: {
                  position: {value: DEFAULT_MATRIX},
                  asset: {value: asset},
                  quantity: {value: 1},
                  owner: {value: null},
                  bindOwner: {value: null},
                  physics: {value: false},
                },
              });
              assetInstance.grab(side);

              object.remove();
            });

            const geometry = new THREE.PlaneBufferGeometry(1, 1, 3, 0);
            const positions = geometry.getAttribute('position').array;
            const numPositions = positions.length / 3;
            for (let i = 0; i < numPositions; i++) {
              const baseIndex = i * 3;
              const x = positions[baseIndex + 0];
              positions[baseIndex + 2] += 0.05 *
                (Math.abs(x) === 1 ? 0 : 1) *
                (x > 0 ? -1 : 0);
            }
            geometry
              .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(
                new THREE.Quaternion().setFromAxisAngle(
                  new THREE.Vector3(1, 0, 0),
                  -0.05 * Math.PI * 2
                )
              ))
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, PAPER_BORDER_SIZE));
            const material = new THREE.MeshPhongMaterial({
              color: 0xFFFFFF,
              shininess: 0,
              shading: THREE.FlatShading,
              side: THREE.DoubleSide,
            });
            const paperMesh = new THREE.Mesh(geometry, material);
            scene.add(paperMesh);
            paperMesh.position.copy(object.position)
              .add(offsetVector);
            paperMesh.quaternion.copy(object.rotation);
            // paperMesh.scale.copy(object.scale);
            scene.add(paperMesh);
            paperMesh.updateMatrixWorld();
            object.paperMesh = paperMesh;

            papers.push(object);

            object[dataSymbol] = {
              cleanup() {
                scene.remove(paperMesh);

                papers.splice(papers.indexOf(object), 1);
              },
            };
          },
          objectRemovedCallback(object) {
            const {[dataSymbol]: {cleanup}} = object;
            cleanup();
          },
        };
        objectApi.registerObject(paperObjectApi);

        const _update = () => {
          if (papers.length > 0) {
            const {gamepads} = pose.getStatus();

            for (let i = 0; i < SIDES.length; i++) {
              const side = SIDES[i];
              const gamepad = gamepads[side];
              const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;

              let found = false;
              for (let j = 0; j < papers.length; j++) {
                if (controllerPosition.distanceTo(papers[j].paperMesh.position) < 1) {
                  found = true;
                  break;
                }
              }

              const pencilMesh = pencilMeshes[side];
              if (found) {
                pencilMesh.position.copy(controllerPosition);
                pencilMesh.quaternion.copy(controllerRotation);
                pencilMesh.scale.copy(controllerScale);
                pencilMesh.updateMatrixWorld();
                pencilMesh.visible = true;
              } else {
                pencilMesh.visible = false;
              }
            }
          }
        };
        render.on('update', _update);

        return () => {
          objectApi.unregisterObject(paperObjectApi);

          render.removeListener('update', _update);

          scene.removeListener(pencilMeshes.left);
          scene.removeListener(pencilMeshes.right);
        };
      })
  );
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = paper;
