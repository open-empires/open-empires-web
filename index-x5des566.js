// src/game/iso.ts
var TILE_WIDTH = 64;
var TILE_HEIGHT = 32;
var HALF_TILE_W = TILE_WIDTH / 2;
var HALF_TILE_H = TILE_HEIGHT / 2;
function tileToScreen(tileX, tileY, cam) {
  return {
    x: (tileX - tileY) * HALF_TILE_W + cam.x,
    y: (tileX + tileY) * HALF_TILE_H + cam.y
  };
}
function screenToTile(screenX, screenY, cam) {
  const localX = screenX - cam.x;
  const localY = screenY - cam.y;
  return {
    x: (localX / HALF_TILE_W + localY / HALF_TILE_H) * 0.5,
    y: (localY / HALF_TILE_H - localX / HALF_TILE_W) * 0.5
  };
}

// src/game/camera.ts
function clampFocusToMap(focus, mapCols, mapRows) {
  focus.x = clamp(focus.x, 0, mapCols - 0.001);
  focus.y = clamp(focus.y, 0, mapRows - 0.001);
}
function syncCameraFromFocus(camera, focus, viewportWidth, viewportHeight) {
  camera.x = viewportWidth * 0.5 - (focus.x - focus.y) * HALF_TILE_W;
  camera.y = viewportHeight * 0.5 - (focus.x + focus.y) * HALF_TILE_H;
}
function applyScreenOffsetToFocus(focus, offsetDx, offsetDy) {
  const focusDx = -0.5 * (offsetDx / HALF_TILE_W + offsetDy / HALF_TILE_H);
  const focusDy = 0.5 * (offsetDx / HALF_TILE_W - offsetDy / HALF_TILE_H);
  focus.x += focusDx;
  focus.y += focusDy;
}
function drawCameraFocusDebug(ctx, camera, focus, viewportWidth, viewportHeight) {
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
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// src/game/terrain.ts
var LAND_FILL = "#4f9b47";
var WATER_FILL = "#2f5f8f";
var GRID_LINE = "rgba(230, 246, 222, 0.28)";
var TARGET_WATER_RATIO = 0.5;
function generateMap(cols, rows, seed, random) {
  const elevationMap = [];
  const entries = [];
  const coastOffsetX = random() * 1000;
  const coastOffsetY = random() * 1000;
  const ridgeOffsetX = random() * 1000;
  const ridgeOffsetY = random() * 1000;
  for (let y = 0;y < rows; y += 1) {
    const row = [];
    for (let x = 0;x < cols; x += 1) {
      const nx = x / (cols - 1) * 2 - 1;
      const ny = y / (rows - 1) * 2 - 1;
      const radial = Math.hypot(nx, ny);
      const islandShape = 1 - Math.pow(clamp2(radial, 0, 1), 1.25);
      const coastlineNoise = fbm(x * 0.09 + coastOffsetX, y * 0.09 + coastOffsetY, seed);
      const ridgeNoise = fbm(x * 0.21 + ridgeOffsetX, y * 0.21 + ridgeOffsetY, seed);
      const edgeFalloff = Math.pow(Math.max(Math.abs(nx), Math.abs(ny)), 1.45);
      const elevation = islandShape * 0.9 + (coastlineNoise - 0.5) * 0.5 + (ridgeNoise - 0.5) * 0.22 - edgeFalloff * 0.58;
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
  const tiles = [];
  for (let y = 0;y < rows; y += 1) {
    const row = [];
    for (let x = 0;x < cols; x += 1) {
      const distToCenter = Math.hypot(x - centerX, y - centerY);
      const forceLand = distToCenter <= protectedRadius;
      const terrain = forceLand || elevationMap[y][x] > threshold ? "land" : "water";
      row.push({ terrain, elevation: elevationMap[y][x] });
    }
    tiles.push(row);
  }
  const connected = floodFillLand(tiles, centerX, centerY, cols, rows);
  for (let y = 0;y < rows; y += 1) {
    for (let x = 0;x < cols; x += 1) {
      if (tiles[y][x].terrain === "land" && !connected.has(tileKey(x, y))) {
        tiles[y][x].terrain = "water";
      }
    }
  }
  let waterTiles = countWaterTiles(tiles);
  const targetWaterTiles = Math.floor(cols * rows * TARGET_WATER_RATIO);
  if (waterTiles < targetWaterTiles) {
    const candidates = [];
    for (let y = 0;y < rows; y += 1) {
      for (let x = 0;x < cols; x += 1) {
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
    const candidates = [];
    for (let y = 0;y < rows; y += 1) {
      for (let x = 0;x < cols; x += 1) {
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
function createMapLayer(map, cols, rows) {
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
  for (let layer = 0;layer <= maxLayer; layer += 1) {
    for (let y = 0;y < rows; y += 1) {
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
function drawMapLayer(ctx, mapLayer, camera) {
  const drawX = camera.x - mapLayer.offsetX;
  const drawY = camera.y - mapLayer.offsetY;
  ctx.drawImage(mapLayer.canvas, drawX, drawY);
}
function countWaterTiles(tiles) {
  let count = 0;
  for (let y = 0;y < tiles.length; y += 1) {
    for (let x = 0;x < tiles[y].length; x += 1) {
      if (tiles[y][x].terrain === "water") {
        count += 1;
      }
    }
  }
  return count;
}
function drawTileAt(ctx, centerX, centerY, tile) {
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
function tileKey(x, y) {
  return `${x},${y}`;
}
function isInBounds(x, y, cols, rows) {
  return x >= 0 && y >= 0 && x < cols && y < rows;
}
function floodFillLand(tiles, startX, startY, cols, rows) {
  const visited = new Set;
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
function hasLandNeighbor(tiles, x, y, cols, rows) {
  const neighbors = [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 }
  ];
  return neighbors.some((n) => isInBounds(n.x, n.y, cols, rows) && tiles[n.y][n.x].terrain === "land");
}
function clamp2(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function hashNoise(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 0.001) * 43758.5453123;
  return n - Math.floor(n);
}
function smoothStep(t) {
  return t * t * (3 - 2 * t);
}
function valueNoise(x, y, seed) {
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
function fbm(x, y, seed) {
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  let norm = 0;
  for (let i = 0;i < 4; i += 1) {
    total += valueNoise(x * frequency, y * frequency, seed) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total / norm;
}

// src/game/minimap.ts
var MINIMAP_HALF_TILE_W = 2;
var MINIMAP_HALF_TILE_H = 1;
function createMinimapTexture(map) {
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
  for (let layer = 0;layer <= cols + rows - 2; layer += 1) {
    for (let y = 0;y < rows; y += 1) {
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
function drawMinimap(ctx, minimapTexture, mapCols, mapRows, camera, viewportWidth, viewportHeight) {
  const padding = 12;
  const width = 220;
  const height = 148;
  const x = viewportWidth - width - padding;
  const y = viewportHeight - height - padding;
  ctx.fillStyle = "rgba(10, 18, 28, 0.68)";
  ctx.fillRect(x, y, width, height);
  const innerX = x + 4;
  const innerY = y + 4;
  const innerW = width - 8;
  const innerH = height - 8;
  ctx.drawImage(minimapTexture, innerX, innerY, innerW, innerH);
  ctx.strokeStyle = "rgba(210, 235, 195, 0.7)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  const originX = mapRows * MINIMAP_HALF_TILE_W + 1;
  const toMiniTexture = (tileX, tileY) => ({
    x: (tileX - tileY) * MINIMAP_HALF_TILE_W + originX,
    y: (tileX + tileY) * MINIMAP_HALF_TILE_H + 1
  });
  const toMiniScreen = (tileX, tileY) => {
    const p = toMiniTexture(tileX, tileY);
    return {
      x: innerX + p.x / minimapTexture.width * innerW,
      y: innerY + p.y / minimapTexture.height * innerH
    };
  };
  const corners = [
    screenToTile(0, 0, camera),
    screenToTile(viewportWidth, 0, camera),
    screenToTile(0, viewportHeight, camera),
    screenToTile(viewportWidth, viewportHeight, camera)
  ];
  const miniCorners = corners.map((corner) => toMiniScreen(corner.x, corner.y));
  const minX = Math.min(...miniCorners.map((p) => p.x));
  const maxX = Math.max(...miniCorners.map((p) => p.x));
  const minY = Math.min(...miniCorners.map((p) => p.y));
  const maxY = Math.max(...miniCorners.map((p) => p.y));
  ctx.strokeStyle = "#f5ff86";
  ctx.lineWidth = 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
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
    halfTileH: MINIMAP_HALF_TILE_H
  };
}
function isPointInMinimap(x, y, projection) {
  if (!projection) {
    return false;
  }
  return x >= projection.x && x <= projection.x + projection.width && y >= projection.y && y <= projection.y + projection.height;
}
function minimapScreenToTile(screenX, screenY, projection) {
  const normX = clamp3((screenX - projection.innerX) / projection.innerW, 0, 1);
  const normY = clamp3((screenY - projection.innerY) / projection.innerH, 0, 1);
  const texX = normX * projection.textureWidth;
  const texY = normY * projection.textureHeight;
  const u = (texX - projection.originX) / projection.halfTileW;
  const v = (texY - 1) / projection.halfTileH;
  return {
    x: (u + v) * 0.5,
    y: (v - u) * 0.5
  };
}
function clamp3(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// src/game/units.ts
function spawnUnits(tiles, center, count, random) {
  const rows = tiles.length;
  const cols = tiles[0]?.length ?? 0;
  const spawned = [];
  let attempts = 0;
  while (spawned.length < count && attempts < 2000) {
    attempts += 1;
    const angle = random() * Math.PI * 2;
    const radius = 2 + random() * 7;
    const tx = Math.floor(center.x + Math.cos(angle) * radius);
    const ty = Math.floor(center.y + Math.sin(angle) * radius);
    if (!isInBounds2(tx, ty, cols, rows) || tiles[ty][tx].terrain !== "land") {
      continue;
    }
    const px = tx + 0.2 + random() * 0.6;
    const py = ty + 0.2 + random() * 0.6;
    if (spawned.some((u) => Math.hypot(u.pos.x - px, u.pos.y - py) < 0.6)) {
      continue;
    }
    spawned.push({
      id: `unit-${spawned.length + 1}`,
      pos: { x: px, y: py },
      target: null,
      speed: 2.7,
      radiusPx: 11
    });
  }
  return spawned;
}
function pickUnitAtScreenPoint(x, y, camera, units) {
  let best = null;
  let bestDist = Infinity;
  for (const unit of units) {
    const p = tileToScreen(unit.pos.x, unit.pos.y, camera);
    const ux = p.x;
    const uy = p.y + HALF_TILE_H - 12;
    const d = Math.hypot(x - ux, y - uy);
    if (d <= unit.radiusPx + 3 && d < bestDist) {
      best = unit;
      bestDist = d;
    }
  }
  return best;
}
function updateUnits(units, map, deltaSeconds) {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  for (const unit of units) {
    if (!unit.target) {
      continue;
    }
    const dx = unit.target.x - unit.pos.x;
    const dy = unit.target.y - unit.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.03) {
      unit.pos.x = unit.target.x;
      unit.pos.y = unit.target.y;
      unit.target = null;
      continue;
    }
    const step = Math.min(unit.speed * deltaSeconds, dist);
    const nextX = unit.pos.x + dx / dist * step;
    const nextY = unit.pos.y + dy / dist * step;
    const tileX = Math.floor(nextX);
    const tileY = Math.floor(nextY);
    if (!isInBounds2(tileX, tileY, cols, rows) || map[tileY][tileX].terrain !== "land") {
      unit.target = null;
      continue;
    }
    unit.pos.x = nextX;
    unit.pos.y = nextY;
  }
}
function drawUnits(ctx, units, camera, selectedUnitIds) {
  const sorted = [...units].sort((a, b) => a.pos.x + a.pos.y - (b.pos.x + b.pos.y));
  for (const unit of sorted) {
    const p = tileToScreen(unit.pos.x, unit.pos.y, camera);
    const footY = p.y + HALF_TILE_H;
    const isSelected = selectedUnitIds.has(unit.id);
    if (isSelected) {
      ctx.beginPath();
      ctx.ellipse(p.x, footY + 2, 14, 7, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "#f5ff86";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p.x, footY - 12, unit.radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = "#e6d4a5";
    ctx.fill();
    ctx.strokeStyle = "#4d3f25";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (unit.target && isSelected) {
      const t = tileToScreen(unit.target.x, unit.target.y, camera);
      const targetY = t.y + HALF_TILE_H;
      ctx.beginPath();
      ctx.ellipse(t.x, targetY + 1, 11, 5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}
function drawUnitsOnMinimap(ctx, units, selectedUnitIds, projection) {
  for (const unit of units) {
    const isSelected = selectedUnitIds.has(unit.id);
    const textureX = (unit.pos.x - unit.pos.y) * projection.halfTileW + projection.originX;
    const textureY = (unit.pos.x + unit.pos.y) * projection.halfTileH + 1;
    const mx = projection.innerX + textureX / projection.textureWidth * projection.innerW;
    const my = projection.innerY + textureY / projection.textureHeight * projection.innerH;
    ctx.fillStyle = isSelected ? "#fff8ab" : "#e6d4a5";
    ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
  }
}
function pickUnitsInScreenRect(rect, camera, units) {
  const selected = [];
  for (const unit of units) {
    const p = tileToScreen(unit.pos.x, unit.pos.y, camera);
    const ux = p.x;
    const uy = p.y + HALF_TILE_H - 12;
    if (ux >= rect.minX && ux <= rect.maxX && uy >= rect.minY && uy <= rect.maxY) {
      selected.push(unit);
    }
  }
  return selected;
}
function isInBounds2(x, y, cols, rows) {
  return x >= 0 && y >= 0 && x < cols && y < rows;
}

// src/index.ts
var MAP_COLS = 72;
var MAP_ROWS = 72;
var UNIT_COUNT = 6;
var CAMERA_SPEED = 900;
var EDGE_SCROLL_PX = 28;
var DRAG_THRESHOLD = 4;
var DEBUG_CAMERA_FOCUS = false;
var canvas = document.createElement("canvas");
var ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("2D canvas context is unavailable.");
}
document.body.appendChild(canvas);
var hud = document.createElement("div");
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
hud.textContent = "Isometric local prototype | WASD / Arrows / edge-scroll camera | Left-click or drag to select | Right-click move selected units | Minimap click/drag pans camera";
document.body.appendChild(hud);
var viewportWidth = window.innerWidth;
var viewportHeight = window.innerHeight;
var keyState = new Set;
var mouseX = 0;
var mouseY = 0;
var seed = Math.random() * 4294967295 >>> 0;
var rng = mulberry32(seed);
var map = generateMap(MAP_COLS, MAP_ROWS, seed, rng);
var mapLayer = createMapLayer(map, MAP_COLS, MAP_ROWS);
var minimapTexture = createMinimapTexture(map);
var spawn = { x: Math.floor(MAP_COLS / 2), y: Math.floor(MAP_ROWS / 2) };
var units = spawnUnits(map, spawn, UNIT_COUNT, rng);
var selectedUnitIds = new Set(units[0] ? [units[0].id] : []);
var camera = { x: 0, y: 0 };
var cameraFocus = { x: spawn.x + 0.5, y: spawn.y + 0.5 };
var dragSelection = {
  isPointerDown: false,
  isDragging: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0
};
var minimapProjection = null;
var minimapPan = { active: false };
function resizeCanvas() {
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
function updateCamera(deltaSeconds) {
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
function drawBackground() {
  ctx.fillStyle = "#203447";
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);
}
function drawSelectionBox() {
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
function drawInfo() {
  const water = countWaterTiles(map);
  const total = MAP_COLS * MAP_ROWS;
  const ratio = (water / total * 100).toFixed(1);
  ctx.fillStyle = "rgba(0, 0, 0, 0.36)";
  ctx.fillRect(10, viewportHeight - 52, 280, 38);
  ctx.fillStyle = "#e5ffe1";
  ctx.font = "12px monospace";
  ctx.fillText(`Seed: ${seed} | Water: ${ratio}% | Units: ${units.length} | Selected: ${selectedUnitIds.size}`, 18, viewportHeight - 29);
}
function focusCameraFromMinimap(screenX, screenY) {
  if (!minimapProjection) {
    return;
  }
  const tile = minimapScreenToTile(screenX, screenY, minimapProjection);
  cameraFocus.x = tile.x;
  cameraFocus.y = tile.y;
  clampFocusToMap(cameraFocus, MAP_COLS, MAP_ROWS);
  syncCameraFromFocus(camera, cameraFocus, viewportWidth, viewportHeight);
}
var lastTime = performance.now();
function frame(now) {
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
function mulberry32(initialSeed) {
  let state = initialSeed >>> 0;
  return () => {
    state += 1831565813;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
