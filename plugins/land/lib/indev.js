var creaturejs = (function () {
var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};





function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var alea = createCommonjsModule(function (module, exports) {
(function (root, factory) {
  {
      module.exports = factory();
  }
}(commonjsGlobal, function () {

  'use strict';

  // From http://baagoe.com/en/RandomMusings/javascript/

  // importState to sync generator states
  Alea.importState = function(i){
    var random = new Alea();
    random.importState(i);
    return random;
  };

  return Alea;

  function Alea() {
    return (function(args) {
      // Johannes Baagøe <baagoe@baagoe.com>, 2010
      var s0 = 0;
      var s1 = 0;
      var s2 = 0;
      var c = 1;

      if (args.length == 0) {
        args = [+new Date];
      }
      var mash = Mash();
      s0 = mash(' ');
      s1 = mash(' ');
      s2 = mash(' ');

      for (var i = 0; i < args.length; i++) {
        s0 -= mash(args[i]);
        if (s0 < 0) {
          s0 += 1;
        }
        s1 -= mash(args[i]);
        if (s1 < 0) {
          s1 += 1;
        }
        s2 -= mash(args[i]);
        if (s2 < 0) {
          s2 += 1;
        }
      }
      mash = null;

      var random = function() {
        var t = 2091639 * s0 + c * 2.3283064365386963e-10; // 2^-32
        s0 = s1;
        s1 = s2;
        return s2 = t - (c = t | 0);
      };
      random.uint32 = function() {
        return random() * 0x100000000; // 2^32
      };
      random.fract53 = function() {
        return random() + 
          (random() * 0x200000 | 0) * 1.1102230246251565e-16; // 2^-53
      };
      random.version = 'Alea 0.9';
      random.args = args;

      // my own additions to sync state between two generators
      random.exportState = function(){
        return [s0, s1, s2, c];
      };
      random.importState = function(i){
        s0 = +i[0] || 0;
        s1 = +i[1] || 0;
        s2 = +i[2] || 0;
        c = +i[3] || 0;
      };
 
      return random;

    } (Array.prototype.slice.call(arguments)));
  }

  function Mash() {
    var n = 0xefc8249d;

    var mash = function(data) {
      data = data.toString();
      for (var i = 0; i < data.length; i++) {
        n += data.charCodeAt(i);
        var h = 0.02519603282416938 * n;
        n = h >>> 0;
        h -= n;
        h *= n;
        n = h >>> 0;
        h -= n;
        n += h * 0x100000000; // 2^32
      }
      return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
    };

    mash.version = 'Mash 0.9';
    return mash;
  }
}));
});

/*
 * A speed-improved simplex noise algorithm for 2D, 3D and 4D in JavaScript.
 *
 * Based on example code by Stefan Gustavson (stegu@itn.liu.se).
 * Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
 * Better rank ordering method by Stefan Gustavson in 2012.
 *
 * This code was placed in the public domain by its original author,
 * Stefan Gustavson. You may use it as you see fit, but
 * attribution is appreciated.
 */

const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
const G3 = 1.0 / 6.0;
const G4 = (5.0 - Math.sqrt(5.0)) / 20.0;

const GRAD3 = [
  [ 1, 1, 0], [-1, 1, 0], [ 1,-1, 0], [-1,-1, 0],
  [ 1, 0, 1], [-1, 0, 1], [ 1, 0,-1], [-1, 0,-1],
  [ 0, 1, 1], [ 0,-1,-1], [ 0, 1,-1], [ 0,-1,-1]
];

const GRAD4 = [
  [ 0, 1, 1, 1], [ 0, 1, 1,-1], [ 0, 1,-1, 1], [ 0, 1,-1,-1],
  [ 0,-1, 1, 1], [ 0,-1, 1,-1], [ 0,-1,-1, 1], [ 0,-1,-1,-1],
  [ 1, 0, 1, 1], [ 1, 0, 1,-1], [ 1, 0,-1, 1], [ 1, 0,-1,-1],
  [-1, 0, 1, 1], [-1, 0, 1,-1], [-1, 0,-1, 1], [-1, 0,-1,-1],
  [ 1, 1, 0, 1], [ 1, 1, 0,-1], [ 1,-1, 0, 1], [ 1,-1, 0,-1],
  [-1, 1, 0, 1], [-1, 1, 0,-1], [-1,-1, 0, 1], [-1,-1, 0,-1],
  [ 1, 1, 1, 0], [ 1, 1,-1, 0], [ 1,-1, 1, 0], [ 1,-1,-1, 0],
  [-1, 1, 1, 0], [-1, 1,-1, 0], [-1,-1, 1, 0], [-1,-1,-1, 0]
];

class FastSimplexNoise {
  constructor(options) {
    if (!options) options = {};

    this.amplitude = options.amplitude || 1.0;
    this.frequency = options.frequency || 1.0;
    this.octaves = parseInt(options.octaves || 1);
    this.persistence = options.persistence || 0.5;
    this.random = options.random || Math.random;

    if (typeof options.min === 'number' && typeof options.max === 'number') {
      if (options.min >= options.max) {
        console.error('options.min must be less than options.max');
      } else {
        var min = parseFloat(options.min);
        var max = parseFloat(options.max);
        var range = max - min;
        this.scale = function (value) {
          return min + ((value + 1) / 2) * range;
        };
      }
    }

    var i;
    var p = new Uint8Array(256);
    for (i = 0; i < 256; i++) {
      p[i] = i;
    }

    var n, q;
    for (i = 255; i > 0; i--) {
      n = Math.floor((i + 1) * this.random());
      q = p[i];
      p[i] = p[n];
      p[n] = q;
    }

    // To remove the need for index wrapping, double the permutation table length
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  cylindrical2D(c, x, y) {
    var nx = x / c;
    var r = c / (2 * Math.PI);
    var rdx = nx * 2 * Math.PI;
    var a = r * Math.sin(rdx);
    var b = r * Math.cos(rdx);

    return this.in3D(a, b, y);
  }

  cylindrical3D(c, x, y, z) {
    var nx = x / c;
    var r = c / (2 * Math.PI);
    var rdx = nx * 2 * Math.PI;
    var a = r * Math.sin(rdx);
    var b = r * Math.cos(rdx);

    return this.in4D(a, b, y, z);
  }

  in2D(x, y) {
    var amplitude = this.amplitude;
    var frequency = this.frequency;
    var maxAmplitude = 0;
    var noise = 0;
    var persistence = this.persistence;

    for (var i = 0; i < this.octaves; i++) {
      noise += this.raw2D(x * frequency, y * frequency) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    var value = noise / maxAmplitude;
    return this.scale ? this.scale(value) : value;
  }

  in3D(x, y, z) {
    var amplitude = this.amplitude;
    var frequency = this.frequency;
    var maxAmplitude = 0;
    var noise = 0;
    var persistence = this.persistence;

    for (var i = 0; i < this.octaves; i++) {
      noise += this.raw3D(x * frequency, y * frequency, z * frequency) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    var value = noise / maxAmplitude;
    return this.scale ? this.scale(value) : value;
  }

  in4D(x, y, z, w) {
    var amplitude = this.amplitude;
    var frequency = this.frequency;
    var maxAmplitude = 0;
    var noise = 0;
    var persistence = this.persistence;

    for (var i = 0; i < this.octaves; i++) {
      noise += this.raw4D(x * frequency, y * frequency, z * frequency, w * frequency) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    var value = noise / maxAmplitude;
    return this.scale ? this.scale(value) : value;
  }

  raw2D(x, y) {
    var perm = this.perm;
    var permMod12 = this.permMod12;

    var n0, n1, n2; // Noise contributions from the three corners

    // Skew the input space to determine which simplex cell we're in
    var s = (x + y) * 0.5 * (Math.sqrt(3.0) - 1.0); // Hairy factor for 2D
    var i = Math.floor(x + s);
    var j = Math.floor(y + s);
    var t = (i + j) * G2;
    var X0 = i - t; // Unskew the cell origin back to (x,y) space
    var Y0 = j - t;
    var x0 = x - X0; // The x,y distances from the cell origin
    var y0 = y - Y0;

    // For the 2D case, the simplex shape is an equilateral triangle.
    // Determine which simplex we are in.
    var i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
    if (x0 > y0) { // Lower triangle, XY order: (0,0)->(1,0)->(1,1)
      i1 = 1;
      j1 = 0;
    } else { // Upper triangle, YX order: (0,0)->(0,1)->(1,1)
      i1 = 0;
      j1 = 1;
    }

    // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
    // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
    // c = (3 - sqrt(3)) / 6

    var x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
    var y1 = y0 - j1 + G2;
    var x2 = x0 - 1.0 + 2.0 * G2; // Offsets for last corner in (x,y) unskewed coords
    var y2 = y0 - 1.0 + 2.0 * G2;

    // Work out the hashed gradient indices of the three simplex corners
    var ii = i & 255;
    var jj = j & 255;
    var gi0 = permMod12[ii + perm[jj]];
    var gi1 = permMod12[ii + i1 + perm[jj + j1]];
    var gi2 = permMod12[ii + 1 + perm[jj + 1]];

    // Calculate the contribution from the three corners
    var t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) {
      n0 = 0.0;
    } else {
      t0 *= t0;
      // (x,y) of 3D gradient used for 2D gradient
      n0 = t0 * t0 * dot2D(GRAD3[gi0], x0, y0);
    }
    var t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) {
      n1 = 0.0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * dot2D(GRAD3[gi1], x1, y1);
    }
    var t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) {
      n2 = 0.0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * dot2D(GRAD3[gi2], x2, y2);
    }

    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1, 1];
    return 70.14805770653952 * (n0 + n1 + n2);
  }

  raw3D(x, y, z) {
    var perm = this.perm;
    var permMod12 = this.permMod12;

    var n0, n1, n2, n3; // Noise contributions from the four corners

    // Skew the input space to determine which simplex cell we're in
    var s = (x + y + z) / 3.0; // Very nice and simple skew factor for 3D
    var i = Math.floor(x + s);
    var j = Math.floor(y + s);
    var k = Math.floor(z + s);
    var t = (i + j + k) * G3;
    var X0 = i - t; // Unskew the cell origin back to (x,y,z) space
    var Y0 = j - t;
    var Z0 = k - t;
    var x0 = x - X0; // The x,y,z distances from the cell origin
    var y0 = y - Y0;
    var z0 = z - Z0;

    // For the 3D case, the simplex shape is a slightly irregular tetrahedron.
    // Determine which simplex we are in.
    var i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords
    var i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
    if (x0 >= y0) {
      if( y0 >= z0) { // X Y Z order
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      } else if (x0 >= z0) { // X Z Y order
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
      } else { // Z X Y order
        i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
      }
    } else { // x0 < y0
      if (y0 < z0) { // Z Y X order
        i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
      } else if (x0 < z0) { // Y Z X order
        i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
      } else { // Y X Z order
        i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      }
    }

    // A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
    // a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and
    // a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where
    // c = 1/6.
    var x1 = x0 - i1 + G3; // Offsets for second corner in (x,y,z) coords
    var y1 = y0 - j1 + G3;
    var z1 = z0 - k1 + G3;
    var x2 = x0 - i2 + 2.0 * G3; // Offsets for third corner in (x,y,z) coords
    var y2 = y0 - j2 + 2.0 * G3;
    var z2 = z0 - k2 + 2.0 * G3;
    var x3 = x0 - 1.0 + 3.0 * G3; // Offsets for last corner in (x,y,z) coords
    var y3 = y0 - 1.0 + 3.0 * G3;
    var z3 = z0 - 1.0 + 3.0 * G3;

    // Work out the hashed gradient indices of the four simplex corners
    var ii = i & 255;
    var jj = j & 255;
    var kk = k & 255;
    var gi0 = permMod12[ii + perm[jj + perm[kk]]];
    var gi1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]];
    var gi2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]];
    var gi3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]];

    // Calculate the contribution from the four corners
    var t0 = 0.5 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 < 0) {
      n0 = 0.0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * dot3D(GRAD3[gi0], x0, y0, z0);
    }
    var t1 = 0.5 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 < 0) {
      n1 = 0.0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * dot3D(GRAD3[gi1], x1, y1, z1);
    }
    var t2 = 0.5 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 < 0) {
      n2 = 0.0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * dot3D(GRAD3[gi2], x2, y2, z2);
    }
    var t3 = 0.5 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 < 0) {
      n3 = 0.0;
    } else {
      t3 *= t3;
      n3 = t3 * t3 * dot3D(GRAD3[gi3], x3, y3, z3);
    }

    // Add contributions from each corner to get the final noise value.
    // The result is scaled to stay just inside [-1,1]
    return 94.68493150681971 * (n0 + n1 + n2 + n3);
  }

  raw4D(x, y, z, w) {
    var perm = this.perm;
    var permMod12 = this.permMod12;

    var n0, n1, n2, n3, n4; // Noise contributions from the five corners

    // Skew the (x,y,z,w) space to determine which cell of 24 simplices we're in
    var s = (x + y + z + w) * (Math.sqrt(5.0) - 1.0) / 4.0; // Factor for 4D skewing
    var i = Math.floor(x + s);
    var j = Math.floor(y + s);
    var k = Math.floor(z + s);
    var l = Math.floor(w + s);
    var t = (i + j + k + l) * G4; // Factor for 4D unskewing
    var X0 = i - t; // Unskew the cell origin back to (x,y,z,w) space
    var Y0 = j - t;
    var Z0 = k - t;
    var W0 = l - t;
    var x0 = x - X0;  // The x,y,z,w distances from the cell origin
    var y0 = y - Y0;
    var z0 = z - Z0;
    var w0 = w - W0;

    // For the 4D case, the simplex is a 4D shape I won't even try to describe.
    // To find out which of the 24 possible simplices we're in, we need to
    // determine the magnitude ordering of x0, y0, z0 and w0.
    // Six pair-wise comparisons are performed between each possible pair
    // of the four coordinates, and the results are used to rank the numbers.
    var rankx = 0;
    var ranky = 0;
    var rankz = 0;
    var rankw = 0;
    if (x0 > y0) {
      rankx++;
    } else {
      ranky++;
    }
    if (x0 > z0) {
      rankx++;
    } else {
      rankz++;
    }
    if (x0 > w0) {
      rankx++;
    } else {
      rankw++;
    }
    if (y0 > z0) {
      ranky++;
    } else {
      rankz++;
    }
    if (y0 > w0) {
      ranky++;
    } else {
      rankw++;
    }
    if (z0 > w0) {
      rankz++;
    } else {
      rankw++;
    }
    var i1, j1, k1, l1; // The integer offsets for the second simplex corner
    var i2, j2, k2, l2; // The integer offsets for the third simplex corner
    var i3, j3, k3, l3; // The integer offsets for the fourth simplex corner

    // simplex[c] is a 4-vector with the numbers 0, 1, 2 and 3 in some order.
    // Many values of c will never occur, since e.g. x>y>z>w makes x<z, y<w and x<w
    // impossible. Only the 24 indices which have non-zero entries make any sense.
    // We use a thresholding to set the coordinates in turn from the largest magnitude.
    // Rank 3 denotes the largest coordinate.
    i1 = rankx >= 3 ? 1 : 0;
    j1 = ranky >= 3 ? 1 : 0;
    k1 = rankz >= 3 ? 1 : 0;
    l1 = rankw >= 3 ? 1 : 0;
    // Rank 2 denotes the second largest coordinate.
    i2 = rankx >= 2 ? 1 : 0;
    j2 = ranky >= 2 ? 1 : 0;
    k2 = rankz >= 2 ? 1 : 0;
    l2 = rankw >= 2 ? 1 : 0;
    // Rank 1 denotes the second smallest coordinate.
    i3 = rankx >= 1 ? 1 : 0;
    j3 = ranky >= 1 ? 1 : 0;
    k3 = rankz >= 1 ? 1 : 0;
    l3 = rankw >= 1 ? 1 : 0;

    // The fifth corner has all coordinate offsets = 1, so no need to compute that.
    var x1 = x0 - i1 + G4; // Offsets for second corner in (x,y,z,w) coords
    var y1 = y0 - j1 + G4;
    var z1 = z0 - k1 + G4;
    var w1 = w0 - l1 + G4;
    var x2 = x0 - i2 + 2.0 * G4; // Offsets for third corner in (x,y,z,w) coords
    var y2 = y0 - j2 + 2.0 * G4;
    var z2 = z0 - k2 + 2.0 * G4;
    var w2 = w0 - l2 + 2.0 * G4;
    var x3 = x0 - i3 + 3.0 * G4; // Offsets for fourth corner in (x,y,z,w) coords
    var y3 = y0 - j3 + 3.0 * G4;
    var z3 = z0 - k3 + 3.0 * G4;
    var w3 = w0 - l3 + 3.0 * G4;
    var x4 = x0 - 1.0 + 4.0 * G4; // Offsets for last corner in (x,y,z,w) coords
    var y4 = y0 - 1.0 + 4.0 * G4;
    var z4 = z0 - 1.0 + 4.0 * G4;
    var w4 = w0 - 1.0 + 4.0 * G4;

    // Work out the hashed gradient indices of the five simplex corners
    var ii = i & 255;
    var jj = j & 255;
    var kk = k & 255;
    var ll = l & 255;
    var gi0 = perm[ii + perm[jj + perm[kk + perm[ll]]]] % 32;
    var gi1 = perm[ii + i1 + perm[jj + j1 + perm[kk + k1 + perm[ll + l1]]]] % 32;
    var gi2 = perm[ii + i2 + perm[jj + j2 + perm[kk + k2 + perm[ll + l2]]]] % 32;
    var gi3 = perm[ii + i3 + perm[jj + j3 + perm[kk + k3 + perm[ll + l3]]]] % 32;
    var gi4 = perm[ii + 1 + perm[jj + 1 + perm[kk + 1 + perm[ll + 1]]]] % 32;

    // Calculate the contribution from the five corners
    var t0 = 0.5 - x0 * x0 - y0 * y0 - z0 * z0 - w0 * w0;
    if (t0 < 0) {
      n0 = 0.0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * dot4D(GRAD4[gi0], x0, y0, z0, w0);
    }
    var t1 = 0.5 - x1 * x1 - y1 * y1 - z1 * z1 - w1 * w1;
    if (t1 < 0) {
      n1 = 0.0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * dot4D(GRAD4[gi1], x1, y1, z1, w1);
    }
    var t2 = 0.5 - x2 * x2 - y2 * y2 - z2 * z2 - w2 * w2;
    if (t2 < 0) {
      n2 = 0.0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * dot4D(GRAD4[gi2], x2, y2, z2, w2);
    }
    var t3 = 0.5 - x3 * x3 - y3 * y3 - z3 * z3 - w3 * w3;
    if (t3 < 0) {
      n3 = 0.0;
    } else {
      t3 *= t3;
      n3 = t3 * t3 * dot4D(GRAD4[gi3], x3, y3, z3, w3);
    }
    var t4 = 0.5 - x4 * x4 - y4 * y4 - z4 * z4 - w4 * w4;
    if (t4 < 0) {
      n4 = 0.0;
    } else {
      t4 *= t4;
      n4 = t4 * t4 * dot4D(GRAD4[gi4], x4, y4, z4, w4);
    }

    // Sum up and scale the result to cover the range [-1,1]
    return 72.37855765153664 * (n0 + n1 + n2 + n3 + n4);
  }

  spherical2D(c, x, y) {
    var nx = x / c;
    var ny = y / c;
    var rdx = nx * 2 * Math.PI;
    var rdy = ny * Math.PI;
    var sinY = Math.sin(rdy + Math.PI);
    var sinRds = 2 * Math.PI;
    var a = sinRds * Math.sin(rdx) * sinY;
    var b = sinRds * Math.cos(rdx) * sinY;
    var d = sinRds * Math.cos(rdy);

    return this.in3D(a, b, d);
  }

  spherical3D(c, x, y, z) {
    var nx = x / c;
    var ny = y / c;
    var rdx = nx * 2 * Math.PI;
    var rdy = ny * Math.PI;
    var sinY = Math.sin(rdy + Math.PI);
    var sinRds = 2 * Math.PI;
    var a = sinRds * Math.sin(rdx) * sinY;
    var b = sinRds * Math.cos(rdx) * sinY;
    var d = sinRds * Math.cos(rdy);

    return this.in4D(a, b, d, z);
  }
}

