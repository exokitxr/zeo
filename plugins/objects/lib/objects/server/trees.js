const path = require('path');

const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
} = require('../../constants/constants');
const NUM_POSITIONS = 30 * 1024;
const CAMERA_ROTATION_ORDER = 'YXZ';

const {three: {THREE}, utils: {image: {jimp}}} = zeo;

const tree = objectApi => {
  return () => Promise.all([
    jimp.read(path.join(__dirname, '../../img/tree.png'))
      .then(img => objectApi.registerTexture('tree', img)),
    jimp.read(path.join(__dirname, '../../img/tree-top.png'))
      .then(img => objectApi.registerTexture('tree-top', img)),
    jimp.read(path.join(__dirname, '../../img/leaf.png'))
      .then(img => objectApi.registerTexture('leaf', img)),
    jimp.read(path.join(__dirname, '../../img/vine.png'))
      .then(img => objectApi.registerTexture('vine', img)),
  ])
    .then(() => {
      const treeUvs = objectApi.getUv('tree');
      const treeTopUvs = objectApi.getUv('tree-top');
      const leafUvs = objectApi.getUv('leaf');
      const vineUvs = objectApi.getUv('vine');
      const zeroUvs = [1, 1, 1, 1];
      const treeBlock = {
        uvs: [
          treeUvs,
          treeUvs,
          treeTopUvs,
          treeTopUvs,
          treeUvs,
          treeUvs,
        ],
        transparent: false,
        translucent: false,
      };
      objectApi.registerBlock('tree', treeBlock);
      const leafBlock = {
        uvs: [
          leafUvs,
          leafUvs,
          leafUvs,
          leafUvs,
          leafUvs,
          leafUvs,
        ],
        transparent: true,
        translucent: true,
      };
      objectApi.registerBlock('leaf', leafBlock);
      const vineBlock = {
        uvs: [
          vineUvs,
          vineUvs,
          zeroUvs,
          zeroUvs,
          vineUvs,
          vineUvs,
        ],
        transparent: true,
        translucent: true,
      };
      objectApi.registerBlock('vine', vineBlock);

      let currentChunk = null;

      const thirdVector = new THREE.Vector3(1/3, 1/3, 1/3);
      const BigO1 = [
        /* -1 */           new THREE.Vector2(0, -1),
        /*  0 */ new THREE.Vector2(-1,  0),          new THREE.Vector2(1,  0),
        /*  1 */           new THREE.Vector2(0,  1),
      ];
      const BigO2 = [
        /* -2 */           new THREE.Vector2(-1, -2), new THREE.Vector2(0, -2), new THREE.Vector2(1, -2),
        /* -1 */ new THREE.Vector2(-2, -1), new THREE.Vector2(-1, -1), new THREE.Vector2(0, -1), new THREE.Vector2(1, -1), new THREE.Vector2(2, -1),
        /*  0 */ new THREE.Vector2(-2,  0), new THREE.Vector2(-1,  0),          new THREE.Vector2(1,  0), new THREE.Vector2(2,  0),
        /*  1 */ new THREE.Vector2(-2,  1), new THREE.Vector2(-1,  1), new THREE.Vector2(0,  1), new THREE.Vector2(1,  1), new THREE.Vector2(2,  1),
        /*  2 */           new THREE.Vector2(-1,  2), new THREE.Vector2(0,  2), new THREE.Vector2(1,  2),
      ];
      const BigO3 = [
        /* -3 */           new THREE.Vector2(-2, -3), new THREE.Vector2(-1, -3), new THREE.Vector2(0, -3), new THREE.Vector2(1, -3), new THREE.Vector2(2, -3),
        /* -2 */ new THREE.Vector2(-3, -2), new THREE.Vector2(-2, -2), new THREE.Vector2(-1, -2), new THREE.Vector2(0, -2), new THREE.Vector2(1, -2), new THREE.Vector2(2, -2), new THREE.Vector2(3, -2),
        /* -1 */ new THREE.Vector2(-3, -1), new THREE.Vector2(-2, -1), new THREE.Vector2(-1, -1), new THREE.Vector2(0, -1), new THREE.Vector2(1, -1), new THREE.Vector2(2, -1), new THREE.Vector2(3, -1),
        /*  0 */ new THREE.Vector2(-3,  0), new THREE.Vector2(-2,  0), new THREE.Vector2(-1,  0),          new THREE.Vector2(1,  0), new THREE.Vector2(2,  0), new THREE.Vector2(3,  0),
        /*  1 */ new THREE.Vector2(-3,  1), new THREE.Vector2(-2,  1), new THREE.Vector2(-1,  1), new THREE.Vector2(0,  1), new THREE.Vector2(1,  1), new THREE.Vector2(2,  1), new THREE.Vector2(3,  1),
        /*  2 */ new THREE.Vector2(-3,  2), new THREE.Vector2(-2,  2), new THREE.Vector2(-1,  2), new THREE.Vector2(0,  2), new THREE.Vector2(1,  2), new THREE.Vector2(2,  2), new THREE.Vector2(3,  2),
        /*  3 */           new THREE.Vector2(-2,  3), new THREE.Vector2(-1,  3), new THREE.Vector2(0,  3), new THREE.Vector2(1,  3), new THREE.Vector2(2,  3),
      ];
      const BigO4 = [
        /* -4 */                     new THREE.Vector2(-2, -4), new THREE.Vector2(-1, -4), new THREE.Vector2(0, -4), new THREE.Vector2(1, -4), new THREE.Vector2(2, -4),
        /* -3 */           new THREE.Vector2(-3, -3), new THREE.Vector2(-2, -3), new THREE.Vector2(-1, -3), new THREE.Vector2(0, -3), new THREE.Vector2(1, -3), new THREE.Vector2(2, -3), new THREE.Vector2(3, -3),
        /* -2 */ new THREE.Vector2(-4, -2), new THREE.Vector2(-3, -2), new THREE.Vector2(-2, -2), new THREE.Vector2(-1, -2), new THREE.Vector2(0, -2), new THREE.Vector2(1, -2), new THREE.Vector2(2, -2), new THREE.Vector2(3, -2), new THREE.Vector2(4, -2),
        /* -1 */ new THREE.Vector2(-4, -1), new THREE.Vector2(-3, -1), new THREE.Vector2(-2, -1), new THREE.Vector2(-1, -1), new THREE.Vector2(0, -1), new THREE.Vector2(1, -1), new THREE.Vector2(2, -1), new THREE.Vector2(3, -1), new THREE.Vector2(4, -1),
        /*  0 */ new THREE.Vector2(-4,  0), new THREE.Vector2(-3,  0), new THREE.Vector2(-2,  0), new THREE.Vector2(-1,  0),          new THREE.Vector2(1,  0), new THREE.Vector2(2,  0), new THREE.Vector2(3,  0), new THREE.Vector2(4,  0),
        /*  1 */ new THREE.Vector2(-4,  1), new THREE.Vector2(-3,  1), new THREE.Vector2(-2,  1), new THREE.Vector2(-1,  1), new THREE.Vector2(0,  1), new THREE.Vector2(1,  1), new THREE.Vector2(2,  1), new THREE.Vector2(3,  1), new THREE.Vector2(4,  1),
        /*  2 */ new THREE.Vector2(-4,  2), new THREE.Vector2(-3,  2), new THREE.Vector2(-2,  2), new THREE.Vector2(-1,  2), new THREE.Vector2(0,  2), new THREE.Vector2(1,  2), new THREE.Vector2(2,  2), new THREE.Vector2(3,  2), new THREE.Vector2(4,  2),
        /*  3 */           new THREE.Vector2(-3,  3), new THREE.Vector2(-2,  3), new THREE.Vector2(-1,  3), new THREE.Vector2(0,  3), new THREE.Vector2(1,  3), new THREE.Vector2(2,  3), new THREE.Vector2(3,  3),
        /*  4 */                     new THREE.Vector2(-2,  4), new THREE.Vector2(-1,  4), new THREE.Vector2(0,  4), new THREE.Vector2(1,  4), new THREE.Vector2(2,  4),
      ];
      const LargeAppleTreeAvailableDirections = [
        new THREE.Vector3( -1, 0, 0 ), new THREE.Vector3( 0, 0, -1  ),
        new THREE.Vector3( -1, 0, 1 ), new THREE.Vector3( -1, 0, -1 ),
        new THREE.Vector3( 1, 0, 1  ), new THREE.Vector3( 1, 0, -1  ),
        new THREE.Vector3( 1, 0, 0  ), new THREE.Vector3( 0, 0, 1   ),

        new THREE.Vector3( -0.5, 0, 0   ), new THREE.Vector3( 0, 0, -0.5    ),
        new THREE.Vector3( -0.5, 0, 0.5 ), new THREE.Vector3( -0.5, 0, -0.5 ),
        new THREE.Vector3( 0.5, 0, 0.5  ), new THREE.Vector3( 0.5, 0, -0.5  ),
        new THREE.Vector3( 0.5, 0, 0    ), new THREE.Vector3( 0, 0, 0.5     ),

        new THREE.Vector3( -1, 0.5, 0 ), new THREE.Vector3( 0, 0.5, -1  ),
        new THREE.Vector3( -1, 0.5, 1 ), new THREE.Vector3( -1, 0.5, -1 ),
        new THREE.Vector3( 1, 0.5, 1  ), new THREE.Vector3( 1, 0.5, -1  ),
        new THREE.Vector3( 1, 0.5, 0  ), new THREE.Vector3( 0, 0.5, 1   ),

        new THREE.Vector3( -0.5, 0.5, 0   ),  new THREE.Vector3( 0, 0.5, -0.5    ),
        new THREE.Vector3( -0.5, 0.5, 0.5 ),  new THREE.Vector3( -0.5, 0.5, -0.5 ),
        new THREE.Vector3( 0.5, 0.5, 0.5  ),  new THREE.Vector3( 0.5, 0.5, -0.5  ),
        new THREE.Vector3( 0.5, 0.5, 0    ),  new THREE.Vector3( 0, 0.5, 0.5     ),
      ];
      const AcaciaTreeAvailableDirections = [
        new THREE.Vector3( -1, 1, 0 ), new THREE.Vector3( 0, 1, -1 ),
        new THREE.Vector3( -1, 1, 1 ), new THREE.Vector3( -1, 1, -1 ),
        new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, -1 ),
        new THREE.Vector3( 1, 1, 0 ), new THREE.Vector3( 0, 1, 1 ),
      ];
      // Vines are around the BigO4, but not in the corners; need proper meta for direction
      const LargeVines = [
        new THREE.Vector3(-2, -5, 1), new THREE.Vector3(-1, -5, 1), new THREE.Vector3(0, -5, 1), new THREE.Vector3(1, -5, 1), new THREE.Vector3(2, -5, 1),  // North face
        new THREE.Vector3(-2,  5, 4), new THREE.Vector3(-1,  5, 4), new THREE.Vector3(0,  5, 4), new THREE.Vector3(1,  5, 4), new THREE.Vector3(2,  5, 4),  // South face
        new THREE.Vector3(5,  -2, 2), new THREE.Vector3(5,  -1, 2), new THREE.Vector3(5,  0, 2), new THREE.Vector3(5,  1, 2), new THREE.Vector3(5,  2, 2),  // East face
        new THREE.Vector3(-5, -2, 8), new THREE.Vector3(-5, -1, 8), new THREE.Vector3(-5, 0, 8), new THREE.Vector3(-5, 1, 8), new THREE.Vector3(-5, 2, 8),  // West face
        // TODO: vines around the trunk, proper metas and height
      ];
      // Vines are around the BigO3, but not in the corners; need proper meta for direction
      const SmallVines = [
        new THREE.Vector3(-2, -4, 1), new THREE.Vector3(-1, -4, 1), new THREE.Vector3(0, -4, 1), new THREE.Vector3(1, -4, 1), new THREE.Vector3(2, -4, 1),  // North face
        new THREE.Vector3(-2,  4, 4), new THREE.Vector3(-1,  4, 4), new THREE.Vector3(0,  4, 4), new THREE.Vector3(1,  4, 4), new THREE.Vector3(2,  4, 4),  // South face
        new THREE.Vector3(4,  -2, 2), new THREE.Vector3(4,  -1, 2), new THREE.Vector3(4,  0, 2), new THREE.Vector3(4,  1, 2), new THREE.Vector3(4,  2, 2),  // East face
        new THREE.Vector3(-4, -2, 8), new THREE.Vector3(-4, -1, 8), new THREE.Vector3(-4, 0, 8), new THREE.Vector3(-4, 1, 8),              // West face
        // TODO: proper metas and height: {0,  1, 1},  {0, -1, 4},  {-1, 0, 2}, {1,  1, 8},  // Around the tunk
      ];
      const Corners = [
        new THREE.Vector2(-1, -1),
        new THREE.Vector2(-1, 1),
        new THREE.Vector2(1, -1),
        new THREE.Vector2(1, 1),
      ];
      const PushCoordBlocks = (a_BlockX, a_Height, a_BlockZ, a_Coords, a_BlockType) => {
        for (let i = 0; i < a_Coords.length; i++) {
          objectApi.setBlock(currentChunk, a_BlockX + a_Coords[i].x, a_Height, a_BlockZ + a_Coords[i].y, a_BlockType);
        }
      };
      const PushCornerBlocks = (a_BlockX, a_Height, a_BlockZ, a_Seq, a_Chance, a_CornersDist, a_BlockType) => {
        for (let i = 0; i < Corners.length; i++) {
          const x = a_BlockX + Corners[i].x;
          const z = a_BlockZ + Corners[i].z;
          if (objectApi.getHash(a_Seq + ':cornerBlocks:' + x + ':' + z) <= a_Chance) {
            objectApi.setBlock(currentChunk, x, a_Height, z, a_BlockType);
          }
        }  // for i - Corners[]
      };
      const PushSomeColumns = (a_BlockX, a_Height, a_BlockZ, a_ColumnHeight, a_Seq, a_Chance, a_Coords, a_BlockType) => {
        for (let i = 0; i < a_Coords.length; i++) {
          const x = a_BlockX + a_Coords[i].x;
          const z = a_BlockZ + a_Coords[i].y;
          if (objectApi.getHash(a_Seq + ':columns:' + x + ':' + z) <= a_Chance) {
            for (let j = 0; j < a_ColumnHeight; j++) {
              objectApi.setBlock(currentChunk, x, a_Height - j, z, a_BlockType);
            }
          }
        }  // for i - a_Coords[]
      };
      const GetAppleTreeImage = (a_BlockX, a_BlockY, a_BlockZ, a_Seq) => {
        if (objectApi.getHash(a_Seq + ':appleTreeType') < 0x60000000) {
          GetSmallAppleTreeImage(a_BlockX, a_BlockY, a_BlockZ, a_Seq);
        } else {
          GetLargeAppleTreeImage(a_BlockX, a_BlockY, a_BlockZ, a_Seq);
        }
      };
      const GetLargeAppleTreeImage = (a_BlockX, a_BlockY, a_BlockZ, a_Seq) => {
        const Height = 7 + objectApi.getHash(a_Seq + ':appleTreeLargeHeight') % 4;

        const branches = [];

        // Create branches
        for (let i = 4; i < Height; i++) {
          // Get a direction for the trunk to go to.
          const BranchStartDirection = LargeAppleTreeAvailableDirections[objectApi.getHash(a_Seq + ':appleTreeLargeBranchStartDirection:' + i) % LargeAppleTreeAvailableDirections.length];
          const BranchDirection = localVector.copy(LargeAppleTreeAvailableDirections[objectApi.getHash(a_Seq + ':appleTreeLargeBranchDirection:' + i) % LargeAppleTreeAvailableDirections.length])
            .divide(thirdVector);

          const BranchLength = 2 + objectApi.getHash(a_Seq + ':appleTreeLargeBranchLength:' + i) % 3;
          const localBranches = GetLargeAppleTreeBranch(a_BlockX, a_BlockY + i, a_BlockZ, BranchLength, BranchStartDirection, BranchDirection, a_BlockY + Height);
          branches.push.apply(branches, localBranches);
        }

        // Place leaves around each log block
        for (let i = 0; i < branches.length; i++) {
          const branch = branches[i];
          const X = branch.x;
          const Y = branch.y;
          const Z = branch.z;

          objectApi.setBlock(currentChunk, X, Y - 2, Z, 'leaf');

          PushCoordBlocks(X, Y - 2, Z, BigO1, 'leaf');
          for (let y = -1; y <= 1; y++) {
            PushCoordBlocks(X, Y + y, Z, BigO2, 'leaf');
          }
          PushCoordBlocks(X, Y + 2, Z, BigO1, 'leaf');

          objectApi.setBlock(currentChunk, X, Y + 2, Z, 'leaf');
        }

        // Trunk:
        for (let i = 0; i < Height; i++) {
          objectApi.setBlock(currentChunk, a_BlockX, a_BlockY + i, a_BlockZ, 'tree');
        }
      };
      const GetSmallAppleTreeImage = (a_BlockX, a_BlockY, a_BlockZ, a_Seq) => {
        /* Small apple tree has:
        - a top plus (no log)
        - optional BigO1 + random corners (log)
        - 2 layers of BigO2 + random corners (log)
        - 1 to 3 blocks of trunk
        */

        let Random = objectApi.getHash(a_Seq + ':appleTreeSmallRandom') >> 3;

        const Heights = [1, 2, 2, 3];
        const Height = 1 + Heights[Random & 3];
        Random >>= 2;

        // Trunk:
        for (let i = 0; i < Height; i++) {
          objectApi.setBlock(currentChunk, a_BlockX, a_BlockY + i, a_BlockZ, 'tree');
        }
        let Hei = a_BlockY + Height;

        // 2 BigO2 + corners layers:
        for (let i = 0; i < 2; i++) {
          PushCoordBlocks(a_BlockX, Hei, a_BlockZ, BigO2, 'leaf');
          PushCornerBlocks(a_BlockX, Hei, a_BlockZ, a_Seq, 0x5000000 - i * 0x10000000, 2, 'leaf');
          objectApi.setBlock(currentChunk, a_BlockX, Hei, a_BlockZ, 'tree');
          Hei++;
        }  // for i - 2*

        // Optional BigO1 + corners layer:
        if ((Random & 1) == 0) {
          PushCoordBlocks(a_BlockX, Hei, a_BlockZ, BigO1, 'leaf');
          PushCornerBlocks(a_BlockX, Hei, a_BlockZ, a_Seq, 0x6000000, 1, 'leaf');
          objectApi.setBlock(currentChunk, a_BlockX, Hei, a_BlockZ, 'tree');
          Hei++;
        }

        // Top plus:
        PushCoordBlocks(a_BlockX, Hei, a_BlockZ, BigO1, 'leaf');
        objectApi.setBlock(currentChunk, a_BlockX, Hei, a_BlockZ, 'leaf');
      };
      const GetLargeAppleTreeBranch = (a_BlockX, a_BlockY, a_BlockZ, a_BranchLength, a_StartDirection, a_Direction, a_TreeHeight) => {
        const branches = [];
        const CurrentPos = localVector2.set(a_BlockX, a_BlockY, a_BlockZ);
        const Direction  = localVector3.copy(a_StartDirection);
        for (let i = 0; i < a_BranchLength; i++) {
          CurrentPos.add(Direction);
          if (CurrentPos.y >= a_TreeHeight) {
            return;
          }
          Direction.sub(a_Direction);
          Direction.clamp(-1.0, 1.0);
          const branch = new THREE.Vector3(Math.floor(CurrentPos.x), Math.floor(CurrentPos.y), Math.floor(CurrentPos.z));
          objectApi.setBlock(currentChunk, branch.x, branch.y, branch.z, 'tree');
          branches.push(branch);
        }
        return branches;
      };
      const GetBirchTreeImage = (a_BlockX, a_BlockY, a_BlockZ, a_Seq) => {
        const Height = 5 + objectApi.getHash(a_Seq + ':birchTreeHeight') % 3;

        // The entire trunk, out of logs:
        for (let i = Height - 1; i >= 0; --i) {
          objectApi.setBlock(currentChunk, a_BlockX, a_BlockY + i, a_BlockZ, 'tree');
        }
        let h = a_BlockY + Height;

        // Top layer - just the Plus:
        PushCoordBlocks(a_BlockX, h, a_BlockZ, BigO1, 'leaf');
        objectApi.setBlock(currentChunk, a_BlockX, h, a_BlockZ, 'leaf');
        h--;

        // Second layer - log, Plus and maybe Corners:
        PushCoordBlocks(a_BlockX, h, a_BlockZ, BigO1, 'leaf');
        PushCornerBlocks(a_BlockX, h, a_BlockZ, a_Seq, 0x5fffffff, 1, 'leaf');
        h--;

        // Third and fourth layers - BigO2 and maybe 2 * Corners:
        for (let Row = 0; Row < 2; Row++) {
          PushCoordBlocks (a_BlockX, h, a_BlockZ, BigO2, 'leaf');
          PushCornerBlocks(a_BlockX, h, a_BlockZ, a_Seq, 0x3fffffff + Row * 0x10000000, 2, 'leaf');
          h--;
        }  // for Row - 2*
      };
      const GetAcaciaTreeImage = (a_BlockX, a_BlockY, a_BlockZ, a_Seq) => {
        // Calculate a base height
        const Height = 2 + (objectApi.getHash(a_Seq + ':acaciaTreeHeight') % 3);

        // Create the trunk
        for (let i = 0; i < Height; i++) {
          objectApi.setBlock(currentChunk, a_BlockX, a_BlockY + i, a_BlockZ, 'tree');
        }

        // Set the starting point of the branch
        const BranchPos = localVector.set(a_BlockX, a_BlockY + Height - 1, a_BlockZ);

        // Get a direction for the trunk to go to.
        const BranchDirection = localVector2.copy(AcaciaTreeAvailableDirections[objectApi.getHash(a_Seq + ':acaciaTreeBranchDirection') % 8]);

        // Calculate a height for the branch between 1 and 3
        let BranchHeight = objectApi.getHash(a_Seq + ':acaciaTreeBranchHeight') % 3 + 1;

        // Place the logs of the branch.
        for (let i = 0; i < BranchHeight; i++) {
          BranchPos.add(BranchDirection);
          objectApi.setBlock(currentChunk, BranchPos.x, BranchPos.y, BranchPos.z, 'tree');
        }

        // Add the leaves to the top of the branch
        PushCoordBlocks(BranchPos.x, BranchPos.y, BranchPos.z, BigO2, 'leaf');
        PushCoordBlocks(BranchPos.x, BranchPos.y + 1, BranchPos.z, BigO1, 'leaf');
        objectApi.setBlock(currentChunk, BranchPos.x, BranchPos.y + 1, BranchPos.z, 'leaf');

        // Choose if we have to add another branch
        const TwoTop = (objectApi.getHash(a_Seq + ':acaciaTreeTwoTop') < 0 ? true : false);
        if (!TwoTop) {
          return;
        }

        // Reset the starting point of the branch
        BranchPos.set(a_BlockX, a_BlockY + Height - 1, a_BlockZ);

        // Invert the direction of the previous branch.
        BranchDirection.set(-BranchDirection.x, 1, -BranchDirection.z);

        // Calculate a new height for the second branch
        BranchHeight = objectApi.getHash(a_Seq + ':acaciaTreeBranchHeight2') % 3 + 1;

        // Place the logs in the same way as the first branch
        for (let i = 0; i < BranchHeight; i++) {
          BranchPos.add(BranchDirection);
          objectApi.setBlock(currentChunk, BranchPos.x, BranchPos.y, BranchPos.z, 'tree');
        }

        // And add the leaves ontop of the second branch
        PushCoordBlocks(BranchPos.x, BranchPos.y, BranchPos.z, BigO2, 'leaf');
        PushCoordBlocks(BranchPos.x, BranchPos.y + 1, BranchPos.z, BigO1, 'leaf');
        objectApi.setBlock(currentChunk, BranchPos.x, BranchPos.y + 1, BranchPos.z, 'leaf');
      };
      const GetJungleTreeImage = (a_BlockX, a_BlockY, a_BlockZ, a_Seq) => {
        const IsLarge = objectApi.getHash(a_Seq + ':jungleTreeIsLarge') < 0x60000000;
        if (!IsLarge) {
          GetSmallJungleTreeImage(a_BlockX, a_BlockY, a_BlockZ, a_Seq);
        } else {
          GetLargeJungleTreeImage(a_BlockX, a_BlockY, a_BlockZ, a_Seq);
        }
      };
      const GetLargeJungleTreeImage = (a_BlockX, a_BlockY, a_BlockZ, a_Seq) => {
        // TODO: Generate proper jungle trees with branches

        const Height = 14 + objectApi.getHash(a_Seq + ':jungleTreeLargeHeight') % 8;

        for (let i = 0; i < Height; i++) {
          objectApi.setBlock(currentChunk, a_BlockX,     a_BlockY + i, a_BlockZ, 'tree');
          objectApi.setBlock(currentChunk, a_BlockX + 1, a_BlockY + i, a_BlockZ, 'tree');
          objectApi.setBlock(currentChunk, a_BlockX,     a_BlockY + i, a_BlockZ + 1, 'tree');
          objectApi.setBlock(currentChunk, a_BlockX + 1, a_BlockY + i, a_BlockZ + 1, 'tree');
        }
        let hei = a_BlockY + Height - 2;

        // Prevent floating trees by placing dirt under them
        /* for (let i = 1; i < 5; i++) {
          a_OtherBlocks.push_back(sSetBlock(a_BlockX, a_BlockY - i, a_BlockZ, E_BLOCK_DIRT, E_META_DIRT_NORMAL));
          a_OtherBlocks.push_back(sSetBlock(a_BlockX + 1, a_BlockY - i, a_BlockZ, E_BLOCK_DIRT, E_META_DIRT_NORMAL));
          a_OtherBlocks.push_back(sSetBlock(a_BlockX, a_BlockY - i, a_BlockZ + 1, E_BLOCK_DIRT, E_META_DIRT_NORMAL));
          a_OtherBlocks.push_back(sSetBlock(a_BlockX + 1, a_BlockY - i, a_BlockZ + 1, E_BLOCK_DIRT, E_META_DIRT_NORMAL));
        } */

        // Put vines around the lowermost leaves layer:
        PushSomeColumns(a_BlockX, hei, a_BlockZ, Height, a_Seq, 0x3fffffff, LargeVines, 'vine');

        // The lower two leaves layers are BigO4 with log in the middle and possibly corners:
        for (let i = 0; i < 2; i++) {
          PushCoordBlocks(a_BlockX, hei, a_BlockZ, BigO4, 'leaf');
          PushCornerBlocks(a_BlockX, hei, a_BlockZ, a_Seq, 0x5fffffff, 3, 'leaf');
          hei++;
        }  // for i - 2*

        // The top leaves layer is a BigO3 with leaves in the middle and possibly corners:
        PushCoordBlocks(a_BlockX, hei, a_BlockZ, BigO3, 'leaf');
        PushCornerBlocks(a_BlockX, hei, a_BlockZ, a_Seq, 0x5fffffff, 3, 'leaf');
        objectApi.setBlock(currentChunk, a_BlockX, hei, a_BlockZ, 'leaf');
      };
      const GetSmallJungleTreeImage = (a_BlockX, a_BlockY, a_BlockZ, a_Seq) => {
        const Height = 7 + objectApi.getHash(a_Seq + ':jungleTreeSmallHeight') % 3;

        for (let i = 0; i < Height; i++) {
          objectApi.setBlock(currentChunk, a_BlockX, a_BlockY + i, a_BlockZ, 'tree');
        }
        let hei = a_BlockY + Height - 3;

        // Put vines around the lowermost leaves layer:
        PushSomeColumns(a_BlockX, hei, a_BlockZ, Height, a_Seq, 0x3fffffff, SmallVines, 'vine');

        // The lower two leaves layers are BigO3 with log in the middle and possibly corners:
        for (let i = 0; i < 2; i++) {
          PushCoordBlocks(a_BlockX, hei, a_BlockZ, BigO3, 'leaf');
          PushCornerBlocks(a_BlockX, hei, a_BlockZ, a_Seq, 0x5fffffff, 3, 'leaf');
          hei++;
        }  // for i - 2*

        // Two layers of BigO2 leaves, possibly with corners:
        for (let i = 0; i < 1; i++) {
          PushCoordBlocks(a_BlockX, hei, a_BlockZ, BigO2, 'leaf');
          PushCornerBlocks(a_BlockX, hei, a_BlockZ, a_Seq, 0x5fffffff, 2, 'leaf');
          hei++;
        }  // for i - 2*

        // Top plus, all leaves:
        PushCoordBlocks(a_BlockX, hei, a_BlockZ, BigO1, 'leaf');
        objectApi.setBlock(currentChunk, a_BlockX, hei, a_BlockZ, 'leaf');
      };
      const localVector = new THREE.Vector3();
      const localVector2 = new THREE.Vector3();
      const localVector3 = new THREE.Vector3();

      const treeProbability = 0.015;

      objectApi.registerGenerator('trees', chunk => {
        currentChunk = chunk;

        for (let doz = -1; doz <= 1; doz++) {
          const oz = chunk.z + doz;

          for (let dox = -1; dox <= 1; dox++) {
            const ox = chunk.x + dox;

            for (let dz = 0; dz < NUM_CELLS; dz++) {
              for (let dx = 0; dx < NUM_CELLS; dx++) {
                const elevation = objectApi.getHeightfield(ox, oz)[(dx + (dz * NUM_CELLS_OVERSCAN)) * 8];

                if (elevation > 64) {
                  const v = objectApi.getNoise('tree', ox, oz, dx, dz);

                  if (v < treeProbability) {
                    GetJungleTreeImage((ox * NUM_CELLS) + dx, Math.floor(elevation), (oz * NUM_CELLS) + dz, String(v));
                  }
                }
              }
            }
          }
        }

        currentChunk = null;

        /* const x = 6;
        const y = 80;
        objectApi.setBlock(chunk, x, y + 0, -2, 'tree');
        objectApi.setBlock(chunk, x, y + 1, -2, 'tree');
        objectApi.setBlock(chunk, x, y + 2, -2, 'leaf');
        objectApi.setBlock(chunk, x, y + 2, -1, 'leaf');
        objectApi.setBlock(chunk, x, y + 2, -3, 'leaf'); */
      });

      return () => {
      };
    });
};

module.exports = tree;
