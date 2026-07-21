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
  'Nagini', 'Slytherin', 'Hisss', 'Snek', 'Danger', 'NoodleInc', 'Loop', 'Venom',
  'Striker', 'Copperhead', 'Taipan', 'Anaconda', 'Constrictor', 'Moccasin', 'Cottonmouth', 'Pitviper',
  'Keelback', 'Racer', 'Garter', 'Kingbrown', 'Inland', 'DeathAdder', 'BlueKrait', 'Banded',
  'Spitting', 'GreenMamba', 'BlackMamba', 'Sniper', 'Venomous', 'Fangster', 'Scales', 'NopeRope',
  'DangerNoodle', 'Slippery', 'Wiggles', 'SirHiss', 'SirSlithers', 'LordNoodle', 'BaronCoil', 'DukeOfFangs',
  'CountScales', 'PrincessHiss', 'CaptainCoil', 'MajorFang', 'GeneralSnek', 'AdmiralSlithers', 'ProfessorWorm', 'DrVenom',
  'ChefNoodle', 'PilotSlinky', 'AgentCoil', 'OperativeHiss', 'ScoutRacer', 'PrivateFang', 'CorporalSnek', 'SergeantCoil',
  'LieutenantHiss', 'CommanderNoodle', 'ColonelSlithers', 'BrigadierSnek', 'GeneralFang', 'MarshalCoil', 'OverlordHiss', 'SupremeSnek',
  'UltraCoil', 'MegaFang', 'HyperNoodle', 'TurboSlinky', 'NeonViper', 'CyberSnake', 'GlitchWorm', 'ByteSerpent',
  'QuantumCobra', 'VoidPython', 'CosmicBoa', 'StellarEel', 'NebulaAsp', 'AstralMamba', 'GalacticRacer', 'OrbitalHiss',
  'LunarScales', 'SolarFang', 'PixelViper', 'RasterSnake', 'VectorWorm', 'ShaderSnek', 'BinaryBoa', 'HexCoil',
  'OctalHiss', 'DecimalFang', 'LambdaSerpent', 'SigmaCobra', 'DeltaPython', 'OmegaBoa', 'AlphaViper', 'BetaSnake',
  'GammaWorm', 'ThetaCoil', 'ZetaHiss', 'KappaSnek', 'TinySnek', 'BigBoi', 'SmolViper', 'ChonkNoodle',
  'LongBoi', 'ShortFang', 'ThickSnek', 'ThinWorm', 'WideCoil', 'NarrowHiss', 'FastSnek', 'SlowWorm',
  'SpeedyCoil', 'LazyHiss', 'QuickFang', 'FlashViper', 'BoltSerpent', 'RocketSnake', 'TurboWorm', 'JetNoodle',
  'SwiftSnek', 'RapidCoil', 'BlitzHiss', 'SprintFang', 'DashViper', 'Mango', 'Peach', 'Kiwi',
  'Plum', 'Berry', 'Cherry', 'Lemon', 'Orange', 'Apple', 'Grape', 'Melon',
  'Fig', 'Date', 'Olive', 'Lime', 'Pear', 'Banana', 'Guava', 'Lychee',
  'Papaya', 'Apricot', 'Nectarine', 'Cantaloupe', 'Blueberry', 'Raspberry', 'Blackberry', 'Strawberry',
  'Cranberry', 'Pineapple', 'Coconut', 'Avocado', 'Pomegranate', 'Dragonfruit', 'Starfruit', 'Passionfruit',
  'Jackfruit', 'Durian', 'Mangosteen', 'Tangerine', 'Clementine', 'Mandarin', 'Grapefruit', 'Watermelon',
  'Tomato', 'Potato', 'Carrot', 'Onion', 'Garlic', 'Pepper', 'Celery', 'Broccoli',
  'Spinach', 'Lettuce', 'Cucumber', 'Pumpkin', 'Squash', 'Mushroom', 'Corn', 'Pea',
  'Bean', 'Radish', 'Turnip', 'Beet', 'Asparagus', 'Artichoke', 'Cauliflower', 'Eggplant',
  'Zucchini', 'Cookies', 'Brownie', 'Waffle', 'Pancake', 'Donut', 'Muffin', 'Bagel',
  'Pretzel', 'Croissant', 'Biscuit', 'Scone', 'Taco', 'Burrito', 'Nachos', 'Pizza',
  'Pasta', 'Ramen', 'Sushi', 'Dumpling', 'Springroll', 'Tempura', 'Wonton', 'Baozi',
  'Mochi', 'Dango', 'Pocky', 'Yakisoba', 'Udon', 'Churro', 'Crepe', 'Cheesecake',
  'Tiramisu', 'Pudding', 'Jelly', 'Truffle', 'Fondue', 'Churros', 'Empanada', 'Falafel',
  'Hummus', 'Baklava', 'Kebab', 'Shawarma', 'Gyro', 'Biryani', 'Curry', 'Samosa',
  'Naan', 'Roti', 'PadThai', 'Kimchi', 'Gyoza', 'Oreo', 'KitKat', 'Snickers',
  'Mars', 'Twix', 'MilkyWay', 'Bounty', 'Twirl', 'Flake', 'DairyMilk', 'Rolo',
  'Toffee', 'Skittles', 'MandMs', 'JellyBeans', 'GummyBears', 'Haribo', 'ChupaChups', 'Lollipop',
  'Candy', 'Fudge', 'Caramel', 'Lava', 'Magma', 'Inferno', 'Blaze', 'Ember',
  'Ash', 'Smoke', 'Soot', 'Flame', 'Spark', 'Flash', 'Bolt', 'Thunder',
  'Storm', 'Tornado', 'Hurricane', 'Cyclone', 'Typhoon', 'Monsoon', 'Blizzard', 'Frost',
  'Ice', 'Snow', 'Hail', 'Sleet', 'Rain', 'Drizzle', 'Mist', 'Fog',
  'Cloud', 'Sky', 'Star', 'Moon', 'Sun', 'Comet', 'Meteor', 'Asteroid',
  'Galaxy', 'Nebula', 'Quasar', 'Pulsar', 'BlackHole', 'Supernova', 'Photon', 'Electron',
  'Proton', 'Neutron', 'Quark', 'Lepton', 'Boson', 'Higgs', 'Gluon',
  'Graviton', 'Tachyon', 'Neutrino', 'Carbon', 'Oxygen', 'Hydrogen', 'Helium', 'Nitrogen',
  'Lithium', 'Sodium', 'Iron', 'Copper', 'Gold', 'Silver', 'Platinum', 'Uranium',
  'Titanium', 'Nickel', 'Zinc', 'Lead', 'Mercury', 'Radon', 'Xenon', 'Neon',
  'Argon', 'Krypton', 'Cesium', 'Rubidium', 'Strontium', 'Magnesium', 'Calcium', 'Potassium',
  'Chromium', 'Manganese', 'Cobalt', 'Pikachu', 'Charmander', 'Squirtle', 'Bulbasaur', 'Jigglypuff',
  'Snorlax', 'Mewtwo', 'Gengar', 'Dragonite', 'Eevee', 'Goku', 'Vegeta', 'Naruto',
  'Luffy', 'Zoro', 'Sasuke', 'Hinata', 'Gogeta', 'Gohan', 'Trunks', 'Piccolo',
  'Krillin', 'Tien', 'Gandalf', 'Frodo', 'Aragorn', 'Legolas', 'Gimli', 'Boromir',
  'Sauron', 'Smaug', 'Bilbo', 'Samwise', 'Pippin', 'Merry', 'Darth', 'Vader',
  'Luke', 'Leia', 'Han', 'Solo', 'Chewie', 'Yoda', 'Palpatine', 'ObiWan',
  'Anakin', 'Mace', 'Windu', 'Kylo', 'Rey', 'Optimus', 'Bumblebee', 'Megatron',
  'Starscream', 'Ironhide', 'Mario', 'Luigi', 'Toad', 'Yoshi', 'Bowser', 'Koopa',
  'Link', 'Zelda', 'Ganondorf', 'Navi', 'Sheik', 'Midna', 'Sonic', 'Tails',
  'Knuckles', 'Amy', 'Shadow', 'Rouge', 'Eggman', 'PacMan', 'Blinky', 'Pinky',
  'Inky', 'Clyde', 'Crash', 'Spyro', 'Sly', 'Jak', 'Ratchet', 'Clank',
  'Daxter', 'MasterChief', 'Cortana', 'Arbiter', 'Geralt', 'Yennefer',
  'Triss', 'Ciri', 'Dandelion', 'Zoltan', 'Kratos', 'Atreus', 'Freya', 'Mimir',
  'Baldur', 'Joel', 'Ellie', 'Abby', 'Tommy', 'Dina', 'Snake', 'Raiden',
  'Ocelot', 'BigBoss', 'VenomSnake', 'Solid', 'Liquid', 'Solidus', 'GrayFox', 'PsychoMantis',
  'NathanDrake', 'Sully', 'Elena', 'SamFisher', 'Agent47', 'LaraCroft', 'Aloy', 'Sekiro',
  'HollowKnight', 'Madeline', 'Cuphead', 'Undertale', 'Deltarune', 'Minecraft', 'Terraria', 'Roblox',
  'Fortnite', 'Apex', 'Valorant', 'Overwatch', 'Dota', 'CSGO', 'RainbowSix',
  'Rust', 'AmongUs', 'FallGuys', 'RocketLeague', 'BrawlStars', 'ClashRoyale',
  'Tetris', 'Chess', 'Uno', 'Domino',
];

