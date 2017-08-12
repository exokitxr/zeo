const mod = require('mod-loop');

const PENCIL_SIZE = 0.2;
const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const SIDES = ['left', 'right'];

const dataSymbol = Symbol();

const paper = objectApi => {
  const {three, elements, render, input, pose, items} = zeo;
  const {THREE, scene, camera, renderer} = three;

  const oneVector = new THREE.Vector3(1, 1, 1);
  const forwardVector = new THREE.Vector3(0, 0, -1);
  const backVector = new THREE.Vector3(0, 0, 1);
  const pencilVector = new THREE.Vector3(0, 0, -PENCIL_SIZE);
  const localVector = new THREE.Vector3();
  const localVector2 = new THREE.Vector3();
  const localVector3 = new THREE.Vector3();
  const localCoords = new THREE.Vector2();
  const localQuaternion = new THREE.Quaternion();
  const localEuler = new THREE.Euler();
  const localLine = new THREE.Line3();

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
  const _requestImageBitmap = src => _requestImage(src)
    .then(img => createImageBitmap(img, 0, 0, img.width, img.height));
  const _requestTexture = (src, name) => _requestImage(src)
    .then(img => objectApi.registerTexture(name, img));

  return () => Promise.all([
    _requestTexture('/archae/objects/img/wood.png', 'paper'),
    _requestImageBitmap('/archae/objects/img/pencil.png'),
    _requestImageBitmap('/archae/objects/img/brush.png'),
  ])
    .then(([
      paperTexture,
      pencilImg,
      brushImg,
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
        const RESOLUTION = 500;
        const width = PAPER_SIZE;
        const height = STAND_SIZE;
        const rendererSize = renderer.getSize();
        const rendererPixelRatio = renderer.getPixelRatio();
        const resolutionWidth = rendererSize.width * rendererPixelRatio;
        const resolutionHeight = rendererSize.height * rendererPixelRatio;

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
          const material = new THREE.MeshBasicMaterial({
            map: texture,
          });
          return material;
        })();
        const _makePencilMesh = () => {
          const geometry = new THREE.BoxBufferGeometry(0.02, 0.02, PENCIL_SIZE)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -PENCIL_SIZE / 2));
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

              object.remove();
            });

            object.on('update', () => {
              _loadFileN(object.value);
            });

            const _triggerdown = e => {
              const {side} = e;

              if (objectApi.getHoveredObject(side) === object) {
                if (object.value !== 0) {
                  const file = items.getFile(object.value);
                  const dropMatrix = (() => {
                    const {hmd} = pose.getStatus();
                    const {worldPosition: hmdPosition, worldRotation: hmdRotation, worldScale: hmdScale} = hmd;
                    localVector.copy(object.position)
                      .add(
                        localVector2.copy(backVector).multiplyScalar(0.5)
                          .add(localVector3.set(0, STAND_SIZE/2, 0))
                          .applyQuaternion(object.rotation)
                      );
                    return localVector.toArray().concat(object.rotation.toArray()).concat(oneVector.toArray());
                  })();

                  items.reifyFile({
                    file,
                    matrix: dropMatrix,
                  });

                  object.setData(0);
                  _loadFileN(0);
                }

                e.stopImmediatePropagation();
              }
            };
            input.on('triggerdown', _triggerdown, {
              priority: -1,
            });

            const paperMesh = (() => {
              // const geometry = new THREE.PlaneBufferGeometry(1, 1, 3, 0);
              const geometry = new THREE.PlaneBufferGeometry(1, 1);
              /* const positions = geometry.getAttribute('position').array;
              const numPositions = positions.length / 3;
              for (let i = 0; i < numPositions; i++) {
                const baseIndex = i * 3;
                const x = positions[baseIndex + 0];
                positions[baseIndex + 2] += 0.05 *
                  (Math.abs(x) === 1 ? 0 : 1) *
                  (x > 0 ? -1 : 0);
              } */
              /* geometry
                .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(
                  new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(1, 0, 0),
                    -0.05 * Math.PI * 2
                  )
                ))
                .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, PAPER_BORDER_SIZE)); */
              const canvas = document.createElement('canvas');
              canvas.width = RESOLUTION;
              canvas.height = RESOLUTION;
              const ctx = canvas.getContext('2d');
              ctx.clear = () => {
                ctx.fillStyle = '#FFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
              };
              ctx.clear();
              canvas.ctx = ctx;
              const texture = new THREE.Texture(
                canvas,
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
                color: 0xFFFFFF,
                shininess: 0,
                map: texture,
                shading: THREE.FlatShading,
                side: THREE.DoubleSide,
              });

              const mesh = new THREE.Mesh(geometry, material);
              mesh.position.copy(object.position)
                .add(new THREE.Vector3(0, height/2 + PAPER_SIZE/2, PAPER_BORDER_SIZE).applyQuaternion(object.rotation));
              mesh.quaternion.copy(object.rotation)
                .multiply(new THREE.Quaternion().setFromAxisAngle(
                  new THREE.Vector3(1, 0, 0),
                  -0.05 * Math.PI * 2
                ));
              // mesh.scale.copy(object.scale);

              const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                localVector.copy(forwardVector).applyQuaternion(mesh.quaternion),
                mesh.position
              );
              const xAxis = new THREE.Line3(
                mesh.position.clone().add(new THREE.Vector3(-PAPER_SIZE/2, PAPER_SIZE/2, 0).applyQuaternion(mesh.quaternion)),
                mesh.position.clone().add(new THREE.Vector3(PAPER_SIZE/2, PAPER_SIZE/2, 0).applyQuaternion(mesh.quaternion))
              );
              const yAxis = new THREE.Line3(
                mesh.position.clone().add(new THREE.Vector3(-PAPER_SIZE/2, PAPER_SIZE/2, 0).applyQuaternion(mesh.quaternion)),
                mesh.position.clone().add(new THREE.Vector3(-PAPER_SIZE/2, -PAPER_SIZE/2, 0).applyQuaternion(mesh.quaternion))
              );
              mesh.getCoords = (line, resultCoords) => {
                const planePoint = plane.intersectLine(line, localVector);

                if (planePoint) {
                  const x = Math.floor(xAxis.closestPointToPoint(planePoint, true, localVector2).distanceTo(xAxis.start) / PAPER_SIZE * RESOLUTION);
                  const y = Math.floor(yAxis.closestPointToPoint(planePoint, true, localVector2).distanceTo(yAxis.start) / PAPER_SIZE * RESOLUTION);

                  if (x > 0 && x < RESOLUTION && y > 0 && y < RESOLUTION) {
                    return resultCoords.set(x, y);
                  } else {
                    return null;
                  }
                } else {
                  return null;
                }
              };

              mesh.saveFile = _debounce(next => {
                texture.image.toBlob(blob => {
                  const file = object.value !== 0 ? items.getFile(object.value) : items.getFile();
                  file.write(blob)
                    .then(() => {
                      if (object.value === 0) {
                        object.setData(file.n);
                      }

                      next();
                    })
                    .catch(err => {
                      console.warn(err);

                      next();
                    });
                }, {
                  mimeType: 'image/png',
                });
              });

              const _makeDrawState = () => ({
                lastPoint: new THREE.Vector2(),
                lastPointActive: false,
              });
              mesh.drawStates = {
                left: _makeDrawState(),
                right: _makeDrawState(),
              };

              return mesh;
            })();
            scene.add(paperMesh);
            paperMesh.updateMatrixWorld();
            object.paperMesh = paperMesh;

            const _loadFileN = n => {
              const texture = paperMesh.material.map;

              if (n !== 0) {
                _requestImageBitmap(items.getFile(n).getUrl())
                  .then(img => {
                    texture.image.ctx.clear();
                    texture.image.ctx.drawImage(img, 0, 0);
                    texture.needsUpdate = true;
                  })
                  .catch(err => {
                    console.warn(err);
                  });
              } else {
                texture.image.ctx.clear();
                texture.needsUpdate = true;
              }
            };
            _loadFileN(object.value);

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

        const _makeDrawState = () => ({
          drawing: false,
        });
        const drawStates = {
          left: _makeDrawState(),
          right: _makeDrawState(),
        };

        const _triggerdown = e => {
          const gamepad = pose.getStatus().gamepads[e.side];

          if (papers.some(paper => {
            const {paperMesh} = paper;
            const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;

            const pencilLine = localLine;
            pencilLine.start.copy(controllerPosition);
            pencilLine.end.copy(controllerPosition)
              .add(
                localVector.copy(pencilVector)
                  .applyQuaternion(controllerRotation)
              );
            return paperMesh.getCoords(pencilLine, localCoords) !== null;
          })) {
            drawStates[e.side].drawing = true;

            e.stopImmediatePropagation();
          }
        };
        input.on('triggerdown', _triggerdown);
        const _triggerup = e => {
          drawStates[e.side].drawing = false;
        };
        input.on('triggerup', _triggerup);

        const _update = () => {
          const _updatePencilMeshes = () => {
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
          const _updateDraw = () => {
            if (papers.length > 0) {
              const {gamepads} = pose.getStatus();

              for (let i = 0; i < papers.length; i++) {
                const paper = papers[i];
                const {paperMesh} = paper;
                const {drawStates: paperMeshDrawStates} = paperMesh;

                let updated = false;
                for (let j = 0; j < SIDES.length; j++) {
                  const side = SIDES[j];
                  const drawState = drawStates[side];
                  const paperMeshDrawState = paperMeshDrawStates[side];

                  if (drawState.drawing) {
                    const gamepad = gamepads[side];
                    const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;

                    const pencilLine = localLine;
                    pencilLine.start.copy(controllerPosition);
                    pencilLine.end.copy(controllerPosition)
                      .add(
                        localVector.copy(pencilVector)
                          .applyQuaternion(controllerRotation)
                      );
                    const planeCoords = paperMesh.getCoords(pencilLine, localCoords);

                    if (planeCoords) {
                      const currentPoint = planeCoords;
                      const {lastPoint, lastPointActive} = paperMeshDrawState;
                      if (!lastPointActive) {
                        lastPoint.copy(currentPoint);
                        lastPoint.y -= 10;
                      }

                      const distance = lastPoint.distanceTo(currentPoint);
                      if (distance > 0) {
                        const halfBrushW = brushImg.width / 2;
                        const halfBrushH = brushImg.height / 2;
                        const dy = currentPoint.y - lastPoint.y;
                        const dx = currentPoint.x - lastPoint.x;
                        const angle = mod(Math.atan2(dy, dx), Math.PI * 2);

                        let minX = Infinity;
                        let maxX = -Infinity;
                        let minY = Infinity;
                        let maxY = -Infinity;
                        for (let z = 0; z <= distance || z === 0; z++) {
                          const x = lastPoint.x + (Math.cos(angle) * z) - halfBrushW;
                          const y = lastPoint.y + (Math.sin(angle) * z) - halfBrushH;
                          paperMesh.material.map.image.ctx.drawImage(brushImg, x, y);

                          const localMinX = Math.floor(x);
                          const localMaxX = Math.min(localMinX + brushImg.width, paperMesh.material.map.image.width);
                          const localMinY = Math.floor(y);
                          const localMaxY = Math.min(localMinY + brushImg.height, paperMesh.material.map.image.height);
                          minX = Math.min(minX, localMinX);
                          maxX = Math.max(maxX, localMaxX);
                          minY = Math.min(minY, localMinY);
                          maxY = Math.max(maxY, localMaxY);
                        }

                        paperMesh.material.map.needsUpdate = true;
                        updated = true;
                      }

                      lastPoint.copy(currentPoint);
                      paperMeshDrawState.lastPointActive = true;
                    } else {
                      paperMeshDrawState.lastPointActive = false;
                    }
                  } else {
                    paperMeshDrawState.lastPointActive = false;
                  }
                }

                if (updated) {
                  paperMesh.saveFile();
                }
              }
            }
          };

          _updatePencilMeshes();
          _updateDraw();
        };
        render.on('update', _update);

        return () => {
          objectApi.unregisterObject(paperObjectApi);

          input.removeListener('triggerdown', _triggerdown);
          input.removeListener('triggerup', _triggerup);
          render.removeListener('update', _update);

          scene.remove(pencilMeshes.left);
          scene.remove(pencilMeshes.right);
        };
      })
  );
};
const _makeId = () => Math.random().toString(36).substring(7);
const _debounce = fn => {
  let running = false;
  let queued = false;

  const _go = () => {
    if (!running) {
      running = true;

      fn(() => {
        running = false;

        if (queued) {
          queued = false;

          _go();
        }
      });
    } else {
      queued = true;
    }
  };
  return _go;
};

module.exports = paper;
