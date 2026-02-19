import { screenToTile } from "./game/iso";
import {
  applyScreenOffsetToFocus,
  clampFocusToMap,
  drawCameraFocusDebug,
  syncCameraFromFocus,
  type CameraFocus,
} from "./game/camera";
import { drawHud, getHudLayout, pickHudSelectedUnit } from "./game/hud";
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

let viewportWidth = window.innerWidth;
let viewportHeight = window.innerHeight;
const keyState = new Set<string>();
let mouseX = 0;
let mouseY = 0;

const seed = (Math.random() * 0xffffffff) >>> 0;
const rng = mulberry32(seed);
const map = generateMap(MAP_COLS, MAP_ROWS, seed, rng);
const waterTiles = countWaterTiles(map);
const waterRatioPercent = ((waterTiles / (MAP_COLS * MAP_ROWS)) * 100).toFixed(1);
const mapLayer = createMapLayer(map, MAP_COLS, MAP_ROWS);
const minimapTexture = createMinimapTexture(map);
const spawn = { x: Math.floor(MAP_COLS / 2), y: Math.floor(MAP_ROWS / 2) };
const units = spawnUnits(map, spawn, UNIT_COUNT, rng);
const selectedUnitIds = new Set<string>(units[0] ? [units[0].id] : []);
let focusedUnitId: string | null = units[0]?.id ?? null;
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

  const hudLayout = getHudLayout(viewportWidth, viewportHeight);
  if (isPointInMinimap(event.clientX, event.clientY, minimapProjection)) {
    minimapPan.active = true;
    dragSelection.isPointerDown = false;
    dragSelection.isDragging = false;
    focusCameraFromMinimap(event.clientX, event.clientY);
    return;
  }

  if (event.clientY >= hudLayout.barY) {
    const selectedUnits = units.filter((unit) => selectedUnitIds.has(unit.id));
    const clickedHudUnitId = pickHudSelectedUnit(hudLayout, selectedUnits, event.clientX, event.clientY);
    if (clickedHudUnitId) {
      focusedUnitId = clickedHudUnitId;
    }
    dragSelection.isPointerDown = false;
    dragSelection.isDragging = false;
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

  syncFocusedUnitSelection();
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

  if (keyState.has("arrowup")) {
    dy += 1;
  }
  if (keyState.has("arrowdown")) {
    dy -= 1;
  }
  if (keyState.has("arrowleft")) {
    dx += 1;
  }
  if (keyState.has("arrowright")) {
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
  const hudLayout = getHudLayout(viewportWidth, viewportHeight);
  const selectedUnits = units.filter((unit) => selectedUnitIds.has(unit.id));
  drawHud(ctx, hudLayout, selectedUnits, focusedUnitId, units.length, waterRatioPercent);

  minimapProjection = drawMinimap(ctx, minimapTexture, MAP_COLS, MAP_ROWS, camera, viewportWidth, viewportHeight, {
    ...hudLayout.minimapFrame,
    backgroundColor: "rgba(15, 24, 17, 0.88)",
    borderColor: "rgba(223, 204, 153, 0.85)",
  });
  drawUnitsOnMinimap(ctx, units, selectedUnitIds, minimapProjection);

  ctx.fillStyle = "#f0e4c3";
  ctx.font = "12px monospace";
  ctx.fillText(
    `Seed ${seed} | Water ${waterRatioPercent}% | Army ${units.length} | Selected ${selectedUnitIds.size}`,
    hudLayout.centerPanel.x + 18,
    hudLayout.barY + hudLayout.barHeight - 14,
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

function syncFocusedUnitSelection(): void {
  if (selectedUnitIds.size === 0) {
    focusedUnitId = null;
    return;
  }

  if (focusedUnitId && selectedUnitIds.has(focusedUnitId)) {
    return;
  }

  const firstSelected = units.find((unit) => selectedUnitIds.has(unit.id));
  focusedUnitId = firstSelected?.id ?? null;
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
