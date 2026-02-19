import { HALF_TILE_H, HALF_TILE_W, TILE_HEIGHT, TILE_WIDTH } from "./iso";
import type { Camera, Tile } from "./types";

export const LAND_FILL = "#4f9b47";
export const WATER_FILL = "#2f5f8f";

const GRID_LINE = "rgba(230, 246, 222, 0.28)";
const TARGET_WATER_RATIO = 0.5;

export type MapLayer = {
  canvas: HTMLCanvasElement;
  offsetX: number;
  offsetY: number;
};

export function generateMap(cols: number, rows: number, seed: number, random: () => number): Tile[][] {
  const elevationMap: number[][] = [];
  const entries: { x: number; y: number; value: number }[] = [];
  const coastOffsetX = random() * 1000;
  const coastOffsetY = random() * 1000;
  const ridgeOffsetX = random() * 1000;
  const ridgeOffsetY = random() * 1000;

  for (let y = 0; y < rows; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < cols; x += 1) {
      const nx = (x / (cols - 1)) * 2 - 1;
      const ny = (y / (rows - 1)) * 2 - 1;
      const radial = Math.hypot(nx, ny);
      const islandShape = 1 - Math.pow(clamp(radial, 0, 1), 1.25);
      const coastlineNoise = fbm(x * 0.09 + coastOffsetX, y * 0.09 + coastOffsetY, seed);
      const ridgeNoise = fbm(x * 0.21 + ridgeOffsetX, y * 0.21 + ridgeOffsetY, seed);
      const edgeFalloff = Math.pow(Math.max(Math.abs(nx), Math.abs(ny)), 1.45);
      const elevation =
        islandShape * 0.9 +
        (coastlineNoise - 0.5) * 0.5 +
        (ridgeNoise - 0.5) * 0.22 -
        edgeFalloff * 0.58;

      row.push(elevation);
      entries.push({ x, y, value: elevation });
    }
    elevationMap.push(row);
  }

  const sorted = [...entries].sort((a, b) => a.value - b.value);
  const thresholdIndex = Math.floor(sorted.length * TARGET_WATER_RATIO);
  const threshold = sorted[thresholdIndex]?.value ?? 0;

  const centerX = Math.floor(cols / 2);
  const centerY = Math.floor(rows / 2);
  const protectedRadius = 7;

  const tiles: Tile[][] = [];
  for (let y = 0; y < rows; y += 1) {
    const row: Tile[] = [];
    for (let x = 0; x < cols; x += 1) {
      const distToCenter = Math.hypot(x - centerX, y - centerY);
      const forceLand = distToCenter <= protectedRadius;
      const terrain = forceLand || elevationMap[y][x] > threshold ? "land" : "water";
      row.push({ terrain, elevation: elevationMap[y][x] });
    }
    tiles.push(row);
  }

  const connected = floodFillLand(tiles, centerX, centerY, cols, rows);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (tiles[y][x].terrain === "land" && !connected.has(tileKey(x, y))) {
        tiles[y][x].terrain = "water";
      }
    }
  }

  let waterTiles = countWaterTiles(tiles);
  const targetWaterTiles = Math.floor(cols * rows * TARGET_WATER_RATIO);

  if (waterTiles < targetWaterTiles) {
    const candidates: { x: number; y: number; score: number }[] = [];
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (tiles[y][x].terrain !== "land") {
          continue;
        }
        const d = Math.hypot(x - centerX, y - centerY);
        if (d <= protectedRadius + 3) {
          continue;
        }
        candidates.push({ x, y, score: tiles[y][x].elevation });
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    for (const candidate of candidates) {
      if (waterTiles >= targetWaterTiles) {
        break;
      }
      tiles[candidate.y][candidate.x].terrain = "water";
      waterTiles += 1;
    }
  } else if (waterTiles > targetWaterTiles) {
    const candidates: { x: number; y: number; score: number }[] = [];
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (tiles[y][x].terrain !== "water") {
          continue;
        }
        if (!hasLandNeighbor(tiles, x, y, cols, rows)) {
          continue;
        }
        candidates.push({ x, y, score: tiles[y][x].elevation });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    for (const candidate of candidates) {
      if (waterTiles <= targetWaterTiles) {
        break;
      }
      tiles[candidate.y][candidate.x].terrain = "land";
      waterTiles -= 1;
    }
  }

  tiles[centerY][centerX].terrain = "land";
  return tiles;
}

