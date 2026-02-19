import { screenToTile } from "./game/iso";
import {
  applyScreenOffsetToFocus,
  clampFocusToMap,
  drawCameraFocusDebug,
  syncCameraFromFocus,
  type CameraFocus,
} from "./game/camera";
import { createMinimapTexture, drawMinimap, isPointInMinimap, minimapScreenToTile } from "./game/minimap";
import { countWaterTiles, createMapLayer, drawMapLayer, generateMap } from "./game/terrain";
import { drawUnits, drawUnitsOnMinimap, pickUnitAtScreenPoint, pickUnitsInScreenRect, spawnUnits, updateUnits } from "./game/units";
import type { Camera } from "./game/types";

const MAP_COLS = 72;
const MAP_ROWS = 72;
const UNIT_COUNT = 6;
const CAMERA_SPEED = 900;
const EDGE_SCROLL_PX = 28;
const DRAG_THRESHOLD = 4;
const DEBUG_CAMERA_FOCUS = false;

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
const cameraFocus: CameraFocus = { x: spawn.x + 0.5, y: spawn.y + 0.5 };

const dragSelection = {
  isPointerDown: false,
  isDragging: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
};

let minimapProjection: ReturnType<typeof drawMinimap> | null = null;
const minimapPan = { active: false };

function resizeCanvas(): void {
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  canvas.width = viewportWidth;
  canvas.height = viewportHeight;
  clampFocusToMap(cameraFocus, MAP_COLS, MAP_ROWS);
  syncCameraFromFocus(camera, cameraFocus, viewportWidth, viewportHeight);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

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

  if (isPointInMinimap(event.clientX, event.clientY, minimapProjection)) {
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
  if (tileX < 0 || tileY < 0 || tileX >= MAP_COLS || tileY >= MAP_ROWS) {
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

  applyScreenOffsetToFocus(cameraFocus, dx * CAMERA_SPEED * deltaSeconds, dy * CAMERA_SPEED * deltaSeconds);
  clampFocusToMap(cameraFocus, MAP_COLS, MAP_ROWS);
  syncCameraFromFocus(camera, cameraFocus, viewportWidth, viewportHeight);
}

function drawBackground(): void {
  ctx.fillStyle = "#203447";
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);
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

function focusCameraFromMinimap(screenX: number, screenY: number): void {
  if (!minimapProjection) {
    return;
  }
  const tile = minimapScreenToTile(screenX, screenY, minimapProjection);
  cameraFocus.x = tile.x;
  cameraFocus.y = tile.y;
  clampFocusToMap(cameraFocus, MAP_COLS, MAP_ROWS);
  syncCameraFromFocus(camera, cameraFocus, viewportWidth, viewportHeight);
}

let lastTime = performance.now();
function frame(now: number): void {
  const deltaSeconds = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  updateCamera(deltaSeconds);
  updateUnits(units, map, deltaSeconds);

  drawBackground();
  drawMapLayer(ctx, mapLayer, camera);
  if (DEBUG_CAMERA_FOCUS) {
    drawCameraFocusDebug(ctx, camera, cameraFocus, viewportWidth, viewportHeight);
  }
  drawUnits(ctx, units, camera, selectedUnitIds);
  drawSelectionBox();
  minimapProjection = drawMinimap(ctx, minimapTexture, MAP_COLS, MAP_ROWS, camera, viewportWidth, viewportHeight);
  drawUnitsOnMinimap(ctx, units, selectedUnitIds, minimapProjection);
  drawInfo();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

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
