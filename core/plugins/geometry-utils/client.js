const LRUMap = require('./lib/lru');

const VOXEL_SIZE = 0.1;
const NUM_PIXELS = 12;
const BOX_TARGET_CACHE_SIZE = 128;

const geometryUtils = archae => ({
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/plugins/function-utils',
    ]).then(([
      three,
      functionUtils,
    ]) => {
      if (live) {
        const {THREE} = three;

        class BoxTarget {
          constructor(position, quaternion, scale, size) {
            this.position = position;
            this.quaternion = quaternion;
            this.scale = scale;
            this.size = size;

            const leftPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
              new THREE.Vector3(-1, 0, 0).applyQuaternion(quaternion),
              position.clone().add(new THREE.Vector3(-size.x / 2, 0, 0).applyQuaternion(quaternion))
            );
            leftPlane.xAxis = new THREE.Line3(
              position.clone().add(new THREE.Vector3(-size.x / 2, 0, -size.z / 2).applyQuaternion(quaternion)),
              position.clone().add(new THREE.Vector3(-size.x / 2, 0, size.z / 2).applyQuaternion(quaternion))
            );
            leftPlane.yAxis = new THREE.Line3(
              position.clone().add(new THREE.Vector3(-size.x / 2, -size.y / 2, 0).applyQuaternion(quaternion)),
              position.clone().add(new THREE.Vector3(-size.x / 2, size.y /2, 0).applyQuaternion(quaternion))
            );
            const rightPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
              new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion),
              position.clone().add(new THREE.Vector3(size.x / 2, 0, 0).applyQuaternion(quaternion))
            );
            rightPlane.xAxis = new THREE.Line3(
              position.clone().add(new THREE.Vector3(size.x / 2, 0, -size.z / 2).applyQuaternion(quaternion)),
              position.clone().add(new THREE.Vector3(size.x / 2, 0, size.z / 2).applyQuaternion(quaternion))
            );
            rightPlane.yAxis = new THREE.Line3(
              position.clone().add(new THREE.Vector3(size.x / 2, -size.y / 2, 0).applyQuaternion(quaternion)),
              position.clone().add(new THREE.Vector3(size.x / 2, size.y / 2, 0).applyQuaternion(quaternion))
            );
            const topPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
              new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion),
              position.clone().add(new THREE.Vector3(0, size.y / 2, 0).applyQuaternion(quaternion))
            );
            topPlane.xAxis = new THREE.Line3(
              position.clone().add(new THREE.Vector3(-size.x / 2, size.y / 2, 0).applyQuaternion(quaternion)),
              position.clone().add(new THREE.Vector3(size.x / 2, size.y / 2, 0).applyQuaternion(quaternion))
            );
            topPlane.yAxis = new THREE.Line3(
              position.clone().add(new THREE.Vector3(0, size.y / 2, -size.z / 2).applyQuaternion(quaternion)),
              position.clone().add(new THREE.Vector3(0, size.y / 2, size.z / 2).applyQuaternion(quaternion))
            );
            const bottomPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
              new THREE.Vector3(0, -1, 0).applyQuaternion(quaternion),
              position.clone().add(new THREE.Vector3(0, -size.y / 2, 0).applyQuaternion(quaternion))
            );
            bottomPlane.xAxis = new THREE.Line3(
              position.clone().add(new THREE.Vector3(-size.x / 2, -size.y / 2, 0).applyQuaternion(quaternion)),
              position.clone().add(new THREE.Vector3(size.x / 2, -size.y / 2, 0).applyQuaternion(quaternion))
            );
            bottomPlane.yAxis = new THREE.Line3(
              position.clone().add(new THREE.Vector3(0, -size.y / 2, -size.z / 2).applyQuaternion(quaternion)),
              position.clone().add(new THREE.Vector3(0, -size.y / 2, size.z / 2).applyQuaternion(quaternion))
            );
            const frontPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
              new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion),
              position.clone().add(new THREE.Vector3(0, 0, size.z / 2).applyQuaternion(quaternion))
            );
            frontPlane.xAxis = new THREE.Line3(
              position.clone().add(new THREE.Vector3(-size.x / 2, 0, size.z / 2).applyQuaternion(quaternion)),
              position.clone().add(new THREE.Vector3(size.x / 2, 0, size.z / 2).applyQuaternion(quaternion))
            );
            frontPlane.yAxis = new THREE.Line3(
              position.clone().add(new THREE.Vector3(0, -size.y / 2, size.z / 2).applyQuaternion(quaternion)),
              position.clone().add(new THREE.Vector3(0, size.y / 2, size.z / 2).applyQuaternion(quaternion))
            );
            const backPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
              new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion),
              position.clone().add(new THREE.Vector3(0, 0, -size.z / 2).applyQuaternion(quaternion))
            );
            backPlane.xAxis = new THREE.Line3(
              position.clone().add(new THREE.Vector3(-size.x / 2, 0, -size.z / 2).applyQuaternion(quaternion)),
              position.clone().add(new THREE.Vector3(size.x / 2, 0, -size.z / 2).applyQuaternion(quaternion))
            );
            backPlane.yAxis = new THREE.Line3(
              position.clone().add(new THREE.Vector3(0, -size.y / 2, -size.z / 2).applyQuaternion(quaternion)),
              position.clone().add(new THREE.Vector3(0, size.y / 2, -size.z / 2).applyQuaternion(quaternion))
            );
            this.planes = [
              leftPlane,
              rightPlane,
              topPlane,
              bottomPlane,
              frontPlane,
              backPlane,
            ];
          }

          intersectLine(line) {
            const intersectionPoints = [];

            for (let i = 0; i < 6; i++) {
              const plane = this.planes[i];
              const intersectionPoint = plane.intersectLine(line);
              if (
                intersectionPoint &&
                intersectionPoint.distanceTo(plane.xAxis.closestPointToPoint(intersectionPoint, false)) < (plane.yAxis.distance() / 2) &&
                intersectionPoint.distanceTo(plane.yAxis.closestPointToPoint(intersectionPoint, false)) < (plane.xAxis.distance() / 2)
              ) {
                intersectionPoints.push(intersectionPoint);
              }
            }

            if (intersectionPoints.length > 0) {
              return intersectionPoints
                .map(intersectionPoint => ({
                  intersectionPoint,
                  distance: line.start.distanceTo(intersectionPoint),
                }))
                .sort((a, b) => a.distance - b.distance)[0].intersectionPoint;
            } else {
              return null;
            }
          }

          containsPoint(point) {
            const innerLine = new THREE.Line3(point, this.position);
            const outerLine = new THREE.Line3(this.position.clone().add(point.clone().sub(this.position).normalize()), this.position);
            return this.intersectLine(innerLine) === null && this.intersectLine(outerLine) !== null;
          }
        }

        class PlaneTarget {
          constructor(position, quaternion, width, height) {
            this.position = position;
            this.quaternion = quaternion;
            this.width = width;
            this.height = height;

            const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
              new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion),
              position
            );
            this.plane = plane;
            const lines = {
              left: new THREE.Line3(
                position.clone().add(new THREE.Vector3(-width / 2, -height / 2, 0).applyQuaternion(quaternion)),
                position.clone().add(new THREE.Vector3(-width / 2, height / 2, 0).applyQuaternion(quaternion))
              ),
              right: new THREE.Line3(
                position.clone().add(new THREE.Vector3(width / 2, -height / 2, 0).applyQuaternion(quaternion)),
                position.clone().add(new THREE.Vector3(width / 2, height / 2, 0).applyQuaternion(quaternion))
              ),
              top: new THREE.Line3(
                position.clone().add(new THREE.Vector3(-width / 2, height / 2, 0).applyQuaternion(quaternion)),
                position.clone().add(new THREE.Vector3(width / 2, height / 2, 0).applyQuaternion(quaternion))
              ),
              bottom: new THREE.Line3(
                position.clone().add(new THREE.Vector3(-width / 2, -height / 2, 0).applyQuaternion(quaternion)),
                position.clone().add(new THREE.Vector3(width / 2, -height / 2, 0).applyQuaternion(quaternion))
              ),
            };
            this.lines = lines;
          }

          projectPoint(point) {
            const {width, height, plane, lines: {left, right, top, bottom}} = this;
            const planePoint = plane.projectPoint(point);

            const leftPoint = left.closestPointToPoint(planePoint, false);
            const rightPoint = right.closestPointToPoint(planePoint, false);
            const topPoint = top.closestPointToPoint(planePoint, false);
            const bottomPoint = bottom.closestPointToPoint(planePoint, false);

            if (
              planePoint.distanceTo(leftPoint) <= width &&
              planePoint.distanceTo(rightPoint) <= width &&
              planePoint.distanceTo(topPoint) <= height &&
              planePoint.distanceTo(bottomPoint) <= height
            ) {
              return {
                x: top.start.distanceTo(topPoint) / width,
                y: left.end.distanceTo(leftPoint) / height,
                z: point.distanceTo(planePoint),
              };
            } else {
              return null;
            }
          }

          intersectLine(line) {
            const {width, height, plane, lines: {left, right, top, bottom}} = this;
            const intersectionPoint = plane.intersectLine(line);

            if (intersectionPoint) {
              const leftPoint = left.closestPointToPoint(intersectionPoint, false);
              const rightPoint = right.closestPointToPoint(intersectionPoint, false);
              const topPoint = top.closestPointToPoint(intersectionPoint, false);
              const bottomPoint = bottom.closestPointToPoint(intersectionPoint, false);

              if (
                intersectionPoint.distanceTo(leftPoint) <= width &&
                intersectionPoint.distanceTo(rightPoint) <= width &&
                intersectionPoint.distanceTo(topPoint) <= height &&
                intersectionPoint.distanceTo(bottomPoint) <= height
              ) {
                return {
                  x: top.start.distanceTo(topPoint) / width,
                  y: left.end.distanceTo(leftPoint) / height,
                  z: line.start.distanceTo(intersectionPoint),
                };
              } else {
                return null;
              }
            } else {
              return null;
            }
          }
        }

        /* const VOXEL_VERTICES = (() => {
          const cubeGeometry = new THREE.CubeGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
          for (let i = 0; i < cubeGeometry.vertices.length; i++) {
            cubeGeometry.vertices[i].x -= (NUM_PIXELS * VOXEL_SIZE) / 2;
            cubeGeometry.vertices[i].y += NUM_PIXELS * VOXEL_SIZE;
            // cubeGeometry.vertices[i].z -= (NUM_PIXELS * VOXEL_SIZE) / 2;
          }
          const bufferGeometry = new THREE.BufferGeometry().fromGeometry(cubeGeometry);
          const positions = bufferGeometry.getAttribute('position').array;
          return positions;
        })();

        function getVoxelVertices(x, y) {
          const voxelVertices = VOXEL_VERTICES.slice();
          for (let i = 0; i < VOXEL_VERTICES.length; i += 3) {
            voxelVertices[i] += x * VOXEL_SIZE;
          }
          for (let i = 1; i < VOXEL_VERTICES.length; i += 3) {
            voxelVertices[i] -= y * VOXEL_SIZE;
          }
          return voxelVertices;
        }

        function makeVoxelGeometry(imageData) {
          const {data, width, height} = imageData;

          function getPixelColorArray(x, y) {
            const index = (x + y * width) * 4;
            return data.slice(index, index + 4);
          }

          const vertices = [];
          const colors = [];
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const pixelColorArray = getPixelColorArray(x, y);
              const [r, g, b, a] = pixelColorArray;

              if (a > 0) {
                const rFloat = (r * 2) / 255;
                const gFloat = (g * 2) / 255;
                const bFloat = (b * 2) / 255;

                const voxelVertices = getVoxelVertices(x, y);
                for (let i = 0; i < VOXEL_VERTICES.length; i += 3) {
                  vertices.push(voxelVertices[i + 0], voxelVertices[i + 1], voxelVertices[i + 2]);
                  colors.push(rFloat, gFloat, bFloat);
                }
              }
            }
          }

          const geometry = new THREE.BufferGeometry();
          geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
          geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
          geometry.computeVertexNormals();

          return geometry;
        } */

        function unindexBufferGeometry(geometry) {
          if (geometry.index) {
            const indexes = geometry.index.array;
            const numIndexes = indexes.length;
            const oldVertices = geometry.getAttribute('position').array;
            const vertices = new Float32Array(numIndexes * 3);
            const oldNormals = geometry.getAttribute('normal').array;
            const normals = new Float32Array(numIndexes * 3);
            const oldUvs = geometry.getAttribute('uv').array;
            const uvs = new Float32Array(numIndexes * 2);
            for (let i = 0; i < numIndexes; i++) {
              const index = indexes[i];

              vertices[(i * 3) + 0] = oldVertices[(index * 3) + 0];
              vertices[(i * 3) + 1] = oldVertices[(index * 3) + 1];
              vertices[(i * 3) + 2] = oldVertices[(index * 3) + 2];

              normals[(i * 3) + 0] = oldNormals[(index * 3) + 0];
              normals[(i * 3) + 1] = oldNormals[(index * 3) + 1];
              normals[(i * 3) + 2] = oldNormals[(index * 3) + 2];

              uvs[(i * 2) + 0] = oldUvs[(index * 2) + 0];
              uvs[(i * 2) + 1] = oldUvs[(index * 2) + 1];
            }
            geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
            geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
            geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            // geometry.removeAttribute('normal');
            // geometry.removeAttribute('uv');
            geometry.index = null;
            // geometry.computeVertexNormals();
          }

          return geometry;
        }
        function mergeBufferGeometry(geometry1, geometry2) {
          if (geometry1.index) {
            geometry1 = unindexBufferGeometry(geometry1);
          }
          if (geometry2.index) {
            geometry2 = unindexBufferGeometry(geometry2);
          }

          const positions1 = geometry1.getAttribute('position').array;
          const positions2 = geometry2.getAttribute('position').array;
          const positions = new Float32Array(positions1.length + positions2.length);
          positions.set(positions1);
          positions.set(positions2, positions1.length);

          const normalAttribute1 = geometry1.getAttribute('normal');
          const normals1 = normalAttribute1 ? normalAttribute1.array : null;
          const normalAttribute2 = geometry2.getAttribute('normal');
          const normals2 = normalAttribute2 ? normalAttribute2.array : null;
          const normals = (normals1 && normals2) ? new Float32Array(normals1.length + normals2.length) : null;
          if (normals) {
            normals.set(normals1);
            normals.set(normals2, normals1.length);
          }

          const colorAttribute1 = geometry1.getAttribute('color');
          const colors1 = colorAttribute1 ? colorAttribute1.array : null;
          const colorAttribute2 = geometry2.getAttribute('color');
          const colors2 = colorAttribute2 ? colorAttribute2.array : null;
          const colors = (colors1 && colors2) ? new Float32Array(colors1.length + colors2.length) : null;
          if (colors) {
            colors.set(colors1);
            colors.set(colors2, colors1.length);
          }

          const uvAttribute1 = geometry1.getAttribute('uv');
          const uvs1 = uvAttribute1 ? uvAttribute1.array : null;
          const uvAttribute2 = geometry2.getAttribute('uv');
          const uvs2 = uvAttribute2 ? uvAttribute2.array : null;
          const uvs = (uvs1 & uvs2) ? new Float32Array(uvs1.length + uvs2.length) : null;
          if (uvs) {
            uvs.set(uvs1);
            uvs.set(uvs2, uvs1.length);
          }

          const geometry3 = new THREE.BufferGeometry();
          geometry3.addAttribute('position', new THREE.BufferAttribute(positions, 3));
          if (normals) {
            geometry3.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
          }
          if (colors) {
            geometry3.addAttribute('color', new THREE.BufferAttribute(colors, 3));
          }
          if (uvs) {
            geometry3.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
          }

          return geometry3;
        }
        function concatBufferGeometry(geometries) {
          geometries = geometries.map(geometry => unindexBufferGeometry(geometry));

          const positions = (() => {
            const geometryPositions = geometries.map(geometry => geometry.getAttribute('position').array);
            const numPositions = functionUtils.sum(geometryPositions.map(geometryPosition => geometryPosition.length));

            const result = new Float32Array(numPositions);
            let i = 0;
            geometryPositions.forEach(geometryPosition => {
              result.set(geometryPosition, i);
              i += geometryPosition.length;
            });
            return result;
          })();
          const normals = (() => {
            const geometryNormals = geometries.map(geometry => geometry.getAttribute('normal').array);
            const numNormals = functionUtils.sum(geometryNormals.map(geometryNormal => geometryNormal.length));

            const result = new Float32Array(numNormals);
            let i = 0;
            geometryNormals.forEach(geometryNormal => {
              result.set(geometryNormal, i);
              i += geometryNormal.length;
            });
            return result;
          })();
          const uvs = (() => {
            const geometryUvs = geometries.map(geometry => geometry.getAttribute('uv').array);
            const numUvs = functionUtils.sum(geometryUvs.map(geometryUv => geometryUv.length));

            const result = new Float32Array(numUvs);
            let i = 0;
            geometryUvs.forEach(geometryUv => {
              result.set(geometryUv, i);
              i += geometryUv.length;
            });
            return result;
          })();

          const geometry = new THREE.BufferGeometry();
          geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
          geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
          geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
          return geometry;
        }

        /* const sliceGeometry = (() => {
          const FRONT = 'front';
          const BACK = 'back';
          const STRADDLE = 'straddle';
          const ON = 'on';

          function sliceFace(plane, geom, points, position) {
            let i;
            let len = points.length;
            let p1;
            let p2;
            let intersection;
            let position1;
            let position2;
            const slicePoints = [];

            for (i = 0; i < len; i++) {
              p1 = points[i];
              p2 = i + 1 < len ? points[i + 1] : points[0];
              intersection = intersectPlane(p1, p2, plane);
              position1 = vertexPosition(plane, p1.vertex);
              position2 = vertexPosition(plane, p2.vertex);
              if (position1 == position && slicePoints.indexOf(p1) === -1) {
                slicePoints.push(p1);
              }
              if (intersection) {
                slicePoints.push(intersection);
              }
              if (position2 == position && slicePoints.indexOf(p2) === -1) {
                slicePoints.push(p2);
              }
            }

            if (slicePoints.length > 3) {
              addFace(geom, [
                slicePoints[0],
                slicePoints[1],
                slicePoints[2],
              ]);
              addFace(geom, [
                slicePoints[2],
                slicePoints[3],
                slicePoints[0],
              ]);
            } else {
              addFace(geom, slicePoints);
            }
          }

          function addFace(geom, points) {
            let existingIndex;
            const vertexIndices = [];
            let indexOffset = geom.vertices.length;
            let exists;
            const normals = [];
            const uvs = [];

            points.forEach(function(point) {
              existingIndex = geom.vertices.indexOf(point.vertex);
              if (existingIndex !== -1) {
                vertexIndices.push(existingIndex);
              } else {
                geom.vertices.push(point.vertex);
                vertexIndices.push(indexOffset);
                indexOffset += 1;
              }
              if (point.normal) {
                normals.push(point.normal);
              }
              if (point.uv) {
                uvs.push(point.uv);
              }
              return !exists;
            });

            const face = new THREE.Face3(
              vertexIndices[0],
              vertexIndices[1],
              vertexIndices[2],
              normals
            );
            geom.faces.push(face);
            if (uvs.length) {
              geom.faceVertexUvs[0].push(uvs);
            }
          }

          function facePoints(geom, face, faceIndex) {
            const uvs = geom.faceVertexUvs[0];
            return ['a', 'b', 'c'].map(function(key, i) {
              return {
                vertex: geom.vertices[face[key]],
                normal: face.vertexNormals[i],
                uv: uvs[faceIndex] ? uvs[faceIndex][i] : undefined,
              };
            });
          }

          function intersectPlane(p1, p2, plane) {
            const line = new THREE.Line3(p1.vertex, p2.vertex);
            const intersection = plane.intersectLine(line);
            if (intersection) {
              const distance = p1.vertex.distanceTo(intersection);
              const alpha = distance / line.distance();
              return {
                vertex: intersection,
                normal: p1.normal.clone().lerp(p2.normal, alpha).normalize(),
                uv: p1.uv && p2.uv ? p1.uv.clone().lerp(p2.uv, alpha) : null
              };
            }
          }

          function facePosition(plane, points) {
            const a = vertexPosition(plane, points[0].vertex);
            const b = vertexPosition(plane, points[1].vertex);
            const c = vertexPosition(plane, points[2].vertex);
            if (a == BACK || b == BACK || c == BACK) {
              if (a == FRONT || b == FRONT || c == FRONT) {
                return STRADDLE;
              }
              return BACK;
            }
            if (a == FRONT || b == FRONT || c == FRONT) {
              if (a == BACK || b == BACK || c == BACK) {
                return STRADDLE;
              }
              return FRONT;
            }
            return ON;
          }

          function vertexPosition(plane, vertex) {
            const distance = plane.distanceToPoint(vertex);
            if (distance < 0) {
              return BACK;
            }
            if (distance > 0) {
              return FRONT;
            }
            return ON;
          }

          return (geom, plane) => {
            const slicedFront = new THREE.Geometry();
            geom.faces.forEach((face, faceIndex) => {
              const pointsFront = facePoints(geom, face, faceIndex);
              const positionFront = facePosition(plane, pointsFront);
              if (positionFront == FRONT || positionFront == ON) {
                addFace(slicedFront, pointsFront);
              } else if (positionFront == STRADDLE) {
                sliceFace(plane, slicedFront, pointsFront, FRONT);
              }
            });

            const slicedBack = new THREE.Geometry();
            geom.faces.forEach((face, faceIndex) => {
              const pointsBack = facePoints(geom, face, faceIndex);
              const positionBack = facePosition(plane, pointsBack);
              if (positionBack == BACK) {
                addFace(slicedBack, pointsBack);
              } else if (positionBack == STRADDLE) {
                sliceFace(plane, slicedBack, pointsBack, BACK);
              }
            });

            return [slicedFront, slicedBack];
          };
        })();
        api.sliceGeometry = sliceGeometry;

        class FacePoint {
          constructor(position = null, normal = null, color = null, uv = null) {
            this.position = position;
            this.normal = normal;
            this.color = color;
            this.uv = uv;
          }
        }

        const sliceBufferGeometry = (() => {
          const FRONT = 'front';
          const BACK = 'back';
          const STRADDLE = 'straddle';
          const ON = 'on';

          function sliceFace(positions, normals, colors, uvs, points, plane, position) {
            const slicePoints = [];

            for (let i = 0; i < 3; i++) {
              const p1 = points[i];
              const p2 = ((i + 1) < 3) ? points[i + 1] : points[0];
              const intersection = intersectPlane(p1, p2, plane);
              const position1 = vertexPosition(plane, p1.position);
              const position2 = vertexPosition(plane, p2.position);
              if (position1 == position && slicePoints.indexOf(p1) === -1) {
                slicePoints.push(p1);
              }
              if (intersection) {
                const intersectionPoint = new FacePoint(
                  intersection.vertex,
                  intersection.normal,
                  (p1.color && p2.color) ? p1.color.clone().add(p2.color).multiplyScalar(0.5) : null,
                  intersection.uv,
                );
                slicePoints.push(intersectionPoint);
              }
              if (position2 == position && slicePoints.indexOf(p2) === -1) {
                slicePoints.push(p2);
              }
            }

            if (slicePoints.length > 3) {
              addFace(positions, normals, colors, uvs, [
                slicePoints[0],
                slicePoints[1],
                slicePoints[2],
              ]);
              addFace(positions, normals, colors, uvs, [
                slicePoints[2],
                slicePoints[3],
                slicePoints[0],
              ]);
            } else {
              addFace(positions, normals, colors, uvs, slicePoints);
            }
          }

          function addFace(positions, normals, colors, uvs, points) {
            positions.push(
              points[0].position.x,
              points[0].position.y,
              points[0].position.z,
              points[1].position.x,
              points[1].position.y,
              points[1].position.z,
              points[2].position.x,
              points[2].position.y,
              points[2].position.z,
            );
            normals.push(
              points[0].normal.x,
              points[0].normal.y,
              points[0].normal.z,
              points[1].normal.x,
              points[1].normal.y,
              points[1].normal.z,
              points[2].normal.x,
              points[2].normal.y,
              points[2].normal.z,
            );
            if (colors) {
              colors.push(
                points[0].color.r,
                points[0].color.g,
                points[0].color.b,
                points[1].color.r,
                points[1].color.g,
                points[1].color.b,
                points[2].color.r,
                points[2].color.g,
                points[2].color.b,
              );
            }
            if (uvs) {
              uvs.push(
                points[0].uv.x,
                points[0].uv.y,
                points[1].uv.x,
                points[1].uv.y,
                points[2].uv.x,
                points[2].uv.y,
              );
            }
          }

          function facePoints(geometry, faceIndex) {
            const positions = geometry.getAttribute('position').array;
            const normals = geometry.getAttribute('normal').array;
            const colorAttribute = geometry.getAttribute('color');
            const colors = colorAttribute ? colorAttribute.array : null;
            const uvAttribute = geometry.getAttribute('uv');
            const uvs = uvAttribute ? uvAttribute.array : null;

            return [
              new FacePoint(
                new THREE.Vector3().fromArray(positions, (faceIndex * 3 * 3) + (0 * 3)),
                new THREE.Vector3().fromArray(normals, (faceIndex * 3 * 3) + (0 * 3)),
                colors && new THREE.Color().fromArray(colors, (faceIndex * 3 * 3) + (0 * 3)),
                uvs && new THREE.Vector3().fromArray(uvs, (faceIndex * 3 * 2) + (0 * 2))
              ),
              new FacePoint(
                new THREE.Vector3().fromArray(positions, (faceIndex * 3 * 3) + (1 * 3)),
                new THREE.Vector3().fromArray(normals, (faceIndex * 3 * 3) + (1 * 3)),
                colors && new THREE.Color().fromArray(colors, (faceIndex * 3 * 3) + (1 * 3)),
                uvs && new THREE.Vector3().fromArray(uvs, (faceIndex * 3 * 2) + (1 * 2))
              ),
              new FacePoint(
                new THREE.Vector3().fromArray(positions, (faceIndex * 3 * 3) + (2 * 3)),
                new THREE.Vector3().fromArray(normals, (faceIndex * 3 * 3) + (2 * 3)),
                colors && new THREE.Color().fromArray(colors, (faceIndex * 3 * 3) + (2 * 3)),
                uvs && new THREE.Vector3().fromArray(uvs, (faceIndex * 3 * 2) + (2 * 2))
              ),
            ];
          }

          function intersectPlane(p1, p2, plane) {
            const line = new THREE.Line3(p1.position, p2.position);
            const intersection = plane.intersectLine(line);
            if (intersection) {
              const distance = p1.position.distanceTo(intersection);
              const alpha = distance / line.distance();
              return {
                vertex: intersection,
                normal: p1.normal.clone().lerp(p2.normal, alpha).normalize(),
                uv: p1.uv && p2.uv ? p1.uv.clone().lerp(p2.uv, alpha) : null
              };
            }
          }

          function facePosition(plane, points) {
            const a = vertexPosition(plane, points[0].position);
            const b = vertexPosition(plane, points[1].position);
            const c = vertexPosition(plane, points[2].position);
            if (a == BACK || b == BACK || c == BACK) {
              if (a == FRONT || b == FRONT || c == FRONT) {
                return STRADDLE;
              }
              return BACK;
            }
            if (a == FRONT || b == FRONT || c == FRONT) {
              if (a == BACK || b == BACK || c == BACK) {
                return STRADDLE;
              }
              return FRONT;
            }
            return ON;
          }

          function vertexPosition(plane, vertex) {
            const distance = plane.distanceToPoint(vertex);
            if (distance < 0) {
              return BACK;
            }
            if (distance > 0) {
              return FRONT;
            }
            return ON;
          }

          return (geometry, plane) => {
            const positions = geometry.getAttribute('position').array;
            const numVertices = positions.length / 3;
            const numFaces = numVertices / 3;

            const geometryFront = new THREE.BufferGeometry();
            const positionsFront = [];
            const normalsFront = geometry.getAttribute('normal') ? [] : null;
            const colorsFront = geometry.getAttribute('color') ? [] : null;
            const uvsFront = geometry.getAttribute('uv') ? [] : null;
            for (let i = 0; i < numFaces; i++) {
              const pointsFront = facePoints(geometry, i);
              const positionFront = facePosition(plane, pointsFront);
              if (positionFront == FRONT || positionFront == ON) {
                addFace(positionsFront, normalsFront, colorsFront, uvsFront, pointsFront);
              } else if (positionFront == STRADDLE) {
                sliceFace(positionsFront, normalsFront, colorsFront, uvsFront, pointsFront, plane, FRONT);
              }
            }
            geometryFront.addAttribute('position', new THREE.BufferAttribute(Float32Array.from(positionsFront), 3));
            geometryFront.addAttribute('normal', new THREE.BufferAttribute(Float32Array.from(normalsFront), 3));
            if (colorsFront) {
              geometryFront.addAttribute('color', new THREE.BufferAttribute(Float32Array.from(colorsFront), 3));
            }
            if (uvsFront) {
              geometryFront.addAttribute('uv', new THREE.BufferAttribute(Float32Array.from(uvsFront), 2));
            }

            const geometryBack = new THREE.BufferGeometry();
            const positionsBack = [];
            const normalsBack = geometry.getAttribute('normal') ? [] : null;
            const colorsBack = geometry.getAttribute('color') ? [] : null;
            const uvsBack = geometry.getAttribute('uv') ? [] : null;
            for (let i = 0; i < numFaces; i++) {
              const pointsBack = facePoints(geometry, i);
              const positionBack = facePosition(plane, pointsBack);
              if (positionBack == BACK) {
                addFace(positionsBack, normalsBack, colorsBack, uvsBack, pointsBack);
              } else if (positionBack == STRADDLE) {
                sliceFace(positionsBack, normalsBack, colorsBack, uvsBack, pointsBack, plane, BACK);
              }
            }
            geometryBack.addAttribute('position', new THREE.BufferAttribute(Float32Array.from(positionsBack), 3));
            geometryBack.addAttribute('normal', new THREE.BufferAttribute(Float32Array.from(normalsBack), 3));
            if (colorsBack) {
              geometryBack.addAttribute('color', new THREE.BufferAttribute(Float32Array.from(colorsBack), 3));
            }
            if (uvsBack) {
              geometryBack.addAttribute('uv', new THREE.BufferAttribute(Float32Array.from(uvsBack), 2));
            }

            return [geometryFront, geometryBack];
          };
        })(); */

        const makeControllerLine = (position, rotation) => {
          if (rotation) {
            return new THREE.Line3(
              position.clone(),
              position.clone().add(new THREE.Vector3(0, 0, -1).applyQuaternion(rotation).multiplyScalar(15))
            );
          } else {
            return new THREE.Line3(
              position.clone().add(new THREE.Vector3(0, 0, 1).applyQuaternion(rotation).multiplyScalar(worldDepth / 2)),
              position.clone().add(new THREE.Vector3(0, 0, -1).applyQuaternion(rotation).multiplyScalar(worldDepth / 2))
            );
          }
        };

        const boxTargetCache = new LRUMap(BOX_TARGET_CACHE_SIZE);
        const makeBoxTarget = (position, rotation, scale, size) => {
          const key = [
            position.x, position.y, position.z,
            rotation.x, rotation.y, rotation.z, rotation.w,
            scale.x, scale.y, scale.z,
            size.x, size.y, size.z,
          ].join(':');
          let entry = boxTargetCache.get(size);
          if (!entry) {
            entry = new BoxTarget(position, rotation, scale, size);
            boxTargetCache.set(key, entry);
          }
          return entry;
        };
        const makeBoxTargetOffset = (position, rotation, scale, start, end) => {
          const topLeft = position.clone().add(
            start.clone().applyQuaternion(rotation)
          );
          const bottomRight = position.clone().add(
            end.clone().applyQuaternion(rotation)
          );
          const newPosition = new THREE.Vector3((topLeft.x + bottomRight.x) / 2, (topLeft.y + bottomRight.y) / 2, (topLeft.z + bottomRight.z) / 2);
          const newSize = new THREE.Vector3(Math.abs(start.x - end.x), Math.abs(start.y - end.y), Math.abs(start.z - end.z));
          return makeBoxTarget(newPosition, rotation, scale, newSize);
        };
        const makePlaneTarget = (position, quaternion, width, height) => new PlaneTarget(position, quaternion, width, height);

        return {
          // makeVoxelGeometry,
          unindexBufferGeometry,
          mergeBufferGeometry,
          concatBufferGeometry,
          // sliceBufferGeometry,
          makeControllerLine,
          makeBoxTarget,
          makeBoxTargetOffset,
          makePlaneTarget,
        };
      }
    });
  },
  unmount() {
    this._cleanup();
  },
});

module.exports = geometryUtils;
