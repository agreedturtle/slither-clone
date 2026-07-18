// ===========================================================================
// Bot.js — an AI-controlled Snake with a small behavior brain.
//
// Bots are just Snakes whose `targetAngle` / `boost` are recomputed each tick
// by this controller. They share the authoritative simulation fully, so a bot
// is indistinguishable from a player on the wire and in collision logic.
//
// Brain priorities (first match wins):
//   1) AVOID  — imminent collision with a body or the border -> steer to open.
//   2) FLEE   — a much larger snake's head is very close -> run.
//   3) EAT    — drift toward the nearest food.
//   4) CIRCLE — orbit the world center in a gentle spiral.
// ===========================================================================

import { Snake } from './Snake.js';
import { CONFIG, bodyRadiusFromScore } from '../shared/constants.js';
import {
  TAU, wrapAngle, stepAngle, angleDiff, dist, dist2, randInDisk, randRange,
} from '../shared/math.js';

const BOT_NAMES = [
  'Viper', 'Slinky', 'Coil', 'Noodle', 'Hiss', 'Fang', 'Mamba', 'Sidewinder',
  'Python', 'Asp', 'Cobra', 'Boa', 'Eel', 'Wormy', 'Zigzag', 'Twist',
  'Squiggle', 'Loopy', 'Slither', 'Rattler', 'Annie', 'Bob', 'Greg', 'Sue',
  'Pixel', 'Bit', 'Byte', 'Nibble', 'Crunch', 'Snacc', 'Ouroboros', 'Kaa',
  'Nagini', 'Slytherin', 'Hisss', 'Snek', 'Danger', 'NoodleInc', 'Loop',
  'Venom', 'Striker', 'Copperhead', 'Taipan', 'Anaconda', 'Constrictor',
  'Moccasin', 'Cottonmouth', 'Pitviper', 'Keelback', 'Racer', 'Garter',
  'Kingbrown', 'Inland', 'DeathAdder', 'Taipan', 'BlueKrait', 'Banded',
  'Spitting', 'GreenMamba', 'BlackMamba', 'Sniper', 'Venomous', 'Fangster',
  'Scales', 'NopeRope', 'HissyEllis', 'DangerNoodle', 'Slippery',
  'Wiggles', 'SirHiss', 'Hissy', 'SirSlithers', 'LordNoodle', 'BaronCoil',
  'DukeOfFangs', 'CountScales', 'PrincessHiss', 'CaptainCoil', 'MajorFang',
  'GeneralSnek', 'AdmiralSlithers', 'ProfessorWorm', 'DrVenom', 'ChefNoodle',
  'PilotSlinky', 'AgentCoil', 'OperativeHiss', 'ScoutRacer', 'PrivateFang',
  'CorporalSnek', 'SergeantCoil', 'LieutenantHiss', 'CommanderNoodle',
  'ColonelSlithers', 'BrigadierSnek', 'GeneralFang', 'MarshalCoil',
  'OverlordHiss', 'SupremeSnek', 'UltraCoil', 'MegaFang', 'HyperNoodle',
  'TurboSlinky', 'NeonViper', 'CyberSnake', 'GlitchWorm', 'ByteSerpent',
  'QuantumCobra', 'VoidPython', 'CosmicBoa', 'StellarEel', 'NebulaAsp',
  'AstralMamba', 'GalacticRacer', 'OrbitalHiss', 'LunarScales', 'SolarFang',
  'PixelViper', 'RasterSnake', 'VectorWorm', 'ShaderSnek', 'BinaryBoa',
  'HexCoil', 'OctalHiss', 'DecimalFang', 'ASCII蠕蛇', 'UnicodeNoodle',
  'LambdaSerpent', 'SigmaCobra', 'DeltaPython', 'OmegaBoa', 'AlphaViper',
  'BetaSnake', 'GammaWorm', 'ThetaCoil', 'ZetaHiss', 'KappaSnek',
  'TinySnek', 'BigBoi', 'SmolViper', 'ChonkNoodle', 'LongBoi',
  'ShortFang', 'ThickSnek', 'ThinWorm', 'WideCoil', 'NarrowHiss',
  'FastSnek', 'SlowWorm', 'SpeedyCoil', 'LazyHiss', 'QuickFang',
  'FlashViper', 'BoltSerpent', 'RocketSnake', 'TurboWorm', 'JetNoodle',
  'SwiftSnek', 'RapidCoil', 'BlitzHiss', 'SprintFang', 'DashViper',
];

export class Bot {
  constructor(room, opts = {}) {
    this.room = room;
    this.isBotFlag = true;
    this.name = opts.name || BOT_NAMES[(Math.random() * BOT_NAMES.length) | 0];
    this.skin = opts.skin != null ? opts.skin : (Math.random() * 11) | 0;
    this._startMass = opts.mass; // admin-spawned mass override
    this.thinkEvery = 1 + ((Math.random() * 3) | 0); // 1..3 tick cadence
    this.tickCounter = 0;

    this.spawn();
  }

  get isBot() { return true; }

