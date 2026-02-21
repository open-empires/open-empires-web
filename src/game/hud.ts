import type { Unit } from "./types";

const TOP_HUD_HEIGHT = 46;
const MAX_MODAL_WIDTH_PX = 1000;
const MAX_MODAL_HEIGHT_PX = 680;
const MIN_MODAL_WIDTH_PX = 340;
const MIN_MODAL_HEIGHT_PX = 220;
const MIN_GAME_CANVAS_VISIBLE_SIDE_PX = 84;
const MIN_GAME_CANVAS_VISIBLE_VERTICAL_PX = 56;
const MIN_MODAL_SCREEN_EDGE_PX = 6;

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type UiTheme = "day" | "night";

export type TopHudButtonId = "ui-mode" | "settings" | "chat" | "tech-tree" | "diplomacy" | "sign-in";

export type TopHudButton = {
  id: TopHudButtonId;
  label: string;
  title: string;
  rect: Rect;
  icon?: "gear" | "sun" | "moon";
};

export type HudLayout = {
  barX: number;
  barY: number;
  barWidth: number;
  barHeight: number;
  leftPanel: Rect;
  centerPanel: Rect;
  minimapPanel: Rect;
  minimapFrame: { x: number; y: number; width: number; height: number; padding: number };
};

export type HudSelectionSlot = {
  unitId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HudModalLayout = {
  rect: Rect;
  closeRect: Rect;
};

type HudPalette = {
  topBar: string;
  topBorder: string;
  chipFill: string;
  buttonFill: string;
  buttonActiveFill: string;
  panelBase: string;
  panelBorder: string;
  bodyText: string;
  titleText: string;
  selectionFill: string;
  selectionFocusFill: string;
  modalBackdrop: string;
  modalFill: string;
  modalBorder: string;
  modalCloseFill: string;
};

export function getTopHudHeight(): number {
  return TOP_HUD_HEIGHT;
}

export function getTopHudButtons(viewportWidth: number, uiTheme: UiTheme): TopHudButton[] {
  const buttonHeight = 30;
  const topY = Math.floor((TOP_HUD_HEIGHT - buttonHeight) * 0.5);
  const rightPadding = 14;
  const gap = 10;

  const rightButtons: TopHudButton[] = [
    { id: "settings", label: "", title: "Settings", icon: "gear", rect: { x: 0, y: topY, width: 42, height: buttonHeight } },
    { id: "diplomacy", label: "Diplo", title: "Diplomacy", rect: { x: 0, y: topY, width: 76, height: buttonHeight } },
    { id: "chat", label: "Chat", title: "Chat", rect: { x: 0, y: topY, width: 64, height: buttonHeight } },
    { id: "tech-tree", label: "Tech", title: "Tech Tree", rect: { x: 0, y: topY, width: 64, height: buttonHeight } },
    {
      id: "ui-mode",
      label: "",
      title: uiTheme === "night" ? "Day Mode" : "Night Mode",
      icon: uiTheme === "night" ? "sun" : "moon",
      rect: { x: 0, y: topY, width: 42, height: buttonHeight },
    },
  ];

  let cursorX = viewportWidth - rightPadding;
  for (const button of rightButtons) {
    cursorX -= button.rect.width;
    button.rect.x = cursorX;
    cursorX -= gap;
  }

  const signInWidth = 132;
  const centerButton: TopHudButton = {
    id: "sign-in",
    label: "Sign In",
    title: "Sign In",
    rect: {
      x: Math.floor((viewportWidth - signInWidth) * 0.5),
      y: topY,
      width: signInWidth,
      height: buttonHeight,
    },
  };

  return [centerButton, ...rightButtons];
}

export function pickTopHudButton(viewportWidth: number, x: number, y: number, uiTheme: UiTheme): TopHudButtonId | null {
  if (y < 0 || y > TOP_HUD_HEIGHT) {
    return null;
  }
  for (const button of getTopHudButtons(viewportWidth, uiTheme)) {
    if (pointInRect(x, y, button.rect)) {
      return button.id;
    }
  }
  return null;
}

export function getHudModalLayout(viewportWidth: number, viewportHeight: number): HudModalLayout {
  const hudLayout = getHudLayout(viewportWidth, viewportHeight);
  const gameCanvasX = 0;
  const gameCanvasY = TOP_HUD_HEIGHT;
  const gameCanvasWidth = viewportWidth;
  const gameCanvasHeight = Math.max(1, hudLayout.barY - gameCanvasY);

  const maxWidthByVisibleSides = Math.max(
    MIN_MODAL_WIDTH_PX,
    gameCanvasWidth - MIN_GAME_CANVAS_VISIBLE_SIDE_PX * 2,
  );
  const maxHeightByVisibleEdges = Math.max(
    MIN_MODAL_HEIGHT_PX,
    gameCanvasHeight - MIN_GAME_CANVAS_VISIBLE_VERTICAL_PX * 2,
  );

  const preferredWidth = Math.floor(gameCanvasWidth * 0.74);
  const preferredHeight = Math.floor(gameCanvasHeight * 0.72);
  const width = clamp(preferredWidth, MIN_MODAL_WIDTH_PX, Math.min(MAX_MODAL_WIDTH_PX, maxWidthByVisibleSides));
  const height = clamp(preferredHeight, MIN_MODAL_HEIGHT_PX, Math.min(MAX_MODAL_HEIGHT_PX, maxHeightByVisibleEdges));

  const gameCanvasVerticalPadding = Math.floor((gameCanvasHeight - height) * 0.5);
  const shouldCenterInScreen = gameCanvasVerticalPadding <= 0;
  const rawX = gameCanvasX + Math.floor((gameCanvasWidth - width) * 0.5);
  const rawY = shouldCenterInScreen
    ? Math.floor((viewportHeight - height) * 0.5)
    : gameCanvasY + gameCanvasVerticalPadding;

  const x = clamp(rawX, MIN_MODAL_SCREEN_EDGE_PX, Math.max(MIN_MODAL_SCREEN_EDGE_PX, viewportWidth - width - MIN_MODAL_SCREEN_EDGE_PX));
  const y = clamp(rawY, MIN_MODAL_SCREEN_EDGE_PX, Math.max(MIN_MODAL_SCREEN_EDGE_PX, viewportHeight - height - MIN_MODAL_SCREEN_EDGE_PX));
  const closeRect = { x: x + width - 36, y: y + 10, width: 24, height: 24 };
  return { rect: { x, y, width, height }, closeRect };
}

export function isPointInHudModal(viewportWidth: number, viewportHeight: number, x: number, y: number): boolean {
  return pointInRect(x, y, getHudModalLayout(viewportWidth, viewportHeight).rect);
}

export function isPointInHudModalClose(viewportWidth: number, viewportHeight: number, x: number, y: number): boolean {
  return pointInRect(x, y, getHudModalLayout(viewportWidth, viewportHeight).closeRect);
}

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
  activeModalId: TopHudButtonId | null,
  uiTheme: UiTheme,
): void {
  const palette = getHudPalette(uiTheme);
  drawTopHud(ctx, layout.barWidth, unitCount, activeModalId, palette, uiTheme);

  const { leftPanel, centerPanel, minimapPanel } = layout;
  ctx.fillStyle = palette.panelBase;
  ctx.fillRect(layout.barX, layout.barY, layout.barWidth, layout.barHeight);

  ctx.strokeStyle = palette.panelBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerPanel.x + 0.5, layout.barY + 6);
  ctx.lineTo(centerPanel.x + 0.5, layout.barY + layout.barHeight - 6);
  ctx.moveTo(minimapPanel.x + 0.5, layout.barY + 6);
  ctx.lineTo(minimapPanel.x + 0.5, layout.barY + layout.barHeight - 6);
  ctx.stroke();
  drawMinimapPlaceholders(ctx, layout.minimapPanel, layout.minimapFrame, palette);

  const focusedUnit = getFocusedUnit(selectedUnits, focusedUnitId);
  drawSelectionInfo(ctx, leftPanel, selectedUnits, focusedUnit, unitCount, waterRatioPercent, palette);
  drawSelectionRoster(ctx, centerPanel, selectedUnits, focusedUnit?.id ?? null, palette);
}

