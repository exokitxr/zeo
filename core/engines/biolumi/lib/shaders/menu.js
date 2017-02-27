const getShader = ({maxNumTextures}) => ({
  uniforms: {
    textures: {
      type: 'tv',
      value: null,
    },
    validTextures: {
      type: 'iv1',
      value: null,
    },
    texturePositions: {
      type: 'v2v',
      value: null,
    },
    textureLimits: {
      type: 'v2v',
      value: null,
    },
    atlasSize: {
      type: 'f',
      value: null,
    },
    backgroundColor: {
      type: '4f',
      value: null,
    },
  },
  vertexShader: [
    "attribute vec2 atlasUv;",
    "varying vec2 vUv;",
    "varying vec2 vAtlasUv;",
    "void main() {",
    "  vUv = uv;",
    "  vAtlasUv = atlasUv;",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
    "}"
  ].join("\n"),
  fragmentShader: [
    "uniform sampler2D textures[" + maxNumTextures + "];",
    "uniform int validTextures[" + maxNumTextures + "];",
    "uniform vec2 texturePositions[" + maxNumTextures + "];",
    "uniform vec2 textureLimits[" + maxNumTextures + "];",
    "uniform float atlasSize;",
    "uniform vec4 backgroundColor;",
    "varying vec2 vUv;",
    "varying vec2 vAtlasUv;",
    "void main() {",
    "  vec3 diffuse = vec3(0.0, 0.0, 0.0);",
    "  int numValid = 0;",
    (() => {
      let result = '';
      for (let i = 0; i < maxNumTextures; i++) {
        result += [
          "if (validTextures[" + i + "] != 0) {",
          "  vec2 uv = vec2(",
          "    (vUv.x - texturePositions[" + i + "].x) / textureLimits[" + i + "].x,",
          "    1.0 - ((1.0 - vUv.y - texturePositions[" + i + "].y) / textureLimits[" + i + "].y)",
          "  );",
          "  if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {",
          "    vec2 sampleUv = vec2((uv.x + vAtlasUv.x) / atlasSize, 1.0 - ((1.0 - uv.y + vAtlasUv.y) / atlasSize));",
          "    vec4 sample = texture2D(textures[" + i + "], sampleUv);",
          "",
          "    if (sample.a > 0.0) {",
          "      diffuse += (sample.rgb * sample.a) + (backgroundColor.rgb * (1.0 - sample.a));",
          "      numValid++;",
          "    }",
          "  }",
          "}",
        ].join('\n');
      }
      return result;
    })(),
    "  if (numValid == 0) { gl_FragColor = backgroundColor; }",
    "  else { gl_FragColor = vec4(diffuse / float(numValid), 1); }",
    "}"
  ].join("\n"),
});

module.exports = {
  getShader,
};