// Personality types with weights: dumb(30%), medium(40%), smart(30%)
const PERSONALITY_WEIGHTS = [
  { type: 'dumb',  weight: 0.30 },
  { type: 'medium', weight: 0.40 },
  { type: 'smart',  weight: 0.30 },
];

// Movement styles — each bot picks one, persists until respawn
const MOVE_STYLES = ['roamer', 'edgeHugger', 'wanderer'];

function pickPersonality() {
  const r = Math.random();
  let acc = 0;
  for (const p of PERSONALITY_WEIGHTS) {
    acc += p.weight;
    if (r < acc) return p.type;
  }
  return 'medium';
}

export class Bot {
  constructor(room, opts = {}) {
    this.room = room;
    this.isBotFlag = true;
    this.name = opts.name || BOT_NAMES[(Math.random() * BOT_NAMES.length) | 0];
    this.skin = opts.skin != null ? opts.skin : (Math.random() * 11) | 0;
    this._startMass = opts.mass;
    this.personality = opts.personality || pickPersonality();
    this.moveStyle = MOVE_STYLES[(Math.random() * MOVE_STYLES.length) | 0];

    if (this.personality === 'dumb') {
      this.thinkEvery = 2 + ((Math.random() * 2) | 0);
    } else if (this.personality === 'smart') {
      this.thinkEvery = 1;
    } else {
      this.thinkEvery = 1 + ((Math.random() * 2) | 0);
    }
    this.tickCounter = 0;
    this._wanderAngle = Math.random() * TAU;
    this._wanderTimer = 0;
    this._huntTarget = null;
    this._huntTimer = 0;
    this._dodgeCooldown = 0;

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
    const startScore = this._startMass != null ? this._startMass : (Math.floor(Math.random() * 13) + 18);
    this._startMass = null;
    if (startScore > 0) this.snake.addScore(startScore);
    this.snake.botRef = this;
    this.room.addSnake(this.snake);
    this._huntTarget = null;
    this._huntTimer = 0;
  }

