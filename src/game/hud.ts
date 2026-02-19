import type { Unit } from "./types";

export type HudLayout = {
  barX: number;
  barY: number;
  barWidth: number;
  barHeight: number;
  leftPanel: { x: number; y: number; width: number; height: number };
  centerPanel: { x: number; y: number; width: number; height: number };
  minimapPanel: { x: number; y: number; width: number; height: number };
  minimapFrame: { x: number; y: number; width: number; height: number; padding: number };
};

export type HudSelectionSlot = {
  unitId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getHudLayout(viewportWidth: number, viewportHeight: number): HudLayout {
  const barHeight = Math.max(152, Math.min(186, Math.round(viewportHeight * 0.24)));
  const barY = viewportHeight - barHeight;
  const leftWidth = Math.max(270, Math.min(360, Math.round(viewportWidth * 0.29)));
  const minimapWidth = Math.max(248, Math.min(310, Math.round(viewportWidth * 0.27)));
  const centerWidth = Math.max(200, viewportWidth - leftWidth - minimapWidth);

  const leftPanel = { x: 0, y: barY, width: leftWidth, height: barHeight };
  const centerPanel = { x: leftPanel.width, y: barY, width: centerWidth, height: barHeight };
  const minimapPanel = { x: centerPanel.x + centerPanel.width, y: barY, width: minimapWidth, height: barHeight };

  const insetX = 16;
  const insetY = 12;
  const frameWidth = minimapPanel.width - insetX * 2;
  const frameHeight = minimapPanel.height - insetY * 2;

  return {
    barX: 0,
    barY,
    barWidth: viewportWidth,
    barHeight,
    leftPanel,
    centerPanel,
    minimapPanel,
    minimapFrame: {
      x: minimapPanel.x + insetX,
      y: minimapPanel.y + insetY,
      width: frameWidth,
      height: frameHeight,
      padding: 6,
    },
  };
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  layout: HudLayout,
  selectedUnits: Unit[],
  focusedUnitId: string | null,
  unitCount: number,
  waterRatioPercent: string,
): void {
  const { leftPanel, centerPanel, minimapPanel } = layout;

  ctx.fillStyle = "rgba(34, 24, 13, 0.96)";
  ctx.fillRect(layout.barX, layout.barY, layout.barWidth, layout.barHeight);

  ctx.fillStyle = "rgba(67, 50, 31, 0.95)";
  ctx.fillRect(leftPanel.x + 8, leftPanel.y + 8, leftPanel.width - 16, leftPanel.height - 16);
  ctx.fillRect(centerPanel.x + 6, centerPanel.y + 8, centerPanel.width - 12, centerPanel.height - 16);
  ctx.fillRect(minimapPanel.x + 8, minimapPanel.y + 8, minimapPanel.width - 16, minimapPanel.height - 16);

  ctx.strokeStyle = "rgba(197, 170, 120, 0.8)";
  ctx.lineWidth = 2;
  ctx.strokeRect(leftPanel.x + 8, leftPanel.y + 8, leftPanel.width - 16, leftPanel.height - 16);
  ctx.strokeRect(centerPanel.x + 6, centerPanel.y + 8, centerPanel.width - 12, centerPanel.height - 16);
  ctx.strokeRect(minimapPanel.x + 8, minimapPanel.y + 8, minimapPanel.width - 16, minimapPanel.height - 16);

  const focusedUnit = getFocusedUnit(selectedUnits, focusedUnitId);
  drawSelectionInfo(ctx, leftPanel, selectedUnits, focusedUnit, unitCount, waterRatioPercent);
  drawSelectionRoster(ctx, centerPanel, selectedUnits, focusedUnit?.id ?? null);
}

function drawSelectionInfo(
  ctx: CanvasRenderingContext2D,
  panel: { x: number; y: number; width: number; height: number },
  selectedUnits: Unit[],
  focusedUnit: Unit | null,
  unitCount: number,
  waterRatioPercent: string,
): void {
  const x = panel.x + 22;
  let y = panel.y + 34;
  ctx.fillStyle = "#f7eac5";
  ctx.font = "bold 16px monospace";
  ctx.fillText("Selection", x, y);

  y += 28;
  if (focusedUnit) {
    const unit = focusedUnit;
    ctx.font = "bold 15px monospace";
    ctx.fillStyle = "#fff8cf";
    ctx.fillText(unit.name, x, y);
    y += 20;
    ctx.font = "13px monospace";
    ctx.fillStyle = "#efe1bb";
    ctx.fillText(`HP ${Math.round(unit.hp)}/${unit.maxHp}`, x, y);
    y += 18;
    ctx.fillText(`Move ${unit.speed.toFixed(1)}  Atk ${unit.attack}  Arm ${unit.armor}`, x, y);
    if (selectedUnits.length > 1) {
      y += 18;
      ctx.fillText(`${selectedUnits.length} units selected`, x, y);
    }
  } else {
    ctx.font = "13px monospace";
    ctx.fillStyle = "#efe1bb";
    const label = selectedUnits.length === 0 ? "No unit selected" : `${selectedUnits.length} units selected`;
    ctx.fillText(label, x, y);
    y += 18;
    ctx.fillText(`Army Size ${unitCount}`, x, y);
    y += 18;
    ctx.fillText(`Water ${waterRatioPercent}%`, x, y);
  }
}

function drawSelectionRoster(
  ctx: CanvasRenderingContext2D,
  panel: { x: number; y: number; width: number; height: number },
  selectedUnits: Unit[],
  focusedUnitId: string | null,
): void {
  const slots = getHudSelectionSlots(panel, selectedUnits);

  ctx.fillStyle = "#f7eac5";
  ctx.font = "bold 16px monospace";
  ctx.fillText("Units", panel.x + 20, panel.y + 22);

  for (const slot of slots) {
    const isFocused = slot.unitId === focusedUnitId;
    ctx.fillStyle = isFocused ? "rgba(162, 129, 73, 0.92)" : "rgba(128, 102, 60, 0.75)";
    ctx.fillRect(slot.x, slot.y, slot.width, slot.height);
    ctx.strokeStyle = "rgba(220, 194, 143, 0.65)";
    ctx.lineWidth = isFocused ? 2 : 1;
    ctx.strokeRect(slot.x + 0.5, slot.y + 0.5, slot.width - 1, slot.height - 1);

    ctx.fillStyle = "#ebdbc1";
    ctx.beginPath();
    ctx.arc(slot.x + slot.width * 0.5, slot.y + slot.height * 0.48, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#231a0f";
    ctx.font = "bold 10px monospace";
    ctx.fillText(slot.unitId.replace("unit-", "#"), slot.x + 7, slot.y + slot.height - 7);
  }
}

export function pickHudSelectedUnit(layout: HudLayout, selectedUnits: Unit[], x: number, y: number): string | null {
  const slots = getHudSelectionSlots(layout.centerPanel, selectedUnits);
  for (const slot of slots) {
    if (x >= slot.x && x <= slot.x + slot.width && y >= slot.y && y <= slot.y + slot.height) {
      return slot.unitId;
    }
  }
  return null;
}

function getHudSelectionSlots(panel: { x: number; y: number; width: number; height: number }, selectedUnits: Unit[]): HudSelectionSlot[] {
  const slotSize = 42;
  const gap = 10;
  const cols = Math.max(1, Math.floor((panel.width - 28) / (slotSize + gap)));
  const startX = panel.x + 20;
  const startY = panel.y + 26;
  const slots: HudSelectionSlot[] = [];

  for (let i = 0; i < selectedUnits.length; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    slots.push({
      unitId: selectedUnits[i].id,
      x: startX + col * (slotSize + gap),
      y: startY + row * (slotSize + gap),
      width: slotSize,
      height: slotSize,
    });
  }

  return slots;
}

function getFocusedUnit(selectedUnits: Unit[], focusedUnitId: string | null): Unit | null {
  if (selectedUnits.length === 0) {
    return null;
  }
  const focused = focusedUnitId ? selectedUnits.find((unit) => unit.id === focusedUnitId) : null;
  return focused ?? selectedUnits[0];
}
