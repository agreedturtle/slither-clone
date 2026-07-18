// ===========================================================================
// math.js — small isomorphic math helpers shared by client & server.
// ===========================================================================

export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

export function clamp01(v) {
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// shortest signed angular difference a->b in [-PI, PI]
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d < -Math.PI) d += TAU;
  else if (d > Math.PI) d -= TAU;
  return d;
}

// move angle `from` toward `to` by at most `maxStep` radians (shortest way)
export function stepAngle(from, to, maxStep) {
  const d = angleDiff(from, to);
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}

export function wrapAngle(a) {
  a %= TAU;
  if (a < 0) a += TAU;
  return a;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function dist(ax, ay, bx, by) {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

export function distFromOrigin(x, y) {
  return Math.sqrt(x * x + y * y);
}

// is point (px,py) within `r` of segment a->b?  squared distance version
export function distToSegment2(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy;
  let t = len2 === 0 ? 0 : (wx * vx + wy * vy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + t * vx;
  const cy = ay + t * vy;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
}

export function randRange(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

export function randInt(lo, hi) {
  return lo + ((Math.random() * (hi - lo + 1)) | 0);
}

export function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

// random point uniformly inside a disk of radius r centered at origin
export function randInDisk(r) {
  // sqrt for uniform area distribution
  const rr = r * Math.sqrt(Math.random());
  const a = Math.random() * TAU;
  return { x: Math.cos(a) * rr, y: Math.sin(a) * rr };
}