var FastSimplexNoise_1 = FastSimplexNoise;

function dot2D(g, x, y) {
  return g[0] * x + g[1] * y;
}

function dot3D(g, x, y, z) {
  return g[0] * x + g[1] * y + g[2] * z;
}

function dot4D(g, x, y, z, w) {
  return g[0] * x + g[1] * y + g[2] * z + g[3] * w;
}

var main = createCommonjsModule(function (module) {
/*
 * A speed-improved simplex noise algorithm for 2D, 3D and 4D in JavaScript.
 *
 * Based on example code by Stefan Gustavson (stegu@itn.liu.se).
 * Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
 * Better rank ordering method by Stefan Gustavson in 2012.
 *
 * This code was placed in the public domain by its original author,
 * Stefan Gustavson. You may use it as you see fit, but
 * attribution is appreciated.
 */

// Data ------------------------------------------------------------------------

var G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
var G3 = 1.0 / 6.0;
var G4 = (5.0 - Math.sqrt(5.0)) / 20.0;

var GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, -1], [0, 1, -1], [0, -1, -1]
];

var GRAD4 = [
  [0, 1, 1, 1], [0, 1, 1, -1], [0, 1, -1, 1], [0, 1, -1, -1],
  [0, -1, 1, 1], [0, -1, 1, -1], [0, -1, -1, 1], [0, -1, -1, -1],
  [1, 0, 1, 1], [1, 0, 1, -1], [1, 0, -1, 1], [1, 0, -1, -1],
  [-1, 0, 1, 1], [-1, 0, 1, -1], [-1, 0, -1, 1], [-1, 0, -1, -1],
  [1, 1, 0, 1], [1, 1, 0, -1], [1, -1, 0, 1], [1, -1, 0, -1],
  [-1, 1, 0, 1], [-1, 1, 0, -1], [-1, -1, 0, 1], [-1, -1, 0, -1],
  [1, 1, 1, 0], [1, 1, -1, 0], [1, -1, 1, 0], [1, -1, -1, 0],
  [-1, 1, 1, 0], [-1, 1, -1, 0], [-1, -1, 1, 0], [-1, -1, -1, 0]
];

