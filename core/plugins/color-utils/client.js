const colorUtils = () => ({
  mount() {
    const _makeColorWheelImg = () => {
      function hsv2rgb(h, s, v) {
        var c = v * s;
        var h1 = h / 60;
        var x = c * (1 - Math.abs((h1 % 2) - 1));
        var m = v - c;
        var rgb;

        if (typeof h == 'undefined') rgb = [0, 0, 0];
        else if (h1 < 1) rgb = [c, x, 0];
        else if (h1 < 2) rgb = [x, c, 0];
        else if (h1 < 3) rgb = [0, c, x];
        else if (h1 < 4) rgb = [0, x, c];
        else if (h1 < 5) rgb = [x, 0, c];
        else if (h1 <= 6) rgb = [c, 0, x];

        var r = 255 * (rgb[0] + m);
        var g = 255 * (rgb[1] + m);
        var b = 255 * (rgb[2] + m);

        return [r, g, b];
      }

      const width = 256;
      const height = width;
      const halfWidth = width / 2;
      const halfHeight = height / 2;

      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext("2d");
      canvas.ctx = ctx;

      // grab the current ImageData (or use createImageData)
      var bitmap = ctx.getImageData(0, 0, width, height);

      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          // offset for the 4 RGBA values in the data array
          var offset = 4 * ((y * width) + x);

          var hue = 180 + Math.atan2(y - halfHeight, x - halfWidth) * (180 / Math.PI);
          var saturation = Math.sqrt(Math.pow(y - halfHeight, 2) + Math.pow(x - halfWidth, 2)) / halfWidth;
          var value = 1;

          saturation = Math.min(1, saturation);

          var hsv = hsv2rgb(hue, saturation, value);

          // fill RGBA values
          bitmap.data[offset + 0] = hsv[0];
          bitmap.data[offset + 1] = hsv[1];
          bitmap.data[offset + 2] = hsv[2];
          bitmap.data[offset + 3] = 255; // no transparency

        }
      }

      // update the canvas
      ctx.putImageData(bitmap, 0, 0);

      return canvas;
    };
    let colorWheelImg = null;
    const _getColorWheelImg = () => {
      if (!colorWheelImg) {
        colorWheelImg = _makeColorWheelImg();
      }
      return colorWheelImg;
    };

    return {
      getColorWheelImg: _getColorWheelImg,
    };
  },
});

module.exports = colorUtils;
