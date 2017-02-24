const svgSrc = `data:image/svg+xml;utf8,<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
   xmlns:dc="http://purl.org/dc/elements/1.1/"
   xmlns:cc="http://creativecommons.org/ns#"
   xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
   xmlns:svg="http://www.w3.org/2000/svg"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   width="175"
   height="88"
   viewBox="0 0 46.302082 23.283334"
   version="1.1"
   id="svg8"
   sodipodi:docname="drawing.svg"
   inkscape:version="0.92.0 r15299">
  <defs
     id="defs2" />
  <sodipodi:namedview
     id="base"
     pagecolor="#ffffff"
     bordercolor="#666666"
     borderopacity="1.0"
     inkscape:pageopacity="0.0"
     inkscape:pageshadow="2"
     inkscape:zoom="11.2"
     inkscape:cx="98.928816"
     inkscape:cy="44.915423"
     inkscape:document-units="px"
     inkscape:current-layer="layer1"
     showgrid="true"
     objecttolerance="10000"
     inkscape:window-width="3840"
     inkscape:window-height="2066"
     inkscape:window-x="-11"
     inkscape:window-y="-11"
     inkscape:window-maximized="1"
     units="px"
     showguides="true"
     borderlayer="false"
     inkscape:pagecheckerboard="false"
     fit-margin-top="0"
     fit-margin-left="0"
     fit-margin-right="0"
     fit-margin-bottom="0">
    <inkscape:grid
       type="xygrid"
       id="grid3690"
       originx="2.2071065e-006"
       originy="-273.84379" />
  </sodipodi:namedview>
  <metadata
     id="metadata5">
    <rdf:RDF>
      <cc:Work
         rdf:about="">
        <dc:format>image/svg+xml</dc:format>
        <dc:type
           rdf:resource="http://purl.org/dc/dcmitype/StillImage" />
        <dc:title></dc:title>
      </cc:Work>
    </rdf:RDF>
  </metadata>
  <g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1"
     transform="translate(2.207107e-6,0.12708404)">
    <path
       style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
       d="M -1e-6,3.8416666 3.96875,-0.12708333 7.9375,3.8416666 Z"
       id="path3692"
       inkscape:connector-curvature="0"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
       d="m 3.9687489,4.6354165 22.4895841,1e-7 -11.90625,8.7312494 z"
       id="path3694"
       inkscape:connector-curvature="0"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
       d="m 21.166665,3.8416666 5.291668,-2.6458333 19.84375,2.6458333 z"
       id="path3698"
       inkscape:connector-curvature="0"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
       d="m 15.345833,13.895833 3.96875,-2.910417 V 23.15625 Z"
       id="path3700"
       inkscape:connector-curvature="0"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
       d="M 8.73125,9.6625003 5.8208333,7.28125 2.9104156,9.6625003 Z"
       id="path3702"
       inkscape:connector-curvature="0"
       sodipodi:nodetypes="cccc" />
  </g>
</svg>`.replace(/\n/g, '');

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
  document.head.innerHTML = '<link href="https://fonts.googleapis.com/css?family=Open+Sans:300,400" rel="stylesheet">';

  const img = new Image();
  img.src = svgSrc;
  img.onload = () => {
    // var size = 32;
    var size = 64;
    // var size = 256;

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

    const imageSize = size * 1.25;
    ctx.drawImage(img, size * 0.4, size * 0.7, imageSize, imageSize / 2);

    var link = document.createElement('a');
    link.innerHTML = 'Download';
    link.addEventListener('click', function() {
      downloadCanvas(this, canvas, 'logo.png');
    });

    document.body.innerHTML = '';

    const main = document.createElement('div');
    main.appendChild(canvas);
    const h1 = document.createElement('div');
    h1.style.cssText = `margin-bottom: ${size / 4}px; margin-left: ${size / 4}px; font-family: "Open Sans"; font-size: ${size * 1.5}px; line-height: 1; font-weight: 300;`;
    h1.innerText = 'zeo vr';
    main.appendChild(h1);

    document.body.appendChild(main);
    document.body.appendChild(link);

    document.body.style.cssText = 'margin: 0; background-color: #000;';
    main.style.cssText = 'display: inline-flex; margin-right: 10px; align-items: center; background-color: #FFF';
    link.style.cssText = 'color: #FFF;';
  };
  img.onerror = err => {
    console.warn(err);
  };
}

drawLogo();