// Exports ---------------------------------------------------------------------

module.exports = FastSimplexNoise;

// Functions -------------------------------------------------------------------

function FastSimplexNoise (options) {
  if (!options) options = {};

  this.amplitude = options.amplitude || 1.0;
  this.frequency = options.frequency || 1.0;
  this.octaves = parseInt(options.octaves || 1);
  this.persistence = options.persistence || 0.5;
  this.random = options.random || Math.random;

  if (typeof options.min === 'number' && typeof options.max === 'number') {
    if (options.min >= options.max) {
      console.error('options.min must be less than options.max');
    } else {
      var min = parseFloat(options.min);
      var max = parseFloat(options.max);
      var range = max - min;
      this.scale = function (value) {
        return min + ((value + 1) / 2) * range
      };
    }
  } else {
    this.scale = function (value) {
      return value
    };
  }

  var i;
  var p = new Uint8Array(256);
  for (i = 0; i < 256; i++) {
    p[i] = i;
  }

  var n, q;
  for (i = 255; i > 0; i--) {
    n = Math.floor((i + 1) * this.random());
    q = p[i];
    p[i] = p[n];
    p[n] = q;
  }

  // To remove the need for index wrapping, double the permutation table length
  this.perm = new Uint8Array(512);
  this.permMod12 = new Uint8Array(512);
  for (i = 0; i < 512; i++) {
    this.perm[i] = p[i & 255];
    this.permMod12[i] = this.perm[i] % 12;
  }
}

FastSimplexNoise.prototype.cylindrical2D = function (c, x, y) {
  var nx = x / c;
  var r = c / (2 * Math.PI);
  var rdx = nx * 2 * Math.PI;
  var a = r * Math.sin(rdx);
  var b = r * Math.cos(rdx);

  return this.in3D(a, b, y)
};

FastSimplexNoise.prototype.cylindrical3D = function (c, x, y, z) {
  var nx = x / c;
  var r = c / (2 * Math.PI);
  var rdx = nx * 2 * Math.PI;
  var a = r * Math.sin(rdx);
  var b = r * Math.cos(rdx);

  return this.in4D(a, b, y, z)
};

FastSimplexNoise.prototype.in2D = function (x, y) {
  var amplitude = this.amplitude;
  var frequency = this.frequency;
  var maxAmplitude = 0;
  var noise = 0;
  var persistence = this.persistence;

  for (var i = 0; i < this.octaves; i++) {
    noise += this.raw2D(x * frequency, y * frequency) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  var value = noise / maxAmplitude;
  return this.scale(value)
};

FastSimplexNoise.prototype.in3D = function (x, y, z) {
  var amplitude = this.amplitude;
  var frequency = this.frequency;
  var maxAmplitude = 0;
  var noise = 0;
  var persistence = this.persistence;

  for (var i = 0; i < this.octaves; i++) {
    noise += this.raw3D(x * frequency, y * frequency, z * frequency) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  var value = noise / maxAmplitude;
  return this.scale(value)
};

FastSimplexNoise.prototype.in4D = function (x, y, z, w) {
  var amplitude = this.amplitude;
  var frequency = this.frequency;
  var maxAmplitude = 0;
  var noise = 0;
  var persistence = this.persistence;

  for (var i = 0; i < this.octaves; i++) {
    noise += this.raw4D(x * frequency, y * frequency, z * frequency, w * frequency) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  var value = noise / maxAmplitude;
  return this.scale(value)
};

FastSimplexNoise.prototype.raw2D = function (x, y) {
  var perm = this.perm;
  var permMod12 = this.permMod12;

  var n0, n1, n2; // Noise contributions from the three corners

  // Skew the input space to determine which simplex cell we're in
  var s = (x + y) * 0.5 * (Math.sqrt(3.0) - 1.0); // Hairy factor for 2D
  var i = Math.floor(x + s);
  var j = Math.floor(y + s);
  var t = (i + j) * G2;
  var X0 = i - t; // Unskew the cell origin back to (x,y) space
  var Y0 = j - t;
  var x0 = x - X0; // The x,y distances from the cell origin
  var y0 = y - Y0;

  // For the 2D case, the simplex shape is an equilateral triangle.
  // Determine which simplex we are in.
  var i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
  if (x0 > y0) { // Lower triangle, XY order: (0,0)->(1,0)->(1,1)
    i1 = 1;
    j1 = 0;
  } else { // Upper triangle, YX order: (0,0)->(0,1)->(1,1)
    i1 = 0;
    j1 = 1;
  }

  // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
  // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
  // c = (3 - sqrt(3)) / 6

  var x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
  var y1 = y0 - j1 + G2;
  var x2 = x0 - 1.0 + 2.0 * G2; // Offsets for last corner in (x,y) unskewed coords
  var y2 = y0 - 1.0 + 2.0 * G2;

  // Work out the hashed gradient indices of the three simplex corners
  var ii = i & 255;
  var jj = j & 255;
  var gi0 = permMod12[ii + perm[jj]];
  var gi1 = permMod12[ii + i1 + perm[jj + j1]];
  var gi2 = permMod12[ii + 1 + perm[jj + 1]];

  // Calculate the contribution from the three corners
  var t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 < 0) {
    n0 = 0.0;
  } else {
    t0 *= t0;
    // (x,y) of 3D gradient used for 2D gradient
    n0 = t0 * t0 * dot2D(GRAD3[gi0], x0, y0);
  }
  var t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 < 0) {
    n1 = 0.0;
  } else {
    t1 *= t1;
    n1 = t1 * t1 * dot2D(GRAD3[gi1], x1, y1);
  }
  var t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 < 0) {
    n2 = 0.0;
  } else {
    t2 *= t2;
    n2 = t2 * t2 * dot2D(GRAD3[gi2], x2, y2);
  }

  // Add contributions from each corner to get the final noise value.
  // The result is scaled to return values in the interval [-1, 1]
  return 70.14805770654148 * (n0 + n1 + n2)
};

