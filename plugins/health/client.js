const sfxr = require('sfxr');
const {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} = require('./lib/constants/constants');
const menuRenderer = require('./lib/render/menu');

const HEALTH_SHADER = {
  uniforms: {
    texture: {
      type: 't',
      value: null,
    },
    backgroundColor: {
      type: '4f',
      value: null,
    },
    worldTime: {
      type: 'f',
      value: 0,
    },
    hit: {
      type: 'f',
      value: 0,
    },
  },
  vertexShader: [
		"uniform float worldTime;",
		"uniform float hit;",
		"varying vec2 vUv;",
`float hash(float n) { return fract(sin(n) * 1e4); }
float noise(float x) {
	float i = floor(x);
	float f = fract(x);
	float u = f * f * (3.0 - 2.0 * f);
	return mix(hash(i), hash(i + 1.0), u);
}`,
    "void main() {",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1.0);",
    "  vUv = uv;",
    "  if (hit > 0.0) {",
    "    float frame = mod(worldTime, 60000.0);",
    "    vUv += vec2(-1.0 + noise(frame) * 2.0, -1.0 + noise(frame + 1000.0) * 2.0) * 0.15 * hit;",
    "  }",
    "}"
  ].join("\n"),
  fragmentShader: [
    "uniform sampler2D texture;",
    "uniform vec4 backgroundColor;",
		"uniform float hit;",
    "varying vec2 vUv;",
    "vec3 redColor = vec3(0.9568627450980393, 0.2627450980392157, 0.21176470588235294);",
    "void main() {",
    "  vec4 sample = texture2D(texture, vUv);",
    "  if (sample.a > 0.0) {",
    "    vec3 diffuse = (sample.rgb * sample.a) + (backgroundColor.rgb * (1.0 - sample.a));",
    "    if (hit > 0.0) {",
    "      diffuse = mix(diffuse, redColor, 0.7);",
    "    }",
    "    gl_FragColor = vec4(diffuse, (backgroundColor.a >= 0.5) ? 1.0 : sample.a);",
    "  } else {",
    "    if (backgroundColor.a >= 0.5) {",
    "      gl_FragColor = backgroundColor;",
    "    } else {",
    "      discard;",
    "    }",
    "  }",
    "}",
  ].join("\n")
};

