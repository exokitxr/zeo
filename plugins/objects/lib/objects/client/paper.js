
const PAPER_SIZE = 1;
const STAND_SIZE = PAPER_SIZE * 2;
const PAPER_BORDER_SIZE = PAPER_SIZE * 0.1;
const RESOLUTION = 500;
const width = PAPER_SIZE;
const height = STAND_SIZE;
const PENCIL_SIZE = 0.4;
const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const SIDES = ['left', 'right'];

const dataSymbol = Symbol();

const paper = objectApi => {
  const {three, elements, render, input, pose, items, utils: {js: {mod}}} = zeo;
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

  return () => Promise.all([
    _requestImageBitmap('/archae/objects/img/pencil.png'),
    _requestImageBitmap('/archae/objects/img/brush.png'),
  ])
    .then(([
      paperTexture,
      pencilImg,
      brushImg,
    ]) => {
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
          color: 0xFFFFFF,
          shininess: 0,
          map: texture,
          shading: THREE.FlatShading,
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
                heightfieldElement ? heightfieldElement.getBestElevation(grabbable.position.x, grabbable.position.z, grabbable.position.y) : 0,
                grabbable.position.z
              );
              localEuler.setFromQuaternion(grabbable.rotation, camera.rotation.order);
              localEuler.x = 0;
              localEuler.z = 0;
              localQuaternion.setFromEuler(localEuler);
              objectApi.addObject('paper', localVector, localQuaternion);

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

      const papers = {};
      const paperObjectApi = {
        object: 'paper',
        addedCallback(id, position, rotation, value, x, z, objectIndex) {
          const paperMesh = (() => {
            const geometry = new THREE.PlaneBufferGeometry(1, 1);

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
            const material = new THREE.MeshBasicMaterial({
              map: texture,
              side: THREE.DoubleSide,
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position)
              .add(new THREE.Vector3(0, height/2 + PAPER_SIZE/2, PAPER_BORDER_SIZE).applyQuaternion(rotation));
            mesh.quaternion.copy(rotation)
              .multiply(new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(1, 0, 0),
                -0.05 * Math.PI * 2
              ));
            // mesh.scale.copy(scale);

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
                const file = paper.value !== 0 ? items.getFile(paper.value) : items.getFile();
                file.write(blob)
                  .then(() => {
                    if (paper.value === 0) {
                      objectApi.setData(x, z, objectIndex, file.n);
                      paper.value = file.n;
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

          const paper = {
            position: position.clone(),
            rotation: rotation.clone(),
            value,
            paperMesh,
            loadFileN(n) {
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

              this.value = n;
            },
            cleanup() {
              scene.remove(paperMesh);

              papers[id] = null;
            },
          };
          paper.loadFileN(value);

          papers[id] = paper;
        },
        removedCallback(id) {
          papers[id].cleanup();
        },
        triggerCallback(id, side, x, z, objectIndex) {
          const paper = papers[id];

          if (paper && paper.value !== 0) {
            const file = items.getFile(paper.value);
            const dropMatrix = (() => {
              const {hmd} = pose.getStatus();
              const {worldPosition: hmdPosition, worldRotation: hmdRotation, worldScale: hmdScale} = hmd;
              localVector.copy(paper.position)
                .add(
                  localVector2.copy(backVector).multiplyScalar(0.5)
                    .add(localVector3.set(0, STAND_SIZE/2, 0))
                    .applyQuaternion(paper.rotation)
                );
              return localVector.toArray().concat(paper.rotation.toArray()).concat(oneVector.toArray());
            })();

            items.reifyFile({
              file,
              matrix: dropMatrix,
            });

            objectApi.setData(x, z, objectIndex, 0);
          }
        },
        gripCallback(id, side, x, z, objectIndex) {
          const itemId = _makeId();
          const asset = 'ITEM.PAPER';
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
        updateCallback(id, position, rotation, value) {
          const paper = papers[id];
          if (paper.value !== value) {
            paper.loadFileN(value);
          }
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
        const {side} = e;

        drawStates[side].drawing = true;

        const gamepad = pose.getStatus().gamepads[side];
        const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;
        for (const id in papers) {
          const paper = papers[id];

          if (paper) {
            const pencilLine = localLine;
            pencilLine.start.copy(controllerPosition);
            pencilLine.end.copy(controllerPosition)
              .add(
                localVector.copy(pencilVector)
                  .applyQuaternion(controllerRotation)
              );
            if (paper.paperMesh.getCoords(pencilLine, localCoords) !== null) {
              e.stopImmediatePropagation();

              break;
            }
          }
        }
      };
      input.on('triggerdown', _triggerdown);
      const _triggerup = e => {
        drawStates[e.side].drawing = false;
      };
      input.on('triggerup', _triggerup);

      const _update = () => {
        const _updatePencilMeshes = () => {
          for (let i = 0; i < SIDES.length; i++) {
            const side = SIDES[i];
            const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = pose.getStatus().gamepads[side];

            let found = false;
            for (const id in papers) {
              const paper = papers[id];

              if (paper) {
                if (controllerPosition.distanceTo(paper.paperMesh.position) < 1) {
                  found = true;
                  break;
                }
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
        };
        const _updateDraw = () => {
          const {gamepads} = pose.getStatus();

          for (const id in papers) {
            const paper = papers[id];

            if (paper) {
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
    });
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