FastSimplexNoise.prototype.raw3D = function (x, y, z) {
  var perm = this.perm;
  var permMod12 = this.permMod12;

  var n0, n1, n2, n3; // Noise contributions from the four corners

  // Skew the input space to determine which simplex cell we're in
  var s = (x + y + z) / 3.0; // Very nice and simple skew factor for 3D
  var i = Math.floor(x + s);
  var j = Math.floor(y + s);
  var k = Math.floor(z + s);
  var t = (i + j + k) * G3;
  var X0 = i - t; // Unskew the cell origin back to (x,y,z) space
  var Y0 = j - t;
  var Z0 = k - t;
  var x0 = x - X0; // The x,y,z distances from the cell origin
  var y0 = y - Y0;
  var z0 = z - Z0;

  // For the 3D case, the simplex shape is a slightly irregular tetrahedron.
  // Determine which simplex we are in.
  var i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords
  var i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
  if (x0 >= y0) {
    if (y0 >= z0) { // X Y Z order
      i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
    } else if (x0 >= z0) { // X Z Y order
      i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
    } else { // Z X Y order
      i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
    }
  } else { // x0 < y0
    if (y0 < z0) { // Z Y X order
      i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
    } else if (x0 < z0) { // Y Z X order
      i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
    } else { // Y X Z order
      i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
    }
  }

  // A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
  // a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and
  // a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where
  // c = 1/6.
  var x1 = x0 - i1 + G3; // Offsets for second corner in (x,y,z) coords
  var y1 = y0 - j1 + G3;
  var z1 = z0 - k1 + G3;
  var x2 = x0 - i2 + 2.0 * G3; // Offsets for third corner in (x,y,z) coords
  var y2 = y0 - j2 + 2.0 * G3;
  var z2 = z0 - k2 + 2.0 * G3;
  var x3 = x0 - 1.0 + 3.0 * G3; // Offsets for last corner in (x,y,z) coords
  var y3 = y0 - 1.0 + 3.0 * G3;
  var z3 = z0 - 1.0 + 3.0 * G3;

  // Work out the hashed gradient indices of the four simplex corners
  var ii = i & 255;
  var jj = j & 255;
  var kk = k & 255;
  var gi0 = permMod12[ii + perm[jj + perm[kk]]];
  var gi1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]];
  var gi2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]];
  var gi3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]];

  // Calculate the contribution from the four corners
  var t0 = 0.5 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t0 < 0) {
    n0 = 0.0;
  } else {
    t0 *= t0;
    n0 = t0 * t0 * dot3D(GRAD3[gi0], x0, y0, z0);
  }
  var t1 = 0.5 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t1 < 0) {
    n1 = 0.0;
  } else {
    t1 *= t1;
    n1 = t1 * t1 * dot3D(GRAD3[gi1], x1, y1, z1);
  }
  var t2 = 0.5 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t2 < 0) {
    n2 = 0.0;
  } else {
    t2 *= t2;
    n2 = t2 * t2 * dot3D(GRAD3[gi2], x2, y2, z2);
  }
  var t3 = 0.5 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t3 < 0) {
    n3 = 0.0;
  } else {
    t3 *= t3;
    n3 = t3 * t3 * dot3D(GRAD3[gi3], x3, y3, z3);
  }

  // Add contributions from each corner to get the final noise value.
  // The result is scaled to stay just inside [-1,1]
  return 94.68493150681972 * (n0 + n1 + n2 + n3)
};

FastSimplexNoise.prototype.raw4D = function (x, y, z, w) {
  var perm = this.perm;

  var n0, n1, n2, n3, n4; // Noise contributions from the five corners

  // Skew the (x,y,z,w) space to determine which cell of 24 simplices we're in
  var s = (x + y + z + w) * (Math.sqrt(5.0) - 1.0) / 4.0; // Factor for 4D skewing
  var i = Math.floor(x + s);
  var j = Math.floor(y + s);
  var k = Math.floor(z + s);
  var l = Math.floor(w + s);
  var t = (i + j + k + l) * G4; // Factor for 4D unskewing
  var X0 = i - t; // Unskew the cell origin back to (x,y,z,w) space
  var Y0 = j - t;
  var Z0 = k - t;
  var W0 = l - t;
  var x0 = x - X0;  // The x,y,z,w distances from the cell origin
  var y0 = y - Y0;
  var z0 = z - Z0;
  var w0 = w - W0;

  // For the 4D case, the simplex is a 4D shape I won't even try to describe.
  // To find out which of the 24 possible simplices we're in, we need to
  // determine the magnitude ordering of x0, y0, z0 and w0.
  // Six pair-wise comparisons are performed between each possible pair
  // of the four coordinates, and the results are used to rank the numbers.
  var rankx = 0;
  var ranky = 0;
  var rankz = 0;
  var rankw = 0;
  if (x0 > y0) {
    rankx++;
  } else {
    ranky++;
  }
  if (x0 > z0) {
    rankx++;
  } else {
    rankz++;
  }
  if (x0 > w0) {
    rankx++;
  } else {
    rankw++;
  }
  if (y0 > z0) {
    ranky++;
  } else {
    rankz++;
  }
  if (y0 > w0) {
    ranky++;
  } else {
    rankw++;
  }
  if (z0 > w0) {
    rankz++;
  } else {
    rankw++;
  }
  var i1, j1, k1, l1; // The integer offsets for the second simplex corner
  var i2, j2, k2, l2; // The integer offsets for the third simplex corner
  var i3, j3, k3, l3; // The integer offsets for the fourth simplex corner

  // simplex[c] is a 4-vector with the numbers 0, 1, 2 and 3 in some order.
  // Many values of c will never occur, since e.g. x>y>z>w makes x<z, y<w and x<w
  // impossible. Only the 24 indices which have non-zero entries make any sense.
  // We use a thresholding to set the coordinates in turn from the largest magnitude.
  // Rank 3 denotes the largest coordinate.
  i1 = rankx >= 3 ? 1 : 0;
  j1 = ranky >= 3 ? 1 : 0;
  k1 = rankz >= 3 ? 1 : 0;
  l1 = rankw >= 3 ? 1 : 0;
  // Rank 2 denotes the second largest coordinate.
  i2 = rankx >= 2 ? 1 : 0;
  j2 = ranky >= 2 ? 1 : 0;
  k2 = rankz >= 2 ? 1 : 0;
  l2 = rankw >= 2 ? 1 : 0;
  // Rank 1 denotes the second smallest coordinate.
  i3 = rankx >= 1 ? 1 : 0;
  j3 = ranky >= 1 ? 1 : 0;
  k3 = rankz >= 1 ? 1 : 0;
  l3 = rankw >= 1 ? 1 : 0;

  // The fifth corner has all coordinate offsets = 1, so no need to compute that.
  var x1 = x0 - i1 + G4; // Offsets for second corner in (x,y,z,w) coords
  var y1 = y0 - j1 + G4;
  var z1 = z0 - k1 + G4;
  var w1 = w0 - l1 + G4;
  var x2 = x0 - i2 + 2.0 * G4; // Offsets for third corner in (x,y,z,w) coords
  var y2 = y0 - j2 + 2.0 * G4;
  var z2 = z0 - k2 + 2.0 * G4;
  var w2 = w0 - l2 + 2.0 * G4;
  var x3 = x0 - i3 + 3.0 * G4; // Offsets for fourth corner in (x,y,z,w) coords
  var y3 = y0 - j3 + 3.0 * G4;
  var z3 = z0 - k3 + 3.0 * G4;
  var w3 = w0 - l3 + 3.0 * G4;
  var x4 = x0 - 1.0 + 4.0 * G4; // Offsets for last corner in (x,y,z,w) coords
  var y4 = y0 - 1.0 + 4.0 * G4;
  var z4 = z0 - 1.0 + 4.0 * G4;
  var w4 = w0 - 1.0 + 4.0 * G4;

  // Work out the hashed gradient indices of the five simplex corners
  var ii = i & 255;
  var jj = j & 255;
  var kk = k & 255;
  var ll = l & 255;
  var gi0 = perm[ii + perm[jj + perm[kk + perm[ll]]]] % 32;
  var gi1 = perm[ii + i1 + perm[jj + j1 + perm[kk + k1 + perm[ll + l1]]]] % 32;
  var gi2 = perm[ii + i2 + perm[jj + j2 + perm[kk + k2 + perm[ll + l2]]]] % 32;
  var gi3 = perm[ii + i3 + perm[jj + j3 + perm[kk + k3 + perm[ll + l3]]]] % 32;
  var gi4 = perm[ii + 1 + perm[jj + 1 + perm[kk + 1 + perm[ll + 1]]]] % 32;

  // Calculate the contribution from the five corners
  var t0 = 0.5 - x0 * x0 - y0 * y0 - z0 * z0 - w0 * w0;
  if (t0 < 0) {
    n0 = 0.0;
  } else {
    t0 *= t0;
    n0 = t0 * t0 * dot4D(GRAD4[gi0], x0, y0, z0, w0);
  }
  var t1 = 0.5 - x1 * x1 - y1 * y1 - z1 * z1 - w1 * w1;
  if (t1 < 0) {
    n1 = 0.0;
  } else {
    t1 *= t1;
    n1 = t1 * t1 * dot4D(GRAD4[gi1], x1, y1, z1, w1);
  }
  var t2 = 0.5 - x2 * x2 - y2 * y2 - z2 * z2 - w2 * w2;
  if (t2 < 0) {
    n2 = 0.0;
  } else {
    t2 *= t2;
    n2 = t2 * t2 * dot4D(GRAD4[gi2], x2, y2, z2, w2);
  }
  var t3 = 0.5 - x3 * x3 - y3 * y3 - z3 * z3 - w3 * w3;
  if (t3 < 0) {
    n3 = 0.0;
  } else {
    t3 *= t3;
    n3 = t3 * t3 * dot4D(GRAD4[gi3], x3, y3, z3, w3);
  }
  var t4 = 0.5 - x4 * x4 - y4 * y4 - z4 * z4 - w4 * w4;
  if (t4 < 0) {
    n4 = 0.0;
  } else {
    t4 *= t4;
    n4 = t4 * t4 * dot4D(GRAD4[gi4], x4, y4, z4, w4);
  }

  // Sum up and scale the result to cover the range [-1,1]
  return 72.37857097679466 * (n0 + n1 + n2 + n3 + n4)
};