class Health {
  mount() {
    const {three: {THREE, scene, camera}, pose, render, input, elements, world, ui, utils: {geometry: geometryUtils}} = zeo;

    let live = true;
    this.cleanup = () => {
      live = false;
    };

    const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const _isInBody = p => {
      const vrMode = pose.getVrMode();

      if (vrMode === 'hmd') {
        const {hmd} = pose.getStatus();
        const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmd;
        const hmdEuler = new THREE.Euler().setFromQuaternion(hmdRotation, camera.rotation.order);
        hmdEuler.z = 0;
        const hmdQuaternion = new THREE.Quaternion().setFromEuler(hmdEuler);
        const bodyPosition = hmdPosition.clone()
          .add(
            new THREE.Vector3(0, -0.5, 0)
              .applyQuaternion(hmdQuaternion)
          );
        return p.distanceTo(bodyPosition) < 0.35;
      } else if (vrMode === 'keyboard') {
        const {hmd: {worldPosition, worldRotation}} = pose.getStatus();
        const hmdEuler = new THREE.Euler().setFromQuaternion(worldRotation, camera.rotation.order);
        hmdEuler.x = 0;
        hmdEuler.z = 0;
        const hmdQuaternion = new THREE.Quaternion().setFromEuler(hmdEuler);
        const bodyPosition = worldPosition.clone()
          .add(
            new THREE.Vector3(0, -0.4, 0.2)
              .applyQuaternion(hmdQuaternion)
          );
        return p.distanceTo(bodyPosition) < 0.35;
      }
    };

    return sfxr.requestSfx('archae/health/sfx/hit.ogg')
      .then(hitSfx => {
        if (live) {
          const healthState = {
            hp: 80,
            totalHp: 112,
          };

          const hudMesh = (() => {
            const menuUi = ui.makeUi({
              width: WIDTH,
              height: HEIGHT,
              color: [1, 1, 1, 0],
            });
            const mesh = menuUi.makePage(({
              health: {
                hp,
                totalHp,
              },
            }) => ({
              type: 'html',
              src: menuRenderer.getHudSrc({hp, totalHp}),
              x: 0,
              y: 0,
              w: WIDTH,
              h: HEIGHT,
            }), {
              type: 'health',
              state: {
                health: healthState,
              },
              worldWidth: WORLD_WIDTH,
              worldHeight: WORLD_HEIGHT,
            });
            const uniforms = THREE.UniformsUtils.clone(HEALTH_SHADER.uniforms);
            uniforms.texture.value = mesh.material.uniforms.texture.value;
            uniforms.backgroundColor.value = mesh.material.uniforms.backgroundColor.value;
            const healthMaterial = new THREE.ShaderMaterial({
              uniforms: uniforms,
              vertexShader: HEALTH_SHADER.vertexShader,
              fragmentShader: HEALTH_SHADER.fragmentShader,
              transparent: true,
            });
            mesh.material = healthMaterial;
            mesh.visible = false;

            const _align = (position, rotation, scale, lerpFactor) => {
              const targetPosition = position.clone().add(
                new THREE.Vector3(
                  0,
                  (((WIDTH - HEIGHT) / 2) / HEIGHT * WORLD_HEIGHT) + WORLD_HEIGHT,
                  -0.5
                ).applyQuaternion(rotation)
              );
              const targetRotation = rotation;
              const distance = position.distanceTo(targetPosition);

              if (lerpFactor < 1) {
                mesh.position.add(
                  targetPosition.clone().sub(mesh.position).multiplyScalar(distance * lerpFactor)
                );
                mesh.quaternion.slerp(targetRotation, lerpFactor);
                mesh.scale.copy(scale);
              } else {
                mesh.position.copy(targetPosition);
                mesh.quaternion.copy(targetRotation);
                mesh.scale.copy(scale);
              }

              mesh.updateMatrixWorld();
            };
            mesh.align = _align;

            const {position: cameraPosition, rotation: cameraRotation, scale: cameraScale} = _decomposeObjectMatrixWorld(camera);
            mesh.align(cameraPosition, cameraRotation, cameraScale, 1);

            const {page} = mesh;
            ui.addPage(page);
            page.update();

            return mesh;
          })();
          scene.add(hudMesh);
          hudMesh.updateMatrixWorld();

          let lastHitTime = 0;
          const _hit = hp => {
            const now = Date.now();
            const timeDiff = now - lastHitTime;

            if (timeDiff > 1000) {
              healthState.hp -= hp;
              hudMesh.page.update();

              lastHitTime = now;

              hitSfx.trigger();

              return true;
            } else {
              return false;
            }
          };

          const healthEntity = {
            entityAddedCallback(entityElement) {
              entityElement.hit = _hit;
            },
            entityRemovedCallback(entityElement) {
              // XXX
            },
          };
          elements.registerEntity(this, healthEntity);

          const _triggerdown = e => {
            const {side} = e;
            const {gamepads} = pose.getStatus();
            const gamepad = gamepads[side];
            const {worldPosition: controllerPosition} = gamepad;

            if (_isInBody(controllerPosition)) {
              if (_hit(1)) {
                e.stopImmediatePropagation();
              }
            }
          };
          input.on('triggerdown', _triggerdown);

          let lastUpdateTime = 0;
          const _update = () => {
            const now = Date.now();

            const _updateHudMeshVisibility = () => {
              const timeDiff = now - lastHitTime;
              hudMesh.visible = timeDiff < 3000;
            };
            const _updateHudMeshAlignment = () => {
              const {position: cameraPosition, rotation: cameraRotation, scale: cameraScale} = _decomposeObjectMatrixWorld(camera);
              const timeDiff = now - lastUpdateTime;
              const lerpFactor = timeDiff * 0.02;
              hudMesh.align(cameraPosition, cameraRotation, cameraScale, lerpFactor);
            };
            const _updateHudMeshUniforms = () => {
              hudMesh.material.uniforms.worldTime.value = world.getWorldTime();

              const timeDiff = now - lastHitTime;
              hudMesh.material.uniforms.hit.value = (timeDiff < 150) ? ((150 - timeDiff) / 150) : 0;
            };

            _updateHudMeshVisibility();
            _updateHudMeshAlignment();
            _updateHudMeshUniforms();

            lastUpdateTime = now;
          };
          render.on('update', _update);

          this._cleanup = () => {
            scene.remove(hudMesh);
            hudMesh.destroy();
            ui.removePage(hudMesh.page);

            input.removeListener('triggerdown', _triggerdown);
            render.removeListener('update', _update);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Health;
