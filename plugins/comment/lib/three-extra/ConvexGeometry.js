/**
 * @author qiao / https://github.com/qiao
 * @fileoverview This is a convex hull generator using the incremental method. 
 * The complexity is O(n^2) where n is the number of vertices.
 * O(nlogn) algorithms do exist, but they are much more complicated.
 *
 * Benchmark: 
 *
 *  Platform: CPU: P7350 @2.00GHz Engine: V8
 *
 *  Num Vertices	Time(ms)
 *
 *     10           1
 *     20           3
 *     30           19
 *     40           48
 *     50           107
 */

module.exports = THREE => {

const ConvexGeometry = function( vertices ) {

	THREE.Geometry.call( this );

	const faces = [ [ 0, 1, 2 ], [ 0, 2, 1 ] ];

	for ( let i = 3; i < vertices.length; i ++ ) {

		addPoint( i );

	}


	function addPoint( vertexId ) {

		const vertex = vertices[ vertexId ].clone();

		const mag = vertex.length();
		vertex.x += mag * randomOffset();
		vertex.y += mag * randomOffset();
		vertex.z += mag * randomOffset();

		const hole = [];

		for ( let f = 0; f < faces.length; ) {

			const face = faces[ f ];

			// for each face, if the vertex can see it,
			// then we try to add the face's edges into the hole.
			if ( visible( face, vertex ) ) {

				for ( let e = 0; e < 3; e ++ ) {

					const edge = [ face[ e ], face[ ( e + 1 ) % 3 ] ];
					let boundary = true;

					// remove duplicated edges.
					for ( let h = 0; h < hole.length; h ++ ) {

						if ( equalEdge( hole[ h ], edge ) ) {

							hole[ h ] = hole[ hole.length - 1 ];
							hole.pop();
							boundary = false;
							break;

						}

					}

					if ( boundary ) {

						hole.push( edge );

					}

				}

				// remove faces[ f ]
				faces[ f ] = faces[ faces.length - 1 ];
				faces.pop();

			} else {

				// not visible

				f ++;

			}

		}

		// construct the new faces formed by the edges of the hole and the vertex
		for ( let h = 0; h < hole.length; h ++ ) {

			faces.push( [
				hole[ h ][ 0 ],
				hole[ h ][ 1 ],
				vertexId
			] );

		}

	}

	/**
	 * Whether the face is visible from the vertex
	 */
	function visible( face, vertex ) {

		const va = vertices[ face[ 0 ] ];
		const vb = vertices[ face[ 1 ] ];
		const vc = vertices[ face[ 2 ] ];

		const n = normal( va, vb, vc );

		// distance from face to origin
		const dist = n.dot( va );

		return n.dot( vertex ) >= dist;

	}

	/**
	 * Face normal
	 */
	function normal( va, vb, vc ) {

		const cb = new THREE.Vector3();
		const ab = new THREE.Vector3();

		cb.subVectors( vc, vb );
		ab.subVectors( va, vb );
		cb.cross( ab );

		cb.normalize();

		return cb;

	}

	/**
	 * Detect whether two edges are equal.
	 * Note that when constructing the convex hull, two same edges can only
	 * be of the negative direction.
	 */
	function equalEdge( ea, eb ) {

		return ea[ 0 ] === eb[ 1 ] && ea[ 1 ] === eb[ 0 ];

	}

	/**
	 * Create a random offset between -1e-6 and 1e-6.
	 */
	function randomOffset() {

		return ( Math.random() - 0.5 ) * 2 * 1e-6;

	}

	// Push vertices into `this.vertices`, skipping those inside the hull
	let id = 0;
	const newId = new Array( vertices.length ); // map from old vertex id to new id

	for ( let i = 0; i < faces.length; i ++ ) {

		 const face = faces[ i ];

		 for ( let j = 0; j < 3; j ++ ) {

			if ( newId[ face[ j ] ] === undefined ) {

				newId[ face[ j ] ] = id ++;
				this.vertices.push( vertices[ face[ j ] ] );

			}

			face[ j ] = newId[ face[ j ] ];

		 }

	}

	// Convert faces into instances of THREE.Face3
	for ( let i = 0; i < faces.length; i ++ ) {

		this.faces.push( new THREE.Face3(
				faces[ i ][ 0 ],
				faces[ i ][ 1 ],
				faces[ i ][ 2 ]
		) );

	}

	this.computeFaceNormals();

	// Compute flat vertex normals
	for ( let i = 0; i < this.faces.length; i ++ ) {

		const face = this.faces[ i ];
		const normal = face.normal;

		face.vertexNormals[ 0 ] = normal.clone();
		face.vertexNormals[ 1 ] = normal.clone();
		face.vertexNormals[ 2 ] = normal.clone();

	}

};

ConvexGeometry.prototype = Object.create( THREE.Geometry.prototype );
ConvexGeometry.prototype.constructor = ConvexGeometry;

return ConvexGeometry;

};
