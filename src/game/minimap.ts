import { screenToTile } from "./iso";
import { LAND_FILL, WATER_FILL } from "./terrain";
import type { Camera, Tile, Vec2 } from "./types";

const MINIMAP_HALF_TILE_W = 2;
const MINIMAP_HALF_TILE_H = 1;

export type MinimapProjection = {
  x: number;
  y: number;
  width: number;
  height: number;
  innerX: number;
  innerY: number;
  innerW: number;
  innerH: number;
  textureWidth: number;
  textureHeight: number;
  originX: number;
  halfTileW: number;
  halfTileH: number;
  diamondCenterX: number;
  diamondCenterY: number;
  diamondHalfW: number;
  diamondHalfH: number;
};

export type MinimapFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  padding?: number;
  borderColor?: string;
  backgroundColor?: string;
};

export function createMinimapTexture(map: Tile[][]): HTMLCanvasElement {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  const mini = document.createElement("canvas");
  const width = Math.ceil((cols + rows) * MINIMAP_HALF_TILE_W + 2);
  const height = Math.ceil((cols + rows) * MINIMAP_HALF_TILE_H + 2);
  mini.width = width;
  mini.height = height;
  const miniCtx = mini.getContext("2d");
  if (!miniCtx) {
    return mini;
  }

  const originX = rows * MINIMAP_HALF_TILE_W + 1;
  for (let layer = 0; layer <= cols + rows - 2; layer += 1) {
    for (let y = 0; y < rows; y += 1) {
      const x = layer - y;
      if (x < 0 || x >= cols) {
        continue;
      }
      const centerX = (x - y) * MINIMAP_HALF_TILE_W + originX;
      const centerY = (x + y) * MINIMAP_HALF_TILE_H + 1;

      miniCtx.beginPath();
      miniCtx.moveTo(centerX, centerY);
      miniCtx.lineTo(centerX + MINIMAP_HALF_TILE_W, centerY + MINIMAP_HALF_TILE_H);
      miniCtx.lineTo(centerX, centerY + MINIMAP_HALF_TILE_H * 2);
      miniCtx.lineTo(centerX - MINIMAP_HALF_TILE_W, centerY + MINIMAP_HALF_TILE_H);
      miniCtx.closePath();
      miniCtx.fillStyle = map[y][x].terrain === "land" ? LAND_FILL : WATER_FILL;
      miniCtx.fill();
    }
  }
  return mini;
}

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  minimapTexture: HTMLCanvasElement,
  mapCols: number,
  mapRows: number,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  frame?: MinimapFrame,
  viewportTop = 0,
): MinimapProjection {
  const width = frame?.width ?? 220;
  const height = frame?.height ?? 148;
  const x = frame?.x ?? viewportWidth - width - 12;
  const y = frame?.y ?? viewportHeight - height - 12;
  const innerPadding = frame?.padding ?? 4;

  if (frame?.backgroundColor) {
    ctx.fillStyle = frame.backgroundColor;
    ctx.fillRect(x, y, width, height);
  }
  const innerX = x + innerPadding;
  const innerY = y + innerPadding;
  const innerW = width - innerPadding * 2;
  const innerH = height - innerPadding * 2;
  const diamondCenterX = innerX + innerW * 0.5;
  const diamondCenterY = innerY + innerH * 0.5;
  const diamondHalfW = innerW * 0.5;
  const diamondHalfH = innerH * 0.5;

  ctx.save();
  applyDiamondPath(ctx, diamondCenterX, diamondCenterY, diamondHalfW, diamondHalfH);
  ctx.clip();
  ctx.drawImage(minimapTexture, innerX, innerY, innerW, innerH);
  ctx.restore();

  ctx.strokeStyle = frame?.borderColor ?? "rgba(210, 235, 195, 0.82)";
  ctx.lineWidth = 1;
  applyDiamondPath(ctx, diamondCenterX, diamondCenterY, diamondHalfW, diamondHalfH);
  ctx.stroke();

  const originX = mapRows * MINIMAP_HALF_TILE_W + 1;
  const toMiniTexture = (tileX: number, tileY: number) => ({
    x: (tileX - tileY) * MINIMAP_HALF_TILE_W + originX,
    y: (tileX + tileY) * MINIMAP_HALF_TILE_H + 1,
  });
  const toMiniScreen = (tileX: number, tileY: number) => {
    const p = toMiniTexture(tileX, tileY);
    return {
      x: innerX + (p.x / minimapTexture.width) * innerW,
      y: innerY + (p.y / minimapTexture.height) * innerH,
    };
  };

  const corners = [
    screenToTile(0, viewportTop, camera),
    screenToTile(viewportWidth, viewportTop, camera),
    screenToTile(0, viewportTop + viewportHeight, camera),
    screenToTile(viewportWidth, viewportTop + viewportHeight, camera),
  ];
  const miniCorners = corners.map((corner) => toMiniScreen(corner.x, corner.y));
  const minX = Math.min(...miniCorners.map((p) => p.x));
  const maxX = Math.max(...miniCorners.map((p) => p.x));
  const minY = Math.min(...miniCorners.map((p) => p.y));
  const maxY = Math.max(...miniCorners.map((p) => p.y));
  ctx.strokeStyle = "#f5ff86";
  ctx.lineWidth = 1;
  ctx.save();
  applyDiamondPath(ctx, diamondCenterX, diamondCenterY, diamondHalfW, diamondHalfH);
  ctx.clip();
  ctx.strokeRect(minX, minY, Math.max(1, maxX - minX), Math.max(1, maxY - minY));
  ctx.restore();

  return {
    x,
    y,
    width,
    height,
    innerX,
    innerY,
    innerW,
    innerH,
    textureWidth: minimapTexture.width,
    textureHeight: minimapTexture.height,
    originX,
    halfTileW: MINIMAP_HALF_TILE_W,
    halfTileH: MINIMAP_HALF_TILE_H,
    diamondCenterX,
    diamondCenterY,
    diamondHalfW,
    diamondHalfH,
  };
}

export function isPointInMinimap(x: number, y: number, projection: MinimapProjection | null): boolean {
  if (!projection) {
    return false;
  }
  return pointInDiamond(x, y, projection);
}

export function minimapScreenToTile(screenX: number, screenY: number, projection: MinimapProjection): Vec2 {
  const normX = clamp((screenX - projection.innerX) / projection.innerW, 0, 1);
  const normY = clamp((screenY - projection.innerY) / projection.innerH, 0, 1);
  const texX = normX * projection.textureWidth;
  const texY = normY * projection.textureHeight;
  const u = (texX - projection.originX) / projection.halfTileW;
  const v = (texY - 1) / projection.halfTileH;
  return {
    x: (u + v) * 0.5,
    y: (v - u) * 0.5,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pointInDiamond(x: number, y: number, projection: MinimapProjection): boolean {
  if (projection.diamondHalfW <= 0 || projection.diamondHalfH <= 0) {
    return false;
  }
  const nx = Math.abs((x - projection.diamondCenterX) / projection.diamondHalfW);
  const ny = Math.abs((y - projection.diamondCenterY) / projection.diamondHalfH);
  return nx + ny <= 1;
}

function applyDiamondPath(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  halfW: number,
  halfH: number,
): void {
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - halfH);
  ctx.lineTo(centerX + halfW, centerY);
  ctx.lineTo(centerX, centerY + halfH);
  ctx.lineTo(centerX - halfW, centerY);
  ctx.closePath();
}