FastSimplexNoise.prototype.spherical2D = function (c, x, y) {
  var nx = x / c;
  var ny = y / c;
  var rdx = nx * 2 * Math.PI;
  var rdy = ny * Math.PI;
  var sinY = Math.sin(rdy + Math.PI);
  var sinRds = 2 * Math.PI;
  var a = sinRds * Math.sin(rdx) * sinY;
  var b = sinRds * Math.cos(rdx) * sinY;
  var d = sinRds * Math.cos(rdy);

  return this.in3D(a, b, d)
};

FastSimplexNoise.prototype.spherical3D = function (c, x, y, z) {
  var nx = x / c;
  var ny = y / c;
  var rdx = nx * 2 * Math.PI;
  var rdy = ny * Math.PI;
  var sinY = Math.sin(rdy + Math.PI);
  var sinRds = 2 * Math.PI;
  var a = sinRds * Math.sin(rdx) * sinY;
  var b = sinRds * Math.cos(rdx) * sinY;
  var d = sinRds * Math.cos(rdy);

  return this.in4D(a, b, d, z)
};

function dot2D (g, x, y) {
  return g[0] * x + g[1] * y
}

function dot3D (g, x, y, z) {
  return g[0] * x + g[1] * y + g[2] * z
}

function dot4D (g, x, y, z, w) {
  return g[0] * x + g[1] * y + g[2] * z + g[3] * w
}
});

var constants = createCommonjsModule(function (module) {
(function() {
"use strict";

const api = {
  SEED: 'seed',
  BUCKETS: 256,
  SAMPLE_SCALE: 1e6,
  SAMPLE_SIZE: 1e8,
  MIN_PRECOMPUTED_OCTAVES: 1,
  MAX_PRECOMPUTED_OCTAVES: 8,
};

module.exports = api;

})();
});

var histogram = createCommonjsModule(function (module) {
(function() {
"use strict";

const constants$$1 = constants;
const BUCKETS = constants$$1.BUCKETS;

function Histogram() {
  this._buckets = (() => {
    const buckets = Array(BUCKETS);
    for (let i = 0, l = buckets.length; i < l; i++) {
      buckets[i] = 0;
    }
    return buckets;
  })();
}
Histogram.prototype = {
  getBucket: function(v) {
    return v * this._buckets.length;
  },
  getBucketIndex: function(v) {
    return Math.floor(this.getBucket(v));
  },
  getBucketResidual: function(v) {
    return this.getBucket(v) % 1;
  },
  add: function(v) {
    const bucketIndex = this.getBucketIndex(v);
    this._buckets[bucketIndex]++;
  },
  total: function() {
    let result = 0;
    for (let i = 0, l = this._buckets.length; i < l; i++) {
      const bucketValue = this._buckets[i];
      result += bucketValue;
    }
    return result;
  },
  normalize: function() {
    const total = this.total();
    this._buckets = this._buckets.map(bucketValue => bucketValue / total);
  },
  makeScaler: function() {
    const cumulativeBuckets = (() => {
      let acc = 0;
      return this._buckets.map(bucketValue => {
        const result = acc;
        acc += bucketValue;
        return result;
      });
    })();
    const cdf = v => {
      const bucketIndex = this.getBucketIndex(v);
      const left = cumulativeBuckets[bucketIndex];
      const right = (bucketIndex < (cumulativeBuckets.length - 1)) ? cumulativeBuckets[bucketIndex + 1] : 1;
      const bucketResidual = this.getBucketResidual(v);
      return left + (bucketResidual * (right - left));
    };
    return cdf;
  },
  save: function() {
    return this._buckets;
  },
};
Histogram.load = histogramJson => {
  const histogram = new Histogram();
  histogram._buckets = histogramJson;
  return histogram;
};

module.exports = Histogram;

})();
});

