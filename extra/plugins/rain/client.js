const PARTICLE_RANGE = 32;
const PARTICLE_FRAME_RATE = 60;
const PARTICLE_FRAME_TIME = 1000 / PARTICLE_FRAME_RATE;
const PARTICLE_FRAMES = 64;
const PARTICLE_SIZE = 15;
const PARTICLE_LENGTH = 64;
const PARTICLE_SCALE = 1;

class Rain {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestEngines([
      '/core/engines/zeo',
      '/core/engines/rend',
    ]).then(([
      zeo,
      rend,
    ]) => {
      if (live) {
        const {THREE, scene} = zeo;
        const world = rend.getCurrentWorld();

        const rainShader = {
          uniforms: THREE.UniformsUtils.merge( [

            THREE.UniformsLib[ "points" ],
            THREE.UniformsLib[ "fog" ],

            {
              frame: {
                type: 'f',
                value: 0,
              }
            }

          ] ),

          vertexShader: [

            // begin custom
            "#define USE_SIZEATTENUATION",

            "uniform float frame;",
            // end custom

            "uniform float size;",
            "uniform float scale;",

            THREE.ShaderChunk[ "common" ],
            THREE.ShaderChunk[ "color_pars_vertex" ],
            THREE.ShaderChunk[ "shadowmap_pars_vertex" ],
            THREE.ShaderChunk[ "logdepthbuf_pars_vertex" ],

            "void main() {",

              THREE.ShaderChunk[ "color_vertex" ],
              THREE.ShaderChunk[ "begin_vertex" ],

              // begin custom
              "transformed.y += " + PARTICLE_RANGE.toFixed(1) + " * " +
                "(1.0 - (frame / " + PARTICLE_FRAMES.toFixed(1) + "));",
              "transformed.y = mod(transformed.y, " + PARTICLE_RANGE.toFixed(1) + ");",
              // end custom

              THREE.ShaderChunk[ "project_vertex" ],

              "#ifdef USE_SIZEATTENUATION",
              "  gl_PointSize = size * ( scale / - mvPosition.z );",
              "#else",
              "  gl_PointSize = size;",
              "#endif",

              THREE.ShaderChunk[ "logdepthbuf_vertex" ],
              THREE.ShaderChunk[ "worldpos_vertex" ],
              THREE.ShaderChunk[ "shadowmap_vertex" ],

            "}"

          ].join( "\n" ),

          fragmentShader: [

            "uniform vec3 diffuse;",
            "uniform float opacity;",

            THREE.ShaderChunk[ "common" ],
            THREE.ShaderChunk[ "color_pars_fragment" ],
            THREE.ShaderChunk[ "map_particle_pars_fragment" ],
            THREE.ShaderChunk[ "fog_pars_fragment" ],
            THREE.ShaderChunk[ "shadowmap_pars_fragment" ],
            THREE.ShaderChunk[ "logdepthbuf_pars_fragment" ],

            "void main() {",

              "vec3 outgoingLight = vec3( 0.0 );",
              "vec4 diffuseColor = vec4( diffuse, opacity );",

              THREE.ShaderChunk[ "logdepthbuf_fragment" ],
              THREE.ShaderChunk[ "map_particle_fragment" ],
              THREE.ShaderChunk[ "color_fragment" ],
              THREE.ShaderChunk[ "alphatest_fragment" ],

              // begin custom
              // 'if (diffuseColor.a < 0.5) discard;',
              // end custom

              "outgoingLight = diffuseColor.rgb;",

              "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",

              THREE.ShaderChunk[ "premultiplied_alpha_fragment" ],
              THREE.ShaderChunk[ "tonemapping_fragment" ],
              THREE.ShaderChunk[ "encodings_fragment" ],
              THREE.ShaderChunk[ "fog_fragment" ],

            "}"

          ].join( "\n" ),
        };

        const updates = [];
        const _update = () => {
          for (let i = 0; i < updates.length; i++) {
            const update = updates[i];
            update();
          }
        };

        return {
          update: _update,
          elements: [
            class RainElement {
              static get tag() {
                return 'rain';
              }
              static get attributes() {
                return {
                  position: {
                    type: 'matrix',
                    value: [
                      0, 0, 0,
                      0, 0, 0, 1,
                      1, 1, 1,
                    ],
                  },
                  type: {
                    type: 'select',
                    value: 'rain',
                    options: [
                      'rain',
                      'snow',
                      'firefly',
                    ],
                  },
                  drops: {
                    type: 'number',
                    value: 250,
                    min: 1,
                    max: 1000,
                  },
                  color: {
                    type: 'color',
                    value: '#3e5eb8',
                  },
                  enabled: {
                    type: 'checkbox',
                    value: true,
                  },
                };
              }

              constructor() {
                console.log('rain constructor'); // XXX

                const geometry = (() => {
                  const result = new THREE.BufferGeometry();

                  const numDrops = 250;
                  const dropSpacing = 1;
                  const numPoints = numDrops * PARTICLE_LENGTH;
                  const positions = new Float32Array(numPoints * 3);
                  for (let i = 0; i < numDrops; i++) {
                    const x = -PARTICLE_RANGE + (Math.random() * (PARTICLE_RANGE * 2));
                    const y = (Math.random() * PARTICLE_RANGE);
                    const z = -PARTICLE_RANGE + (Math.random() * (PARTICLE_RANGE * 2));

                    for (let j = 0; j < PARTICLE_LENGTH; j++) {
                      positions[(i * PARTICLE_LENGTH * 3) + (j * 3) + 0] = x;
                      positions[(i * PARTICLE_LENGTH * 3) + (j * 3) + 1] = y + ((PARTICLE_LENGTH / 2) - (j / PARTICLE_LENGTH)) * dropSpacing;
                      positions[(i * PARTICLE_LENGTH * 3) + (j * 3) + 2] = z;
                    }
                  }
                  result.addAttribute('position', new THREE.BufferAttribute(positions, 3));

                  return result;
                })();

                const material = (() => {
                  const uniforms = THREE.UniformsUtils.clone(rainShader.uniforms);
                  uniforms.size.value = PARTICLE_SIZE;
                  uniforms.scale.value = PARTICLE_SCALE;
                  uniforms.diffuse.value = new THREE.Color(0x3e5eb8);

                  return new THREE.ShaderMaterial({
                    side: THREE.FrontSide,
                    // lights: [], // force lights refresh to setup uniforms, three.js WebGLRenderer line 4323
                    transparent: true,
                    fog: true,
                    uniforms,
                    vertexShader: rainShader.vertexShader,
                    fragmentShader: rainShader.fragmentShader,
                  });
                })();

                const mesh = (() => {
                  const result = new THREE.Points(geometry, material);
                  result.frustumCulled = false;
                  return result;
                })();
                scene.add(mesh);
                this.mesh = mesh;

                const update = () => {
                  const worldTime = world.getWorldTime();

                  const frame = Math.floor(worldTime / PARTICLE_FRAME_TIME) % PARTICLE_FRAMES;
                  material.uniforms.frame.value = frame;
                };
                updates.push(update);

                this._cleanup = () => {
                  scene.remove(mesh);

                  updates.splice(updates.indexOf(update), 1);
                };
              }

              destructor() {
                console.log('rain destructor');

                this._cleanup();
              }

              set position(position) {
                console.log('rain set position', position);
              }

              set type(type) {
                console.log('rain set type', type);
              }

              set drops(drops) {
                console.log('rain set drops', drops);
              }

              set color(color) {
                console.log('rain set color', color);
                const {mesh: {material: {uniforms}}} = this;
                uniforms.diffuse.value = new THREE.Color(color);
              }

              set enabled(enabled) {
                console.log('rain set enabled', enabled);
                const {mesh} = this;
                mesh.visible = enabled;
              }
            },
            class RainBoxElement {
              static get tag() {
                return 'rain:box';
              }
              static get attributes() {
                return {
                  position: {
                    type: 'matrix',
                    value: [
                      0, 0, 0,
                      0, 0, 0, 1,
                      1, 1, 1,
                    ],
                  },
                  color: {
                    type: 'color',
                    value: '#CCC',
                  },
                  opacity: {
                    type: 'number',
                    value: 0.1,
                    min: 0,
                    max: 1,
                  },
                  enabled: {
                    type: 'checkbox',
                    value: true,
                  },
                };
              }

              constructor() {
                console.log('rain:box constructor'); // XXX
              }

              destructor() {
                console.log('rain:box destructor');
              }

              set position(position) {
                console.log('rain:box set position', position);
              }

              set color(color) {
                console.log('rain:box set color', color);
              }

              set opacity(opacity) {
                console.log('rain:box set opacity', opacity);
              }

              set enabled(enabled) {
                console.log('rain:box set enabled', enabled);
              }
            }
          ],
          templates: [
            {
              tag: 'rain',
              attributes: {},
              children: [
                {
                  tag: 'rain:box',
                  attributes: {
                    position: [
                      0, 1.5, 0,
                      0, 0, 0, 1,
                      1, 1, 1,
                    ],
                  },
                  children: [],
                },
              ],
            },
          ],
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Rain;
