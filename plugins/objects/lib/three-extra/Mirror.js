/**
 * @author Slayvin / http://slayvin.net
 */

module.exports = THREE => {

function THREEMirror( width, height, options ) {

	THREE.Mesh.call( this, new THREE.PlaneBufferGeometry( width, height ) );

	var scope = this;

	options = options || {};

	var textureWidth = options.textureWidth !== undefined ? options.textureWidth : 512;
	var textureHeight = options.textureHeight !== undefined ? options.textureHeight : 512;
	var renderTargets = options.renderTargets;

	var clipBias = options.clipBias !== undefined ? options.clipBias : 0.0;
	// var mirrorColor = options.color !== undefined ? new THREE.Color( options.color ) : new THREE.Color( 0x7F7F7F );

	var mirrorPlane = new THREE.Plane();
	var normal = new THREE.Vector3();
	var mirrorWorldPosition = new THREE.Vector3();
	var cameraWorldPosition = new THREE.Vector3();
	var rotationMatrix = new THREE.Matrix4();
	var lookAtPosition = new THREE.Vector3( 0, 0, - 1 );
	var view = new THREE.Vector3();
	var target = new THREE.Vector3();
	var clipPlane = new THREE.Vector4();
	var q = new THREE.Vector4();
	var c = new THREE.Vector4();

	var textureMatrix = new THREE.Matrix4();

	var mirrorCamera = new THREE.PerspectiveCamera();
	mirrorCamera.name = 'left';
	mirrorCamera.matrixAutoUpdate = false;

	var parameters = {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBFormat,
		stencilBuffer: false
	};

	/* var renderTarget = new THREE.WebGLRenderTarget( textureWidth, textureHeight, parameters );

	if ( ! THREE.Math.isPowerOfTwo( textureWidth ) || ! THREE.Math.isPowerOfTwo( textureHeight ) ) {

		renderTarget.texture.generateMipmaps = false;

	} */

	var mirrorShader = {

		uniforms: {
			// mirrorColor: { value: new THREE.Color( 0x7F7F7F ) },
			mirrorSampler: { value: null },
			textureMatrix: { value: new THREE.Matrix4() }
		},

		vertexShader: [
			'uniform mat4 textureMatrix;',
			'varying vec4 mirrorCoord;',

			'void main() {',

			'	vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );',
			'	vec4 worldPosition = modelMatrix * vec4( position, 1.0 );',
			'	mirrorCoord = textureMatrix * worldPosition;',

			'	gl_Position = projectionMatrix * mvPosition;',

			'}'
		].join( '\n' ),

		fragmentShader: [
			// 'uniform vec3 mirrorColor;',
			'vec3 mirrorColor = vec3(0.5, 0.5, 0.5);',
			'uniform sampler2D mirrorSampler;',
			'varying vec4 mirrorCoord;',

			'float blendOverlay(float base, float blend) {',
			'	return( base < 0.5 ? ( 2.0 * base * blend ) : (1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );',
			'}',

			'void main() {',
			'	vec4 color = texture2DProj(mirrorSampler, mirrorCoord);',
			'	color = vec4(blendOverlay(mirrorColor.r, color.r), blendOverlay(mirrorColor.g, color.g), blendOverlay(mirrorColor.b, color.b), 1.0);',
			'	gl_FragColor = color;',
			'}'
		].join( '\n' )

	};

	var mirrorUniforms = THREE.UniformsUtils.clone( mirrorShader.uniforms );

	var material = new THREE.ShaderMaterial( {

		fragmentShader: mirrorShader.fragmentShader,
		vertexShader: mirrorShader.vertexShader,
		uniforms: mirrorUniforms

	} );
	material.volatile = true;

	// material.uniforms.mirrorSampler.value = renderTarget.texture;
	// material.uniforms.mirrorColor.value = mirrorColor;
	// material.uniforms.textureMatrix.value = textureMatrix;

	scope.material = material;

	function updateTextureMatrix( camera ) {
		mirrorCamera.projectionMatrix.copy(camera.projectionMatrix);

		mirrorWorldPosition.setFromMatrixPosition( scope.matrixWorld );
		cameraWorldPosition.setFromMatrixPosition( camera.matrixWorld );

		rotationMatrix.extractRotation( scope.matrixWorld );

		normal.set( 0, 0, 1 );
		normal.applyMatrix4( rotationMatrix );

		view.copy(mirrorWorldPosition).sub( cameraWorldPosition );
		view.reflect( normal ).negate();
		view.add( mirrorWorldPosition );

		rotationMatrix.extractRotation( camera.matrixWorld );

		lookAtPosition.set( 0, 0, - 1 );
		lookAtPosition.applyMatrix4( rotationMatrix );
		lookAtPosition.add( cameraWorldPosition );

		target.copy(mirrorWorldPosition).sub( lookAtPosition );
		target.reflect( normal ).negate();
		target.add( mirrorWorldPosition );

		mirrorCamera.position.copy( view );
		mirrorCamera.up.set( 0, - 1, 0 );
		mirrorCamera.up.applyMatrix4( rotationMatrix );
		mirrorCamera.up.reflect( normal ).negate();
		mirrorCamera.lookAt( target );

		mirrorCamera.updateMatrix();
		mirrorCamera.matrixWorld.copy(mirrorCamera.matrix);
		mirrorCamera.matrixWorldInverse.getInverse( mirrorCamera.matrixWorld );

		// Update the texture matrix
		textureMatrix.set(
			0.5, 0.0, 0.0, 0.5,
			0.0, 0.5, 0.0, 0.5,
			0.0, 0.0, 0.5, 0.5,
			0.0, 0.0, 0.0, 1.0
		);
		textureMatrix.multiply( mirrorCamera.projectionMatrix );
		textureMatrix.multiply( mirrorCamera.matrixWorldInverse );

		// Now update projection matrix with new clip plane, implementing code from: http://www.terathon.com/code/oblique.html
		// Paper explaining this technique: http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
		mirrorPlane.setFromNormalAndCoplanarPoint( normal, mirrorWorldPosition );
		mirrorPlane.applyMatrix4( mirrorCamera.matrixWorldInverse );

		clipPlane.set( mirrorPlane.normal.x, mirrorPlane.normal.y, mirrorPlane.normal.z, mirrorPlane.constant );

		var projectionMatrix = mirrorCamera.projectionMatrix;

		q.x = ( Math.sign( clipPlane.x ) + projectionMatrix.elements[ 8 ] ) / projectionMatrix.elements[ 0 ];
		q.y = ( Math.sign( clipPlane.y ) + projectionMatrix.elements[ 9 ] ) / projectionMatrix.elements[ 5 ];
		q.z = - 1.0;
		q.w = ( 1.0 + projectionMatrix.elements[ 10 ] ) / projectionMatrix.elements[ 14 ];

		// Calculate the scaled plane vector
		c = clipPlane.multiplyScalar( 2.0 / clipPlane.dot( q ) );

		// Replacing the third row of the projection matrix
		projectionMatrix.elements[ 2 ] = c.x;
		projectionMatrix.elements[ 6 ] = c.y;
		projectionMatrix.elements[ 10 ] = c.z + 1.0 - clipBias;
		projectionMatrix.elements[ 14 ] = c.w;

	}

  scope.onBeforeRender = (renderer, scene, camera) => {
    const {name: side} = camera;
    const renderTarget = renderTargets[side];
    material.uniforms.mirrorSampler.value = renderTarget.texture;
    material.uniforms.textureMatrix.value = renderTarget.textureMatrix;
  };

	scope.renderEye = function ( renderer, scene, camera, renderTarget ) {
		updateTextureMatrix( camera );

		renderTarget.textureMatrix.copy(textureMatrix);

		scope.visible = false;

		const oldVrEnabled = renderer.vr.enabled;
		renderer.vr.enabled = false;

		renderer.render( scene, mirrorCamera, renderTarget );
		renderer.setRenderTarget(null);

		renderer.vr.enabled = oldVrEnabled;

		scope.visible = true;
	};

};

THREEMirror.prototype = Object.create( THREE.Mesh.prototype );

return THREEMirror;

};
