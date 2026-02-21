import { screenToTile, tileToScreen } from "./game/iso";
import {
  applyScreenOffsetToFocus,
  clampFocusToMap,
  drawCameraFocusDebug,
  syncCameraFromFocus,
  type CameraFocus,
} from "./game/camera";
import {
  drawHud,
  drawHudModalOverlay,
  getHudLayout,
  getTopHudHeight,
  isPointInHudModal,
  isPointInHudModalClose,
  pickHudSelectedUnit,
  pickTopHudButton,
  type TopHudButtonId,
  type UiTheme,
} from "./game/hud";
import { createMinimapTexture, drawMinimap, isPointInMinimap, minimapScreenToTile } from "./game/minimap";
import { countWaterTiles, createMapLayer, drawMapLayer, generateMap } from "./game/terrain";
import { drawUnits, drawUnitsOnMinimap, pickUnitAtScreenPoint, pickUnitsInScreenRect, spawnUnits, updateUnits } from "./game/units";
import type { Camera } from "./game/types";

const MAP_COLS = 72;
const MAP_ROWS = 72;
const UNIT_COUNT = 6;
const CAMERA_SPEED = 900;
const CAMERA_EDGE_SCROLL_BORDER_PX = 10;
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
  startWorldX: 0,
  startWorldY: 0,
  startPointerX: 0,
  startPointerY: 0,
  currentX: 0,
  currentY: 0,
};

let minimapProjection: ReturnType<typeof drawMinimap> | null = null;
const minimapPan = { active: false };
let activeTopModalId: TopHudButtonId | null = null;
let uiTheme: UiTheme = "night";

function getGameCanvasBounds(): { x: number; y: number; width: number; height: number } {
  const topHudHeight = getTopHudHeight();
  const bottomHudTop = getHudLayout(viewportWidth, viewportHeight).barY;
  return { x: 0, y: topHudHeight, width: viewportWidth, height: Math.max(1, bottomHudTop - topHudHeight) };
}

function syncCameraToGameCanvas(): void {
  const gameCanvas = getGameCanvasBounds();
  syncCameraFromFocus(camera, cameraFocus, gameCanvas.width, gameCanvas.height);
  camera.y += gameCanvas.y;
}

function resizeCanvas(): void {
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  canvas.width = viewportWidth;
  canvas.height = viewportHeight;
  clampFocusToMap(cameraFocus, MAP_COLS, MAP_ROWS);
  syncCameraToGameCanvas();
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
  const dx = dragSelection.currentX - dragSelection.startPointerX;
  const dy = dragSelection.currentY - dragSelection.startPointerY;
  if (!dragSelection.isDragging && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
    dragSelection.isDragging = true;
  }
});

