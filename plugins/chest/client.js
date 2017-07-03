const {
  NUM_CELLS,
} = require('./lib/constants/constants');
const protocolUtils = require('./lib/utils/protocol-utils');

const NUM_POSITIONS_CHUNK = 100 * 1024;
const SIDES = ['left', 'right'];

class Chest {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three, render, pose, hands, utils: {geometry: geometryUtils}} = zeo;
    const {THREE, scene} = three;

    const chestMaterial = new THREE.MeshBasicMaterial({
      // color: 0xFFFFFF,
      // shininess: 0,
      // shading: THREE.FlatShading,
      vertexColors: THREE.VertexColors,
      // side: THREE.DoubleSide,
    });
    const hoverColor = new THREE.Color(0x2196F3);

    const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };
    const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
      for (let i = 0; i < src.length; i++) {
        dst[startIndexIndex + i] = src[i] + startAttributeIndex;
      }
    };

    const worker = new Worker('archae/plugins/_plugins_chest/build/worker.js');
    const queue = [];
    worker.requestGeometry = () => new Promise((accept, reject) => {
      const buffer = new ArrayBuffer(NUM_POSITIONS_CHUNK * 3 * 4);
      worker.postMessage({
        buffer,
      }, [buffer]);
      queue.push(buffer => {
        accept(buffer);
      });
    });
    worker.onmessage = e => {
      const {data: buffer} = e;
      const cb = queue.shift();
      cb(buffer);
    };

    const _makeHoverState = () => ({
      type: null,
    });
    const hoverStates = {
      left: _makeHoverState(),
      right: _makeHoverState(),
    };

    const _requestChestGeometry = () => worker.requestGeometry()
      .then(chestChunkBuffer => protocolUtils.parseChestChunks(chestChunkBuffer))
      .then(([chestGeometry, lidGeometry]) => ({chestGeometry, lidGeometry}));
    const _makeChestMesh = chestGeometries => {
      const {chestGeometry, lidGeometry} = chestGeometries;

      const positions = new Float32Array(NUM_POSITIONS_CHUNK * 3);
      const colors = new Float32Array(NUM_POSITIONS_CHUNK * 3);
      const indices = new Uint32Array(NUM_POSITIONS_CHUNK * 3);
      let attributeIndex = 0;
      let indexIndex = 0;

      const _render = () => {
        const _addGeometry = newGeometry => {
          const {positions: newPositions/*, normals*/, colors: newColors, indices: newIndices/*, heightRange*/} = newGeometry;

          positions.set(newPositions, attributeIndex);
          colors.set(newColors, attributeIndex);
          _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

          attributeIndex += newPositions.length;
          indexIndex += newIndices.length;
        };
        const _rotateGeometry = (geometry, offset, quaternion) => {
          const {positions, colors, indices} = geometry;
          const newPositions = positions.slice();
          const positionAttribute = new THREE.BufferAttribute(newPositions, 3);

          new THREE.Matrix4().makeTranslation(
            offset.x,
            offset.y,
            offset.z
          )
            .premultiply(new THREE.Matrix4().makeRotationFromQuaternion(quaternion))
            .premultiply(new THREE.Matrix4().makeTranslation(
              -offset.x,
              -offset.y,
              -offset.z
            ))
            .applyToBufferAttribute(positionAttribute);

          return {
            positions: newPositions,
            colors: colors,
            indices: indices,
          };
        };

        _addGeometry(chestGeometry);
        _addGeometry(
          _rotateGeometry(
            lidGeometry,
            new THREE.Vector3(
              0,
              (lidGeometry.boundingBox[1][1] - lidGeometry.boundingBox[0][1]) / 2,
              (lidGeometry.boundingBox[1][2] - lidGeometry.boundingBox[0][2]) / 2
            ),
            new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 0, -1),
              new THREE.Vector3(0, -1, -1).normalize(),
            )
          )
        );
      };
      _render();      

      const geometry = new THREE.BufferGeometry();
      geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, attributeIndex), 3));
      geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.buffer, colors.byteOffset, attributeIndex), 3));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices.buffer, indices.byteOffset, indexIndex), 1));
      geometry.boundingSphere = new THREE.Sphere(
        new THREE.Vector3(
          0,
          0,
          0
        ),
        10
      );

      const material = chestMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(0, 31, 0);
      mesh.updateMatrixWorld();
      // mesh.frustumCulled = false;

      const grabbable = hands.makeGrabbable('chest', {
        position: mesh.position.toArray(),
        rotation: mesh.quaternion.toArray(),
        scale: mesh.scale.toArray(),
        isGrabbable: p => SIDES.some(side => hoverStates[side].type === 'chest'),
      });
      grabbable.on('update', ({position, rotation, scale}) => {
        mesh.position.fromArray(position);
        mesh.quaternion.fromArray(rotation);
        mesh.scale.fromArray(scale);
        mesh.updateMatrixWorld();
      });
      mesh.grabbable = grabbable;

      const _makeBoxTargetSpec = (type, position, rotation, scale, boundingBox) => {
        const boundingBoxMin = new THREE.Vector3().fromArray(boundingBox[0]);
        const boundingBoxMax = new THREE.Vector3().fromArray(boundingBox[1]);
        const offset = boundingBoxMin.clone().add(boundingBoxMax).divideScalar(2).multiply(scale).applyQuaternion(rotation);
        const newPosition = position.clone().add(offset);
        const size = boundingBoxMax.clone().sub(boundingBoxMin);
        return {
          type: type,
          boxTarget: geometryUtils.makeBoxTarget(
            newPosition,
            rotation,
            scale,
            size
          ),
        };
      };
      let lastMatrixWorld = new THREE.Matrix4();
      lastMatrixWorld.set(); // force initial update
      mesh.boxTargets = null;
      mesh.updateBoxTargets = () => {
        if (!mesh.matrixWorld.equals(lastMatrixWorld)) {
          const {position, rotation, scale} = _decomposeObjectMatrixWorld(mesh);

          mesh.boxTargets = [
            _makeBoxTargetSpec('chest', position, rotation, scale, chestGeometry.boundingBox),
            _makeBoxTargetSpec('lid', position, rotation, scale, lidGeometry.boundingBox),
          ];
          lastMatrixWorld.copy(mesh.matrixWorld);
        }
      };

      mesh.needsUpdate = false;
      mesh.update = () => {
        if (mesh.needsUpdate) {
          const hoverTypes = (() => {
            const result = [];
            SIDES.forEach(side => {
              const hoverState = hoverStates[side];
              const {type} = hoverState;
              if (!result.includes(type)) {
                result.push(type);
              }
            });
            return result;
          })();

          const colorAttribute = geometry.getAttribute('color');
          const {array: colors} = colorAttribute;
          let attributeIndex = 0;
          const _rerenderGeometry = (newGeometry, highlight) => {
            const {colors: newColors} = newGeometry;

            if (highlight) {
              const numColors = colors.length / 3;
              for (let i = 0; i < numColors; i++) {
                const baseIndex = i * 3;
                const color = hoverColor.clone().multiplyScalar(
                  new THREE.Color(
                    newColors[baseIndex + 0],
                    newColors[baseIndex + 1],
                    newColors[baseIndex + 2],
                  ).getHSL().l * 3.5
                );
                colors[attributeIndex + baseIndex + 0] = color.r;
                colors[attributeIndex + baseIndex + 1] = color.g;
                colors[attributeIndex + baseIndex + 2] = color.b;
              }
            } else {
              colors.set(newColors, attributeIndex);
            }

            attributeIndex += newColors.length;
          };
          _rerenderGeometry(chestGeometry, hoverTypes.includes('chest'));
          _rerenderGeometry(lidGeometry, hoverTypes.includes('lid'));
          colorAttribute.needsUpdate = true;

          mesh.needsUpdate = false;
        }
      };
      mesh.destroy = () => {
        geometry.dispose();

        hands.destroyGrabbable(grabbable);
      };

      return mesh;
    };

    return _requestChestGeometry()
      .then(chestGeometries => {
        const chestMesh = _makeChestMesh(chestGeometries);
        scene.add(chestMesh);

        worker.terminate();

        const _update = () => {
          const _updateHover = () => {
            const {gamepads} = pose.getStatus();
            const {chestGeometry, lidGeometry} = chestGeometries;
            chestMesh.updateBoxTargets();
            const {boxTargets: boxTargetSpecs} = chestMesh;

            SIDES.forEach(side => {
              const gamepad = gamepads[side];
              const {worldPosition: controllerPosition} = gamepad;
              const hoverState = hoverStates[side];

              let type = null;
              for (let i = 0; i < boxTargetSpecs.length; i++) {
                const boxTargetSpec = boxTargetSpecs[i];
                const {boxTarget} = boxTargetSpec;

                if (boxTarget.containsPoint(controllerPosition)) {
                  type = boxTargetSpec.type;
                  break;
                }
              }
              if (hoverState.type !== type) {
                hoverState.type = type;
                chestMesh.needsUpdate = true;
              }
            });
          };
          const _updateMesh = () => {
            chestMesh.update();
          };

          _updateHover();
          _updateMesh();
        };
        render.on('update', _update);

        this._cleanup = () => {
          scene.remove(chestMesh);
          chestMesh.destroy();

          chestMaterial.dispose();

          render.removeListener('update', _update);
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Chest;
