const {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} = require('./lib/constants/constants');

const HEALTH_SHADER = {
  uniforms: {
    texture: {
      type: 't',
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
    heal: {
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
		"uniform float hit;",
		"uniform float heal;",
    "varying vec2 vUv;",
    "vec3 redColor = vec3(0.9568627450980393, 0.2627450980392157, 0.21176470588235294);",
    "vec3 whiteColor = vec3(1.0);",
    "void main() {",
    "  vec4 sample = texture2D(texture, vUv);",
    "  // if (sample.a > 0.0) {",
    "    vec3 diffuse = (sample.rgb * sample.a);",
    "    if (hit > 0.0) {",
    "      diffuse = mix(diffuse, redColor, 0.7);",
    "    }",
    "    if (heal > 0.0) {",
    "      diffuse = mix(diffuse, whiteColor, 0.5);",
    "    }",
    "    gl_FragColor = vec4(diffuse, sample.a);",
    "  /* } else {",
    "    discard;",
    "  } */",
    "}",
  ].join("\n")
};

class Health {
  mount() {
    const {three: {THREE, scene, camera}, pose, render, input, elements, world, ui, sound, utils: {geometry: geometryUtils}} = zeo;

    let live = true;
    this.cleanup = () => {
      live = false;
    };

    return sound.requestSfx('archae/health/sfx/hit.ogg')
      .then(hitSfx => {
        if (live) {
          const localVector = new THREE.Vector3();
          const localVector2= new THREE.Vector3();
          const localQuaternion = new THREE.Quaternion();

          const healthState = {
            hp: 80,
            totalHp: 112,
          };

          const hudMesh = (() => {
            const canvas = document.createElement('canvas');
            canvas.width = WIDTH;
            canvas.height = HEIGHT;
            const ctx = canvas.getContext('2d');
            ctx.font = `50px Consolas, 'Liberation Mono', Menlo, Courier, monospace`;

            const geometry = new THREE.PlaneBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT);
            const texture = new THREE.Texture(
              canvas,
              THREE.UVMapping,
              THREE.ClampToEdgeWrapping,
              THREE.ClampToEdgeWrapping,
              THREE.NearestMipMapLinearFilter,
              THREE.NearestMipMapLinearFilter,
              THREE.RGBAFormat,
              THREE.UnsignedByteType,
              16
            );
            const uniforms = THREE.UniformsUtils.clone(HEALTH_SHADER.uniforms);
            uniforms.texture.value = texture;
            const material = new THREE.ShaderMaterial({
              uniforms,
              vertexShader: HEALTH_SHADER.vertexShader,
              fragmentShader: HEALTH_SHADER.fragmentShader,
              // transparent: true,
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = false;

            mesh.update = () => {
              ctx.fillStyle = '#111';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = '#FFF';
              ctx.textAlign = 'left';
              ctx.fillText('HP', 30, 70);
              ctx.textAlign = 'right';
              ctx.fillText(`${healthState.hp}/${healthState.totalHp}`, canvas.width - 30, 70);
              ctx.lineWidth = 5;
              ctx.fillStyle = '#4CAF50';
              ctx.fillRect(110, 30, (canvas.width - 110 - 250 - 30) * (healthState.hp / healthState.totalHp), canvas.height - 30 * 2);
              ctx.strokeStyle = '#FFF';
              ctx.strokeRect(110, 30, canvas.width - 110 - 250 - 30, canvas.height - 30 * 2);
              texture.needsUpdate = true;
            };
            mesh.align = (position, rotation, scale, lerpFactor) => {
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

            mesh.update();

            camera.matrixWorld.decompose(localVector, localQuaternion, localVector2);
            mesh.align(localVector, localQuaternion, localVector2, 1);

            return mesh;
          })();
          scene.add(hudMesh);
          hudMesh.updateMatrixWorld();

          let lastHitTime = 0;
          const _hurt = hp => {
            const now = Date.now();
            const timeDiff = now - lastHitTime;

            if (timeDiff > 1000 && healthState.hp > 0) {
              healthState.hp = Math.max(healthState.hp - hp, 0);
              hudMesh.update();

              lastHitTime = now;

              hitSfx.trigger();

              return true;
            } else {
              return false;
            }
          };
          let lastHealTime = 0;
          const _heal = hp => {
            if (healthState.hp < healthState.totalHp) {
              healthState.hp = Math.min(healthState.hp + hp, healthState.totalHp);
              hudMesh.update();

              lastHealTime = Date.now();

              return true;
            } else {
              return false;
            }
          };

          const healthEntity = {
            entityAddedCallback(entityElement) {
              entityElement.hurt = _hurt;
              entityElement.heal = _heal;
            },
            entityRemovedCallback(entityElement) {
              // XXX
            },
          };
          elements.registerEntity(this, healthEntity);

          let lastUpdateTime = 0;
          const _update = () => {
            const now = Date.now();

            const _updateHudMeshVisibility = () => {
              hudMesh.visible = ((now - lastHitTime) < 3000) || ((now - lastHealTime) < 3000);
            };
            const _updateHudMeshAlignment = () => {
              if (hudMesh.visible) {
                camera.matrixWorld.decompose(localVector, localQuaternion, localVector2);
                hudMesh.align(localVector, localQuaternion, localVector2, (now - lastUpdateTime) * 0.02);
              }
            };
            const _updateHudMeshUniforms = () => {
              if (hudMesh.visible) {
                hudMesh.material.uniforms.worldTime.value = world.getWorldTime();

                const hitTimeDiff = now - lastHitTime;
                hudMesh.material.uniforms.hit.value = (hitTimeDiff < 150) ? ((150 - hitTimeDiff) / 150) : 0;

                const healTimeDiff = now - lastHealTime;
                hudMesh.material.uniforms.heal.value = (healTimeDiff < 150) ? ((150 - healTimeDiff) / 150) : 0;
              }
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
