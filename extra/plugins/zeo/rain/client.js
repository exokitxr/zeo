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
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {THREE, scene} = zeo;
        const world = zeo.getCurrentWorld();

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
          const materialParams = {
            transparent: true,
            side: THREE.FrontSide,
            // lights: [], // force lights refresh to setup uniforms, three.js WebGLRenderer line 4323
            fog: true,

            uniforms: THREE.UniformsUtils.merge( [

              THREE.UniformsLib[ "points" ],
              THREE.UniformsLib[ "fog" ],

              {
                frame: {type: 'f', value: 0}
              }

            ] ),

            vertexShader: window.vertexShader = [

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
            // depthWrite: false,
            // depthTest: false,
          };
          materialParams.uniforms.size.value = PARTICLE_SIZE;
          materialParams.uniforms.scale.value = PARTICLE_SCALE;
          materialParams.uniforms.diffuse.value = new THREE.Color(0x3e5eb8);

          const material = new THREE.ShaderMaterial(materialParams);
          return material;
        })();

        const mesh = new THREE.Points(geometry, material);
        mesh.frustumCulled = false;
        scene.add(mesh);

        const _update = () => {
          const worldTime = world.getWorldTime();

          const frame = Math.floor(worldTime / PARTICLE_FRAME_TIME) % PARTICLE_FRAMES;
          material.uniforms.frame.value = frame;
        };

        return {
          update: _update,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Rain;
