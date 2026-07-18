// ===========================================================================
// gameConfig.js — EDIT THIS FILE to customize the game.
//
// Every value here overrides the default in constants.js.
// Restart the server after changing any value.
// ===========================================================================

export default {
  // --- Simulation ----------------------------------------------------------
  TICK_HZ: 20,                  // server ticks per second

  // --- World ---------------------------------------------------------------
  WORLD_RADIUS: 8000,           // circular arena radius; leaving it = death
  FOOD_TARGET: 5000,            // how many food pellets exist at any time

  // --- Population ----------------------------------------------------------
  BOT_TARGET: 40,               // bots fill the world up to this count

  // --- Movement ------------------------------------------------------------
  BASE_SPEED: 10,             // units per tick (normal movement)
  BOOST_SPEED: 20,            // units per tick (while boosting)
  TURN_SPEED: 0.30,             // max radians a snake can turn per tick

  // --- Body / growth -------------------------------------------------------
  POINT_DIST: 3.5,              // visual spacing between body points
  MIN_POINTS: 12,               // smallest snake body length
  MAX_POINTS: 22000,            // hard cap on longest snake
  SCORE_PER_POINT: 2,           // score needed per extra body point
  BODY_RADIUS_MIN: 8,           // thinnest the snake can be
  BODY_RADIUS_MAX: 100,          // thickest the snake can be

  // --- Boost ---------------------------------------------------------------
  BOOST_COST_TICKS: 3,          // lose 1 score every N ticks while boosting (must be integer)
  BOOST_MIN_SCORE: 12,          // minimum score to boost

  // --- Food ----------------------------------------------------------------
  FOOD_VALUE_SMALL: 1,          // value of a normal food pellet
  FOOD_VALUE_DEATH_MIN: 5,      // min value of death-drop pellets
  FOOD_VALUE_DEATH_MAX: 50,        // max value of death-drop pellets
  FOOD_RADIUS_SMALL: 6,         // visual radius of normal food
  FOOD_RADIUS_DEATH: 10,        // visual radius of death-drop food
  FOOD_DEATH_LIFETIME_MIN: 50000, // ms before death food despawns (min)
  FOOD_DEATH_LIFETIME_MAX: 70000, // ms before death food despawns (max)
  FOOD_LIFETIME_MIN: 120000,    // ms before normal food despawns (min)
  FOOD_LIFETIME_MAX: 160000,    // ms before normal food despawns (max)

  // --- Multiplier powerups --------------------------------------------------
  POWERUP_RADIUS: 22,           // visual radius of powerup potions
  POWERUP_SPAWN_MAX: 12,         // max powerups on the map at once
  POWERUP_LIFETIME_MIN: 60000,  // ms before powerup despawns (min)
  POWERUP_LIFETIME_MAX: 80000,  // ms before powerup despawns (max)
  POWERUP_SPAWN_INTERVAL: 8,    // ticks between spawn attempts

  // --- Spawn ---------------------------------------------------------------
  SPAWN_INVULN_TICKS: 20,       // invulnerability frames on spawn (~1s)

  // --- Network / client ----------------------------------------------------
  VIEW_RADIUS: 1400,            // how far around the head we send/draw entities
  MAX_BODY_POINTS_NET: 6000,    // hard cap on points transmitted per snake

  // --- Leaderboard ---------------------------------------------------------
  LEADERBOARD_SIZE: 10,         // top N shown on leaderboard
};
