const SIDES = ['left', 'right'];
const DIRECTIONS = [
  [-1, -1, -1],
  [-1, -1, 1],
  [-1, 1, -1],
  [-1, 1, 1],

  [1, -1, -1],
  [1, -1, 1],
  [1, 1, -1],
  [1, 1, 1],
];
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const outputSymbol = Symbol();

class Craft {
  mount() {
    const {three, input, pose, render, hands, elements, items, utils: {js: jsUtils}} = zeo;
    const {THREE, scene, camera} = three;
    const {events} = jsUtils;
    const {EventEmitter} = events;

    const oneVector = new THREE.Vector3(1, 1, 1);
    const upVector = new THREE.Vector3(0, 1, 0);
    const forwardVector = new THREE.Vector3(0, 0, -1);
    const zeroQuaternion = new THREE.Quaternion();

    const gridSize = 0.125;
    const gridSpacing = gridSize / 2;
    const gridWidth = 3;
    const hoverDistance = _sq((gridSize + gridSpacing) / 2);

    const directions = DIRECTIONS.map(direction => new THREE.Vector3().fromArray(direction).multiplyScalar(gridSize / 2));
    const craftShader = {
      uniforms: {
        gselected: {
          type: 'v2',
          value: new THREE.Vector2(-1, -1),
        },
        gfull: {
          type: 'm3',
          value: new THREE.Matrix3(),
        },
        goutput: {
          type: 'f',
          value: 0,
        },
      },
      vertexShader: [
        "attribute float selected;",
        "varying float vselected;",
        "void main() {",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y, position.z, 1.0);",
        "  vselected = selected;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform vec2 gselected;",
        "uniform mat3 gfull;",
        "uniform float goutput;",
        "varying float vselected;",
        "void main() {",
        "  if (abs(gselected.x - vselected) < 0.1 || abs(gselected.y - vselected) < 0.1) {",
        "    gl_FragColor = vec4(0.12941176470588237, 0.5882352941176471, 0.9529411764705882, 1.0);", // blue
        "  } else if (",
        "    abs(vselected - 0.0) < 0.1 && gfull[0][0] > 0.5 ||",
        "    abs(vselected - 1.0) < 0.1 && gfull[1][0] > 0.5 ||",
        "    abs(vselected - 2.0) < 0.1 && gfull[2][0] > 0.5 ||",
        "    abs(vselected - 3.0) < 0.1 && gfull[0][1] > 0.5 ||",
        "    abs(vselected - 4.0) < 0.1 && gfull[1][1] > 0.5 ||",
        "    abs(vselected - 5.0) < 0.1 && gfull[2][1] > 0.5 ||",
        "    abs(vselected - 6.0) < 0.1 && gfull[0][2] > 0.5 ||",
        "    abs(vselected - 7.0) < 0.1 && gfull[1][2] > 0.5 ||",
        "    abs(vselected - 8.0) < 0.1 && gfull[2][2] > 0.5",
        "  ) {",
        "    if (goutput < 0.5) {",
        "      gl_FragColor = vec4(0.403921568627451, 0.22745098039215686, 0.7176470588235294, 1.0);", // purple
        "    } else {",
        "      gl_FragColor = vec4(0.2980392156862745, 0.6862745098039216, 0.3137254901960784, 1.0);", // green
        "    }",
        "  } else {",
        "    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);",
        "  }",
        "}"
      ].join("\n")
    };
    const gridMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(craftShader.uniforms),
      vertexShader: craftShader.vertexShader,
      fragmentShader: craftShader.fragmentShader,
      side: THREE.DoubleSide,
      // transparent: true,
      // depthWrite: false,
    });

    const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
      for (let i = 0; i < src.length; i++) {
        dst[startIndexIndex + i] = src[i] + startAttributeIndex;
      }
    };
    const _getGridPosition = (x, y) => new THREE.Vector3(
      -(((gridWidth * gridSize) + ((gridWidth - 1) * gridSpacing)) / 2) + (gridSize / 2) + (x * (gridSize + gridSpacing)),
      (gridSize / 2) + 0.001,
      -(((gridWidth * gridSize) + ((gridWidth - 1) * gridSpacing)) / 2) + (gridSize / 2) + (y * (gridSize + gridSpacing))
    );

    const gridGeometry = (() => {
      const planeGeometry = new THREE.PlaneBufferGeometry(gridSize, gridSize)
        .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 1, 0)
        )))
        .applyMatrix(new THREE.Matrix4().makeTranslation(0, -gridSize/2, 0));
      const gridGeometry = (() => {
        const positions = new Float32Array(planeGeometry.getAttribute('position').array.length * ((gridWidth * gridWidth) + 1));
        const selecteds = new Float32Array((planeGeometry.getAttribute('position').array.length / 3) * ((gridWidth * gridWidth) + 1));
        const indices = new Uint16Array(planeGeometry.index.array.length * ((gridWidth * gridWidth) + 1));
        let attributeIndex = 0;
        let selectedIndex = 0;
        let indexIndex = 0;

        const _addBox = (x, y) => {
          const position = _getGridPosition(x, y);
          const selected = x + (y * gridWidth);

          const newPositions = planeGeometry.clone()
            .applyMatrix(new THREE.Matrix4().makeTranslation(position.x, position.y, position.z))
            .getAttribute('position').array;
          positions.set(newPositions, attributeIndex);
          const newSelecteds = (() => {
            const numNewPositions = newPositions.length / 3;
            const result = new Float32Array(numNewPositions);
            for (let i = 0; i < numNewPositions; i++) {
              result[i] = selected;
            }
            return result;
          })();
          selecteds.set(newSelecteds, selectedIndex);
          const newIndices = planeGeometry.index.array;
          _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

          attributeIndex += newPositions.length;
          selectedIndex += newSelecteds.length;
          indexIndex += newIndices.length;
        };

        for (let x = 0; x < gridWidth; x++) {
          for (let y = 0; y < gridWidth; y++) {
            _addBox(x, y);
          }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('selected', new THREE.BufferAttribute(selecteds, 1));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        return geometry;
      })();

      return gridGeometry;
    })();

    /* const _triggerdown = e => {
      const {side} = e;
      const status = pose.getStatus();
      const {gamepads} = status;
      const gamepad = gamepads[side];

      if (gamepad.buttons.grip.pressed) {
        const {worldPosition: controllerPosition} = gamepad;

        if (!gridMesh.visible) {
          
        } else {
          const index = _getHoveredIndex(controllerPosition);

          if (index !== -1) {
            craftApi.trigger(side, index);
          } else {
            craftApi.close();
          }
        }

        e.stopImmediatePropagation();
      }
    };
    input.on('triggerdown', _triggerdown, {
      priority: -1,
    });
    const _gripdown = e => {
      const {side} = e;
      const {gamepads} = pose.getStatus();
      const gamepad = gamepads[side];
      const {worldPosition: controllerPosition} = gamepad;
      const index = _getHoveredIndex(controllerPosition);

      if (index !== -1) {
        const hoverState = hoverStates[side];
        const {worldGrabAsset} = hoverState;
        const gridItem = grid[index];

        if (!worldGrabAsset && gridItem) {
          gridItem.grab(side);

          grid[index] = null;
          craft.setGridIndex(index, null);

          e.stopImmediatePropagation();
        }
      }
    };
    input.on('gripdown', _gripdown, {
      priority: -1,
    }); */
    const _release = ({grabbable, side}) => {
      const {gamepads} = pose.getStatus();
      const gamepad = gamepads[side];
      const {worldPosition: controllerPosition} = gamepad;

      for (let i = 0; i < crafters.length; i++) {
        const crafter = crafters[i];
        const index = crafter.getHoveredIndex(controllerPosition);

        if (index !== -1) {
          /* const {item} = grabbable;
          const {attributes} = item;
          const {asset: {value: asset}} = attributes; */
          crafter.setGridIndex(index, grabbable);

          grabbable.setState(crafter.positions[index], zeroQuaternion, oneVector);
          grabbable.disablePhysics();
        }
      }
    };
    hands.on('release', _release);
    /* const _gripup = e => {
      const {side} = e;
      const {gamepads} = pose.getStatus();
      const gamepad = gamepads[side];
      const {worldPosition: controllerPosition} = gamepad;
      const index = _getHoveredIndex(controllerPosition);

      if (index !== -1) {
        // _setGridIndex(index, );
      }
    };
    input.on('gripup', _gripup, {
      priority: -1,
    }); */

    /* const _teleport = () => {
      if (gridMesh.visible) {
        const {hmd} = pose.getStatus();
        const {worldPosition: hmdPosition} = hmd;
        const hmdEuler = new THREE.Euler().setFromQuaternion(
          new THREE.Quaternion().setFromRotationMatrix(
            new THREE.Matrix4().lookAt(
              hmdPosition,
              gridMesh.position,
              upVector
            )
          ),
          camera.rotation.order
        );
        hmdEuler.x = 0;
        hmdEuler.z = 0;
        const hmdQuaternion = new THREE.Quaternion().setFromEuler(hmdEuler);

        gridMesh.position.copy(
          hmdPosition.clone()
            .add(forwardVector.clone().multiplyScalar(0.6).applyQuaternion(hmdQuaternion))
        );
        gridMesh.quaternion.copy(hmdQuaternion);
        gridMesh.scale.copy(oneVector);
        gridMesh.updateMatrixWorld();

        gridMesh.updatePositions();

        craftApi.emit('teleport');
      }
    };
    teleport.on('teleport', _teleport); */

    const recipes = {};
