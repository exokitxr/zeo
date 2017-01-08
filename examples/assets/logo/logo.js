function getRGB(h, s, v) {
    while (h > 1) h -= 1;
    while (h < 0) h += 1;

    var r, g, b, i, f, p, q, t;
    if (h && s === undefined && v === undefined) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.floor(r * 255),
        g: Math.floor(g * 255),
        b: Math.floor(b * 255)
    };
}

function getColorString(color, alpha) {
  if (alpha === undefined) 
    alpha = 1;
  return 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + alpha + ')';
}

function downloadCanvas(link, canvas, filename) {
    link.href = canvas.toDataURL();
    link.download = filename;
}

function drawLogo() {
  var size = 256;

  var canvas = document.createElement('canvas');
  canvas.width = size * 2;
  canvas.height = size * 3.2;
  var ctx = canvas.getContext('2d');

  var x = size;
  var y = size * 1.2;

  // Primer
  ctx.fillStyle = 'rgba(10, 40, 40, 1)';
  ctx.beginPath();
  ctx.moveTo(x, y - size * 1.2);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size * 2);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fill();
  // Top right
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.2);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size * 0.3);
  ctx.closePath();
  ctx.fill();

  // Top left
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.2);
  ctx.lineTo(x - size, y);
  ctx.lineTo(x, y + size * 0.3);
  ctx.closePath();
  ctx.fill();

  // Top right
  ctx.fillStyle = 'rgba(76, 175, 80, 0.7)';
  ctx.beginPath();
  ctx.moveTo(x, y - size * 1.2);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y - size * 0.2);
  ctx.closePath();
  ctx.fill();

  // Top left
  ctx.fillStyle = 'rgba(139, 195, 74, 0.7)';
  ctx.beginPath();
  ctx.moveTo(x, y - size * 1.2);
  ctx.lineTo(x - size, y);
  ctx.lineTo(x, y - size * 0.2);
  ctx.closePath();
  ctx.fill();

  // Bottom left
  ctx.fillStyle = 'rgba(255, 23, 68, 0.65)';
  ctx.beginPath();
  ctx.moveTo(x, y + size * 2);
  ctx.lineTo(x - size, y);
  ctx.lineTo(x, y - size * 0.2);
  ctx.closePath();
  ctx.fill();

  var link = document.createElement('a');
  link.innerHTML = 'Download';
  link.addEventListener('click', function() {
    downloadCanvas(this, canvas, 'logo.png');
  });

  document.body.innerHTML = '';
  document.body.appendChild(canvas);
  document.body.appendChild(link);
}

drawLogo();
