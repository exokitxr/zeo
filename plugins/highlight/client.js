const SIDES = ['left', 'right'];

class Highlight {
  mount() {
    const {three: {THREE, scene, camera}, input, pose, render} = zeo;

    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x808080,
      wireframe: true,
    });

    const _makeHighlightState = () => ({
      startPoint: null,
    });
    const highlightStates = {
      left: _makeHighlightState(),
      right: _makeHighlightState(),
    };

    const _makeHighlightBoxMesh = () => {
      const geometry = new THREE.BoxBufferGeometry(1, 1, 1);
      const material = wireframeMaterial;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.order = camera.rotation.order;
      mesh.visible = false;
      return mesh;
    };
    const highlightBoxMeshes = {
      left: _makeHighlightBoxMesh(),
      right: _makeHighlightBoxMesh(),
    };
    scene.add(highlightBoxMeshes.left);
    scene.add(highlightBoxMeshes.right);

    const _gripdown = e => {
      const {side} = e;

      const {gamepads} = pose.getStatus();
      const gamepad = gamepads[side];

      if (gamepad) {
        const {position: controllerPosition} = gamepad;

        const highlightState = highlightStates[side];
        highlightState.startPoint = controllerPosition.clone();
      }
    };
    input.on('gripdown', _gripdown, {
      priority: -1,
    });
    const _gripup = e => {
      const {side} = e;

      const highlightState = highlightStates[side];
      highlightState.startPoint = null;

      const highlightBoxMesh = highlightBoxMeshes[side];
      highlightBoxMesh.visible = false;
    };
    input.on('gripup', _gripup, {
      priority: -1,
    });

    const _update = e => {
      const {gamepads} = pose.getStatus();

      SIDES.forEach(side => {
        const gamepad = gamepads[side];

        if (gamepad) {
          const highlightState = highlightStates[side];
          const {startPoint} = highlightState;

          const highlightBoxMesh = highlightBoxMeshes[side];
          if (startPoint) {
            const {position: currentPoint} = gamepad;

            const size = currentPoint.clone()
              .sub(startPoint);
            size.x = Math.abs(size.x);
            size.y = Math.abs(size.y);
            size.z = Math.abs(size.z);

            if (size.x > 0.001 && size.y > 0.001 && size.z > 0.001) {
              const midPoint = startPoint.clone()
                .add(currentPoint)
                .divideScalar(2);

              highlightBoxMesh.position.copy(midPoint);
              highlightBoxMesh.scale.copy(size);
              if (!highlightBoxMesh.visible) {
                highlightBoxMesh.visible = true;
              }
            } else {
              if (highlightBoxMesh.visible) {
                highlightBoxMesh.visible = false;
              }
            }
          } else {
            if (highlightBoxMesh.visible) {
              highlightBoxMesh.visible = false;
            }
          }
        }
      });
    };
    render.on('update', _update);

    this._cleanup = () => {
      SIDES.forEach(side => {
        scene.remove(highlightBoxMeshes[side]);
      });

      input.removeListener('gripdown', _gripdown);
      input.removeListener('gripup', _gripup);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Highlight;
