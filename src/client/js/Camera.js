// ===========================================================================
// Camera.js — world<->screen transform + smooth follow + zoom-out with growth.
// ===========================================================================

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;        // world coords at screen center
    this.y = 0;
    this.zoom = 1.0;   // pixels per world unit
    this._targetZoom = 1.0;
  }

  // Smoothly follow a target world position. dt-based for frame-rate independence.
  follow(tx, ty) {
    const ease = 1 - Math.pow(1 - 0.5, (this._lastDt || 16.667) / 16.667);
    this.x += (tx - this.x) * ease;
    this.y += (ty - this.y) * ease;
  }

  setDt(dt) { this._lastDt = dt; }

  setZoom(target) {
    this._targetZoom = target;
    const zEase = 1 - Math.pow(1 - 0.12, (this._lastDt || 16.667) / 16.667);
    this.zoom += (this._targetZoom - this.zoom) * zEase;
  }

  worldToScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + this.canvas.clientWidth / 2,
      y: (wy - this.y) * this.zoom + this.canvas.clientHeight / 2,
    };
  }

  // visible world bounds (for culling) as {minX,minY,maxX,maxY}
  viewBounds() {
    const halfW = (this.canvas.clientWidth / 2) / this.zoom;
    const halfH = (this.canvas.clientHeight / 2) / this.zoom;
    return {
      minX: this.x - halfW, maxX: this.x + halfW,
      minY: this.y - halfH, maxY: this.y + halfH,
    };
  }
}

export default Camera;