var histograms = {
	"1": [0.0001306,0.0000898,0.00007895,0.00007394,0.00006954,0.00006641,0.00006386,0.00008072,0.00029,0.00035549,0.00057989,0.00083801,0.001028,0.00119114,0.00127889,0.00134303,0.00137894,0.00141358,0.00138306,0.00137754,0.00138506,0.00138553,0.00139053,0.00140721,0.00142228,0.00143089,0.0014499,0.00147103,0.00148538,0.00150995,0.0015269,0.00155552,0.00158491,0.00161095,0.00165024,0.00167398,0.00171336,0.0017264,0.00173757,0.00174348,0.00320094,0.00303405,0.00284217,0.00303404,0.00359309,0.00386969,0.00434526,0.00497348,0.00541169,0.00546435,0.00528075,0.0052315,0.00522403,0.00526704,0.005328,0.00542698,0.00562643,0.00559921,0.00549095,0.00542808,0.00543149,0.0054744,0.00555217,0.00574505,0.00575393,0.00558808,0.00552446,0.00555726,0.00555297,0.00550701,0.00548649,0.00547586,0.0055118,0.00568249,0.00573428,0.0056219,0.00566217,0.00554378,0.00541329,0.00532515,0.00527838,0.00522918,0.00519918,0.0051914,0.00519254,0.00515695,0.0051654,0.00516004,0.0051811,0.00519451,0.00522026,0.0052702,0.00526775,0.00528457,0.0052504,0.00522185,0.00524056,0.00528908,0.00522002,0.00520665,0.00522835,0.00524558,0.00529738,0.00540441,0.00554619,0.00541757,0.00539066,0.00539057,0.00541434,0.00539999,0.00545351,0.00548772,0.00541949,0.00539437,0.00534706,0.00534585,0.00528704,0.00526301,0.00522582,0.00515763,0.00512342,0.0050859,0.00508026,0.00508666,0.00507709,0.0050846,0.00512135,0.00521928,0.00518424,0.00511428,0.0050775,0.00506236,0.00504992,0.00506018,0.00507056,0.00508883,0.00512079,0.00516423,0.00523824,0.00527239,0.00530538,0.00529389,0.00532893,0.00537788,0.00542416,0.00538392,0.00535842,0.00536618,0.00533748,0.00531427,0.0053478,0.00545898,0.00531847,0.00523367,0.00518912,0.00517269,0.00516728,0.0051748,0.00524268,0.00519205,0.00519222,0.00522288,0.00523646,0.00520978,0.00521268,0.00516796,0.00512041,0.00509912,0.00509269,0.00510029,0.00509842,0.00513013,0.00513536,0.00514161,0.00517239,0.00521787,0.00524716,0.00532116,0.00545876,0.00550907,0.00548002,0.00558586,0.00557916,0.00544273,0.00535224,0.00536725,0.00538218,0.00543219,0.0054715,0.00545733,0.00551788,0.0056927,0.00568845,0.0055098,0.00543545,0.00540202,0.00540204,0.00545649,0.00558519,0.00560111,0.0054254,0.00532783,0.00527297,0.00526083,0.00526678,0.00534719,0.00557141,0.00548611,0.00512312,0.0044713,0.00390936,0.00366293,0.00311265,0.00283029,0.00300636,0.00317214,0.00179344,0.00178693,0.00178658,0.00176606,0.00172478,0.00169737,0.00166828,0.00163708,0.0016026,0.00158228,0.00154802,0.00152037,0.0014994,0.00147611,0.00145841,0.00144775,0.00143399,0.00142509,0.00140575,0.00140465,0.00140383,0.00141461,0.00145522,0.0014182,0.00137471,0.00131036,0.00121347,0.00103201,0.00085107,0.00061119,0.00040376,0.00029769,0.00008421,0.00006906,0.00006953,0.00007184,0.00007758,0.00008064,0.00009285,0.00013364],
	"2": [0,0,1.3e-7,5.5e-7,0.00000105,0.00000316,0.00000331,0.00000416,0.0000071,0.00000917,0.00001075,0.000014,0.00001757,0.00001793,0.00002238,0.00002816,0.00003498,0.0000415,0.00005087,0.00007327,0.00009078,0.00010628,0.00012476,0.00013748,0.00016836,0.00021655,0.00026575,0.00032009,0.00036228,0.00040693,0.00045225,0.00049656,0.00053577,0.0005658,0.00060334,0.00064326,0.00070934,0.00078978,0.00086855,0.00092174,0.00098429,0.00104623,0.00110571,0.00118711,0.00132271,0.00145956,0.00157723,0.00170428,0.00183953,0.0019654,0.00215092,0.00232744,0.00255259,0.00275258,0.00289396,0.00304314,0.00311912,0.00325476,0.003362,0.00345209,0.00353564,0.00359709,0.00366173,0.00373846,0.00382994,0.00398655,0.00409053,0.0041866,0.00432732,0.0044588,0.00458036,0.00471533,0.004856,0.00507544,0.00525063,0.00536753,0.00551619,0.00568169,0.00582296,0.00593161,0.00600657,0.00607057,0.00610307,0.00619427,0.00626806,0.00633573,0.0063932,0.00646103,0.00653242,0.00660677,0.00669889,0.00670999,0.00672276,0.00677489,0.00684757,0.00693005,0.00703217,0.00728171,0.00748628,0.00749687,0.00751552,0.00760362,0.00763534,0.00775047,0.00777975,0.00785471,0.00792291,0.00793213,0.00800861,0.00800828,0.00798419,0.00794441,0.00792392,0.00797065,0.00788651,0.00785739,0.00779625,0.00775422,0.00776958,0.00780902,0.00783261,0.00791402,0.00798904,0.00806399,0.00817207,0.00830906,0.00852712,0.00937116,0.00938155,0.00854975,0.00832309,0.00818457,0.00808776,0.00801693,0.00790953,0.00787297,0.00784589,0.00781632,0.00779055,0.00782624,0.0078932,0.00790455,0.0079647,0.00791222,0.00791575,0.00797009,0.0079699,0.00793562,0.00789452,0.00787443,0.00782177,0.00774319,0.00772237,0.00760349,0.00754878,0.00746761,0.00739112,0.00735655,0.00718749,0.00699541,0.00686855,0.00679588,0.00675055,0.00673209,0.00670843,0.00668137,0.00659705,0.00649877,0.00646578,0.00639814,0.00634019,0.0062668,0.0061678,0.00607951,0.00602735,0.00598316,0.00591627,0.00581716,0.00565282,0.00545448,0.00532869,0.00519864,0.00503313,0.00481908,0.0046918,0.00453996,0.0044275,0.00431077,0.00417614,0.00408797,0.00400001,0.00382152,0.00373617,0.00367403,0.00359386,0.00353542,0.00347043,0.00338202,0.00327392,0.00312685,0.00304463,0.00288802,0.00274064,0.00254836,0.00234748,0.00219491,0.00200734,0.00189637,0.00174186,0.00161232,0.00150496,0.00135954,0.00122105,0.00113816,0.00107566,0.00100896,0.0009403,0.00087868,0.00079591,0.00072061,0.00064862,0.00060041,0.00056827,0.00053851,0.0004954,0.0004558,0.00041104,0.00036154,0.00031923,0.00027258,0.00022537,0.00018288,0.00014782,0.00013283,0.00011694,0.00010016,0.00008191,0.00005686,0.00004568,0.00003905,0.00003184,0.00002407,0.00001939,0.0000179,0.00001495,0.00001131,0.00000945,0.00000729,0.0000039,0.00000373,0.0000031,0.00000157,4.8e-7,2.3e-7,0,0],
	"3": [0,0,0,0,6e-8,4e-8,7e-8,4e-8,8e-8,3.4e-7,4.4e-7,5.5e-7,6.6e-7,0.00000115,0.00000153,0.00000254,0.0000036,0.00000446,0.0000057,0.00000783,0.00000922,0.0000137,0.00001639,0.00002191,0.00002765,0.00003466,0.00004329,0.00005401,0.00006682,0.00008296,0.00009498,0.0001151,0.00013548,0.00015997,0.00018888,0.0002195,0.00025111,0.00028539,0.00031768,0.00035611,0.00040055,0.00044633,0.00051024,0.00056928,0.00063536,0.00070667,0.00077792,0.00085442,0.00095246,0.00104727,0.00115294,0.00126162,0.00138662,0.00150004,0.00161814,0.00175723,0.00189102,0.00203182,0.00218739,0.00232067,0.00246363,0.00258998,0.00273212,0.00287743,0.00305446,0.00322101,0.00340272,0.0035726,0.00374159,0.00389624,0.00408003,0.00427491,0.00446199,0.00463942,0.00480972,0.00496558,0.00512827,0.00530196,0.00545459,0.00559231,0.00570497,0.00585452,0.0059855,0.00611242,0.00628653,0.00640725,0.00655295,0.00667387,0.00683005,0.00700193,0.00716614,0.00733742,0.00744514,0.00759811,0.00771207,0.00782428,0.00794099,0.00798766,0.00808548,0.00814746,0.00822779,0.008289,0.00837494,0.00840412,0.0084854,0.00853775,0.00863433,0.00871501,0.00878202,0.00885715,0.0089286,0.00898499,0.00905446,0.00913207,0.00920859,0.009266,0.00935794,0.00940763,0.00943656,0.00943003,0.00943389,0.009424,0.00946358,0.00944114,0.00942995,0.00944146,0.00942125,0.00953934,0.00952403,0.00942394,0.0094158,0.00942314,0.00944133,0.00943227,0.00941281,0.00939978,0.00941054,0.00940726,0.00937243,0.00931403,0.00921478,0.00916562,0.00909147,0.00903298,0.00894979,0.00889659,0.00880343,0.0087268,0.00867898,0.00859177,0.00854252,0.00845117,0.00839106,0.00834852,0.0082578,0.00817018,0.00810462,0.00801847,0.00794616,0.00785625,0.00776422,0.00764002,0.00753266,0.00737915,0.00728533,0.00710218,0.00696273,0.00677915,0.00664565,0.00652346,0.00637248,0.00625917,0.00611896,0.00596188,0.00584435,0.0056936,0.00555752,0.00544304,0.00530172,0.00510996,0.00496284,0.00480555,0.00465218,0.00445638,0.00428392,0.00410301,0.00390601,0.0037409,0.00356823,0.00340792,0.00323782,0.00308543,0.0028859,0.00273609,0.00259702,0.00246852,0.00233691,0.00218572,0.00204845,0.00190875,0.00177927,0.0016474,0.0015248,0.00141254,0.00129126,0.00118764,0.00107044,0.00097727,0.00088482,0.00079723,0.00073197,0.00065469,0.00058377,0.0005255,0.00046352,0.00041559,0.0003711,0.00033125,0.0002941,0.00025881,0.00022651,0.00019692,0.00016913,0.00014301,0.00012064,0.00010185,0.00008484,0.00007002,0.00005512,0.00004322,0.0000337,0.00002746,0.00002135,0.00001808,0.00001469,0.00001076,0.00000801,0.00000593,0.00000478,0.00000409,0.00000277,0.00000196,0.00000142,9.9e-7,6.6e-7,5.1e-7,4.4e-7,2.5e-7,2.6e-7,1.7e-7,1e-7,5e-8,4e-8,2e-8,0,0],
	"4": [0,0,0,0,0,0,0,0,4e-8,5e-8,2e-8,8e-8,1e-7,1.5e-7,2.9e-7,3.6e-7,6.1e-7,7.8e-7,0.00000108,0.0000015,0.00000231,0.00000306,0.00000388,0.00000525,0.00000706,0.0000093,0.00001248,0.00001596,0.00002075,0.00002668,0.00003375,0.00004203,0.00005121,0.00006276,0.00007726,0.00009341,0.00011377,0.00013293,0.00015961,0.00018706,0.00021416,0.00025056,0.0002877,0.00032642,0.00037263,0.00042351,0.00047892,0.00054062,0.0006127,0.00068012,0.00075987,0.00084681,0.00094189,0.00104333,0.00115192,0.00126569,0.0013961,0.00152958,0.00166007,0.00179784,0.00194026,0.00208914,0.00223941,0.00240259,0.00256407,0.00273332,0.00291162,0.00308577,0.00327434,0.00346632,0.00362933,0.00383017,0.00402153,0.00421835,0.00441596,0.00463351,0.00481298,0.00502413,0.00519927,0.00537571,0.0055705,0.00573052,0.00591099,0.00608213,0.00624615,0.00640964,0.00658499,0.00674718,0.0069291,0.00707405,0.00724339,0.00739347,0.00754622,0.00772132,0.00787829,0.00800237,0.00814664,0.00827961,0.00838244,0.00850015,0.00861167,0.00870988,0.00879885,0.00888454,0.00896078,0.00904894,0.00913618,0.00921357,0.00929147,0.0093825,0.00946777,0.00956069,0.00963425,0.00970613,0.00976181,0.00983384,0.00988033,0.00992413,0.00998484,0.01000464,0.01003105,0.01005997,0.0100946,0.01010629,0.0101048,0.01011924,0.01015376,0.01020762,0.0102015,0.01014039,0.01010122,0.01007261,0.01008039,0.01004818,0.01004379,0.01002938,0.00997718,0.00995954,0.00987129,0.00984426,0.00980204,0.00973858,0.00966468,0.00959754,0.00952073,0.00942117,0.00932494,0.00927419,0.00916228,0.00908209,0.00900558,0.00890582,0.00882785,0.00875367,0.00865529,0.00854511,0.00844409,0.00835607,0.00824105,0.00810609,0.00795998,0.00781211,0.00767559,0.0075045,0.00735514,0.00719726,0.00702489,0.00687536,0.00672023,0.00655476,0.00638736,0.00622347,0.0060562,0.00588407,0.00572816,0.00554162,0.00536348,0.00518856,0.00501415,0.00480544,0.00461978,0.00443144,0.00422635,0.0040224,0.00383781,0.00364978,0.00346783,0.00327916,0.00310716,0.00293146,0.00275102,0.00258046,0.00242355,0.00226017,0.00211965,0.00196417,0.00181936,0.00168398,0.00155119,0.00141395,0.00129215,0.00117722,0.00106608,0.00096947,0.00086859,0.00078409,0.00070535,0.00063302,0.00056127,0.00049908,0.00044279,0.00038955,0.00033919,0.00029384,0.00026005,0.00022689,0.00019356,0.00016493,0.00014136,0.00011732,0.00009741,0.00008076,0.00006551,0.00005478,0.00004474,0.00003525,0.0000281,0.00002124,0.00001611,0.0000118,0.00000973,0.00000788,0.00000596,0.00000436,0.00000358,0.00000246,0.00000143,0.0000012,9.6e-7,6.2e-7,4.2e-7,4e-7,2.9e-7,1.6e-7,9e-8,7e-8,4e-8,7e-8,1e-8,5e-8,2e-8,0,1e-8,1e-8,0,0],
	"5": [0,0,0,0,0,0,0,0,0,1e-8,1e-8,1e-8,2e-8,7e-8,8e-8,1.6e-7,2e-7,1.8e-7,4e-7,5.9e-7,8.6e-7,0.0000011,0.00000168,0.00000222,0.00000284,0.00000436,0.0000058,0.00000733,0.00000974,0.00001317,0.00001758,0.00002268,0.0000275,0.00003654,0.00004409,0.00005636,0.00006873,0.00008405,0.00010133,0.00012217,0.00014565,0.0001731,0.00020244,0.00023493,0.00027261,0.00031238,0.00035988,0.00041193,0.00046698,0.00052906,0.00059839,0.00066974,0.00075357,0.00084094,0.00094732,0.00104582,0.00116027,0.00128165,0.0014091,0.00154858,0.00168763,0.00183606,0.00199258,0.00214717,0.00230913,0.00247849,0.00265323,0.00283805,0.00301433,0.00321417,0.00339256,0.00358331,0.00379304,0.00401167,0.00420511,0.00441994,0.0046237,0.00483549,0.0050479,0.00524651,0.00543693,0.00564412,0.00583157,0.00602022,0.00620475,0.00638162,0.00655844,0.00674401,0.00690526,0.00710734,0.0072472,0.00743539,0.00761327,0.00776695,0.00796118,0.0081023,0.00826275,0.00840739,0.00853452,0.00865776,0.00877526,0.00888485,0.0089782,0.00910165,0.00921501,0.00931159,0.00937634,0.00946175,0.00955216,0.00963998,0.00973505,0.00982959,0.00990669,0.00996427,0.01004215,0.01013039,0.01016973,0.0102427,0.01025993,0.01033272,0.01036311,0.01039256,0.01039641,0.01043715,0.01045666,0.01047477,0.01048793,0.01049638,0.01049327,0.01047453,0.01047618,0.01044142,0.01040289,0.010376,0.01034999,0.01032128,0.01028754,0.01025239,0.01018556,0.01015631,0.01008765,0.01002048,0.0099337,0.00984959,0.00979288,0.00967507,0.00959754,0.00951088,0.00941784,0.00932405,0.00923543,0.00912957,0.0090347,0.0089483,0.00886893,0.00872835,0.0086127,0.00847345,0.00835997,0.00820952,0.00806512,0.00789194,0.00774646,0.0075586,0.0074007,0.00720972,0.00705607,0.00688201,0.00670794,0.00652392,0.00636666,0.00617581,0.00598966,0.00582562,0.0056234,0.00542906,0.00524381,0.00504902,0.00483148,0.00461985,0.00441859,0.00421313,0.00399611,0.00379749,0.00360748,0.00341531,0.0032185,0.00303496,0.00284614,0.00267338,0.00250764,0.00234139,0.00216772,0.00200925,0.00186006,0.00170214,0.00156739,0.0014353,0.0013057,0.00118893,0.00107315,0.00096415,0.00086618,0.00078297,0.00069836,0.00062007,0.00055311,0.00048521,0.00042701,0.00037451,0.00032464,0.0002859,0.00024454,0.00020955,0.00017793,0.00015385,0.00012759,0.00010905,0.00008672,0.00007107,0.00005881,0.00004576,0.00003887,0.00003008,0.00002322,0.00001794,0.00001363,0.00001005,0.00000779,0.00000624,0.0000046,0.0000033,0.0000024,0.00000175,0.00000121,9.3e-7,6.7e-7,4.5e-7,2.8e-7,2.6e-7,1.7e-7,1.4e-7,3e-8,1e-7,6e-8,4e-8,2e-8,0,0,0,0,0,0,0,0,0],
	"6": [0,0,0,0,0,0,0,0,0,0,0,2e-8,2e-8,2e-8,2e-8,5e-8,8e-8,2e-7,1.8e-7,2.7e-7,5.2e-7,6.2e-7,9.6e-7,0.00000141,0.00000187,0.00000267,0.00000352,0.00000498,0.00000636,0.00000916,0.00001184,0.00001505,0.00002026,0.00002529,0.00003362,0.00004102,0.00005196,0.00006535,0.00008079,0.00009622,0.00011583,0.00014113,0.00016558,0.00019409,0.00022879,0.0002639,0.00030641,0.00035352,0.00040405,0.00045963,0.00052761,0.00059344,0.0006674,0.00074751,0.00084544,0.00094488,0.00104529,0.00116912,0.00128879,0.00142654,0.00156194,0.0017053,0.00186567,0.00201986,0.00217898,0.00234813,0.00251898,0.00270267,0.00289331,0.00308146,0.00326118,0.00347653,0.00367381,0.00388191,0.00409466,0.00430531,0.00452591,0.00474712,0.00495416,0.0051736,0.00537724,0.00558393,0.00577124,0.00598414,0.00615674,0.00636543,0.00654325,0.00673492,0.00690874,0.00709581,0.00728181,0.00744859,0.00761271,0.00781028,0.00798463,0.00816013,0.00831585,0.00846809,0.00858772,0.00875221,0.00887052,0.0089723,0.00907913,0.00919696,0.0093217,0.00941369,0.00950204,0.00958447,0.00968552,0.00978174,0.00986147,0.00995195,0.01004252,0.01013095,0.01017505,0.01026905,0.01033683,0.0103717,0.01042799,0.01047773,0.01052614,0.01055485,0.01057694,0.01058613,0.01064043,0.01064395,0.01063771,0.01068883,0.01065141,0.0106285,0.01062763,0.01062667,0.0105669,0.01053738,0.01050354,0.01049302,0.01044166,0.01040077,0.01035613,0.01029343,0.01024941,0.01015112,0.01007673,0.00999605,0.00990762,0.00981514,0.00972669,0.00962487,0.00952455,0.00945456,0.00935036,0.00924059,0.00914818,0.00904784,0.00894585,0.00882491,0.00867674,0.00856705,0.00840399,0.00826297,0.00809158,0.0079435,0.00775817,0.0075917,0.00741063,0.0072315,0.00707297,0.00688209,0.00668672,0.00652468,0.00631709,0.00615685,0.00596074,0.00576293,0.00557889,0.00537631,0.00516221,0.00494917,0.0047325,0.00452046,0.00430874,0.00410582,0.00388633,0.00368024,0.00348449,0.00329056,0.00309429,0.00290772,0.00272022,0.00255427,0.00237483,0.00220046,0.00203841,0.00188347,0.00172412,0.00158233,0.00144368,0.00132204,0.00119238,0.00107422,0.00096841,0.0008668,0.00077847,0.00069662,0.00061381,0.00054783,0.00047982,0.00041704,0.00036738,0.00032431,0.00027593,0.00023606,0.00020173,0.00017257,0.00014774,0.00012245,0.00010109,0.00008343,0.0000663,0.00005468,0.00004346,0.00003473,0.00002696,0.00002104,0.00001609,0.00001237,0.00000948,0.00000692,0.00000534,0.00000416,0.00000289,0.00000192,0.00000142,0.000001,8.1e-7,6e-7,4e-7,2e-7,1.9e-7,1.4e-7,1e-7,7e-8,8e-8,4e-8,3e-8,0,0,0,0,0,0,0,0,0,0,0],
	"7": [0,0,0,0,0,0,0,0,0,0,0,0,2e-8,1e-8,1e-8,3e-8,5e-8,1.2e-7,1.9e-7,2.2e-7,2.7e-7,5.6e-7,6.4e-7,0.00000108,0.00000144,0.00000209,0.00000282,0.00000389,0.00000537,0.00000722,0.00000939,0.00001269,0.0000166,0.00002163,0.00002817,0.00003587,0.00004353,0.00005637,0.00007015,0.00008602,0.00010237,0.00012648,0.00014815,0.0001769,0.00020837,0.00024123,0.00028239,0.00032659,0.00037606,0.00042752,0.00049031,0.00055684,0.00062857,0.00070638,0.00079481,0.00089422,0.00099066,0.00111093,0.00123255,0.00136266,0.00149898,0.00164851,0.00179609,0.00195448,0.00211425,0.00228119,0.00245216,0.00263988,0.0028229,0.00301564,0.0032003,0.00341183,0.00361519,0.00382352,0.0040353,0.00425471,0.00446761,0.00469736,0.00490855,0.00512331,0.00535274,0.00555018,0.00574688,0.00595511,0.0061454,0.00635257,0.0065448,0.00671134,0.00690715,0.00709151,0.00728164,0.00746644,0.0076308,0.00781233,0.00799942,0.00817938,0.0083396,0.00849981,0.00863175,0.00878279,0.00890921,0.00901783,0.00913799,0.00924815,0.00936419,0.0094761,0.00956709,0.00964771,0.00974479,0.00984643,0.00992701,0.01001673,0.01011542,0.01019721,0.01025217,0.01034905,0.01040195,0.01045134,0.01050364,0.01055783,0.0106047,0.01063136,0.01066886,0.01066724,0.01071606,0.01074038,0.01073686,0.01075404,0.01073755,0.01072239,0.01071371,0.0106918,0.01065245,0.01062367,0.01059813,0.01055734,0.01052794,0.01047222,0.01043649,0.01037399,0.01030145,0.01023457,0.01014434,0.01005889,0.00997158,0.00988334,0.00979709,0.0096783,0.00959026,0.00951427,0.00940214,0.00930803,0.00919442,0.00909909,0.00899065,0.00885614,0.00873237,0.00859046,0.00842937,0.00829403,0.00812157,0.00794953,0.00778585,0.00760027,0.00741235,0.00724329,0.00706302,0.00687254,0.00668725,0.00651426,0.00630392,0.0061383,0.00594488,0.00573801,0.00554387,0.00534016,0.00512552,0.00489653,0.00468342,0.0044728,0.00426103,0.00403714,0.00382789,0.00363302,0.00341679,0.00322246,0.00303709,0.00284009,0.00265849,0.00248798,0.00230883,0.00213712,0.00197208,0.00181419,0.00166356,0.00151956,0.00138928,0.00125973,0.0011322,0.00102393,0.00091579,0.00082056,0.00073766,0.00065285,0.00057741,0.00050846,0.00044551,0.0003886,0.00034244,0.00029602,0.00025182,0.00021343,0.00018474,0.00015488,0.00013259,0.00010894,0.00008868,0.00007262,0.00005784,0.00004696,0.00003733,0.00002942,0.00002208,0.00001794,0.00001332,0.00001017,0.0000075,0.00000602,0.00000406,0.00000328,0.00000227,0.00000142,0.00000112,8.5e-7,6e-7,4.1e-7,2.5e-7,2.3e-7,1.2e-7,1e-7,1e-7,5e-8,6e-8,4e-8,1e-8,0,0,0,0,0,0,0,0,0,0,0],
	"8": [0,0,0,0,0,0,0,0,0,0,0,0,1e-8,1e-8,2e-8,2e-8,4e-8,1.2e-7,1.1e-7,2.1e-7,2.7e-7,4.2e-7,6.3e-7,8.5e-7,0.0000013,0.00000178,0.00000258,0.00000342,0.00000494,0.00000605,0.00000881,0.00001162,0.0000147,0.00001981,0.00002589,0.0000328,0.00004086,0.00005225,0.0000651,0.00008116,0.00009714,0.00011755,0.00014195,0.00016765,0.00019817,0.00023071,0.00027066,0.00031289,0.00036174,0.00041249,0.00047051,0.00054079,0.00060741,0.00068597,0.00077319,0.00086669,0.0009692,0.00107764,0.00120295,0.00133432,0.00146825,0.00161462,0.00176252,0.0019274,0.00207599,0.00224998,0.00242474,0.00260054,0.0027863,0.00299306,0.00317057,0.00337171,0.00358499,0.00379491,0.00400737,0.00422044,0.00444255,0.00467245,0.00488747,0.00509833,0.00532765,0.00553911,0.00573954,0.00593601,0.00614382,0.00633677,0.00653922,0.00671058,0.00690637,0.00709265,0.00728366,0.0074617,0.00763991,0.00781913,0.00801392,0.00818832,0.00834561,0.00851269,0.00866093,0.0087929,0.00893269,0.00904273,0.00915793,0.00927672,0.00939528,0.00950494,0.00958937,0.0096793,0.0097753,0.0098789,0.00996023,0.01005391,0.01014546,0.01023266,0.01029025,0.0103794,0.01044264,0.01049716,0.01054509,0.01058505,0.01065271,0.01067454,0.01070824,0.01071376,0.0107481,0.01077864,0.01078688,0.01079662,0.01077225,0.01077196,0.01075362,0.01073486,0.01068759,0.01067431,0.01063119,0.01060292,0.01056877,0.01051483,0.01047065,0.01040839,0.01034165,0.01027204,0.01017964,0.01009109,0.0100047,0.00991619,0.00982665,0.00970846,0.00962257,0.00955022,0.0094247,0.00933297,0.00922289,0.00912844,0.00900311,0.00888207,0.00874759,0.0086139,0.00844496,0.00829429,0.00813681,0.0079613,0.00779268,0.00760038,0.00742538,0.007236,0.00706195,0.0068735,0.00669109,0.00650171,0.00630441,0.00611939,0.00593837,0.00572539,0.0055295,0.00532368,0.00509784,0.00487017,0.00466318,0.00444511,0.00423631,0.00400666,0.00380101,0.00359988,0.00338014,0.00320108,0.00300004,0.00281062,0.0026303,0.00245256,0.00227342,0.00209948,0.00194211,0.00178361,0.00162839,0.00149333,0.00136024,0.00122989,0.00110248,0.00099612,0.00088899,0.00080295,0.00071436,0.00063419,0.0005563,0.00049167,0.0004287,0.00037603,0.00032955,0.00028119,0.00023983,0.00020477,0.0001763,0.0001461,0.00012589,0.00010156,0.00008223,0.00006705,0.0000551,0.00004386,0.00003398,0.0000263,0.00002059,0.0000163,0.00001235,0.00000879,0.00000705,0.00000517,0.00000389,0.00000275,0.0000019,0.00000128,0.00000109,7.3e-7,4.7e-7,3.7e-7,2.2e-7,1.7e-7,1.3e-7,7e-8,9e-8,7e-8,3e-8,3e-8,0,0,0,0,0,0,0,0,0,0,0,0]
};

