export const WIDTH = 200;
export const ASPECT_RATIO = 3;
export const HEIGHT = Math.round(WIDTH / ASPECT_RATIO);
export const WORLD_WIDTH = 0.2 + (0.2 / 10);
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
