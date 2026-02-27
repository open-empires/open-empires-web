import cursorImageUrl from "./temp-assets/cursor.png";

const CURSOR_HOTSPOT_X = 0;
const CURSOR_HOTSPOT_Y = 0;

const cursorImage = new Image();
let cursorImageLoaded = false;
let cursorImageLoadError = false;

cursorImage.addEventListener("load", () => {
  cursorImageLoaded = true;
});

cursorImage.addEventListener("error", () => {
  cursorImageLoadError = true;
  console.error("Failed to load cursor sprite.");
});

cursorImage.src = cursorImageUrl;

export function drawGameCursor(ctx: CanvasRenderingContext2D, pointerX: number, pointerY: number): void {
  if (cursorImageLoadError || !cursorImageLoaded) {
    return;
  }

  ctx.drawImage(cursorImage, Math.round(pointerX - CURSOR_HOTSPOT_X), Math.round(pointerY - CURSOR_HOTSPOT_Y));
}
