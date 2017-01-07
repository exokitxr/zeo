const isosurface = require('isosurface');

self.onrequest = (method, args, cb) => {
  switch (method) {
    case 'ping': {
      cb(null, args[0]);

      break;
    }
    case 'marchCubes': {
      const opts = args[0];
      const positions = marchCubes(opts);
      const result = {
        positions,
      };
      cb(null, result);

      break;
    }
    default: {
      const err = new Error('unknown method');
      cb(err.stack);

      break;
    }
  }
};

function marchCubes({points, chunkSize, dims, start, end}) {
  const _getPointIndex = (x, y, z) => (x * chunkSize * chunkSize) + (y * chunkSize) + z;

  const h = chunkSize / 2;

  const cubes = isosurface.marchingCubes(dims, (x, y, z) => {
    if (
      x >= -h && y >= -h && z >= -h &&
      x < h && y < h && z < h
    ) {
      const pointIndex = _getPointIndex(x - (-h), y - (-h), z - (-h));
      const value = points[pointIndex];

      return -0.5 + (value || 0);
    } else {
      return -1;
    }
  }, [
    start,
    end,
  ]);
  const {cells: cubeCells, positions: cubePositions} = cubes;

  const numCells = cubeCells.length;

  const positions = new Float32Array(numCells * 3 * 3);
  for (let i = 0; i < numCells; i++) {
    const cubeCell = cubeCells[i];

    const va = cubePositions[cubeCell[0]];
    const vb = cubePositions[cubeCell[1]];
    const vc = cubePositions[cubeCell[2]];

    positions[(i * 9) + 0] = va[0];
    positions[(i * 9) + 1] = va[1];
    positions[(i * 9) + 2] = va[2];
    positions[(i * 9) + 3] = vc[0];
    positions[(i * 9) + 4] = vc[1];
    positions[(i * 9) + 5] = vc[2];
    positions[(i * 9) + 6] = vb[0];
    positions[(i * 9) + 7] = vb[1];
    positions[(i * 9) + 8] = vb[2];
  }

  return positions;
}
