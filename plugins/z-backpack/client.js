const DEFAULT_GRAB_DISTANCE = 0.12;
const NUM_ITEMS = 9;
const NUM_ITEMS_PER_ROW = 3;
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const SIDES = ['left', 'right'];

class ZBackpack {
  mount() {
    const {three: {THREE, scene, camera}, render, input, utils: {geometry: geometryUtils}} = zeo;

    const _decomposeObjectMatrixWorld = object => {
      const {matrixWorld} = object;
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrixWorld.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const zeroVector = new THREE.Vector3(0, 0, 0);
    const zeroQuaternion = new THREE.Quaternion();
    const oneVector = new THREE.Vector3(1, 1, 1);
    const backVector = new THREE.Vector3(0.4, 0.5, 0.5);

    const _makeHoverState = () => ({
      hovered: false,
      targetItemIndex: -1,
    });
    const hoverStates = {
      left: _makeHoverState(),
      right: _makeHoverState(),
    };

    const _makeBackpackMesh = () => {
      const object = new THREE.Mesh();
      object.visible = false;

      const itemBoxMeshes = (() => {
        const _makeItemBoxMesh = index => {
          const size = 0.075;
          const padding = size / 2;

          const geometry = new THREE.BoxBufferGeometry(size, size, size);
          const material = new THREE.MeshBasicMaterial({
            color: 0x808080,
            wireframe: true,
          });

          const mesh = new THREE.Mesh(geometry, material);
          const xIndex = index % NUM_ITEMS_PER_ROW;
          mesh.position.x = -(((size * NUM_ITEMS_PER_ROW) + (padding * (NUM_ITEMS_PER_ROW - 1))) / 2) + ((size + padding) * xIndex) + (size / 2);
          const yIndex = Math.floor(index / NUM_ITEMS_PER_ROW);
          mesh.position.y = (size + padding) - (yIndex * (size + padding));
          // mesh.position.z = -0.5;
          return mesh;
        };

        const result = Array(NUM_ITEMS);
        for (let i = 0; i < NUM_ITEMS; i++) {
          result[i] = _makeItemBoxMesh(i);
        }
        return result;
      })();
      itemBoxMeshes.forEach(itemBoxMesh => {
        object.add(itemBoxMesh);
      });
      object.itemBoxMeshes = itemBoxMeshes;

      return object;
    };
    const backpackMesh = _makeBackpackMesh();
    scene.add(backpackMesh);

    const _update = e => {
      const _updateHoverStates = () => {
        const {gamepads} = pose.getStatus();

        const behindCameraBoxTarget = geometryUtils.makeBoxTarget(
          camera.position.clone()
            .add(new THREE.Vector3(0, (-0.5 / 2) + 0.15, (0.5 / 2) + 0.15).applyQuaternion(camera.quaternion)),
          camera.quaternion,
          oneVector,
          backVector,
          false
        );

        SIDES.forEach(side => {
          const hoverState = hoverStates[side];
          const gamepad = gamepads[side];

          if (gamepad) {
            const _isBehindCamera = position => behindCameraBoxTarget.containsPoint(position);
            const _getClosestItemMeshIndex = position => {
              const {itemBoxMeshes} = backpackMesh;
              const itemBoxMeshSpecs = itemBoxMeshes.map((itemBoxMesh, index) => {
                const {position: itemBoxMeshPosition} = _decomposeObjectMatrixWorld(itemBoxMesh);
                const distance = position.distanceTo(itemBoxMeshPosition);
                return {
                  index,
                  distance,
                };
              });
              const closestItemBoxMeshIndex = itemBoxMeshSpecs.sort((a, b) => a.distance - b.distance)[0].index;
              return closestItemBoxMeshIndex;
            };

            const {position: controllerPosition} = gamepad;
            const hovered = _isBehindCamera(controllerPosition);
            hoverState.hovered = hovered;
            const targetItemIndex = hovered ? _getClosestItemMeshIndex(controllerPosition) : -1;
            hoverState.targetItemIndex = targetItemIndex;
          }
        });
      };
      const _updateMeshes = () => {
        const hovered = SIDES.some(side => hoverStates[side].hovered);

        if (hovered) {
          const {hmd} = pose.getStatus();
          const {position, rotation} = hmd;

          backpackMesh.position.copy(position.clone().add(new THREE.Vector3(0, 0, -0.5).applyQuaternion(rotation)));
          backpackMesh.quaternion.copy(rotation);

          const {itemBoxMeshes} = backpackMesh;
          for (let i = 0; i < NUM_ITEMS; i++) {
            const hovered = SIDES.some(side => hoverStates[side].targetItemIndex === i);
            itemBoxMeshes[i].material.color = new THREE.Color(hovered ? 0x0000FF : 0x808080);
          }

          if (!backpackMesh.visible) {
            backpackMesh.visible = true;
          }
        } else {
          if (backpackMesh.visible) {
            backpackMesh.visible = false;
          }
        }
      };

      _updateHoverStates();
      _updateMeshes();
    };
    render.on('update', _update);

    this._cleanup = () => {
      scene.remove(backpackMesh);

      render.removeListener('update', _update);
    };

    const _getBackpackMesh = () => backpackMesh;
    const _getHoveredItemIndex = side => {
      const hoverState = hoverStates[side];
      const {targetItemIndex} = hoverState;

      return targetItemIndex;
    };

    return {
      getBackpackMesh: _getBackpackMesh,
      getHoveredItemIndex: _getHoveredItemIndex,
      makeBackpackMesh: _makeBackpackMesh,
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = ZBackpack;