canvas.addEventListener("mousedown", (event) => {
  if (event.button !== 0) {
    return;
  }

  const topButtonId = pickTopHudButton(viewportWidth, event.clientX, event.clientY, uiTheme);
  if (topButtonId) {
    if (topButtonId === "ui-mode") {
      uiTheme = uiTheme === "night" ? "day" : "night";
      activeTopModalId = null;
    } else {
      activeTopModalId = topButtonId;
    }
    dragSelection.isPointerDown = false;
    dragSelection.isDragging = false;
    return;
  }

  if (activeTopModalId) {
    if (isPointInHudModalClose(viewportWidth, viewportHeight, event.clientX, event.clientY)) {
      activeTopModalId = null;
    } else if (!isPointInHudModal(viewportWidth, viewportHeight, event.clientX, event.clientY)) {
      activeTopModalId = null;
    }
    dragSelection.isPointerDown = false;
    dragSelection.isDragging = false;
    return;
  }

  const hudLayout = getHudLayout(viewportWidth, viewportHeight);
  const gameCanvas = getGameCanvasBounds();
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

  if (event.clientY < gameCanvas.y || event.clientY > gameCanvas.y + gameCanvas.height) {
    dragSelection.isPointerDown = false;
    dragSelection.isDragging = false;
    return;
  }

  dragSelection.isPointerDown = true;
  dragSelection.isDragging = false;
  const startTile = screenToTile(event.clientX, event.clientY, camera);
  dragSelection.startWorldX = startTile.x;
  dragSelection.startWorldY = startTile.y;
  dragSelection.startPointerX = event.clientX;
  dragSelection.startPointerY = event.clientY;
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

  selectedUnitIds.clear();
  if (dragSelection.isDragging) {
    const gameCanvas = getGameCanvasBounds();
    const startScreen = tileToScreen(dragSelection.startWorldX, dragSelection.startWorldY, camera);
    const endScreen = clampPointToGameCanvas(dragSelection.currentX, dragSelection.currentY, gameCanvas);
    const minX = Math.min(startScreen.x, endScreen.x);
    const minY = Math.min(startScreen.y, endScreen.y);
    const maxX = Math.max(startScreen.x, endScreen.x);
    const maxY = Math.max(startScreen.y, endScreen.y);
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
  if (activeTopModalId) {
    return;
  }
  const gameCanvas = getGameCanvasBounds();
  if (event.clientY < gameCanvas.y || event.clientY > gameCanvas.y + gameCanvas.height) {
    return;
  }
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

  if (mouseX < CAMERA_EDGE_SCROLL_BORDER_PX) {
    dx += 1;
  } else if (mouseX > viewportWidth - CAMERA_EDGE_SCROLL_BORDER_PX) {
    dx -= 1;
  }
  if (mouseY < CAMERA_EDGE_SCROLL_BORDER_PX) {
    dy += 1;
  } else if (mouseY > viewportHeight - CAMERA_EDGE_SCROLL_BORDER_PX) {
    dy -= 1;
  }

  const length = Math.hypot(dx, dy);
  if (length > 0) {
    dx /= length;
    dy /= length;
  }

  applyScreenOffsetToFocus(cameraFocus, dx * CAMERA_SPEED * deltaSeconds, dy * CAMERA_SPEED * deltaSeconds);
  clampFocusToMap(cameraFocus, MAP_COLS, MAP_ROWS);
  syncCameraToGameCanvas();
}

function drawBackground(): void {
  const gameCanvas = getGameCanvasBounds();
  ctx.fillStyle = "#203447";
  ctx.fillRect(gameCanvas.x, gameCanvas.y, gameCanvas.width, gameCanvas.height);
}

function drawSelectionBox(): void {
  if (!dragSelection.isPointerDown || !dragSelection.isDragging) {
    return;
  }
  const gameCanvas = getGameCanvasBounds();
  const startScreen = tileToScreen(dragSelection.startWorldX, dragSelection.startWorldY, camera);
  const endScreen = clampPointToGameCanvas(dragSelection.currentX, dragSelection.currentY, gameCanvas);
  const minX = Math.min(startScreen.x, endScreen.x);
  const minY = Math.min(startScreen.y, endScreen.y);
  const width = Math.abs(endScreen.x - startScreen.x);
  const height = Math.abs(endScreen.y - startScreen.y);
  ctx.fillStyle = "rgba(180, 240, 155, 0.15)";
  ctx.fillRect(minX, minY, width, height);
  ctx.strokeStyle = "rgba(228, 255, 190, 0.9)";
  ctx.lineWidth = 1;
  ctx.strokeRect(minX + 0.5, minY + 0.5, width, height);
}

function drawInfo(): void {
  const hudLayout = getHudLayout(viewportWidth, viewportHeight);
  const selectedUnits = units.filter((unit) => selectedUnitIds.has(unit.id));
  drawHud(ctx, hudLayout, selectedUnits, focusedUnitId, units.length, waterRatioPercent, activeTopModalId, uiTheme);
  const gameCanvas = getGameCanvasBounds();

  minimapProjection = drawMinimap(
    ctx,
    minimapTexture,
    MAP_COLS,
    MAP_ROWS,
    camera,
    viewportWidth,
    gameCanvas.height,
    {
      ...hudLayout.minimapFrame,
      borderColor: "rgba(223, 204, 153, 0.85)",
    },
    gameCanvas.y,
  );
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
  syncCameraToGameCanvas();
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

function clampPointToGameCanvas(
  x: number,
  y: number,
  gameCanvas: { x: number; y: number; width: number; height: number },
): { x: number; y: number } {
  const maxX = Math.max(gameCanvas.x, gameCanvas.x + gameCanvas.width - 1);
  const maxY = Math.max(gameCanvas.y, gameCanvas.y + gameCanvas.height - 1);
  return {
    x: clamp(x, gameCanvas.x, maxX),
    y: clamp(y, gameCanvas.y, maxY),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

let lastTime = performance.now();
function frame(now: number): void {
  const deltaSeconds = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  updateCamera(deltaSeconds);
  updateUnits(units, map, deltaSeconds);

  const gameCanvas = getGameCanvasBounds();
  ctx.save();
  ctx.beginPath();
  ctx.rect(gameCanvas.x, gameCanvas.y, gameCanvas.width, gameCanvas.height);
  ctx.clip();
  drawBackground();
  drawMapLayer(ctx, mapLayer, camera);
  if (DEBUG_CAMERA_FOCUS) {
    drawCameraFocusDebug(ctx, camera, cameraFocus, gameCanvas.width, gameCanvas.height);
  }
  drawUnits(ctx, units, camera, selectedUnitIds);
  drawSelectionBox();
  ctx.restore();
  drawInfo();
  drawHudModalOverlay(ctx, viewportWidth, viewportHeight, activeTopModalId, uiTheme);

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
