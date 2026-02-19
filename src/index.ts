import { HALF_TILE_H, HALF_TILE_W, screenToTile, tileToScreen } from "./game/iso";
import {
  clampCameraByCoverageAlongSegment,
  clampCameraToMapBounds,
  countWaterTiles,
  createMapLayer,
  createMinimapTexture,
  drawMapLayer,
  drawMinimap,
  generateMap,
} from "./game/terrain";
import { drawUnits, drawUnitsOnMinimap, pickUnitAtScreenPoint, pickUnitsInScreenRect, spawnUnits, updateUnits } from "./game/units";
import type { Camera } from "./game/types";

const MAP_COLS = 72;
const MAP_ROWS = 72;
const UNIT_COUNT = 6;
const CAMERA_SPEED = 900;
const EDGE_SCROLL_PX = 28;

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("2D canvas context is unavailable.");
}
document.body.appendChild(canvas);

const hud = document.createElement("div");
hud.style.position = "fixed";
hud.style.left = "10px";
hud.style.top = "10px";
hud.style.padding = "8px 10px";
hud.style.background = "rgba(0,0,0,0.45)";
hud.style.color = "#e8ffe0";
hud.style.fontSize = "12px";
hud.style.lineHeight = "1.4";
hud.style.border = "1px solid rgba(220, 255, 200, 0.3)";
hud.style.borderRadius = "5px";
hud.style.userSelect = "none";
hud.textContent =
  "Isometric local prototype | WASD / Arrows / edge-scroll camera | Left-click or drag to select | Right-click move selected units | Minimap click/drag pans camera";
document.body.appendChild(hud);

let viewportWidth = window.innerWidth;
let viewportHeight = window.innerHeight;
const keyState = new Set<string>();
let mouseX = 0;
let mouseY = 0;

const seed = (Math.random() * 0xffffffff) >>> 0;
const rng = mulberry32(seed);
const map = generateMap(MAP_COLS, MAP_ROWS, seed, rng);
const mapLayer = createMapLayer(map, MAP_COLS, MAP_ROWS);
const minimapTexture = createMinimapTexture(map);
const spawn = { x: Math.floor(MAP_COLS / 2), y: Math.floor(MAP_ROWS / 2) };
const units = spawnUnits(map, spawn, UNIT_COUNT, rng);
const selectedUnitIds = new Set<string>(units[0] ? [units[0].id] : []);
const camera: Camera = { x: 0, y: 0 };
const dragSelection = {
  isPointerDown: false,
  isDragging: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
};
const DRAG_THRESHOLD = 4;
let minimapProjection: ReturnType<typeof drawMinimap> | null = null;
const minimapPan = {
  active: false,
};

