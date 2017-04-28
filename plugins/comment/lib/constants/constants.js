export const WIDTH = 512;
export const HEIGHT = Math.round(WIDTH / 2);
export const ASPECT_RATIO = WIDTH / HEIGHT;
export const WORLD_WIDTH = 0.5;
export const WORLD_HEIGHT = WORLD_WIDTH / ASPECT_RATIO;
export const WORLD_DEPTH = WORLD_WIDTH / 50;

export default {
  WIDTH,
  HEIGHT,
  ASPECT_RATIO,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
};