  spawn() {
    const pos = this.room.findSpawnPosition();
    const angle = Math.atan2(-pos.y || -0.01, -pos.x || -0.01);
    this.snake = new Snake({
      name: this.name,
      skin: this.skin,
      x: pos.x,
      y: pos.y,
      angle,
    });
    const startScore = this._startMass != null ? this._startMass : ((Math.random() * Math.random()) * 60) | 0;
    this._startMass = null;
    if (startScore > 0) this.snake.addScore(startScore);
    this.snake.botRef = this;
    this.room.addSnake(this.snake);
  }

  respawn() {
    this.skin = (Math.random() * 11) | 0;
    this.spawn();
  }

  onDeath() { /* Room will call respawn after a short delay */ }

  // Main AI tick: decide targetAngle + boost.
  think() {
    const s = this.snake;
    if (!s || s.dead) return;
    this.tickCounter++;
    const hx = s.headX, hy = s.headY;
    const headR = s.bodyRadius;

    // --- 1) AVOID border: if getting close to world edge, steer inward. ---
    const distFromCenter = Math.sqrt(hx * hx + hy * hy);
    const edgeMargin = CONFIG.WORLD_RADIUS - headR * 2 - 60;
    if (distFromCenter > edgeMargin) {
      const inward = Math.atan2(-hy, -hx);
      s.setTargetAngle(inward);
      s.setBoost(false);
      return;
    }

    // --- 2) AVOID bodies: scan a few look-ahead points for collisions. ---
    const lookAhead = this._scanAhead(s, headR);
    if (lookAhead.danger) {
      const left = wrapAngle(s.angle - 0.6);
      const right = wrapAngle(s.angle + 0.6);
      const leftSafe = this._angleOpen(s, left, headR);
      const rightSafe = this._angleOpen(s, right, headR);
      let chosen;
      if (leftSafe && rightSafe) {
        chosen = Math.abs(angleDiff(s.angle, left)) < Math.abs(angleDiff(s.angle, right)) ? left : right;
      } else if (leftSafe) chosen = left;
      else if (rightSafe) chosen = right;
      else chosen = wrapAngle(s.angle + Math.PI);
      s.setTargetAngle(chosen);
      s.setBoost(false);
      return;
    }

    // --- 3) FLEE: only run if something huge is right on top of us. ---
    const threat = this.room.findThreatTo(s);
    if (threat && threat.dist2 < 180 * 180) {
      const flee = Math.atan2(hy - threat.headY, hx - threat.headX);
      s.setTargetAngle(flee);
      s.setBoost(false);
      return;
    }

    // --- 4) EAT: head toward nearest food (wide search). ---
    const food = this.room.findNearestFood(hx, hy, 900);
    if (food) {
      s.setTargetAngle(Math.atan2(food.y - hy, food.x - hx));
      s.setBoost(false);
      return;
    }

    // --- 5) POWERUP: chase multiplier powerups if within range. ---
    const powerup = this.room.findNearestPowerup(hx, hy, 600);
    if (powerup) {
      s.setTargetAngle(Math.atan2(powerup.y - hy, powerup.x - hx));
      s.setBoost(false);
      return;
    }

    // --- 6) CIRCLE: orbit around the world center at a comfortable radius. ---
    const targetOrbit = CONFIG.WORLD_RADIUS * 0.5;
    const orbitAngle = Math.atan2(hy, hx);
    // tangent direction (perpendicular to radial, clockwise)
    const tangent = wrapAngle(orbitAngle + Math.PI / 2);
    // blend toward tangent if we're roughly the right distance, else steer in/out
    if (distFromCenter > targetOrbit * 1.15) {
      // too far out -> steer inward
      const inward = Math.atan2(-hy, -hx);
      s.setTargetAngle(wrapAngle(inward + 0.4));
    } else if (distFromCenter < targetOrbit * 0.85) {
      // too far in -> steer outward
      const outward = Math.atan2(hy, hx);
      s.setTargetAngle(wrapAngle(outward + 0.3));
    } else {
      s.setTargetAngle(tangent);
    }
    s.setBoost(false);
  }

  // Sample a few points ahead along current heading; return {danger} if any
  // are blocked by a body or the border.
  _scanAhead(s, headR) {
    const lookDists = [headR * 2 + 18, headR * 2 + 50, headR * 2 + 90];
    for (let i = 0; i < lookDists.length; i++) {
      const d = lookDists[i];
      const px = s.headX + Math.cos(s.angle) * d;
      const py = s.headY + Math.sin(s.angle) * d;
      if (Math.sqrt(px * px + py * py) > CONFIG.WORLD_RADIUS - headR) {
        return { danger: true };
      }
      if (this.room.pointHitsBody(px, py, headR * 0.9, s.id)) {
        return { danger: true };
      }
    }
    return { danger: false };
  }

  _angleOpen(s, angle, headR) {
    const px = s.headX + Math.cos(angle) * (headR * 2 + 40);
    const py = s.headY + Math.sin(angle) * (headR * 2 + 40);
    if (Math.sqrt(px * px + py * py) > CONFIG.WORLD_RADIUS - headR) return false;
    return !this.room.pointHitsBody(px, py, headR * 0.9, s.id);
  }

  get id() { return this.snake ? this.snake.id : -1; }
}

export default Bot;
