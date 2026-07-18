// ===========================================================================
// Input.js — captures mouse/touch/keyboard and exposes current steering input.
//
//   input.angle  -> desired heading in radians (screen-center to cursor)
//   input.boost  -> boolean (LMB held, Space held, or touch-boost button)
// ===========================================================================

import { TAU, wrapAngle } from '../../shared/math.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mx = 0;          // cursor in screen coords (centered origin)
    this.my = 0;
    this.angle = 0;
    this.boost = false;
    this.autoSpin = false;  // Q key toggles continuous spinning
    this._spaceHeld = false;
    this._mouseHeld = false;
    this._spinAngle = 0;
    this._lastSpinTime = 0;

    this._bind();
    this._resetCenter();
  }

  _resetCenter() {
    this.cx = window.innerWidth / 2;
    this.cy = window.innerHeight / 2;
    this.mx = this.cx;
    this.my = this.cy - 1; // point up slightly so the snake moves on spawn
  }

  _bind() {
    window.addEventListener('mousemove', (e) => {
      this.mx = e.clientX; this.my = e.clientY;
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this._mouseHeld = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this._mouseHeld = false; }
    });
    window.addEventListener('contextmenu', (e) => {
      // right-click also boosts (common .io convention); prevent the menu
      this._mouseHeld = true;
      e.preventDefault();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { this._spaceHeld = true; e.preventDefault(); }
      if (e.code === 'KeyQ') { this.autoSpin = !this.autoSpin; this._spinAngle = this.angle; }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') { this._spaceHeld = false; }
    });
    window.addEventListener('resize', () => this._resetCenter());

    // Touch: drag to steer, dedicated boost button handled by ui/main.
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length) {
        this.mx = e.touches[0].clientX;
        this.my = e.touches[0].clientY;
      }
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length) {
        this.mx = e.touches[0].clientX;
        this.my = e.touches[0].clientY;
      }
    }, { passive: true });
  }

  // Called by UI for the on-screen boost button.
  setTouchBoost(on) {
    this._touchBoost = !!on;
  }

  // Recompute angle/boost from raw inputs. Call once per frame.
  update() {
    if (this.autoSpin) {
      const now = performance.now();
      if (this._lastSpinTime > 0) {
        const dt = (now - this._lastSpinTime) / 1000;
        this._spinAngle += 0.30 * 20 * dt; // TURN_SPEED * TICK_HZ = 6 rad/s
      } else {
        this._spinAngle = this.angle;
      }
      this._lastSpinTime = now;
      this.angle = this._spinAngle;
      return;
    } else {
      this._lastSpinTime = 0;
    }
    // Re-center in case of resize.
    this.cx = window.innerWidth / 2;
    this.cy = window.innerHeight / 2;
    const dx = this.mx - this.cx;
    const dy = this.my - this.cy;
    if (dx * dx + dy * dy > 3) {
      this.angle = wrapAngle(Math.atan2(dy, dx));
    }
    this.boost = this._mouseHeld || this._spaceHeld || !!this._touchBoost;
  }
}

export default Input;
