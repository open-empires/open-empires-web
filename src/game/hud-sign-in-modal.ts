export type SignInModalPalette = {
  bodyText: string;
  titleText: string;
  buttonActiveFill: string;
  panelBorder: string;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function isPointInSignInModalActionButton(modalRect: Rect, x: number, y: number): boolean {
  return pointInRect(x, y, getSignInModalActionButtonRect(modalRect));
}

export function drawSignInModalContent(
  ctx: CanvasRenderingContext2D,
  modalRect: Rect,
  palette: SignInModalPalette,
): void {
  const actionButton = getSignInModalActionButtonRect(modalRect);

  ctx.fillStyle = palette.bodyText;
  ctx.font = "14px monospace";
  ctx.fillText("Run a quick backend smoke test from the client.", modalRect.x + 22, modalRect.y + 78);
  ctx.fillText("This will call reducers: add + say_hello.", modalRect.x + 22, modalRect.y + 102);

  ctx.fillStyle = palette.buttonActiveFill;
  ctx.fillRect(actionButton.x, actionButton.y, actionButton.width, actionButton.height);
  ctx.strokeStyle = palette.panelBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(actionButton.x + 0.5, actionButton.y + 0.5, actionButton.width - 1, actionButton.height - 1);

  ctx.fillStyle = palette.titleText;
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Run Reducers", actionButton.x + actionButton.width * 0.5, actionButton.y + actionButton.height * 0.5);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function getSignInModalActionButtonRect(modalRect: Rect): Rect {
  const width = 188;
  const height = 36;
  return {
    x: Math.floor(modalRect.x + (modalRect.width - width) * 0.5),
    y: modalRect.y + modalRect.height - height - 24,
    width,
    height,
  };
}

function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
