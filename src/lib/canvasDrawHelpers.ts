/**
 * Canvas Drawing Helpers
 * 
 * Pure drawing utility functions extracted from SimpleTabletop.tsx.
 * All functions take their dependencies as parameters (no closure coupling).
 */

import type { Token } from '../stores/sessionStore';

// ── Token label with rounded rect background ──
export const drawTokenLabel = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  labelPos: 'above' | 'center' | 'below',
  radius: number,
  zoom: number,
  labelColor?: string,
  labelBackgroundColor?: string
) => {
  const fontSize = 12 / zoom;
  const paddingX = 4 / zoom;
  const paddingY = 2 / zoom;
  const borderRadius = 3 / zoom;

  ctx.font = `${fontSize}px Arial`;
  const textMetrics = ctx.measureText(text);
  const textWidth = textMetrics.width;
  const textHeight = fontSize;

  let labelX = x;
  let labelY: number;
  let textBaseline: CanvasTextBaseline;

  if (labelPos === 'center') {
    labelY = y;
    textBaseline = 'middle';
  } else if (labelPos === 'above') {
    labelY = y - radius - 4 / zoom - textHeight / 2;
    textBaseline = 'middle';
  } else {
    labelY = y + radius + 4 / zoom + textHeight / 2;
    textBaseline = 'middle';
  }

  const bgColor = labelBackgroundColor || 'rgba(30, 30, 30, 0.75)';
  const bgX = labelX - textWidth / 2 - paddingX;
  const bgY = labelY - textHeight / 2 - paddingY;
  const bgWidth = textWidth + paddingX * 2;
  const bgHeight = textHeight + paddingY * 2;

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(bgX, bgY, bgWidth, bgHeight, borderRadius);
  ctx.fill();

  ctx.fillStyle = labelColor || '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = textBaseline;
  ctx.fillText(text, labelX, labelY);
};

