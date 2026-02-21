const CURSOR_SHADOW = "rgba(0, 0, 0, 0.45)";
const METAL_DARK = "rgba(64, 66, 63, 0.95)";

export function drawSpearPointCursor(ctx: CanvasRenderingContext2D, tipX: number, tipY: number): void {
  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate((-135 * Math.PI) / 180);
  ctx.scale(2, 2);
  ctx.lineJoin = "miter";
  ctx.lineCap = "butt";

  ctx.shadowColor = CURSOR_SHADOW;
  ctx.shadowBlur = 1;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  const headGradient = ctx.createLinearGradient(-10.5, -5.6, 0.3, 5.6);
  headGradient.addColorStop(0, "#faf9f7");
  headGradient.addColorStop(0.5, "#bdbfbc");
  headGradient.addColorStop(1, "#7a7d79");
  ctx.fillStyle = headGradient;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-11.8, -6.2);
  ctx.lineTo(-11.8, 6.2);
  ctx.closePath();
  ctx.fill();

  const baseGradient = ctx.createLinearGradient(-5.8, -3.2, -14.5, 3.2);
  baseGradient.addColorStop(0, "#d7d8d5");
  baseGradient.addColorStop(1, "#8a8d89");
  ctx.fillStyle = baseGradient;
  ctx.beginPath();
  ctx.moveTo(-5.8, 0);
  ctx.lineTo(-13.8, -3.2);
  ctx.lineTo(-13.8, 3.2);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = METAL_DARK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-11.8, -6.2);
  ctx.lineTo(-11.8, 6.2);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-5.8, 0);
  ctx.lineTo(-13.8, -3.2);
  ctx.lineTo(-13.8, 3.2);
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = "rgba(250, 250, 247, 0.92)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-1, -0.2);
  ctx.lineTo(-9.2, -4);
  ctx.stroke();

  ctx.restore();
}