  respawn() {
    this.skin = (Math.random() * 11) | 0;
    this.moveStyle = MOVE_STYLES[(Math.random() * MOVE_STYLES.length) | 0];
    this.spawn();
  }

  onDeath() { }

  // ---- Main AI tick ----
  think() {
    const s = this.snake;
    if (!s || s.dead) return;
    this.tickCounter++;
    if (this._dodgeCooldown > 0) this._dodgeCooldown--;

    const hx = s.headX, hy = s.headY;
    const headR = s.bodyRadius;
    const myScore = s.score;

    // Bigger bots think faster
    if (myScore >= 200) this.thinkEvery = 1;

    const distFromCenter = Math.sqrt(hx * hx + hy * hy);

    // 1) AVOID border — always priority.
    const edgeMargin = CONFIG.WORLD_RADIUS - headR * 2 - 60;
    if (distFromCenter > edgeMargin) {
      const inward = Math.atan2(-hy, -hx);
      s.setTargetAngle(inward);
      s.setBoost(distFromCenter > CONFIG.WORLD_RADIUS - headR - 20);
      return;
    }

    // 2) FLEE from threats — ALL bots do this, scaled by size
    const threatRange = Math.min(600, 200 + myScore * 0.15);
    const bestThreat = this._findClosestThreat(s, hx, hy, myScore, threatRange);
    if (bestThreat) {
      const fleeAngle = Math.atan2(hy - bestThreat.hy, hx - bestThreat.hx);
      s.setTargetAngle(fleeAngle);
      const d = Math.sqrt(bestThreat.d2);
      // Bigger threats and closer threats = more urgency
      const urgency = bestThreat.score / Math.max(1, myScore);
      s.setBoost(d < 300 || (urgency > 0.8 && d < 500));
      return;
    }

    // 3) Dodge body collisions — scale with size
    if (myScore >= 2000) {
      if (this._eliteDodge(s, hx, hy, headR, myScore, distFromCenter)) return;
    } else if (myScore >= 200) {
      if (this._mediumDodge(s, hx, hy, headR, myScore)) return;
    } else {
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
    }

    // 4) Goal-oriented behavior based on size + personality
    if (myScore >= 500) {
      this._thinkBig(s, hx, hy, headR, myScore, distFromCenter);
    } else if (myScore >= 50) {
      this._thinkMedium(s, hx, hy, headR, myScore, distFromCenter);
    } else {
      this._thinkSmall(s, hx, hy, headR, myScore, distFromCenter);
    }
  }

