export const WIDTH = 1024;
export const ASPECT_RATIO = 640 / (480 + 200);
export const HEIGHT = Math.round(WIDTH / ASPECT_RATIO);
export const WORLD_WIDTH = 2;
export const WORLD_HEIGHT = WORLD_WIDTH / ASPECT_RATIO;
export const WORLD_DEPTH = WORLD_WIDTH / 50;

export const DEFAULT_USER_HEIGHT = 1.6;

export default {
  WIDTH,
  HEIGHT,
  ASPECT_RATIO,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  DEFAULT_USER_HEIGHT,
};
