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

// src/game/hud.ts
var TOP_HUD_HEIGHT = 46;
var MAX_MODAL_WIDTH_PX = 1000;
var MAX_MODAL_HEIGHT_PX = 680;
var MIN_MODAL_WIDTH_PX = 340;
var MIN_MODAL_HEIGHT_PX = 220;
var MIN_GAME_CANVAS_VISIBLE_SIDE_PX = 84;
var MIN_GAME_CANVAS_VISIBLE_VERTICAL_PX = 56;
var MIN_MODAL_SCREEN_EDGE_PX = 6;
function getTopHudHeight() {
  return TOP_HUD_HEIGHT;
}
function getTopHudButtons(viewportWidth, uiTheme) {
  const buttonHeight = 30;
  const topY = Math.floor((TOP_HUD_HEIGHT - buttonHeight) * 0.5);
  const rightPadding = 14;
  const gap = 10;
  const rightButtons = [
    { id: "settings", label: "", title: "Settings", icon: "gear", rect: { x: 0, y: topY, width: 42, height: buttonHeight } },
    { id: "diplomacy", label: "Diplo", title: "Diplomacy", rect: { x: 0, y: topY, width: 76, height: buttonHeight } },
    { id: "chat", label: "Chat", title: "Chat", rect: { x: 0, y: topY, width: 64, height: buttonHeight } },
    { id: "tech-tree", label: "Tech", title: "Tech Tree", rect: { x: 0, y: topY, width: 64, height: buttonHeight } },
    {
      id: "ui-mode",
      label: "",
      title: uiTheme === "night" ? "Day Mode" : "Night Mode",
      icon: uiTheme === "night" ? "sun" : "moon",
      rect: { x: 0, y: topY, width: 42, height: buttonHeight }
    }
  ];
  let cursorX = viewportWidth - rightPadding;
  for (const button of rightButtons) {
    cursorX -= button.rect.width;
    button.rect.x = cursorX;
    cursorX -= gap;
  }
  const signInWidth = 132;
  const centerButton = {
    id: "sign-in",
    label: "Sign In",
    title: "Sign In",
    rect: {
      x: Math.floor((viewportWidth - signInWidth) * 0.5),
      y: topY,
      width: signInWidth,
      height: buttonHeight
    }
  };
  return [centerButton, ...rightButtons];
}
function pickTopHudButton(viewportWidth, x, y, uiTheme) {
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
function getHudModalLayout(viewportWidth, viewportHeight) {
  const hudLayout = getHudLayout(viewportWidth, viewportHeight);
  const gameCanvasX = 0;
  const gameCanvasY = TOP_HUD_HEIGHT;
  const gameCanvasWidth = viewportWidth;
  const gameCanvasHeight = Math.max(1, hudLayout.barY - gameCanvasY);
  const maxWidthByVisibleSides = Math.max(MIN_MODAL_WIDTH_PX, gameCanvasWidth - MIN_GAME_CANVAS_VISIBLE_SIDE_PX * 2);
  const maxHeightByVisibleEdges = Math.max(MIN_MODAL_HEIGHT_PX, gameCanvasHeight - MIN_GAME_CANVAS_VISIBLE_VERTICAL_PX * 2);
  const preferredWidth = Math.floor(gameCanvasWidth * 0.74);
  const preferredHeight = Math.floor(gameCanvasHeight * 0.72);
  const width = clamp2(preferredWidth, MIN_MODAL_WIDTH_PX, Math.min(MAX_MODAL_WIDTH_PX, maxWidthByVisibleSides));
  const height = clamp2(preferredHeight, MIN_MODAL_HEIGHT_PX, Math.min(MAX_MODAL_HEIGHT_PX, maxHeightByVisibleEdges));
  const gameCanvasVerticalPadding = Math.floor((gameCanvasHeight - height) * 0.5);
  const shouldCenterInScreen = gameCanvasVerticalPadding <= 0;
  const rawX = gameCanvasX + Math.floor((gameCanvasWidth - width) * 0.5);
  const rawY = shouldCenterInScreen ? Math.floor((viewportHeight - height) * 0.5) : gameCanvasY + gameCanvasVerticalPadding;
  const x = clamp2(rawX, MIN_MODAL_SCREEN_EDGE_PX, Math.max(MIN_MODAL_SCREEN_EDGE_PX, viewportWidth - width - MIN_MODAL_SCREEN_EDGE_PX));
  const y = clamp2(rawY, MIN_MODAL_SCREEN_EDGE_PX, Math.max(MIN_MODAL_SCREEN_EDGE_PX, viewportHeight - height - MIN_MODAL_SCREEN_EDGE_PX));
  const closeRect = { x: x + width - 36, y: y + 10, width: 24, height: 24 };
  return { rect: { x, y, width, height }, closeRect };
}
function isPointInHudModal(viewportWidth, viewportHeight, x, y) {
  return pointInRect(x, y, getHudModalLayout(viewportWidth, viewportHeight).rect);
}
function isPointInHudModalClose(viewportWidth, viewportHeight, x, y) {
  return pointInRect(x, y, getHudModalLayout(viewportWidth, viewportHeight).closeRect);
}
function getHudLayout(viewportWidth, viewportHeight) {
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
      padding: 6
    }
  };
}
function drawHud(ctx, layout, selectedUnits, focusedUnitId, unitCount, waterRatioPercent, activeModalId, uiTheme) {
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
function drawHudModalOverlay(ctx, viewportWidth, viewportHeight, activeModalId, uiTheme) {
  if (!activeModalId || activeModalId === "ui-mode") {
    return;
  }
  const palette = getHudPalette(uiTheme);
  drawHudModal(ctx, viewportWidth, viewportHeight, activeModalId, palette, uiTheme);
}
function drawTopHud(ctx, viewportWidth, population, activeModalId, palette, uiTheme) {
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
function drawTopResourceChip(ctx, x, label, value, palette) {
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
function drawTopButton(ctx, button, active, palette) {
  ctx.fillStyle = active ? palette.buttonActiveFill : palette.buttonFill;
  ctx.fillRect(button.rect.x, button.rect.y, button.rect.width, button.rect.height);
  ctx.strokeStyle = palette.panelBorder;
  ctx.lineWidth = active ? 2 : 1;
  ctx.strokeRect(button.rect.x + 0.5, button.rect.y + 0.5, button.rect.width - 1, button.rect.height - 1);
  if (button.icon === "gear") {
    drawGearIcon(ctx, button.rect.x + Math.floor(button.rect.width * 0.5), button.rect.y + Math.floor(button.rect.height * 0.5), 10, palette.titleText, active ? palette.buttonActiveFill : palette.buttonFill);
    return;
  }
  if (button.icon === "sun") {
    drawSunIcon(ctx, button.rect.x + Math.floor(button.rect.width * 0.5), button.rect.y + Math.floor(button.rect.height * 0.5), palette.titleText);
    return;
  }
  if (button.icon === "moon") {
    drawMoonIcon(ctx, button.rect.x + Math.floor(button.rect.width * 0.5), button.rect.y + Math.floor(button.rect.height * 0.5), palette.titleText, active ? palette.buttonActiveFill : palette.buttonFill);
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
function drawGearIcon(ctx, cx, cy, outerRadius, gearColor, holeColor) {
  const toothCount = 8;
  const toothOuter = outerRadius;
  const toothInner = outerRadius - 3;
  ctx.save();
  ctx.fillStyle = gearColor;
  ctx.beginPath();
  for (let i = 0;i < toothCount * 2; i += 1) {
    const radius = i % 2 === 0 ? toothOuter : toothInner;
    const angle = -Math.PI * 0.5 + i * Math.PI / toothCount;
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
function drawSunIcon(ctx, cx, cy, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0;i < 8; i += 1) {
    const a = i / 8 * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7);
    ctx.lineTo(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11);
    ctx.stroke();
  }
  ctx.restore();
}
function drawMoonIcon(ctx, cx, cy, color, cutoutColor) {
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
function drawHudModal(ctx, viewportWidth, viewportHeight, activeModalId, palette, uiTheme) {
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
function drawSelectionInfo(ctx, panel, selectedUnits, focusedUnit, unitCount, waterRatioPercent, palette) {
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
function drawSelectionRoster(ctx, panel, selectedUnits, focusedUnitId, palette) {
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
function drawMinimapPlaceholders(ctx, minimapPanel, minimapFrame, palette) {
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
    { edgeA: right, edgeB: bottom, corner: { x: innerX + innerW, y: innerY + innerH }, label: "B" }
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
function drawMiniButton(ctx, centerX, centerY, radius, palette, label) {
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
function pickHudSelectedUnit(layout, selectedUnits, x, y) {
  const slots = getHudSelectionSlots(layout.centerPanel, selectedUnits);
  for (const slot of slots) {
    if (x >= slot.x && x <= slot.x + slot.width && y >= slot.y && y <= slot.y + slot.height) {
      return slot.unitId;
    }
  }
  return null;
}
function getHudSelectionSlots(panel, selectedUnits) {
  const slotSize = 42;
  const gap = 10;
  const cols = Math.max(1, Math.floor((panel.width - 28) / (slotSize + gap)));
  const startX = panel.x + 20;
  const startY = panel.y + 26;
  const slots = [];
  for (let i = 0;i < selectedUnits.length; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    slots.push({
      unitId: selectedUnits[i].id,
      x: startX + col * (slotSize + gap),
      y: startY + row * (slotSize + gap),
      width: slotSize,
      height: slotSize
    });
  }
  return slots;
}
function getFocusedUnit(selectedUnits, focusedUnitId) {
  if (selectedUnits.length === 0) {
    return null;
  }
  const focused = focusedUnitId ? selectedUnits.find((unit) => unit.id === focusedUnitId) : null;
  return focused ?? selectedUnits[0];
}
function getHudPalette(theme) {
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
      modalCloseFill: "rgba(126, 96, 56, 0.97)"
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
    modalCloseFill: "rgba(93, 67, 36, 0.95)"
  };
}
function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
function clamp2(value, min, max) {
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
      const islandShape = 1 - Math.pow(clamp3(radial, 0, 1), 1.25);
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
function clamp3(value, min, max) {
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
function drawMinimap(ctx, minimapTexture, mapCols, mapRows, camera, viewportWidth, viewportHeight, frame, viewportTop = 0) {
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
    screenToTile(0, viewportTop, camera),
    screenToTile(viewportWidth, viewportTop, camera),
    screenToTile(0, viewportTop + viewportHeight, camera),
    screenToTile(viewportWidth, viewportTop + viewportHeight, camera)
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
    diamondHalfH
  };
}
function isPointInMinimap(x, y, projection) {
  if (!projection) {
    return false;
  }
  return pointInDiamond(x, y, projection);
}
function minimapScreenToTile(screenX, screenY, projection) {
  const normX = clamp4((screenX - projection.innerX) / projection.innerW, 0, 1);
  const normY = clamp4((screenY - projection.innerY) / projection.innerH, 0, 1);
  const texX = normX * projection.textureWidth;
  const texY = normY * projection.textureHeight;
  const u = (texX - projection.originX) / projection.halfTileW;
  const v = (texY - 1) / projection.halfTileH;
  return {
    x: (u + v) * 0.5,
    y: (v - u) * 0.5
  };
}
function clamp4(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function pointInDiamond(x, y, projection) {
  if (projection.diamondHalfW <= 0 || projection.diamondHalfH <= 0) {
    return false;
  }
  const nx = Math.abs((x - projection.diamondCenterX) / projection.diamondHalfW);
  const ny = Math.abs((y - projection.diamondCenterY) / projection.diamondHalfH);
  return nx + ny <= 1;
}
function applyDiamondPath(ctx, centerX, centerY, halfW, halfH) {
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - halfH);
  ctx.lineTo(centerX + halfW, centerY);
  ctx.lineTo(centerX, centerY + halfH);
  ctx.lineTo(centerX - halfW, centerY);
  ctx.closePath();
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
      name: `Militia ${spawned.length + 1}`,
      pos: { x: px, y: py },
      target: null,
      hp: 45,
      maxHp: 45,
      attack: 4,
      armor: 0,
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
var CAMERA_EDGE_SCROLL_BORDER_PX = 10;
var DRAG_THRESHOLD = 4;
var DEBUG_CAMERA_FOCUS = false;
var canvas = document.createElement("canvas");
var ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("2D canvas context is unavailable.");
}
document.body.appendChild(canvas);
var viewportWidth = window.innerWidth;
var viewportHeight = window.innerHeight;
var keyState = new Set;
var mouseX = 0;
var mouseY = 0;
var seed = Math.random() * 4294967295 >>> 0;
var rng = mulberry32(seed);
var map = generateMap(MAP_COLS, MAP_ROWS, seed, rng);
var waterTiles = countWaterTiles(map);
var waterRatioPercent = (waterTiles / (MAP_COLS * MAP_ROWS) * 100).toFixed(1);
var mapLayer = createMapLayer(map, MAP_COLS, MAP_ROWS);
var minimapTexture = createMinimapTexture(map);
var spawn = { x: Math.floor(MAP_COLS / 2), y: Math.floor(MAP_ROWS / 2) };
var units = spawnUnits(map, spawn, UNIT_COUNT, rng);
var selectedUnitIds = new Set(units[0] ? [units[0].id] : []);
var focusedUnitId = units[0]?.id ?? null;
var camera = { x: 0, y: 0 };
var cameraFocus = { x: spawn.x + 0.5, y: spawn.y + 0.5 };
var dragSelection = {
  isPointerDown: false,
  isDragging: false,
  startWorldX: 0,
  startWorldY: 0,
  startPointerX: 0,
  startPointerY: 0,
  currentX: 0,
  currentY: 0
};
var minimapProjection = null;
var minimapPan = { active: false };
var activeTopModalId = null;
var uiTheme = "night";
function getGameCanvasBounds() {
  const topHudHeight = getTopHudHeight();
  const bottomHudTop = getHudLayout(viewportWidth, viewportHeight).barY;
  return { x: 0, y: topHudHeight, width: viewportWidth, height: Math.max(1, bottomHudTop - topHudHeight) };
}
function syncCameraToGameCanvas() {
  const gameCanvas = getGameCanvasBounds();
  syncCameraFromFocus(camera, cameraFocus, gameCanvas.width, gameCanvas.height);
  camera.y += gameCanvas.y;
}
function resizeCanvas() {
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
function updateCamera(deltaSeconds) {
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
function drawBackground() {
  const gameCanvas = getGameCanvasBounds();
  ctx.fillStyle = "#203447";
  ctx.fillRect(gameCanvas.x, gameCanvas.y, gameCanvas.width, gameCanvas.height);
}
function drawSelectionBox() {
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
function drawInfo() {
  const hudLayout = getHudLayout(viewportWidth, viewportHeight);
  const selectedUnits = units.filter((unit) => selectedUnitIds.has(unit.id));
  drawHud(ctx, hudLayout, selectedUnits, focusedUnitId, units.length, waterRatioPercent, activeTopModalId, uiTheme);
  const gameCanvas = getGameCanvasBounds();
  minimapProjection = drawMinimap(ctx, minimapTexture, MAP_COLS, MAP_ROWS, camera, viewportWidth, gameCanvas.height, {
    ...hudLayout.minimapFrame,
    borderColor: "rgba(223, 204, 153, 0.85)"
  }, gameCanvas.y);
  drawUnitsOnMinimap(ctx, units, selectedUnitIds, minimapProjection);
  ctx.fillStyle = "#f0e4c3";
  ctx.font = "12px monospace";
  ctx.fillText(`Seed ${seed} | Water ${waterRatioPercent}% | Army ${units.length} | Selected ${selectedUnitIds.size}`, hudLayout.centerPanel.x + 18, hudLayout.barY + hudLayout.barHeight - 14);
}
function focusCameraFromMinimap(screenX, screenY) {
  if (!minimapProjection) {
    return;
  }
  const tile = minimapScreenToTile(screenX, screenY, minimapProjection);
  cameraFocus.x = tile.x;
  cameraFocus.y = tile.y;
  clampFocusToMap(cameraFocus, MAP_COLS, MAP_ROWS);
  syncCameraToGameCanvas();
}
function syncFocusedUnitSelection() {
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
function clampPointToGameCanvas(x, y, gameCanvas) {
  const maxX = Math.max(gameCanvas.x, gameCanvas.x + gameCanvas.width - 1);
  const maxY = Math.max(gameCanvas.y, gameCanvas.y + gameCanvas.height - 1);
  return {
    x: clamp5(x, gameCanvas.x, maxX),
    y: clamp5(y, gameCanvas.y, maxY)
  };
}
function clamp5(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
var lastTime = performance.now();
function frame(now) {
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