// ── Ghost token (semi-transparent drag preview at original position) ──
export const drawGhostToken = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  token: { color?: string; label?: string; gridWidth?: number; gridHeight?: number },
  zoom: number
) => {
  const baseTokenSize = 40;
  const tokenSize = Math.max(token.gridWidth || 1, token.gridHeight || 1) * baseTokenSize;
  const radius = tokenSize / 2;

  ctx.save();
  ctx.globalAlpha = 0.3;

  ctx.fillStyle = token.color || "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2 / zoom;
  ctx.setLineDash([5 / zoom, 5 / zoom]);
  ctx.stroke();
  ctx.setLineDash([]);

  if (token.label) {
    ctx.fillStyle = "#ffffff";
    ctx.font = `${12 / zoom}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(token.label, x, y);
  }

  ctx.restore();
};

// ── Direction arrow ──
export const drawDirectionArrow = (
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  zoom: number
) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 10) return;

  const angle = Math.atan2(dy, dx);
  const arrowLength = 15 / zoom;
  const arrowAngle = Math.PI / 6;

  ctx.save();
  ctx.translate(to.x, to.y);
  ctx.rotate(angle);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2 / zoom;
  ctx.globalAlpha = 0.8;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-arrowLength, -arrowLength * Math.tan(arrowAngle));
  ctx.lineTo(-arrowLength, arrowLength * Math.tan(arrowAngle));
  ctx.closePath();
  ctx.fill();

  ctx.restore();
};

// ── Targeting reticle line helper (action system) ──
export const drawTargetingLineHelper = (
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  distGrid: number,
  gridSize: number,
  confirmed: boolean,
  zoom: number
) => {
  ctx.save();

  const lineWidth = 2 / zoom;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(confirmed ? [] : [8 / zoom, 4 / zoom]);

  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  gradient.addColorStop(0, confirmed ? 'rgba(239, 68, 68, 0.9)' : 'rgba(251, 191, 36, 0.7)');
  gradient.addColorStop(1, confirmed ? 'rgba(239, 68, 68, 0.5)' : 'rgba(251, 191, 36, 0.3)');
  ctx.strokeStyle = gradient;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  const reticleRadius = confirmed ? 14 / zoom : 10 / zoom;
  ctx.strokeStyle = confirmed ? 'rgba(239, 68, 68, 0.9)' : 'rgba(251, 191, 36, 0.8)';
  ctx.lineWidth = 1.5 / zoom;

  ctx.beginPath();
  ctx.arc(x2, y2, reticleRadius, 0, Math.PI * 2);
  ctx.stroke();

  const ch = reticleRadius * 0.6;
  ctx.beginPath();
  ctx.moveTo(x2 - ch, y2); ctx.lineTo(x2 + ch, y2);
  ctx.moveTo(x2, y2 - ch); ctx.lineTo(x2, y2 + ch);
  ctx.stroke();

  if (confirmed) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    ctx.beginPath();
    ctx.arc(x2, y2, reticleRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Distance label at midpoint
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const distFt = Math.round(distGrid * 5);
  const text = `${distFt} ft (${distGrid.toFixed(1)} sq)`;
  const fontSize = 11 / zoom;
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tm = ctx.measureText(text);
  const px = 4 / zoom;
  const py = 2 / zoom;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.beginPath();
  ctx.roundRect(midX - tm.width / 2 - px, midY - fontSize / 2 - py, tm.width + px * 2, fontSize + py * 2, 3 / zoom);
  ctx.fill();

  ctx.fillStyle = confirmed ? '#ef4444' : '#fbbf24';
  ctx.fillText(text, midX, midY);

  ctx.restore();
};

// ── Off-screen token indicator ──
export const drawOffScreenIndicator = (
  ctx: CanvasRenderingContext2D,
  token: { x: number; y: number; color?: string },
  canvasWidth: number,
  canvasHeight: number,
  transform: { x: number; y: number; zoom: number }
) => {
  const margin = 10;
  const indicatorSize = 8;
  const indicatorLength = 20;

  const tokenScreenX = token.x * transform.zoom + transform.x;
  const tokenScreenY = token.y * transform.zoom + transform.y;

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  const dirX = tokenScreenX - centerX;
  const dirY = tokenScreenY - centerY;
  const distance = Math.sqrt(dirX * dirX + dirY * dirY);

  if (distance === 0) return;

  const normalizedX = dirX / distance;
  const normalizedY = dirY / distance;

  const leftDist = Math.abs(centerX - margin) / Math.abs(normalizedX);
  const rightDist = Math.abs(canvasWidth - centerX - margin) / Math.abs(normalizedX);
  const topDist = Math.abs(centerY - margin) / Math.abs(normalizedY);
  const bottomDist = Math.abs(canvasHeight - centerY - margin) / Math.abs(normalizedY);

  const minDist = Math.min(normalizedX < 0 ? leftDist : rightDist, normalizedY < 0 ? topDist : bottomDist);

  let edgeX = Math.max(margin, Math.min(canvasWidth - margin, centerX + normalizedX * minDist));
  let edgeY = Math.max(margin, Math.min(canvasHeight - margin, centerY + normalizedY * minDist));

  ctx.fillStyle = token.color || "#ffffff";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;

  const angle = Math.atan2(normalizedY, normalizedX);

  ctx.save();
  ctx.translate(edgeX, edgeY);
  ctx.rotate(angle);

  ctx.fillRect(-indicatorLength / 2, -indicatorSize / 2, indicatorLength, indicatorSize);
  ctx.strokeRect(-indicatorLength / 2, -indicatorSize / 2, indicatorLength, indicatorSize);

  ctx.beginPath();
  ctx.moveTo(indicatorLength / 2, 0);
  ctx.lineTo(indicatorLength / 2 + 6, -4);
  ctx.lineTo(indicatorLength / 2 + 6, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
};

// ── Map pings (expanding + fading circles) ──
export const drawMapPings = (
  ctx: CanvasRenderingContext2D,
  pings: Array<{ pos: { x: number; y: number }; color: string; ts: number }>,
  zoom: number
) => {
  if (pings.length === 0) return;
  const now = Date.now();
  ctx.save();
  for (const ping of pings) {
    const age = now - ping.ts;
    if (age >= 1000) continue;
    const t = age / 1000;
    const radius = (20 + t * 60) / zoom;
    const alpha = 1 - t;

    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = ping.color;
    ctx.lineWidth = 3 / zoom;
    ctx.beginPath();
    ctx.arc(ping.pos.x, ping.pos.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = ping.color;
    ctx.beginPath();
    ctx.arc(ping.pos.x, ping.pos.y, 5 / zoom, 0, Math.PI * 2);
    ctx.fill();

    if (t > 0.15) {
      const t2 = (t - 0.15) / 0.85;
      const radius2 = (20 + t2 * 60) / zoom;
      ctx.globalAlpha = (1 - t2) * 0.35;
      ctx.strokeStyle = ping.color;
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.arc(ping.pos.x, ping.pos.y, radius2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
};

// ── Remote drag previews ──
export const drawRemoteDragPreviews = (
  ctx: CanvasRenderingContext2D,
  previews: Array<{
    tokenId: string;
    userId: string;
    startPos: { x: number; y: number };
    currentPos: { x: number; y: number };
    path: Array<{ x: number; y: number }>;
  }>,
  tokens: Token[],
  zoom: number
) => {
  if (previews.length === 0) return;

  ctx.save();
  for (const p of previews) {
    const baseTokenSize = 40;
    const token = tokens.find((t) => t.id === p.tokenId);
    const tokenSize = token ? Math.max(token.gridWidth || 1, token.gridHeight || 1) * baseTokenSize : baseTokenSize;
    const radius = tokenSize / 2;
    const color = token?.color || "#888888";

    if (p.path.length >= 2) {
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5 / zoom;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(p.path[0].x, p.path[0].y);
      for (let i = 1; i < p.path.length; i++) {
        ctx.lineTo(p.path[i].x, p.path[i].y);
      }
      ctx.lineTo(p.currentPos.x, p.currentPos.y);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.beginPath();
    ctx.moveTo(p.startPos.x, p.startPos.y);
    ctx.lineTo(p.currentPos.x, p.currentPos.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.startPos.x, p.startPos.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.45;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.currentPos.x, p.currentPos.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.arc(p.currentPos.x, p.currentPos.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#ffffff";
    ctx.font = `${11 / zoom}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const label = p.userId.slice(0, 8);
    ctx.fillText(label, p.currentPos.x, p.currentPos.y - radius - 4 / zoom);
  }
  ctx.restore();
};

