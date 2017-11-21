module.exports = ({
  THREE,
  context: gl,
}) => {

function error(msg) {
  if (topWindow.console) {
    if (topWindow.console.error) {
      topWindow.console.error(msg);
    } else if (topWindow.console.log) {
      topWindow.console.log(msg);
    }
  }
}

function loadShader(gl, shaderSource, shaderType, opt_errorCallback) {
  var errFn = opt_errorCallback || error;
  // Create the shader object
  var shader = gl.createShader(shaderType);

  // Load the shader source
  gl.shaderSource(shader, shaderSource);

  // Compile the shader
  gl.compileShader(shader);

  // Check the compile status
  var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!compiled) {
    // Something went wrong during compilation; get the error
    var lastError = gl.getShaderInfoLog(shader);
    errFn("*** Error compiling shader '" + shader + "':" + lastError);
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}
function createProgram(gl, shaders, opt_attribs, opt_locations, opt_errorCallback) {
  var errFn = opt_errorCallback || error;
  var program = gl.createProgram();
  shaders.forEach(function(shader) {
    gl.attachShader(program, shader);
  });
  if (opt_attribs) {
    for (let i = 0; i < opt_attribs.length; i++) {
      const attrib = opt_attribs[i];
      gl.bindAttribLocation(
          program,
          opt_locations ? opt_locations[i] : i,
          attrib);
    }
  }
  gl.linkProgram(program);

  // Check the link status
  var linked = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!linked) {
      // something went wrong with the link
      var lastError = gl.getProgramInfoLog(program);
      errFn("Error in program linking:" + lastError);

      gl.deleteProgram(program);
      return null;
  }
  return program;
}
function createProgramFromSources(gl, shaderSources, opt_attribs, opt_locations, opt_errorCallback) {
  var shaders = [
    loadShader(gl, shaderSources[0], gl.VERTEX_SHADER, opt_errorCallback),
    loadShader(gl, shaderSources[1], gl.FRAGMENT_SHADER, opt_errorCallback),
  ];
  return createProgram(gl, shaders, opt_attribs, opt_locations, opt_errorCallback);
}

const vertexShader = `\  
  attribute vec4 a_position;
  attribute vec2 a_texcoord;

  uniform mat4 u_matrix;

  varying vec2 v_texcoord;

  void main() {
     gl_Position = u_matrix * a_position;
     v_texcoord = a_texcoord;
  }
`;
const fragmentShader = `\    
  precision mediump float;

  varying vec2 v_texcoord;

  uniform sampler2D u_texture;

  void main() {
     gl_FragColor = texture2D(u_texture, v_texcoord);
  }
`;

// setup GLSL program
var program = createProgramFromSources(gl, [vertexShader, fragmentShader]);

// look up where the vertex data needs to go.
var positionLocation = gl.getAttribLocation(program, "a_position");
var texcoordLocation = gl.getAttribLocation(program, "a_texcoord");

// lookup uniforms
var matrixLocation = gl.getUniformLocation(program, "u_matrix");
var textureLocation = gl.getUniformLocation(program, "u_texture");

// Create a buffer.
var positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

// Put a unit quad in the buffer
var positions = Float32Array.from([
  0, 0,
  0, 1,
  1, 0,
  1, 0,
  0, 1,
  1, 1,
]);
gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

// Create a buffer for texture coords
var texcoordBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);

// Put texcoords in the buffer
var texcoords = Float32Array.from([
  0, 0,
  0, 1,
  1, 0,
  1, 0,
  0, 1,
  1, 1,
]);
gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW);

const localMatrix = new THREE.Matrix4();
const localMatrix2 = new THREE.Matrix4();
const localMatrixArray = new Float32Array(16);

// creates a texture info { width: w, height: h, texture: tex }
// The texture will start with 1x1 pixels and be updated
// when the image has loaded
function loadImageAndCreateTextureInfo(url) {
  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  // Fill the texture with a 1x1 blue pixel.
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                new Uint8Array([0, 0, 255, 255]));

  // let's assume all images are not a power of 2
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  var textureInfo = {
    width: 1,   // we don't know the size until it loads
    height: 1,
    texture: tex,
  };
  var img = new Image();
  img.onload = () => {
    textureInfo.width = img.width;
    textureInfo.height = img.height;

    gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  };
  img.onerror = err => {
    console.warn(err);
  };
  img.crossOrigin = 'Anonymous';
  img.src = url;

  return textureInfo;
}
function drawImage(tex, texWidth, texHeight, dstX, dstY) {
  gl.bindTexture(gl.TEXTURE_2D, tex);

  // Tell WebGL to use our shader program pair
  gl.useProgram(program);

  // Setup the attributes to pull data from our buffers
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
  gl.enableVertexAttribArray(texcoordLocation);
  gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 0, 0);

  // this matirx will convert from pixels to clip space
  var matrix = localMatrix.makeOrthographic(0, gl.canvas.width, gl.canvas.height, 0, -1, 1);

  // this matrix will translate our quad to dstX, dstY
  matrix.multiply(localMatrix2.makeTranslation(dstX, dstY, 0));

  // this matrix will scale our 1 unit quad
  // from 1 unit to texWidth, texHeight units
  matrix.multiply(localMatrix2.makeScale(texWidth, texHeight, 1));

  // Set the matrix.
  gl.uniformMatrix4fv(matrixLocation, false, matrix.toArray(localMatrixArray));

  // Tell the shader to get the texture from texture unit 0
  gl.uniform1i(textureLocation, 0);

  gl.disable(gl.DEPTH_TEST);

  // draw the quad (2 triangles, 6 vertices)
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  gl.enable(gl.DEPTH_TEST);
}
var textureInfoYes = loadImageAndCreateTextureInfo('/archae/rend/img/google-cardboard.svg');
var textureInfoNo = loadImageAndCreateTextureInfo('/archae/rend/img/google-cardboard-x.svg');

function renderVRButton(yes) {
  const textureInfo = yes ? textureInfoYes : textureInfoNo;
  drawImage(
    textureInfo.texture,
    gl.canvas.width * 0.1,
    gl.canvas.width * 0.1 * textureInfo.height / textureInfo.width,
    0.85 * gl.canvas.width,
    0.05 * gl.canvas.width
  );
}

return {
  renderVRButton,
};

};