var histograms$1 = Object.freeze({
	default: histograms
});

var require$$4 = ( histograms$1 && histograms ) || histograms$1;

var index$2 = createCommonjsModule(function (module) {
(function() {
"use strict";

const Alea = alea;
const FastSimplexNoise = main;
const Histogram = histogram;

const constants$$1 = constants;
const MIN_PRECOMPUTED_OCTAVES = constants$$1.MIN_PRECOMPUTED_OCTAVES;
const MAX_PRECOMPUTED_OCTAVES = constants$$1.MAX_PRECOMPUTED_OCTAVES;

const PRECOMPUTED_HISTOGRAMS = require$$4;

function _getScaler(octaves) {
  if (octaves >= MIN_PRECOMPUTED_OCTAVES && octaves <= MAX_PRECOMPUTED_OCTAVES) {
    const histogramJson = PRECOMPUTED_HISTOGRAMS[octaves];
    const histogram$$1 = Histogram.load(histogramJson);
    const scaler = histogram$$1.makeScaler();
    return scaler;
  } else {
    throw new Error('octaves must be in (' + MIN_PRECOMPUTED_OCTAVES + ',' + MAX_PRECOMPUTED_OCTAVES + ')');
  }
}

function FastUniformNoise(opts) {
  opts = opts || {};
  opts.min = opts.min || 0;
  opts.max = opts.max || 1;
  opts.frequency = opts.frequency || 1;
  opts.octaves = opts.octaves || 1;
  opts.random = opts.random || new Alea('');

  // console.log('uniform noise', opts);

  this._min = opts.min;
  this._max = opts.max;
  this._noise = new FastSimplexNoise({
    min: 0,
    max: 1,
    frequency: opts.frequency,
    octaves: opts.octaves,
    random: opts.random,
  });
  this._scaler = _getScaler(opts.octaves);
}
FastUniformNoise.prototype = {
  in2D: function(x, y) {
    const v = this._noise.in2D(x, y);
    const scaledV = this._scaler(v);
    const offsetV = this._min + (scaledV * (this._max - this._min));
    return offsetV;
  }
};

module.exports = FastUniformNoise;

})();
});

function Indev(opts) {
  opts = opts || {};
  const seed = opts.seed;
  const random = opts.random;

  this._random = (() => {
    if (random !== undefined) {
      return random;
    } else if (seed !== undefined) {
      return new alea(seed);
    } else {
      return Math.random;
    }
  })();
}
Indev.prototype = {
  simplex: function(opts) {
    opts = opts || {};
    opts.min = opts.min || 0;
    opts.max = opts.max || 1;
    opts.random = this._random;

    return new FastSimplexNoise_1(opts);
  },
  uniform: function(opts) {
    opts = opts || {};
    opts.min = opts.min || 0;
    opts.max = opts.max || 1;
    opts.random = this._random;

    return new index$2(opts);
  },
};

function indev(opts) {
  return new Indev(opts);
}

var index = {indev};

return index;

}());
