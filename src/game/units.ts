import { HALF_TILE_H, tileToScreen } from "./iso";
import type { MinimapProjection } from "./minimap";
import type { Camera, Tile, Unit, Vec2 } from "./types";

export function spawnUnits(tiles: Tile[][], center: Vec2, count: number, random: () => number): Unit[] {
  const rows = tiles.length;
  const cols = tiles[0]?.length ?? 0;
  const spawned: Unit[] = [];
  let attempts = 0;

  while (spawned.length < count && attempts < 2000) {
    attempts += 1;
    const angle = random() * Math.PI * 2;
    const radius = 2 + random() * 7;
    const tx = Math.floor(center.x + Math.cos(angle) * radius);
    const ty = Math.floor(center.y + Math.sin(angle) * radius);
    if (!isInBounds(tx, ty, cols, rows) || tiles[ty][tx].terrain !== "land") {
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
      radiusPx: 11,
    });
  }

  return spawned;
}

export function pickUnitAtScreenPoint(
  x: number,
  y: number,
  camera: Camera,
  units: Unit[],
): Unit | null {
  let best: Unit | null = null;
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

export function updateUnits(units: Unit[], map: Tile[][], deltaSeconds: number): void {
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
    const nextX = unit.pos.x + (dx / dist) * step;
    const nextY = unit.pos.y + (dy / dist) * step;
    const tileX = Math.floor(nextX);
    const tileY = Math.floor(nextY);

    if (!isInBounds(tileX, tileY, cols, rows) || map[tileY][tileX].terrain !== "land") {
      unit.target = null;
      continue;
    }

    unit.pos.x = nextX;
    unit.pos.y = nextY;
  }
}

export function drawUnits(
  ctx: CanvasRenderingContext2D,
  units: Unit[],
  camera: Camera,
  selectedUnitIds: Set<string>,
): void {
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

export function drawUnitsOnMinimap(
  ctx: CanvasRenderingContext2D,
  units: Unit[],
  selectedUnitIds: Set<string>,
  projection: MinimapProjection,
): void {
  for (const unit of units) {
    const isSelected = selectedUnitIds.has(unit.id);
    const textureX = (unit.pos.x - unit.pos.y) * projection.halfTileW + projection.originX;
    const textureY = (unit.pos.x + unit.pos.y) * projection.halfTileH + 1;
    const mx = projection.innerX + (textureX / projection.textureWidth) * projection.innerW;
    const my = projection.innerY + (textureY / projection.textureHeight) * projection.innerH;
    ctx.fillStyle = isSelected ? "#fff8ab" : "#e6d4a5";
    ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
  }
}

export function pickUnitsInScreenRect(
  rect: { minX: number; minY: number; maxX: number; maxY: number },
  camera: Camera,
  units: Unit[],
): Unit[] {
  const selected: Unit[] = [];
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

function isInBounds(x: number, y: number, cols: number, rows: number): boolean {
  return x >= 0 && y >= 0 && x < cols && y < rows;
}
