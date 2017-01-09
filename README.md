# zeo.sh

JavaScript `npm` plugins in WebVR.

Zeo.sh lets you run `npm` modules in VR, from your browser. Under the hood it's a `Three.js` / `WebVR` rendering engine that polyfills the complexity of getting things working, so you can write a JS file and (literally) experience it running. Everything is nicely glued together by the [`archae`](https://github.com/modulesio/archae) `npm` module loader.

<img src="/screencap.gif?raw=true" width="512px">

:warning: Heavy development, expect things to be broken.

```js
function init() {

	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
	camera.position.z = 1000;

	geometry = new THREE.BoxGeometry( 200, 200, 200 );
	material = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: true } );

	mesh = new THREE.Mesh( geometry, material );
	scene.add( mesh );

	renderer = new THREE.WebGLRenderer();
	renderer.setSize( window.innerWidth, window.innerHeight );

	document.body.appendChild( renderer.domElement );

}

function init() {

	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
	camera.position.z = 1000;

	geometry = new THREE.BoxGeometry( 200, 200, 200 );
	material = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: true } );

	mesh = new THREE.Mesh( geometry, material );
	scene.add( mesh );

	renderer = new THREE.WebGLRenderer();
	renderer.setSize( window.innerWidth, window.innerHeight );

	document.body.appendChild( renderer.domElement );

}
```

## Features

- Works with WebVR 1.0
- Fully emulates HMD + tracked controllers, if you don't have the browser or hardware for it
- A ton of included base modules to get you started, including:
  - Multi-world management with a backing database
  - _Server-side_ physics with JavaScript bindings to Bullet
  - Multiplayer support, which plays nicely with the physics server
  - Model loader
  - Positional audio
  - VR `bash` shell so you can hack while jacked
  - Youtube player
  - Portals you can walk through
  - Weather effects
  - Skybox with Rayleigh scattering, sun, moon, and stars
  - Everything is plain JS!

## In progress

  - A menu UI infrastructure
  - Plugin management without leaving VR
  - Voice controls and reading backed by Watson
  - Virtual tools you can pick up and play with
  - Keyboard emulation
  - Emulated game consoles with Retroarch
