// ===========================================================================
// Camera.js — world<->screen transform + smooth follow + zoom-out with growth.
// ===========================================================================

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.zoom = 1.0;
    this._targetZoom = 1.0;
    this._lastDt = 16.667;

    // Reusable screen-space point to avoid allocations in hot paths.
    this._screenOut = { x: 0, y: 0 };
    // Cached view bounds (updated lazily per frame).
    this._vb = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    this._vbZoom = 0;
    this._vbX = 0;
    this._vbY = 0;

    // Velocity tracking for smooth follow.
    this._velX = 0;
    this._velY = 0;
    this._prevX = 0;
    this._prevY = 0;
  }

  follow(tx, ty) {
    const dtSec = this._lastDt / 1000;
    // Exponential smoothing — lower base = smoother, slower response.
    const baseEase = 0.12;
    const ease = 1 - Math.pow(1 - baseEase, this._lastDt / 16.667);
    // Smoothly ease toward target.
    this.x += (tx - this.x) * ease;
    this.y += (ty - this.y) * ease;
    // Track velocity for sub-frame smoothing.
    if (dtSec > 0) {
      this._velX = (this.x - this._prevX) / dtSec;
      this._velY = (this.y - this._prevY) / dtSec;
    }
    this._prevX = this.x;
    this._prevY = this.y;
  }

  setDt(dt) { this._lastDt = dt; }

  setZoom(target) {
    this._targetZoom = target;
    const zEase = 1 - Math.pow(1 - 0.10, this._lastDt / 16.667);
    this.zoom += (this._targetZoom - this.zoom) * zEase;
  }

  // Returns a reusable {x,y} — callers must read immediately, not store.
  worldToScreen(wx, wy) {
    const o = this._screenOut;
    o.x = (wx - this.x) * this.zoom + this.canvas.clientWidth * 0.5;
    o.y = (wy - this.y) * this.zoom + this.canvas.clientHeight * 0.5;
    return o;
  }

  // Cached view bounds — recalculated only when camera moves or zoom changes.
  viewBounds() {
    const z = this.zoom, cx = this.x, cy = this.y;
    if (z === this._vbZoom && cx === this._vbX && cy === this._vbY) return this._vb;
    const cw = this.canvas.clientWidth * 0.5 / z;
    const ch = this.canvas.clientHeight * 0.5 / z;
    this._vb.minX = cx - cw; this._vb.maxX = cx + cw;
    this._vb.minY = cy - ch; this._vb.maxY = cy + ch;
    this._vbZoom = z; this._vbX = cx; this._vbY = cy;
    return this._vb;
  }
}

export default Camera;
