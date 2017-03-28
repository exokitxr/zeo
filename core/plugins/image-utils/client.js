const imageUtils = archae => ({
  mount() {
    const _boxizeImage = img => {
      const {width, height} = img;
      const size = Math.max(width, height);

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, (size / 2) - (width / 2), (size / 2) - (height / 2));

      return canvas;
    };

    return {
      boxizeImage: _boxizeImage,
    };
  },
});

module.exports = imageUtils;