  // ---- Find closest threat (any snake heading toward us or nearby) ----
  _findClosestThreat(s, hx, hy, myScore, range) {
    const range2 = range * range;
    let best = null;
    for (const o of this.room.snakes.values()) {
      if (o.id === s.id || o.dead) continue;
      const d2v = dist2(hx, hy, o.headX, o.headY);
      if (d2v > range2) continue;
      // Any snake close enough and big enough to be dangerous
      if (o.score < myScore * 0.4) continue;
      // If close (<200px), always threat. If farther, only if heading toward us.
      if (d2v > 200 * 200) {
        const dx = hx - o.headX, dy = hy - o.headY;
        const facing = Math.cos(o.angle) * dx + Math.sin(o.angle) * dy;
        if (facing < 0) continue;
      }
      if (!best || d2v < best.d2) best = { hx: o.headX, hy: o.headY, d2: d2v, score: o.score };
    }
    return best;
  }

  // ---- MEDIUM: Wider dodge for mid-sized bots (score 200+) ----
  // Checks 5 angles, avoids bodies + border + nearby snake heads
  _mediumDodge(s, hx, hy, headR, myScore) {
    const scanDist = headR * 3 + 80;
    const candidates = [-60, -30, 0, 30, 60];
    let bestScore = -Infinity;
    let bestAngle = s.angle;

    for (const deg of candidates) {
      const testAngle = wrapAngle(s.angle + deg * Math.PI / 180);
      const px = hx + Math.cos(testAngle) * scanDist;
      const py = hy + Math.sin(testAngle) * scanDist;

      let score = 0;

      // Border penalty
      const dCenter = Math.sqrt(px * px + py * py);
      if (dCenter > CONFIG.WORLD_RADIUS - headR * 2 - 30) {
        score -= 500;
      }

      // Body collision penalty
      if (this.room.pointHitsBody(px, py, headR * 0.8, s.id)) {
        score -= 400;
      }

      // Close check
      const closeX = hx + Math.cos(testAngle) * (headR * 2 + 20);
      const closeY = hy + Math.sin(testAngle) * (headR * 2 + 20);
      if (this.room.pointHitsBody(closeX, closeY, headR * 0.7, s.id)) {
        score -= 600;
      }

      // Bonus for continuing straight
      if (deg === 0) score += 15;

      if (score > bestScore) {
        bestScore = score;
        bestAngle = testAngle;
      }
    }

    const diff = Math.abs(angleDiff(s.angle, bestAngle));
    if (diff > 0.05 && bestScore < -100) {
      s.setTargetAngle(bestAngle);
      s.setBoost(false);
      return true;
    }
    return false;
  }