// ── Remote token hover highlights ──
export const drawRemoteTokenHovers = (
  ctx: CanvasRenderingContext2D,
  hovers: Array<{ tokenId: string | null; userId: string }>,
  tokens: Token[],
  zoom: number,
  getCursorColor: (userId: string) => string
) => {
  if (hovers.length === 0) return;

  ctx.save();
  for (const h of hovers) {
    if (!h.tokenId) continue;
    const token = tokens.find((t) => t.id === h.tokenId);
    if (!token) continue;

    const baseTokenSize = 40;
    const tokenSize = Math.max(token.gridWidth || 1, token.gridHeight || 1) * baseTokenSize;
    const radius = tokenSize / 2 + 3 / zoom;
    const color = getCursorColor(h.userId);

    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5 / zoom;
    ctx.setLineDash([6 / zoom, 3 / zoom]);
    ctx.beginPath();
    ctx.arc(token.x, token.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 0.6;
    ctx.fillStyle = color;
    ctx.font = `${9 / zoom}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(h.userId.slice(0, 8), token.x, token.y - radius - 2 / zoom);
  }
  ctx.restore();
};

// ── Remote selection rectangle previews ──
export const drawRemoteSelectionPreviews = (
  ctx: CanvasRenderingContext2D,
  selections: Array<{ userId: string; rect: { x: number; y: number; width: number; height: number } | null }>,
  zoom: number,
  getCursorColor: (userId: string) => string
) => {
  if (selections.length === 0) return;

  ctx.save();
  for (const s of selections) {
    if (!s.rect || s.rect.width < 2 || s.rect.height < 2) continue;
    const color = getCursorColor(s.userId);

    ctx.globalAlpha = 0.08;
    ctx.fillStyle = color;
    ctx.fillRect(s.rect.x, s.rect.y, s.rect.width, s.rect.height);

    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([5 / zoom, 3 / zoom]);
    ctx.strokeRect(s.rect.x, s.rect.y, s.rect.width, s.rect.height);
    ctx.setLineDash([]);

    ctx.globalAlpha = 0.6;
    ctx.fillStyle = color;
    ctx.font = `${9 / zoom}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(s.userId.slice(0, 8), s.rect.x, s.rect.y - 2 / zoom);
  }
  ctx.restore();
};

// ── Remote action target crosshairs ──
export const drawRemoteActionTargets = (
  ctx: CanvasRenderingContext2D,
  targets: Array<{ userId: string; pos: { x: number; y: number }; sourceTokenId: string }>,
  tokens: Token[],
  zoom: number,
  getCursorColor: (userId: string) => string
) => {
  if (targets.length === 0) return;

  ctx.save();
  for (const t of targets) {
    const color = getCursorColor(t.userId);
    const r = 12 / zoom;
    const { x, y } = t.pos;

    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - r * 1.4, y); ctx.lineTo(x - r * 0.5, y);
    ctx.moveTo(x + r * 0.5, y); ctx.lineTo(x + r * 1.4, y);
    ctx.moveTo(x, y - r * 1.4); ctx.lineTo(x, y - r * 0.5);
    ctx.moveTo(x, y + r * 0.5); ctx.lineTo(x, y + r * 1.4);
    ctx.stroke();

    ctx.globalAlpha = 0.7;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 2 / zoom, 0, Math.PI * 2);
    ctx.fill();

    const sourceToken = tokens.find((tk) => tk.id === t.sourceTokenId);
    if (sourceToken) {
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([4 / zoom, 3 / zoom]);
      ctx.beginPath();
      ctx.moveTo(sourceToken.x, sourceToken.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.globalAlpha = 0.6;
    ctx.fillStyle = color;
    ctx.font = `${9 / zoom}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(t.userId.slice(0, 8), x, y - r - 3 / zoom);
  }
  ctx.restore();
};