function resizeCanvas(): void {
  const previousCamera = { x: camera.x, y: camera.y };
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  canvas.width = viewportWidth;
  canvas.height = viewportHeight;
  clampCameraToMapBounds(camera, mapLayer, MAP_COLS, MAP_ROWS, viewportWidth, viewportHeight);
  clampCameraByCoverageAlongSegment(
    previousCamera,
    camera,
    mapLayer,
    MAP_COLS,
    MAP_ROWS,
    viewportWidth,
    viewportHeight,
    0.25,
  );
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const spawnScreen = tileToScreen(spawn.x + 0.5, spawn.y + 0.5, { x: 0, y: 0 });
camera.x = viewportWidth * 0.5 - spawnScreen.x;
camera.y = viewportHeight * 0.5 - spawnScreen.y;
clampCameraToMapBounds(camera, mapLayer, MAP_COLS, MAP_ROWS, viewportWidth, viewportHeight);

window.addEventListener("keydown", (event) => {
  keyState.add(event.key.toLowerCase());
});
window.addEventListener("keyup", (event) => {
  keyState.delete(event.key.toLowerCase());
});

canvas.addEventListener("mousemove", (event) => {
  mouseX = event.clientX;
  mouseY = event.clientY;
  if (minimapPan.active) {
    focusCameraFromMinimap(event.clientX, event.clientY);
    return;
  }
  if (!dragSelection.isPointerDown) {
    return;
  }
  dragSelection.currentX = event.clientX;
  dragSelection.currentY = event.clientY;
  const dx = dragSelection.currentX - dragSelection.startX;
  const dy = dragSelection.currentY - dragSelection.startY;
  if (!dragSelection.isDragging && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
    dragSelection.isDragging = true;
  }
});

canvas.addEventListener("mousedown", (event) => {
  if (event.button !== 0) {
    return;
  }
  if (isPointInMinimap(event.clientX, event.clientY)) {
    minimapPan.active = true;
    dragSelection.isPointerDown = false;
    dragSelection.isDragging = false;
    focusCameraFromMinimap(event.clientX, event.clientY);
    return;
  }
  dragSelection.isPointerDown = true;
  dragSelection.isDragging = false;
  dragSelection.startX = event.clientX;
  dragSelection.startY = event.clientY;
  dragSelection.currentX = event.clientX;
  dragSelection.currentY = event.clientY;
});

window.addEventListener("mouseup", (event) => {
  if (event.button !== 0) {
    return;
  }
  if (minimapPan.active) {
    minimapPan.active = false;
    return;
  }
  if (!dragSelection.isPointerDown) {
    return;
  }

  const minX = Math.min(dragSelection.startX, dragSelection.currentX);
  const minY = Math.min(dragSelection.startY, dragSelection.currentY);
  const maxX = Math.max(dragSelection.startX, dragSelection.currentX);
  const maxY = Math.max(dragSelection.startY, dragSelection.currentY);

  selectedUnitIds.clear();
  if (dragSelection.isDragging) {
    const selected = pickUnitsInScreenRect({ minX, minY, maxX, maxY }, camera, units);
    for (const unit of selected) {
      selectedUnitIds.add(unit.id);
    }
  } else {
    const clicked = pickUnitAtScreenPoint(event.clientX, event.clientY, camera, units);
    if (clicked) {
      selectedUnitIds.add(clicked.id);
    }
  }

  dragSelection.isPointerDown = false;
  dragSelection.isDragging = false;
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const selected = units.filter((unit) => selectedUnitIds.has(unit.id));
  if (selected.length === 0) {
    return;
  }
  const tile = screenToTile(event.clientX, event.clientY, camera);
  const tileX = Math.floor(tile.x);
  const tileY = Math.floor(tile.y);
  if (!isInBounds(tileX, tileY, MAP_COLS, MAP_ROWS)) {
    return;
  }
  if (map[tileY][tileX].terrain !== "land") {
    return;
  }
  const sharedTarget = { x: tileX + 0.5, y: tileY + 0.5 };
  for (const unit of selected) {
    unit.target = sharedTarget;
  }
});

function updateCamera(deltaSeconds: number): void {
  const previousCamera = { x: camera.x, y: camera.y };
  let dx = 0;
  let dy = 0;
  if (keyState.has("w") || keyState.has("arrowup")) {
    dy += 1;
  }
  if (keyState.has("s") || keyState.has("arrowdown")) {
    dy -= 1;
  }
  if (keyState.has("a") || keyState.has("arrowleft")) {
    dx += 1;
  }
  if (keyState.has("d") || keyState.has("arrowright")) {
    dx -= 1;
  }

  if (mouseX < EDGE_SCROLL_PX) {
    dx += 1;
  } else if (mouseX > viewportWidth - EDGE_SCROLL_PX) {
    dx -= 1;
  }
  if (mouseY < EDGE_SCROLL_PX) {
    dy += 1;
  } else if (mouseY > viewportHeight - EDGE_SCROLL_PX) {
    dy -= 1;
  }

  const length = Math.hypot(dx, dy);
  if (length > 0) {
    dx /= length;
    dy /= length;
  }
  camera.x += dx * CAMERA_SPEED * deltaSeconds;
  camera.y += dy * CAMERA_SPEED * deltaSeconds;
  clampCameraToMapBounds(camera, mapLayer, MAP_COLS, MAP_ROWS, viewportWidth, viewportHeight);
  clampCameraByCoverageAlongSegment(
    previousCamera,
    camera,
    mapLayer,
    MAP_COLS,
    MAP_ROWS,
    viewportWidth,
    viewportHeight,
    0.25,
  );
}

function drawBackground(): void {
  ctx.fillStyle = "#203447";
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);
}