  // ---- ELITE: Multi-angle dodge for big snakes ----
  _eliteDodge(s, hx, hy, headR, myScore, distFromCenter) {
    const scanDist = headR * 3 + 120;
    const candidates = [-90, -60, -30, 0, 30, 60, 90];
    let bestScore = -Infinity;
    let bestAngle = s.angle;

    for (const deg of candidates) {
      const testAngle = wrapAngle(s.angle + deg * Math.PI / 180);
      const px = hx + Math.cos(testAngle) * scanDist;
      const py = hy + Math.sin(testAngle) * scanDist;

      let score = 0;

      const dCenter = Math.sqrt(px * px + py * py);
      if (dCenter > CONFIG.WORLD_RADIUS - headR * 2) score -= 500;

      if (this.room.pointHitsBody(px, py, headR * 0.8, s.id)) score -= 400;

      const closeX = hx + Math.cos(testAngle) * (headR * 2 + 30);
      const closeY = hy + Math.sin(testAngle) * (headR * 2 + 30);
      if (this.room.pointHitsBody(closeX, closeY, headR * 0.7, s.id)) score -= 600;

      if (deg === 0) score += 15;

      if (score > bestScore) {
        bestScore = score;
        bestAngle = testAngle;
      }
    }

    const diff = Math.abs(angleDiff(s.angle, bestAngle));
    if (diff > 0.08 && bestScore < -100) {
      s.setTargetAngle(bestAngle);
      s.setBoost(false);
      return true;
    }
    return false;
  }

  // ---- SMALL bot (<50 score) ----
  _thinkSmall(s, hx, hy, headR, myScore, distFromCenter) {
    const food = this.room.findNearestFood(hx, hy, 350);
    if (food) {
      s.setTargetAngle(Math.atan2(food.y - hy, food.x - hx));
      s.setBoost(false);
      return;
    }

    // Wander: pick a direction, change it periodically
    this._wanderTimer--;
    if (this._wanderTimer <= 0) {
      this._wanderAngle = Math.random() * TAU;
      this._wanderTimer = 30 + (Math.random() * 60) | 0;
    }
    // Bias wander slightly away from center if near edge, toward open area otherwise
    const toCenter = Math.atan2(-hy, -hx);
    if (distFromCenter > CONFIG.WORLD_RADIUS * 0.6) {
      s.setTargetAngle(wrapAngle(this._wanderAngle * 0.4 + (toCenter + Math.PI) * 0.6));
    } else {
      s.setTargetAngle(this._wanderAngle);
    }
    s.setBoost(false);
  }

  // ---- MEDIUM bot (50-500 score) ----
  _thinkMedium(s, hx, hy, headR, myScore, distFromCenter) {
    // Grab powerups if nearby
    const powerup = this.room.findNearestPowerup(hx, hy, 500);
    if (powerup) {
      const pupAngle = Math.atan2(powerup.y - hy, powerup.x - hx);
      if (this._angleOpen(s, pupAngle, headR)) {
        s.setTargetAngle(pupAngle);
        const pupDist = Math.sqrt(dist2(hx, hy, powerup.x, powerup.y));
        s.setBoost(pupDist > 200);
        return;
      }
    }

    // Hunt smaller prey if we're big enough
    const prey = this.room.findPreyFor(s);
    if (prey && myScore > prey.score * 1.2 && prey.dist2 < 600 * 600) {
      const predictDist = Math.sqrt(prey.d2) * 0.3;
      const tx = prey.headX + Math.cos(prey.angle) * predictDist;
      const ty = prey.headY + Math.sin(prey.angle) * predictDist;
      s.setTargetAngle(Math.atan2(ty - hy, tx - hx));
      const close = Math.sqrt(prey.d2);
      s.setBoost(close < 350);
      return;
    }

    // Eat food
    const food = this.room.findNearestFood(hx, hy, 500);
    if (food) {
      s.setTargetAngle(Math.atan2(food.y - hy, food.x - hx));
      s.setBoost(false);
      return;
    }

    // Wander based on movement style
    this._wanderTimer--;
    if (this._wanderTimer <= 0) {
      this._wanderAngle = Math.random() * TAU;
      this._wanderTimer = 40 + (Math.random() * 80) | 0;
    }
    const toCenter = Math.atan2(-hy, -hx);
    if (this.moveStyle === 'edgeHugger') {
      // Move tangentially to center (circle around the map)
      const tangent = Math.atan2(-hx, hy);
      s.setTargetAngle(wrapAngle(tangent * 0.7 + this._wanderAngle * 0.3));
    } else if (this.moveStyle === 'roamer') {
      // Roam randomly, slight center bias only when far out
      if (distFromCenter > CONFIG.WORLD_RADIUS * 0.7) {
        s.setTargetAngle(wrapAngle(this._wanderAngle * 0.5 + toCenter * 0.5));
      } else {
        s.setTargetAngle(this._wanderAngle);
      }
    } else {
      // wanderer: gentle drift
      s.setTargetAngle(wrapAngle(s.angle + (Math.random() - 0.5) * 0.3));
    }
    s.setBoost(false);
  }

