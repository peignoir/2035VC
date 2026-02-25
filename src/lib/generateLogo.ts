/**
 * Generates a branded logo image for events that don't have an uploaded logo.
 * Returns a Blob (PNG) that can be used as an object URL or stored.
 */

const LOGO_W = 800;
const LOGO_H = 500;

export async function generateLogo(
  eventName: string,
  city?: string,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = LOGO_W;
  canvas.height = LOGO_H;
  const ctx = canvas.getContext('2d')!;

  // ── White background with subtle rounded feel ──
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, LOGO_W, LOGO_H);

  // ── Decorative hourglass / X motif (center) ──
  drawHourglassMotif(ctx, LOGO_W / 2, LOGO_H * 0.52, LOGO_H * 0.22);

  // ── Event name (top) ──
  const name = eventName || 'CAFÉ 2035';
  const nameFontSize = fitFontSize(ctx, name.toUpperCase(), LOGO_W * 0.85, 60, 28);
  ctx.font = `800 ${nameFontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#111111';
  ctx.fillText(name.toUpperCase(), LOGO_W / 2, LOGO_H * 0.06);

  // ── City (below name) ──
  if (city) {
    const citySize = Math.round(nameFontSize * 0.4);
    ctx.font = `600 ${citySize}px sans-serif`;
    ctx.fillStyle = '#444444';
    ctx.letterSpacing = '0.15em';
    ctx.fillText(city.toUpperCase(), LOGO_W / 2, LOGO_H * 0.06 + nameFontSize + 4);
    ctx.letterSpacing = '0px';
  }

  // ── Tagline (bottom) ──
  const tagSize = Math.round(LOGO_H * 0.026);
  ctx.font = `600 ${tagSize}px sans-serif`;
  ctx.fillStyle = '#666666';
  ctx.textBaseline = 'bottom';
  ctx.fillText('THE FUTURE IS IN THIS ROOM.', LOGO_W / 2, LOGO_H * 0.94);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to generate logo'))),
      'image/png',
    );
  });
}

/** Find the largest font size that fits within maxWidth */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
): number {
  for (let size = maxSize; size >= minSize; size -= 2) {
    ctx.font = `800 ${size}px sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  return minSize;
}

/** Draw a simple geometric hourglass / X motif */
function drawHourglassMotif(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) {
  ctx.save();
  ctx.translate(cx, cy);

  const arm = size * 0.9;
  const spread = size * 0.45;
  const lineW = 2.5;

  // Draw crossing lines forming an X / hourglass shape
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';

  // Top-left to bottom-right
  ctx.beginPath();
  ctx.moveTo(-spread, -arm);
  ctx.quadraticCurveTo(0, 0, spread, arm);
  ctx.stroke();

  // Top-right to bottom-left
  ctx.beginPath();
  ctx.moveTo(spread, -arm);
  ctx.quadraticCurveTo(0, 0, -spread, arm);
  ctx.stroke();

  // Horizontal accent through center
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-spread * 0.7, 0);
  ctx.lineTo(spread * 0.7, 0);
  ctx.stroke();

  // Small decorative dots at extremes
  const dotR = 3;
  ctx.fillStyle = '#ef4444';
  for (const [dx, dy] of [[-spread, -arm], [spread, -arm], [-spread, arm], [spread, arm]] as [number, number][]) {
    ctx.beginPath();
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Radiating thin lines from center (like a burst)
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.8;
  const rays = 12;
  const innerR = size * 0.15;
  const outerR = size * 0.6;
  for (let i = 0; i < rays; i++) {
    const angle = (Math.PI * 2 * i) / rays;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
    ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
    ctx.stroke();
  }

  ctx.restore();
}