function drawInfo(): void {
  const water = countWaterTiles(map);
  const total = MAP_COLS * MAP_ROWS;
  const ratio = ((water / total) * 100).toFixed(1);
  ctx.fillStyle = "rgba(0, 0, 0, 0.36)";
  ctx.fillRect(10, viewportHeight - 52, 280, 38);
  ctx.fillStyle = "#e5ffe1";
  ctx.font = "12px monospace";
  ctx.fillText(
    `Seed: ${seed} | Water: ${ratio}% | Units: ${units.length} | Selected: ${selectedUnitIds.size}`,
    18,
    viewportHeight - 29,
  );
}

function drawSelectionBox(): void {
  if (!dragSelection.isPointerDown || !dragSelection.isDragging) {
    return;
  }
  const minX = Math.min(dragSelection.startX, dragSelection.currentX);
  const minY = Math.min(dragSelection.startY, dragSelection.currentY);
  const width = Math.abs(dragSelection.currentX - dragSelection.startX);
  const height = Math.abs(dragSelection.currentY - dragSelection.startY);
  ctx.fillStyle = "rgba(180, 240, 155, 0.15)";
  ctx.fillRect(minX, minY, width, height);
  ctx.strokeStyle = "rgba(228, 255, 190, 0.9)";
  ctx.lineWidth = 1;
  ctx.strokeRect(minX + 0.5, minY + 0.5, width, height);
}

let lastTime = performance.now();
function frame(now: number): void {
  const deltaSeconds = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  updateCamera(deltaSeconds);
  updateUnits(units, map, deltaSeconds);

  drawBackground();
  drawMapLayer(ctx, mapLayer, camera);
  drawUnits(ctx, units, camera, selectedUnitIds);
  drawSelectionBox();
  minimapProjection = drawMinimap(
    ctx,
    minimapTexture,
    MAP_COLS,
    MAP_ROWS,
    camera,
    viewportWidth,
    viewportHeight,
  );
  drawUnitsOnMinimap(ctx, units, selectedUnitIds, minimapProjection);
  drawInfo();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function isInBounds(x: number, y: number, cols: number, rows: number): boolean {
  return x >= 0 && y >= 0 && x < cols && y < rows;
}

function mulberry32(initialSeed: number): () => number {
  let state = initialSeed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isPointInMinimap(x: number, y: number): boolean {
  if (!minimapProjection) {
    return false;
  }
  return (
    x >= minimapProjection.x &&
    x <= minimapProjection.x + minimapProjection.width &&
    y >= minimapProjection.y &&
    y <= minimapProjection.y + minimapProjection.height
  );
}

function focusCameraFromMinimap(screenX: number, screenY: number): void {
  if (!minimapProjection) {
    return;
  }
  const previousCamera = { x: camera.x, y: camera.y };
  const normX = clamp((screenX - minimapProjection.innerX) / minimapProjection.innerW, 0, 1);
  const normY = clamp((screenY - minimapProjection.innerY) / minimapProjection.innerH, 0, 1);
  const texX = normX * minimapProjection.textureWidth;
  const texY = normY * minimapProjection.textureHeight;

  const u = (texX - minimapProjection.originX) / minimapProjection.halfTileW;
  const v = (texY - 1) / minimapProjection.halfTileH;
  const tileX = (u + v) * 0.5;
  const tileY = (v - u) * 0.5;

  camera.x = viewportWidth * 0.5 - (tileX - tileY) * HALF_TILE_W;
  camera.y = viewportHeight * 0.5 - (tileX + tileY) * HALF_TILE_H;
  clampCameraToMapBounds(camera, mapLayer, MAP_COLS, MAP_ROWS, viewportWidth, viewportHeight);
  clampCameraByCoverageAlongSegment(
    previousCamera,
    camera,
    mapLayer,
    MAP_COLS,
    MAP_ROWS,
    viewportWidth,
    viewportHeight,
    0.25,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
