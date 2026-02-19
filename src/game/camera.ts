import { HALF_TILE_H, HALF_TILE_W, tileToScreen } from "./iso";
import type { Camera, Vec2 } from "./types";

export type CameraFocus = Vec2;

export function clampFocusToMap(focus: CameraFocus, mapCols: number, mapRows: number): void {
  focus.x = clamp(focus.x, 0, mapCols - 0.001);
  focus.y = clamp(focus.y, 0, mapRows - 0.001);
}

export function syncCameraFromFocus(
  camera: Camera,
  focus: CameraFocus,
  viewportWidth: number,
  viewportHeight: number,
): void {
  camera.x = viewportWidth * 0.5 - (focus.x - focus.y) * HALF_TILE_W;
  camera.y = viewportHeight * 0.5 - (focus.x + focus.y) * HALF_TILE_H;
}

export function applyScreenOffsetToFocus(
  focus: CameraFocus,
  offsetDx: number,
  offsetDy: number,
): void {
  const focusDx = -0.5 * (offsetDx / HALF_TILE_W + offsetDy / HALF_TILE_H);
  const focusDy = 0.5 * (offsetDx / HALF_TILE_W - offsetDy / HALF_TILE_H);
  focus.x += focusDx;
  focus.y += focusDy;
}

export function drawCameraFocusDebug(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  focus: CameraFocus,
  viewportWidth: number,
  viewportHeight: number,
): void {
  const tileX = Math.floor(focus.x);
  const tileY = Math.floor(focus.y);
  const p = tileToScreen(tileX, tileY, camera);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + HALF_TILE_W, p.y + HALF_TILE_H);
  ctx.lineTo(p.x, p.y + HALF_TILE_H * 2);
  ctx.lineTo(p.x - HALF_TILE_W, p.y + HALF_TILE_H);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.13)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const cx = Math.floor(viewportWidth * 0.5);
  const cy = Math.floor(viewportHeight * 0.5);
  ctx.fillStyle = "#000000";
  ctx.fillRect(cx, cy, 1, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
