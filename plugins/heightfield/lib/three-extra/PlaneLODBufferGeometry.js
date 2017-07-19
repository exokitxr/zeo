/**
 * @author mrdoob / http://mrdoob.com/
 * @author Mugen87 / https://github.com/Mugen87
 */

module.exports = THREE => {

// PlaneLODGeometry

function PlaneLODGeometry( width, height, widthSegments, heightSegments, widthLodSegments, heightLodSegments ) {

	THREE.Geometry.call( this );

	this.type = 'PlaneLODGeometry';

	this.parameters = {
		width: width,
		height: height,
		widthSegments: widthSegments,
		heightSegments: heightSegments,
		widthLodSegments: widthLodSegments,
		heightLodSegments: heightLodSegments,
	};

	this.fromBufferGeometry( new PlaneLODBufferGeometry( width, height, widthSegments, heightSegments, widthLodSegments, heightLodSegments ) );
	this.mergeVertices();

}

PlaneLODGeometry.prototype = Object.create( THREE.Geometry.prototype );
PlaneLODGeometry.prototype.constructor = PlaneLODGeometry;

// PlaneLODBufferGeometry

function PlaneLODBufferGeometry( width, height, widthSegments, heightSegments, widthLodSegments, heightLodSegments ) {

	THREE.BufferGeometry.call( this );

	this.type = 'PlaneLODBufferGeometry';

	this.parameters = {
		width: width,
		height: height,
		widthSegments: widthSegments,
		heightSegments: heightSegments,
    widthLodSegments: widthLodSegments,
    heightLodSegments: heightLodSegments,
	};

	var width_half = width / 2;
	var height_half = height / 2;

	var gridX = Math.floor( widthSegments ) || 1;
	var gridY = Math.floor( heightSegments ) || 1;

	var gridX1 = gridX + 1;
	var gridY1 = gridY + 1;

	var segment_width = width / gridX;
	var segment_height = height / gridY;

  var gridLodX = Math.floor( widthLodSegments ) || 1;
	var gridLodY = Math.floor( heightLodSegments ) || 1;

  var gridLodX1 = gridLodX + 1;
	var gridLodY1 = gridLodY + 1;

	var segment_lod_width = width / gridLodX;
	var segment_lod_height = height / gridLodY;

	var ix, iy;

	// buffers

	var indices = [];
	var vertices = [];
	var normals = [];
	var uvs = [];

	// generate vertices, normals and uvs

	for ( iy = 0; iy < gridY1; iy ++ ) {

		var y = iy * segment_height - height_half;

		for ( ix = 0; ix < gridX1; ix ++ ) {

      if (iy !== 0 && iy !== (gridY1 - 1) && ix !== 0 && ix !== (gridX1 - 1)) break;

			var x = ix * segment_width - width_half;

			vertices.push( x, - y, 0 );

			normals.push( 0, 0, 1 );

			uvs.push( ix / gridX );
			uvs.push( 1 - ( iy / gridY ) );

		}

	}

	// indices

	for ( iy = 0; iy < gridY; iy ++ ) {

		for ( ix = 0; ix < gridX; ix ++ ) {

      if (iy !== 0 && iy !== (gridY1 - 1) && ix !== 0 && ix !== (gridX1 - 1)) break;

			var a = ix + gridX1 * iy;
			var b = ix + gridX1 * ( iy + 1 );
			var c = ( ix + 1 ) + gridX1 * ( iy + 1 );
			var d = ( ix + 1 ) + gridX1 * iy;

			// faces

			indices.push( a, b, d );
			indices.push( b, c, d );

		}

	}

  // internal

  var numFrontierVertices = vertices.length / 3;

  for ( iy = 1; iy < gridLodY1 - 1; iy ++ ) {

		var y = iy * segment_lod_height - height_half;

		for ( ix = 1; ix < gridLodX1 - 1; ix ++ ) {

			var x = ix * segment_lod_width - width_half;

			vertices.push( x, - y, 0 );

			normals.push( 0, 0, 1 );

			uvs.push( ix / gridLodX );
			uvs.push( 1 - ( iy / gridLodY ) );

		}

	}

  for ( iy = 1; iy < gridLodY - 1; iy ++ ) {

		for ( ix = 1; ix < gridLodX - 1; ix ++ ) {

			var a = numFrontierVertices + (ix - 1) + (gridLodX1 - 1) * (iy - 1); // sub 1 from gridLodX1?
			var b = numFrontierVertices + (ix - 1) + (gridLodX1 - 1) * ( (iy - 1) + 1 );
			var c = numFrontierVertices + ( (ix - 1) + 1 ) + (gridLodX1 - 1) * ( (iy - 1) + 1 );
			var d = numFrontierVertices + ( (ix - 1) + 1 ) + (gridLodX1 - 1) * (iy - 1);

			// faces

			indices.push( a, b, d );
			indices.push( b, c, d );

		}

	}

	// build geometry

	this.setIndex( indices );
	this.addAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
	this.addAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
	this.addAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );

}

PlaneLODBufferGeometry.prototype = Object.create( THREE.BufferGeometry.prototype );
PlaneLODBufferGeometry.prototype.constructor = PlaneLODBufferGeometry;


return { PlaneLODGeometry, PlaneLODBufferGeometry };

};
