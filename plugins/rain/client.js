const PARTICLE_FRAME_RATE = 60;
const PARTICLE_FRAME_TIME = 1000 / PARTICLE_FRAME_RATE;
const PARTICLE_FRAMES = 64;
const PARTICLE_SIZE = 15;
const PARTICLE_SCALE = 1;

const ATTRIBUTE_DEFAULTS = {
  drops: 250,
  range: 32,
  length: 64,
};

class Rain {
  mount() {
    const {three: {THREE}, elements, render, world} = zeo;

    const rainShader = {
      uniforms: THREE.UniformsUtils.merge( [

        THREE.UniformsLib[ "points" ],
        THREE.UniformsLib[ "fog" ],

        {
          range: {
            type: 'f',
            value: 0,
          }
        },
        {
          frame: {
            type: 'f',
            value: 0,
          }
        },

      ] ),

      vertexShader: [

        // begin custom
        "#define USE_SIZEATTENUATION",

        "uniform float frame;",
        // end custom

        "uniform float size;",
        "uniform float scale;",
        "uniform float range;",

        THREE.ShaderChunk[ "common" ],
        THREE.ShaderChunk[ "color_pars_vertex" ],
        THREE.ShaderChunk[ "shadowmap_pars_vertex" ],
        THREE.ShaderChunk[ "logdepthbuf_pars_vertex" ],
        THREE.ShaderChunk[ "fog_pars_vertex" ],

        "void main() {",

          THREE.ShaderChunk[ "color_vertex" ],
          THREE.ShaderChunk[ "begin_vertex" ],

          // begin custom
          "transformed.y += range * " +
          "  (1.0 - (frame / " + PARTICLE_FRAMES.toFixed(1) + "));",
          "transformed.y = mod(transformed.y, range);",
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
          THREE.ShaderChunk[ "fog_vertex" ],

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

    const _makePositions = ({drops, range, length}) => {
      const dropSpacing = length / 64;

      const numPoints = drops * length;
      const positions = new Float32Array(numPoints * 3);
      for (let i = 0; i < drops; i++) {
        const x = -range + (Math.random() * (range * 2));
        const y = (Math.random() * range);
        const z = -range + (Math.random() * (range * 2));

        for (let j = 0; j < length; j++) {
          positions[(i * length * 3) + (j * 3) + 0] = x;
          positions[(i * length * 3) + (j * 3) + 1] = y + ((length / 2) - (j / length)) * dropSpacing;
          positions[(i * length * 3) + (j * 3) + 2] = z;
        }
      }
      return positions;
    };

    const updates = [];
    const _update = () => {
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        update();
      }
    };

    class RainElement extends HTMLElement {
      selector: 'rain[position][type][drops][range][length][color][enabled]',
      attributes: {
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
        range: {
          type: 'number',
          value: 32,
          min: 1,
          max: 128,
        },
        length: {
          type: 'number',
          value: 64,
          min: 1,
          max: 256,
          step: 1,
        },
        color: {
          type: 'color',
          value: '#3e5eb8',
        },
        enabled: {
          type: 'checkbox',
          value: true.
        }
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();
        const entityObject = entityElement.getObject();

        const {drops, range, length} = ATTRIBUTE_DEFAULTS;
        entityApi.drops = drops;
        entityApi.range = range;
        entityApi.length = length;

        const geometry = (() => {
          const result = new THREE.BufferGeometry();

          const positions = _makePositions({drops, range, length});
          result.addAttribute('position', new THREE.BufferAttribute(positions, 3));

          return result;
        })();

        const material = (() => {
          const uniforms = THREE.UniformsUtils.clone(rainShader.uniforms);
          uniforms.size.value = PARTICLE_SIZE;
          uniforms.scale.value = PARTICLE_SCALE;
          uniforms.diffuse.value = new THREE.Color(0x3e5eb8);
          uniforms.range.value = range;

          return new THREE.ShaderMaterial({
            side: THREE.FrontSide,
            // lights: [], // force lights refresh to setup uniforms, three.js WebGLRenderer line 4323
            transparent: true,
            fog: true,
            uniforms: uniforms,
            vertexShader: rainShader.vertexShader,
            fragmentShader: rainShader.fragmentShader,
          });
        })();

        const mesh = (() => {
          const result = new THREE.Points(geometry, material);
          result.frustumCulled = false;
          return result;
        })();
        entityObject.add(mesh);
        entityApi.mesh = mesh;

        const update = () => {
          const worldTime = world.getWorldTime();

          const frame = Math.floor(worldTime / PARTICLE_FRAME_TIME) % PARTICLE_FRAMES;
          material.uniforms.frame.value = frame;
        };
        updates.push(update);

        entityApi._updateGeometry = () => {
          const {geometry} = mesh;
          const {drops, range, length} = entityApi;
          const positions = _makePositions({drops, range, length});
          geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        };
        entityApi._updateMaterial = () => {
          const {material: {uniforms}} = mesh;
          const {range} = entityApi;

          uniforms.range.value = range;
        };

        entityApi._cleanup = () => {
          entityObject.remove(mesh);

          updates.splice(updates.indexOf(update), 1);
        };
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getComponentApi();

        entityApi._cleanup();
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getComponentApi();

        switch (name) {
          case 'position': {
            const {mesh} = entityApi;

            mesh.position.set(newValue[0], newValue[1], newValue[2]);
            mesh.quaternion.set(newValue[3], newValue[4], newValue[5], newValue[6]);
            mesh.scale.set(newValue[7], newValue[8], newValue[9]);

            break;
          }
          case 'type': {
            console.log('rain set type', newValue); // XXX

            break;
          }
          case 'drops': {
            entityApi.drops = newValue;
            entityApi._updateGeometry();

            break;
          }
          case 'range': {
            entityApi.range = newValue;
            entityApi._updateGeometry();
            entityApi._updateMaterial();

            break;
          }
          case 'length': {
            entityApi.length = newValue;
            entityApi._updateGeometry();

            break;
          }
          case 'color': {
            const {mesh: {material: {uniforms}}} = entityApi;

            uniforms.diffuse.value = new THREE.Color(newValue);

            break;
          }
          case 'enabled': {
            const {mesh} = entityApi;

            entityApi.visible = newValue;

            break;
          }
        }
      },
    }
    elements.registerComponent(this, rainComponent);

    render.on('update', _update);

    this._cleanup = () => {
      elements.unregisterComponent(this, rainComponent);

      render.removeListener('update', _update);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Rain;