export function createMapLayer(map: Tile[][], cols: number, rows: number): MapLayer {
  const mapMinX = -rows * HALF_TILE_W;
  const mapMaxX = cols * HALF_TILE_W;
  const mapMinY = 0;
  const mapMaxY = (cols + rows) * HALF_TILE_H + TILE_HEIGHT;

  const paddingX = TILE_WIDTH * 2;
  const paddingY = TILE_HEIGHT * 2;
  const canvasWidth = Math.ceil(mapMaxX - mapMinX + paddingX * 2);
  const canvasHeight = Math.ceil(mapMaxY - mapMinY + paddingY * 2);

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const layerCtx = canvas.getContext("2d");
  if (!layerCtx) {
    return { canvas, offsetX: 0, offsetY: 0 };
  }

  const offsetX = -mapMinX + paddingX;
  const offsetY = -mapMinY + paddingY;
  const maxLayer = cols + rows - 2;

  for (let layer = 0; layer <= maxLayer; layer += 1) {
    for (let y = 0; y < rows; y += 1) {
      const x = layer - y;
      if (x < 0 || x >= cols) {
        continue;
      }
      const centerX = (x - y) * HALF_TILE_W + offsetX;
      const centerY = (x + y) * HALF_TILE_H + offsetY;
      drawTileAt(layerCtx, centerX, centerY, map[y][x]);
    }
  }

  return { canvas, offsetX, offsetY };
}

export function drawMapLayer(ctx: CanvasRenderingContext2D, mapLayer: MapLayer, camera: Camera): void {
  const drawX = camera.x - mapLayer.offsetX;
  const drawY = camera.y - mapLayer.offsetY;
  ctx.drawImage(mapLayer.canvas, drawX, drawY);
}

export function countWaterTiles(tiles: Tile[][]): number {
  let count = 0;
  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < tiles[y].length; x += 1) {
      if (tiles[y][x].terrain === "water") {
        count += 1;
      }
    }
  }
  return count;
}

function drawTileAt(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, tile: Tile): void {
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + HALF_TILE_W, centerY + HALF_TILE_H);
  ctx.lineTo(centerX, centerY + TILE_HEIGHT);
  ctx.lineTo(centerX - HALF_TILE_W, centerY + HALF_TILE_H);
  ctx.closePath();

  ctx.fillStyle = tile.terrain === "land" ? LAND_FILL : WATER_FILL;
  ctx.fill();
  ctx.strokeStyle = GRID_LINE;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

function isInBounds(x: number, y: number, cols: number, rows: number): boolean {
  return x >= 0 && y >= 0 && x < cols && y < rows;
}

function floodFillLand(tiles: Tile[][], startX: number, startY: number, cols: number, rows: number): Set<string> {
  const visited = new Set<string>();
  const queue = [{ x: startX, y: startY }];

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) {
      break;
    }
    const key = tileKey(next.x, next.y);
    if (visited.has(key)) {
      continue;
    }
    if (!isInBounds(next.x, next.y, cols, rows)) {
      continue;
    }
    if (tiles[next.y][next.x].terrain !== "land") {
      continue;
    }
    visited.add(key);
    queue.push({ x: next.x + 1, y: next.y });
    queue.push({ x: next.x - 1, y: next.y });
    queue.push({ x: next.x, y: next.y + 1 });
    queue.push({ x: next.x, y: next.y - 1 });
  }

  return visited;
}

function hasLandNeighbor(tiles: Tile[][], x: number, y: number, cols: number, rows: number): boolean {
  const neighbors = [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
  return neighbors.some((n) => isInBounds(n.x, n.y, cols, rows) && tiles[n.y][n.x].terrain === "land");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 0.001) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const sx = smoothStep(x - x0);
  const sy = smoothStep(y - y0);

  const n00 = hashNoise(x0, y0, seed);
  const n10 = hashNoise(x1, y0, seed);
  const n01 = hashNoise(x0, y1, seed);
  const n11 = hashNoise(x1, y1, seed);

  const ix0 = n00 + (n10 - n00) * sx;
  const ix1 = n01 + (n11 - n01) * sx;
  return ix0 + (ix1 - ix0) * sy;
}

function fbm(x: number, y: number, seed: number): number {
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  let norm = 0;
  for (let i = 0; i < 4; i += 1) {
    total += valueNoise(x * frequency, y * frequency, seed) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total / norm;
}
