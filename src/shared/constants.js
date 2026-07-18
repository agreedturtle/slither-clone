// ===========================================================================
// constants.js — ALL tunables in one place, shared by client and server.
// Values come from gameConfig.js (edit that file to customize).
// ===========================================================================

import userConfig from './gameConfig.js';

export const CONFIG = {
  // --- Simulation ----------------------------------------------------------
  TICK_HZ: 20,
  get TICK_MS() { return 1000 / this.TICK_HZ; },

  // --- World ---------------------------------------------------------------
  WORLD_RADIUS: 3200,
  FOOD_TARGET: 3500,

  // --- Population ----------------------------------------------------------
  BOT_TARGET: 28,

  // --- Movement ------------------------------------------------------------
  BASE_SPEED: 10.5,
  BOOST_SPEED: 19.0,
  TURN_SPEED: 0.28,

  // --- Body / growth -------------------------------------------------------
  POINT_DIST: 3.5,
  MIN_POINTS: 12,
  MAX_POINTS: 1400,
  SCORE_PER_POINT: 2,
  BODY_RADIUS_MIN: 8,
  BODY_RADIUS_MAX: 36,

  // --- Boost ---------------------------------------------------------------
  BOOST_COST_TICKS: 5,
  BOOST_MIN_SCORE: 12,

  // --- Food value ----------------------------------------------------------
  FOOD_VALUE_SMALL: 1,
  FOOD_VALUE_DEATH_MIN: 5,
  FOOD_VALUE_DEATH_MAX: 22,
  FOOD_RADIUS_SMALL: 5,
  FOOD_RADIUS_DEATH: 8,
  FOOD_LIFETIME_MIN: 50000,
  FOOD_LIFETIME_MAX: 70000,

  // --- Multiplier powerups --------------------------------------------------
  POWERUP_RADIUS: 14,
  POWERUP_SPAWN_MAX: 8,
  POWERUP_LIFETIME: 45000,
  POWERUP_SPAWN_INTERVAL: 8,

  // --- Spawn ---------------------------------------------------------------
  SPAWN_INVULN_TICKS: 20,

  // --- Network / client ----------------------------------------------------
  VIEW_RADIUS: 1400,
  CLIENT_INTERP_MS: 100,
  CLIENT_SNAP_MAX: 16,
  BODY_SAMPLE_STEP: 2,
  MAX_BODY_POINTS_NET: 2400,

  // --- Leaderboard ---------------------------------------------------------
  LEADERBOARD_SIZE: 10,
  LEADERBOARD_INTERVAL_MS: 1000,

  // Apply user overrides from gameConfig.js
  ...userConfig,
  // Re-derive TICK_MS after override
  get TICK_MS() { return 1000 / this.TICK_HZ; },
};

// --- Derived helpers (shared math so client & server agree) -----------------

export function scoreToPoints(score) {
  const p = CONFIG.MIN_POINTS + Math.floor(score / CONFIG.SCORE_PER_POINT);
  return Math.min(Math.max(CONFIG.MIN_POINTS, p), 4000);
}

export function pointsToScore(points) {
  return Math.max(0, (points - CONFIG.MIN_POINTS) * CONFIG.SCORE_PER_POINT);
}

export function bodyRadiusFromScore(score) {
  const t = CONFIG.BODY_RADIUS_MIN + Math.pow(score, 0.35) * 0.7;
  return Math.max(CONFIG.BODY_RADIUS_MIN, Math.min(t, CONFIG.BODY_RADIUS_MAX));
}

export function zoomFromScore(score) {
  return Math.max(0.8, 1.45 - score / 6000);
}

export default CONFIG;