window.recipes = recipes;
    const _makeNullInput = (width, height) => {
      const result = Array(width * height);
      for (let i = 0; i < (width * height); i++) {
        result[i] = null;
      }
      return result;
    };
    const _drawInput = (canvas, canvasWidth, canvasHeight, data, x, y, width, height) => {
      for (let dy = 0; dy < height; dy++) {
       for (let dx = 0; dx < width; dx++) {
          const canvasIndex = (x + dx) + ((y + dy) * canvasWidth);
          const dataIndex = dx + (dy * width);
          canvas[canvasIndex] = data[dataIndex];
        }
      }
    };
    const _getRecipeVariantInputs = recipe => {
      const {width, height, input} = recipe;

      const result = [];
      for (let x = 0; x < (gridWidth - width + 1); x++) {
        for (let y = 0; y < (gridWidth - height + 1); y++) {
          const fullInput = _makeNullInput(gridWidth, gridWidth);
          _drawInput(fullInput, gridWidth, gridWidth, input, x, y, width, height);
          result.push(fullInput);
        }
      }
      return result;
    };
    const _hashRecipeInput = input => JSON.stringify(input);
    const _addRecipe = recipe => {
      const inputs = _getRecipeVariantInputs(recipe);

      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const hash = _hashRecipeInput(input);

        let entry = recipes[hash];
        if (!entry) {
          entry = [recipe.output, 0];
          recipes[hash] = entry;
        }
        entry[1]++;
      }
    };
    const _removeRecipe = recipe => {
      const inputs = _getRecipeVariantInputs(recipe);

      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const hash = _hashRecipeInput(input);

        const entry = recipes[hash];
        entry[1]--;
        if (entry[1] === 0) {
          delete recipes[hash];
        }
      }
    };
    const _getRecipeOutput = input => {
      const hash = _hashRecipeInput(input);
      const entry = recipes[hash];
      return entry ? entry[0] : null;
    };

    const _update = () => {
      const {gamepads} = pose.getStatus();

      for (let i = 0; i < crafters.length; i++) {
        const crafter = crafters[i];
        const {gridMesh, grid} = crafter;

        for (let j = 0; j < SIDES.length; j++) {
          const side = SIDES[j];
          gridMesh.material.uniforms.gselected.value[side === 'left' ? 'x' : 'y'] = crafter.getHoveredIndex(gamepads[side].worldPosition);
        }
        gridMesh.material.uniforms.gfull.value.set(
          grid[0] ? 1 : 0,
          grid[1] ? 1 : 0,
          grid[2] ? 1 : 0,
          grid[3] ? 1 : 0,
          grid[4] ? 1 : 0,
          grid[5] ? 1 : 0,
          grid[6] ? 1 : 0,
          grid[7] ? 1 : 0,
          grid[8] ? 1 : 0
        );
        gridMesh.material.uniforms.goutput.value = grid[outputSymbol] !== null ? 1 : 0;
      }
    };
    render.on('update', _update);

    /* const _getHoveredGridIndex = side => {
      const {gamepads} = pose.getStatus();
      const gamepad = gamepads[side];
      const {worldPosition: controllerPosition} = gamepad;
      return _getHoveredIndex(controllerPosition);
    }; */

    const crafters = [];

    class Crafter extends EventEmitter {
      constructor(position, rotation, scale) {
        super();

        const gridMesh = new THREE.Mesh(gridGeometry, gridMaterial)
        gridMesh.position.copy(position);
        gridMesh.rotation.copy(rotation);
        gridMesh.scale.copy(scale);
        gridMesh.updateMatrixWorld();
        scene.add(gridMesh);
        this.gridMesh = gridMesh;

        const positions = Array(gridWidth * gridWidth);
        for (let y = 0; y < gridWidth; y++) {
          for (let x = 0; x < gridWidth; x++) {
            positions[x + (y * gridWidth)] = _getGridPosition(x, y)
              .multiply(scale)
              .applyQuaternion(rotation)
              .add(position);
          }
        }
        this.positions = positions;

        const grid = Array(gridWidth * gridWidth);
        for (let i = 0; i < grid.length; i++) {
          grid[i] = null;
        }
        this.grid = grid;
      }

      getGridIndex(index) {
        return this.grid[index];
      }

      setGridIndex(index, assetInstance) {
        this.grid[index] = assetInstance;
        this.grid[outputSymbol] = _getRecipeOutput(this.grid.map(grabbable => grabbable ? grabbable.item.attributes.asset.value : null));

        if (assetInstance) {
          const _cleanup = () => {
            assetInstance.removeListener('release', _release);
            this.removeListener('destroy', _cleanup);
          };

          const _grab = () => {
            this.setGridIndex(index, null);
            _cleanup();
          };
          assetInstance.on('grab', _grab);
          this.on('destroy', _cleanup);
        }
      }

      getHoveredIndex(p) {
        for (let j = 0; j < this.positions.length; j++) {
          const position = this.positions[j];
          const distance = p.distanceTo(position);

          if (distance < hoverDistance) {
            return j;
          }
        }
        return -1;
      }

      clearGrid() {
        for (let i = 0; i < this.grid.length; i++) {
          const assetInstance = this.grid[i];

          if (assetInstance) {
            items.destroyItem(assetInstance);
            this.grid[i] = null;
          }
        }
      }

      craft() {
        const outputAsset = this.grid[outputSymbol];

        if (outputAsset !== null) {
          this.clearGrid();

          const id = _makeId();
          const index = 4;
          const assetInstance = items.makeItem({
            type: 'asset',
            id: id,
            name: outputAsset,
            displayName: outputAsset,
            attributes: {
              position: {value: DEFAULT_MATRIX},
              asset: {value: outputAsset},
              quantity: {value: 1},
              owner: {value: null},
              bindOwner: {value: null},
              physics: {value: false},
            },
          });
          const position = this.positions[index];
          assetInstance.setState(position, zeroQuaternion, oneVector);

          this.setGridIndex(index, assetInstance);
        }
      }

      destroy() {
        for (let i = 0; i < this.grid.length; i++) {
          const grabbable = this.grid[i];
          if (grabbable) {
            grabbable.enablePhysics();
          }
        }

        scene.remove(this.gridMesh);

        this.emit('destroy');
      }
    }

    const craftEntity = {
      entityAddedCallback(entityElement) {
        entityElement.open = (position, rotation, scale) => {
          const crafter = new Crafter(position, rotation, scale);
          crafters.push(crafter);
          return crafter;
        };
        entityElement.close = crafter => {
          crafter.destroy();
          crafters.splice(crafters.indexOf(crafter), 1);
        };
        entityElement.registerRecipe = recipe => {
          _addRecipe(recipe);
        };
        entityElement.unregisterRecipe = recipe => {
          _removeRecipe(recipe);
        };
      },
      entityRemovedCallback(entityElement) {
        // XXX
      },
    };
    elements.registerEntity(this, craftEntity);

    this._cleanup = () => {
      for (let i = 0; i < crafters.length; i++) {
        const crafter = crafters[i];
        crafter.destroy();
      }

      gridGeometry.dispose();
      gridMaterial.dispose();

      // input.removeListener('triggerdown', _triggerdown);
      // input.removeListener('gripup', _gripup);

      hands.removeListener('release', _release);

      // teleport.removeListener('teleport', _teleport);

      render.removeListener('update', _update);

      elements.unregisterEntity(this, craftEntity);
    };

    /* const _craftTrigger = e => {sss
      const {side, index} = e;
      const hoverState = hoverStates[side];
      const {worldGrabAsset} = hoverState;
      const gridItem = grid[index];

      if (worldGrabAsset && !gridItem) {
        grid[index] = worldGrabAsset;
        const {asset} = worldGrabAsset;
        craft.setGridIndex(index, asset);

        worldGrabAsset.release(); // needs to happen second so physics are not enabled in the release handler
        const indexPosition = craft.getGridIndexPosition(index);
        worldGrabAsset.setStateLocal(indexPosition, zeroQuaternion, oneVector);
      }
    };
    craft.on('trigger', _craftTrigger);

    const _craftGripup = e => {
      const {side, index} = e;
      const hoverState = hoverStates[side];
      const {worldGrabAsset} = hoverState;
      const gridItem = grid[index];

      if (worldGrabAsset && !gridItem) {
        grid[index] = worldGrabAsset;
        const {asset} = worldGrabAsset;
        craft.setGridIndex(index, asset);

        worldGrabAsset.release(); // needs to happen second so physics are not enabled in the release handler
        const indexPosition = craft.getGridIndexPosition(index);
        worldGrabAsset.setStateLocal(indexPosition, zeroQuaternion, oneVector);

        e.stopImmediatePropagation();
      }
    };
    craft.on('gripup', _craftGripup); */
  }

  unmount() {
    this._cleanup();
  }
}
const _makeId = () => Math.random().toString(36).substring(7);
const _sq = n => Math.sqrt(n*n*2);

module.exports = Craft;
