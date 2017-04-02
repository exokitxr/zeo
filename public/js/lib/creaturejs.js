var creaturejs = (function () {
var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function commonjsRequire () {
	throw new Error('Dynamic requires are not currently supported by rollup-plugin-commonjs');
}



function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var cacheLru = createCommonjsModule(function (module, exports) {
/*
**  Cache-LRU -- In-Memory Cache with O(1) Operations and LRU Purging Strategy
**  Copyright (c) 2015-2016 Ralf S. Engelschall <rse@engelschall.com>
**
**  Permission is hereby granted, free of charge, to any person obtaining
**  a copy of this software and associated documentation files (the
**  "Software"), to deal in the Software without restriction, including
**  without limitation the rights to use, copy, modify, merge, publish,
**  distribute, sublicense, and/or sell copies of the Software, and to
**  permit persons to whom the Software is furnished to do so, subject to
**  the following conditions:
**
**  The above copyright notice and this permission notice shall be included
**  in all copies or substantial portions of the Software.
**
**  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
**  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
**  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
**  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
**  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
**  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
**  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

(function(f){{module.exports=f();}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof commonjsRequire=="function"&&commonjsRequire;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r);}return n[o].exports}var i=typeof commonjsRequire=="function"&&commonjsRequire;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
"use strict";function _classCallCheck(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}var _createClass=function(){function e(e,t){for(var i=0;i<t.length;i++){var n=t[i];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n);}}return function(t,i,n){return i&&e(t.prototype,i),n&&e(t,n),t}}(),CacheLRU=function(){function e(){return _classCallCheck(this,e),this._index={},this._LRU={newer:null},this._MRU={older:null},this._LRU.newer=this._MRU,this._MRU.older=this._LRU,this._cur=0,this._max=1/0,this._dispose=function(){},this}return _createClass(e,[{key:"limit",value:function(e){var t=this._max;return arguments.length>0&&(this._max=e,this._purge()),t}},{key:"dispose",value:function(e){return this._dispose=e,this}},{key:"length",value:function(){return this._cur}},{key:"keys",value:function(){return this.each(function(e,t){this.push(t);},[])}},{key:"values",value:function(){return this.each(function(e){this.push(e);},[])}},{key:"each",value:function(e,t){arguments<2&&(t=this);for(var i=0,n=this._MRU.older;n!==this._LRU;)e.call(t,n.val,n.key,i++),n=n.older;return t}},{key:"has",value:function(e){return void 0!==this._index[e]}},{key:"peek",value:function(e){var t=this._index[e];if(void 0!==t)return t.expires<Date.now()?void this.del(t.key):t.val}},{key:"touch",value:function(e){var t=this._index[e];if(void 0===t)throw new Error("touch: no such item");return this._promote(t),this}},{key:"get",value:function(e){var t=this._index[e];if(void 0!==t)return t.expires<Date.now()?void this.del(t.key):(this._promote(t),t.val)}},{key:"set",value:function(e,t,i){arguments.length<3&&(i=1/0),i+=Date.now();var n=this._index[e];if(void 0===n)n={older:null,newer:null,key:e,val:t,expires:i},this._index[e]=n,this._attach(n),this._cur++,this._purge();else{var r=n.val;n.val=t,this._promote(n),this._dispose.call(void 0,n.key,r,"set");}return this}},{key:"del",value:function(e){var t=this._index[e];if(void 0===t)throw new Error("del: no such item");return delete this._index[e],this._detach(t),this._cur--,this._dispose.call(void 0,e,t.val,"del"),this}},{key:"clear",value:function(){for(;this._cur>0;)this.del(this._LRU.newer.key);return this}},{key:"_purge",value:function(){for(;this._cur>this._max;)this.del(this._LRU.newer.key);}},{key:"_promote",value:function(e){this._detach(e),this._attach(e);}},{key:"_detach",value:function(e){e.older.newer=e.newer,e.newer.older=e.older,e.older=null,e.newer=null;}},{key:"_attach",value:function(e){e.older=this._MRU.older,e.newer=this._MRU,e.newer.older=e,e.older.newer=e;}}]),e}();module.exports=CacheLRU;
},{}]},{},[1])(1)
});



});

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

const cache = new cacheLru({
  max: 128,
});

const SIZE = 12;
const _2_32 = Math.pow(2, 32);

function _cloneCanvas(canvas) {
  const result = document.createElement('canvas');
  result.width = canvas.width;
  result.height = canvas.height;

  const ctx = result.getContext('2d');
  ctx.drawImage(canvas, 0, 0);

  return result;
}
function _cloneEntry(entry) {
  if (typeof entry === 'string') {
    return entry;
  } else {
    return entry.map(_cloneCanvas);
  }
}

function makeCreature(seed, {single = false}) {
  seed = seed || String(Math.random());

  const key = seed + ':' + single;
  const entry = cache.get(key);
  if (entry) {
    return _cloneEntry(entry);
  } else {
    const entry = (() => {
      const rng = new alea(seed);

      function _setPixel(ctx, x, y, c) {
        let {pixelImageData} = ctx;
        if (!pixelImageData) {
          pixelImageData = ctx.createImageData(1,1);
          ctx.pixelImageData = pixelImageData;
        }
        const {data} = pixelImageData;
        data[0] = (c >> (8 * 2)) & 0xFF;
        data[1] = (c >> (8 * 1)) & 0xFF;
        data[2] = (c >> (8 * 0)) & 0xFF;
        data[3] = c ? 255 : 0;
        ctx.putImageData(pixelImageData, x, y);
      }

      function _getPixel(ctx, x, y) {
        const pixelImageData = ctx.getImageData(x, y, 1, 1);
        const {data} = pixelImageData;
        const r = data[0];
        const g = data[1];
        const b = data[2];
        const a = data[3];
        return (a << (8 * 3)) | (r << (8 * 2)) | (g << (8 * 1)) | (b << (8 * 0));
      }

      function getColor32(alpha, red, green, blue) {
        return alpha << 24 | red << 16 | green << 8 | blue;
      }

      function getRGB(color) {
        const alpha = color >>> 24;
        const red = color >> 16 & 255;
        const green = color >> 8 & 255;
        const blue = color & 255;
        return {
          alpha,
          red,
          green,
          blue,
        };
      }

      function HSVtoRGB(h, s, v, alpha = 255) {
        let result = 0;
        if (s === 0) {
          result = getColor32(alpha,v * 255,v * 255,v * 255);
        } else {
          h = h / 60;

          const intH = Math.floor(h);
          let f = h - intH;
          let p = v * (1 - s);
          let q = v * (1 - s * f);
          let t = v * (1 - s * (1 - f));
          switch (intH) {
             case 0:
                result = getColor32(alpha,v * 255,t * 255,p * 255);
                break;
             case 1:
                result = getColor32(alpha,q * 255,v * 255,p * 255);
                break;
             case 2:
                result = getColor32(alpha,p * 255,v * 255,t * 255);
                break;
             case 3:
                result = getColor32(alpha,p * 255,q * 255,v * 255);
                break;
             case 4:
                result = getColor32(alpha,t * 255,p * 255,v * 255);
                break;
             case 5:
                result = getColor32(alpha,v * 255,p * 255,q * 255);
                break;
             default:
                throw new Error('FlxColor Error: HSVtoRGB : Unknown color');
          }
        }
        return result;
      }

      function RGBtoHSV(color) {
        let hue = NaN;
        let saturation = NaN;

        const rgb = getRGB(color);
        const red = rgb.red / 255;
        const green = rgb.green / 255;
        const blue = rgb.blue / 255;

        const min = Math.min(red,green,blue);
        const max = Math.max(red,green,blue);
        const delta = max - min;
        const lightness = (max + min) / 2;

        if (delta === 0) {
          hue = 0;
          saturation = 0;
        } else {
          if(lightness < 0.5) {
             saturation = delta / (max + min);
          } else {
             saturation = delta / (2 - max - min);
          }
          let delta_r = ((max - red) / 6 + delta / 2) / delta;
          let delta_g = ((max - green) / 6 + delta / 2) / delta;
          let delta_b = ((max - blue) / 6 + delta / 2) / delta;
          if (red === max) {
             hue = delta_b - delta_g;
          } else if (green === max) {
             hue = 1 / 3 + delta_r - delta_b;
          } else if (blue === max) {
             hue = 2 / 3 + delta_g - delta_r;
          }
          if (hue < 0) {
             hue = hue + 1;
          }
          if (hue > 1) {
             hue = hue - 1;
          }
        }
        hue = hue * 360;
        hue = Math.round(hue);

        return {
          hue,
          saturation,
          lightness,
          value: lightness,
        };
      }

      function mirror(ctx) {
        const w = SIZE;
        const h = SIZE;
        for(let iY = 0; iY < h; iY++) {
          for(let iX = w / 2; iX < w; iX++) {
            _setPixel(ctx, iX, iY, _getPixel(ctx, w - 1 - iX, iY));
          }
        }
      }

      function renderMainFrame(ctx) {
        const w = SIZE;
        const h = SIZE;
        const color = Math.floor(rng() * _2_32);

        let show = color;
        const halfw = (w - 1) / 2;
        const halfh = (h - 1) / 2;
        const radius = Math.min(Math.sqrt(Math.pow(halfw,2)),Math.sqrt(Math.pow(halfh,2)));
        const c = RGBtoHSV(show);

        for (let i = 0; i <= halfw; i++) {
          for (let j = 0; j < h; j++) {
             let dist = Math.min(1,Math.max(0,Math.sqrt(Math.pow(i - halfw,2) + Math.pow(j - halfh,2)) / radius));
             c.hue = Math.max(0,Math.min(359,c.hue + Math.round((rng() * 2 - 1) * 359 * 0.1)));
             c.saturation = Math.max(0,Math.min(1,c.saturation + (rng() * 2 - 1) * 0.1));
             c.value = 1 - dist;
             show = HSVtoRGB(c.hue,c.saturation,c.value);
             if (rng() >= dist) {
                _setPixel(ctx, i, j, show);
             }
          }
        }

        mirror(ctx);
      }

      function renderAltFrame(ctx) {
        let animChance = 1;

        const w = SIZE;
        const h = SIZE;
        const halfw = (w - 1) / 2;

        for (let i = 1; i < halfw; i++) {
          for (let j = 1; j < h - 1; j++) {
            if (rng() <= animChance && _getPixel(ctx, i, j) !== _getPixel(ctx, i - 1, j)) {
               const centerPixel = _getPixel(ctx, i, j);
               const leftPixel = _getPixel(ctx, i - 1, j);
              _setPixel(ctx, i - 1, j, centerPixel);
              _setPixel(ctx, i, j, leftPixel);
              i++;
              j++;
            } else if (rng() <= animChance && _getPixel(ctx, i, j) !== _getPixel(ctx, i, j - 1)) {
               const centerPixel = _getPixel(ctx, i, j);
               const topPixel = _getPixel(ctx, i, j - 1);
              _setPixel(ctx, i, j - 1, centerPixel);
              _setPixel(ctx, i, j, topPixel);
              i++;
              j++;
            }
          }
        }

        mirror(ctx);
      }

      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      canvas.style.width = 64;
      canvas.style.height = 64;
      canvas.style.imageRendering = 'pixelated';
      const ctx = canvas.getContext('2d');

      renderMainFrame(ctx);
      const mainFrame = _cloneCanvas(canvas);

      if (!single) {
        renderAltFrame(ctx);
        const altFrame = canvas;

        return [mainFrame, altFrame];
      } else {
        return canvas.toDataURL('image/png');
      }
    })();

    cache.set(key, entry);

    return _cloneEntry(entry);
  }
}
const makeAnimatedCreature = seed => makeCreature(seed, {single: false});
const makeStaticCreature = seed => makeCreature(seed, {single: true});

var index = {
  makeAnimatedCreature,
  makeStaticCreature,
};

return index;

}());
