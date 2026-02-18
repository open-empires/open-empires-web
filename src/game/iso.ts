import type { Camera, Vec2 } from "./types";

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const HALF_TILE_W = TILE_WIDTH / 2;
export const HALF_TILE_H = TILE_HEIGHT / 2;

export function tileToScreen(tileX: number, tileY: number, cam: Camera): Vec2 {
  return {
    x: (tileX - tileY) * HALF_TILE_W + cam.x,
    y: (tileX + tileY) * HALF_TILE_H + cam.y,
  };
}

export function screenToTile(screenX: number, screenY: number, cam: Camera): Vec2 {
  const localX = screenX - cam.x;
  const localY = screenY - cam.y;
  return {
    x: (localX / HALF_TILE_W + localY / HALF_TILE_H) * 0.5,
    y: (localY / HALF_TILE_H - localX / HALF_TILE_W) * 0.5,
  };
}