  // ---- BIG bot (500+ score) ----
  _thinkBig(s, hx, hy, headR, myScore, distFromCenter) {
    const cautious = myScore >= 3000;

    // Grab powerups if nearby and safe
    const powerup = this.room.findNearestPowerup(hx, hy, 500);
    if (powerup && !cautious) {
      const pupAngle = Math.atan2(powerup.y - hy, powerup.x - hx);
      if (this._angleOpen(s, pupAngle, headR)) {
        s.setTargetAngle(pupAngle);
        const pupDist = Math.sqrt(dist2(hx, hy, powerup.x, powerup.y));
        s.setBoost(pupDist > 200);
        return;
      }
    }

    // Hunt only if not cautious and prey is much smaller
    if (!cautious) {
      const prey = this.room.findPreyFor(s);
      if (prey && myScore > prey.score * 1.5 && prey.dist2 < 500 * 500) {
        const predictDist = Math.sqrt(prey.d2) * 0.35;
        const tx = prey.headX + Math.cos(prey.angle) * predictDist;
        const ty = prey.headY + Math.sin(prey.angle) * predictDist;
        s.setTargetAngle(Math.atan2(ty - hy, tx - hx));
        const close = Math.sqrt(prey.d2);
        s.setBoost(close < 300);
        return;
      }
    }

    // Eat food — wider scan for big snakes
    const foodRange = cautious ? 400 : 800;
    const food = this.room.findNearestFood(hx, hy, foodRange);
    if (food) {
      const foodAngle = Math.atan2(food.y - hy, food.x - hx);
      if (this._angleOpen(s, foodAngle, headR)) {
        s.setTargetAngle(foodAngle);
        s.setBoost(false);
        return;
      }
    }

    // Wander based on movement style
    this._wanderTimer--;
    if (this._wanderTimer <= 0) {
      this._wanderAngle = Math.random() * TAU;
      this._wanderTimer = 50 + (Math.random() * 100) | 0;
    }
    const toCenter = Math.atan2(-hy, -hx);
    if (this.moveStyle === 'edgeHugger') {
      const tangent = Math.atan2(-hx, hy);
      s.setTargetAngle(wrapAngle(tangent * 0.6 + this._wanderAngle * 0.4));
      s.setBoost(cautious ? false : false);
    } else if (this.moveStyle === 'roamer') {
      if (distFromCenter > CONFIG.WORLD_RADIUS * 0.65) {
        s.setTargetAngle(wrapAngle(this._wanderAngle * 0.4 + toCenter * 0.6));
      } else {
        s.setTargetAngle(wrapAngle(this._wanderAngle * 0.7 + s.angle * 0.3));
      }
      s.setBoost(false);
    } else {
      // wanderer: gentle wide curves
      s.setTargetAngle(wrapAngle(s.angle + (Math.random() - 0.5) * 0.2));
      s.setBoost(false);
    }
  }

  // Scan ahead for collisions (standard bots).
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
