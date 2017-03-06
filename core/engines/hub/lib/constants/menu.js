export const WIDTH = 1024;
export const HEIGHT = Math.round(WIDTH / 1.5);
export const ASPECT_RATIO = WIDTH / HEIGHT;
export const WORLD_WIDTH = 2;
export const WORLD_HEIGHT = WORLD_WIDTH / ASPECT_RATIO;
export const WORLD_DEPTH = WORLD_WIDTH / 50;

export const SERVER_WIDTH = 1024;
export const SERVER_HEIGHT = Math.round(SERVER_WIDTH / 2.5);
export const SERVER_ASPECT_RATIO = SERVER_WIDTH / SERVER_HEIGHT;
export const SERVER_WORLD_WIDTH = 1;
export const SERVER_WORLD_HEIGHT = SERVER_WORLD_WIDTH / SERVER_ASPECT_RATIO;
export const SERVER_WORLD_DEPTH = SERVER_WORLD_WIDTH / 50;

export const DEFAULT_USER_HEIGHT = 1.6;

export default {
  WIDTH,
  HEIGHT,
  ASPECT_RATIO,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  SERVER_WIDTH,
  SERVER_HEIGHT,
  SERVER_ASPECT_RATIO,
  SERVER_WORLD_WIDTH,
  SERVER_WORLD_HEIGHT,
  SERVER_WORLD_DEPTH,

  DEFAULT_USER_HEIGHT,
};