export function drawHudModalOverlay(
  ctx: CanvasRenderingContext2D,
  viewportWidth: number,
  viewportHeight: number,
  activeModalId: TopHudButtonId | null,
  uiTheme: UiTheme,
): void {
  if (!activeModalId || activeModalId === "ui-mode") {
    return;
  }
  const palette = getHudPalette(uiTheme);
  drawHudModal(ctx, viewportWidth, viewportHeight, activeModalId, palette, uiTheme);
}

function drawTopHud(
  ctx: CanvasRenderingContext2D,
  viewportWidth: number,
  population: number,
  activeModalId: TopHudButtonId | null,
  palette: HudPalette,
  uiTheme: UiTheme,
): void {
  ctx.fillStyle = palette.topBar;
  ctx.fillRect(0, 0, viewportWidth, TOP_HUD_HEIGHT);
  ctx.strokeStyle = palette.topBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, TOP_HUD_HEIGHT - 0.5);
  ctx.lineTo(viewportWidth, TOP_HUD_HEIGHT - 0.5);
  ctx.stroke();

  drawTopResourceChip(ctx, 14, "Food", 200, palette);
  drawTopResourceChip(ctx, 108, "Wood", 180, palette);
  drawTopResourceChip(ctx, 202, "Gold", 90, palette);
  drawTopResourceChip(ctx, 296, "Stone", 60, palette);
  drawTopResourceChip(ctx, 396, "Pop", `${population}/50`, palette);

  const buttons = getTopHudButtons(viewportWidth, uiTheme);
  for (const button of buttons) {
    const active = activeModalId === button.id;
    drawTopButton(ctx, button, active, palette);
  }
}

function drawTopResourceChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  label: string,
  value: number | string,
  palette: HudPalette,
): void {
  const y = 8;
  const width = 86;
  const height = 30;
  ctx.fillStyle = palette.chipFill;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = palette.panelBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  ctx.fillStyle = palette.titleText;
  ctx.font = "bold 11px monospace";
  ctx.fillText(label, x + 8, y + 12);
  ctx.font = "bold 13px monospace";
  ctx.fillText(String(value), x + 8, y + 25);
}

function drawTopButton(ctx: CanvasRenderingContext2D, button: TopHudButton, active: boolean, palette: HudPalette): void {
  ctx.fillStyle = active ? palette.buttonActiveFill : palette.buttonFill;
  ctx.fillRect(button.rect.x, button.rect.y, button.rect.width, button.rect.height);
  ctx.strokeStyle = palette.panelBorder;
  ctx.lineWidth = active ? 2 : 1;
  ctx.strokeRect(button.rect.x + 0.5, button.rect.y + 0.5, button.rect.width - 1, button.rect.height - 1);

  if (button.icon === "gear") {
    drawGearIcon(
      ctx,
      button.rect.x + Math.floor(button.rect.width * 0.5),
      button.rect.y + Math.floor(button.rect.height * 0.5),
      10,
      palette.titleText,
      active ? palette.buttonActiveFill : palette.buttonFill,
    );
    return;
  }

  if (button.icon === "sun") {
    drawSunIcon(
      ctx,
      button.rect.x + Math.floor(button.rect.width * 0.5),
      button.rect.y + Math.floor(button.rect.height * 0.5),
      palette.titleText,
    );
    return;
  }

  if (button.icon === "moon") {
    drawMoonIcon(
      ctx,
      button.rect.x + Math.floor(button.rect.width * 0.5),
      button.rect.y + Math.floor(button.rect.height * 0.5),
      palette.titleText,
      active ? palette.buttonActiveFill : palette.buttonFill,
    );
    return;
  }

  ctx.fillStyle = palette.titleText;
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(button.label, button.rect.x + button.rect.width * 0.5, button.rect.y + button.rect.height * 0.5);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawGearIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerRadius: number,
  gearColor: string,
  holeColor: string,
): void {
  const toothCount = 8;
  const toothOuter = outerRadius;
  const toothInner = outerRadius - 3;

  ctx.save();
  ctx.fillStyle = gearColor;
  ctx.beginPath();
  for (let i = 0; i < toothCount * 2; i += 1) {
    const radius = i % 2 === 0 ? toothOuter : toothInner;
    const angle = -Math.PI * 0.5 + (i * Math.PI) / toothCount;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = holeColor;
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius - 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSunIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7);
    ctx.lineTo(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMoonIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, cutoutColor: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cutoutColor;
  ctx.beginPath();
  ctx.arc(cx + 3, cy - 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHudModal(
  ctx: CanvasRenderingContext2D,
  viewportWidth: number,
  viewportHeight: number,
  activeModalId: TopHudButtonId,
  palette: HudPalette,
  uiTheme: UiTheme,
): void {
  const buttons = getTopHudButtons(viewportWidth, uiTheme);
  const activeButton = buttons.find((button) => button.id === activeModalId);
  if (!activeButton) {
    return;
  }

  const modal = getHudModalLayout(viewportWidth, viewportHeight);

  ctx.fillStyle = palette.modalBackdrop;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  ctx.fillStyle = palette.modalFill;
  ctx.fillRect(modal.rect.x, modal.rect.y, modal.rect.width, modal.rect.height);
  ctx.strokeStyle = palette.modalBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(modal.rect.x + 0.5, modal.rect.y + 0.5, modal.rect.width - 1, modal.rect.height - 1);

  ctx.fillStyle = palette.titleText;
  ctx.font = "bold 20px monospace";
  ctx.fillText(activeButton.title, modal.rect.x + 22, modal.rect.y + 34);

  ctx.fillStyle = palette.modalCloseFill;
  ctx.fillRect(modal.closeRect.x, modal.closeRect.y, modal.closeRect.width, modal.closeRect.height);
  ctx.strokeStyle = palette.modalBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(modal.closeRect.x + 0.5, modal.closeRect.y + 0.5, modal.closeRect.width - 1, modal.closeRect.height - 1);
  ctx.fillStyle = palette.titleText;
  ctx.font = "bold 14px monospace";
  ctx.fillText("X", modal.closeRect.x + 8, modal.closeRect.y + 16);
}

function drawSelectionInfo(
  ctx: CanvasRenderingContext2D,
  panel: Rect,
  selectedUnits: Unit[],
  focusedUnit: Unit | null,
  unitCount: number,
  waterRatioPercent: string,
  palette: HudPalette,
): void {
  const x = panel.x + 22;
  let y = panel.y + 34;
  ctx.fillStyle = palette.titleText;
  ctx.font = "bold 16px monospace";
  ctx.fillText("Selection", x, y);

  y += 28;
  if (focusedUnit) {
    const unit = focusedUnit;
    ctx.font = "bold 15px monospace";
    ctx.fillStyle = palette.titleText;
    ctx.fillText(unit.name, x, y);
    y += 20;
    ctx.font = "13px monospace";
    ctx.fillStyle = palette.bodyText;
    ctx.fillText(`HP ${Math.round(unit.hp)}/${unit.maxHp}`, x, y);
    y += 18;
    ctx.fillText(`Move ${unit.speed.toFixed(1)}  Atk ${unit.attack}  Arm ${unit.armor}`, x, y);
    if (selectedUnits.length > 1) {
      y += 18;
      ctx.fillText(`${selectedUnits.length} units selected`, x, y);
    }
  } else {
    ctx.font = "13px monospace";
    ctx.fillStyle = palette.bodyText;
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
  panel: Rect,
  selectedUnits: Unit[],
  focusedUnitId: string | null,
  palette: HudPalette,
): void {
  const slots = getHudSelectionSlots(panel, selectedUnits);

  ctx.fillStyle = palette.titleText;
  ctx.font = "bold 16px monospace";
  ctx.fillText("Units", panel.x + 20, panel.y + 22);

  for (const slot of slots) {
    const isFocused = slot.unitId === focusedUnitId;
    ctx.fillStyle = isFocused ? palette.selectionFocusFill : palette.selectionFill;
    ctx.fillRect(slot.x, slot.y, slot.width, slot.height);
    ctx.strokeStyle = palette.panelBorder;
    ctx.lineWidth = isFocused ? 2 : 1;
    ctx.strokeRect(slot.x + 0.5, slot.y + 0.5, slot.width - 1, slot.height - 1);

    ctx.fillStyle = palette.titleText;
    ctx.beginPath();
    ctx.arc(slot.x + slot.width * 0.5, slot.y + slot.height * 0.48, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#231a0f";
    ctx.font = "bold 10px monospace";
    ctx.fillText(slot.unitId.replace("unit-", "#"), slot.x + 7, slot.y + slot.height - 7);
  }
}

function drawMinimapPlaceholders(
  ctx: CanvasRenderingContext2D,
  minimapPanel: Rect,
  minimapFrame: { x: number; y: number; width: number; height: number; padding: number },
  palette: HudPalette,
): void {
  const clipX = minimapPanel.x;
  const clipY = minimapPanel.y;
  const clipW = Math.max(0, minimapPanel.width);
  const clipH = Math.max(0, minimapPanel.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(clipX, clipY, clipW, clipH);
  ctx.clip();

  const innerX = minimapFrame.x + minimapFrame.padding;
  const innerY = minimapFrame.y + minimapFrame.padding;
  const innerW = Math.max(0, minimapFrame.width - minimapFrame.padding * 2);
  const innerH = Math.max(0, minimapFrame.height - minimapFrame.padding * 2);
  const centerX = innerX + innerW * 0.5;
  const centerY = innerY + innerH * 0.5;
  const radius = Math.max(12, Math.min(17, Math.floor(Math.min(innerW, innerH) * 0.105)));
  const diameter = radius * 2;
  const outwardOffset = radius + 6;

  const top = { x: centerX, y: innerY };
  const right = { x: innerX + innerW, y: centerY };
  const bottom = { x: centerX, y: innerY + innerH };
  const left = { x: innerX, y: centerY };

  const pairSpecs = [
    { edgeA: top, edgeB: left, corner: { x: innerX, y: innerY }, label: "A" },
    { edgeA: top, edgeB: right, corner: { x: innerX + innerW, y: innerY }, label: "B" },
    { edgeA: left, edgeB: bottom, corner: { x: innerX, y: innerY + innerH }, label: "A" },
    { edgeA: right, edgeB: bottom, corner: { x: innerX + innerW, y: innerY + innerH }, label: "B" },
  ];

  for (const spec of pairSpecs) {
    const edgeMidX = (spec.edgeA.x + spec.edgeB.x) * 0.5;
    const edgeMidY = (spec.edgeA.y + spec.edgeB.y) * 0.5;
    const tx = spec.edgeB.x - spec.edgeA.x;
    const ty = spec.edgeB.y - spec.edgeA.y;
    const tLen = Math.hypot(tx, ty) || 1;
    const ux = tx / tLen;
    const uy = ty / tLen;
    const edgeLen = tLen;
    const freeSpace = Math.max(0, edgeLen - diameter * 2);
    const edgeGap = freeSpace / 3;
    const firstCenterDist = edgeGap + radius;
    const secondCenterDist = edgeGap * 2 + diameter + radius;

    // Choose the normal that points away from the diamond and into this corner's empty triangle.
    const nxA = -uy;
    const nyA = ux;
    const nxB = uy;
    const nyB = -ux;
    const toCornerAx = spec.corner.x - (edgeMidX + nxA * outwardOffset);
    const toCornerAy = spec.corner.y - (edgeMidY + nyA * outwardOffset);
    const toCornerBx = spec.corner.x - (edgeMidX + nxB * outwardOffset);
    const toCornerBy = spec.corner.y - (edgeMidY + nyB * outwardOffset);
    const distA = toCornerAx * toCornerAx + toCornerAy * toCornerAy;
    const distB = toCornerBx * toCornerBx + toCornerBy * toCornerBy;
    const nx = distA <= distB ? nxA : nxB;
    const ny = distA <= distB ? nyA : nyB;

    const baseX = spec.edgeA.x + nx * outwardOffset;
    const baseY = spec.edgeA.y + ny * outwardOffset;
    drawMiniButton(ctx, baseX + ux * firstCenterDist, baseY + uy * firstCenterDist, radius, palette, spec.label);
    drawMiniButton(ctx, baseX + ux * secondCenterDist, baseY + uy * secondCenterDist, radius, palette, spec.label);
  }

  ctx.restore();
}

function drawMiniButton(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  palette: HudPalette,
  label: string,
): void {
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = palette.buttonFill;
  ctx.fill();
  ctx.strokeStyle = palette.panelBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = palette.titleText;
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, centerX, centerY);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
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

function getHudSelectionSlots(panel: Rect, selectedUnits: Unit[]): HudSelectionSlot[] {
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

function getHudPalette(theme: UiTheme): HudPalette {
  if (theme === "day") {
    return {
      topBar: "rgba(119, 88, 50, 0.96)",
      topBorder: "rgba(195, 161, 108, 0.86)",
      chipFill: "rgba(152, 122, 76, 0.95)",
      buttonFill: "rgba(142, 112, 69, 0.95)",
      buttonActiveFill: "rgba(176, 138, 82, 0.97)",
      panelBase: "rgba(119, 88, 50, 0.96)",
      panelBorder: "rgba(195, 161, 108, 0.86)",
      bodyText: "#f4e5c4",
      titleText: "#fff6db",
      selectionFill: "rgba(179, 141, 85, 0.8)",
      selectionFocusFill: "rgba(205, 160, 95, 0.95)",
      modalBackdrop: "rgba(0, 0, 0, 0.33)",
      modalFill: "rgba(98, 72, 42, 0.98)",
      modalBorder: "rgba(213, 176, 117, 0.85)",
      modalCloseFill: "rgba(126, 96, 56, 0.97)",
    };
  }

  return {
    topBar: "rgba(34, 24, 13, 0.96)",
    topBorder: "rgba(197, 170, 120, 0.8)",
    chipFill: "rgba(72, 53, 31, 0.95)",
    buttonFill: "rgba(88, 67, 40, 0.95)",
    buttonActiveFill: "rgba(146, 113, 65, 0.95)",
    panelBase: "rgba(34, 24, 13, 0.96)",
    panelBorder: "rgba(197, 170, 120, 0.8)",
    bodyText: "#efe1bb",
    titleText: "#f7eac5",
    selectionFill: "rgba(128, 102, 60, 0.75)",
    selectionFocusFill: "rgba(162, 129, 73, 0.92)",
    modalBackdrop: "rgba(0, 0, 0, 0.4)",
    modalFill: "rgba(54, 37, 21, 0.98)",
    modalBorder: "rgba(217, 190, 142, 0.82)",
    modalCloseFill: "rgba(93, 67, 36, 0.95)",
  };
}

function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
