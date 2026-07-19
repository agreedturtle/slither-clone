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

// Personality types with weights: dumb(35%), medium(40%), smart(25%)
const PERSONALITY_WEIGHTS = [
  { type: 'dumb',  weight: 0.35 },
  { type: 'medium', weight: 0.40 },
  { type: 'smart',  weight: 0.25 },
];

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

    // Dumb bots think less often (slower reactions). Smart bots think every tick.
    if (this.personality === 'dumb') {
      this.thinkEvery = 2 + ((Math.random() * 2) | 0); // 2..3
    } else if (this.personality === 'smart') {
      this.thinkEvery = 1; // every tick
    } else {
      this.thinkEvery = 1 + ((Math.random() * 2) | 0); // 1..2
    }
    this.tickCounter = 0;
    this._wanderAngle = Math.random() * TAU; // for dumb wandering
    this._huntTarget = null; // { headX, headY, score, id } for smart bots
    this._huntTimer = 0;

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
    this._huntTarget = null;
    this._huntTimer = 0;
  }

  respawn() {
    this.skin = (Math.random() * 11) | 0;
    this.spawn();
  }

  onDeath() { /* Room will call respawn after a short delay */ }

  // ---- Main AI tick ----
  think() {
    const s = this.snake;
    if (!s || s.dead) return;
    this.tickCounter++;
    const hx = s.headX, hy = s.headY;
    const headR = s.bodyRadius;
    const myScore = s.score;

    // 1) AVOID border — always priority.
    const distFromCenter = Math.sqrt(hx * hx + hy * hy);
    const edgeMargin = CONFIG.WORLD_RADIUS - headR * 2 - 60;
    if (distFromCenter > edgeMargin) {
      const inward = Math.atan2(-hy, -hx);
      s.setTargetAngle(inward);
      s.setBoost(false);
      return;
    }

    // 2) AVOID bodies — always priority.
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

    // Personality-specific behavior below.
    switch (this.personality) {
      case 'dumb':  this._thinkDumb(s, hx, hy, headR, myScore); break;
      case 'smart': this._thinkSmart(s, hx, hy, headR, myScore, distFromCenter); break;
      default:      this._thinkMedium(s, hx, hy, headR, myScore, distFromCenter); break;
    }
  }

  // ---- DUMB bot: wanders randomly, eats food only if very close, rarely fights ----
  _thinkDumb(s, hx, hy, headR, myScore) {
    // Flee if something huge is right on top (panic).
    const threat = this.room.findThreatTo(s);
    if (threat && threat.dist2 < 120 * 120) {
      const flee = Math.atan2(hy - threat.headY, hx - threat.headX);
      s.setTargetAngle(flee);
      s.setBoost(false);
      return;
    }

    // Eat only very close food.
    const food = this.room.findNearestFood(hx, hy, 300);
    if (food) {
      s.setTargetAngle(Math.atan2(food.y - hy, food.x - hx));
      s.setBoost(false);
      return;
    }

    // Wander: slowly drift in a random direction, occasionally change.
    if (this.tickCounter % 20 === 0 || !this._wanderAngle) {
      this._wanderAngle = Math.random() * TAU;
    }
    // Drift toward center slightly so they don't hug the wall.
    const toCenter = Math.atan2(-hy, -hx);
    const blend = wrapAngle(this._wanderAngle * 0.7 + toCenter * 0.3);
    s.setTargetAngle(blend);
    s.setBoost(false);
  }

  // ---- MEDIUM bot: eats food, avoids threats, mild aggression ----
  _thinkMedium(s, hx, hy, headR, myScore, distFromCenter) {
    // Flee from threats.
    const threat = this.room.findThreatTo(s);
    if (threat && threat.dist2 < 200 * 200) {
      const flee = Math.atan2(hy - threat.headY, hx - threat.headX);
      s.setTargetAngle(flee);
      s.setBoost(false);
      return;
    }

    // If far from center, head back strongly.
    if (distFromCenter > CONFIG.WORLD_RADIUS * 0.35) {
      const toCenter = Math.atan2(-hy, -hx);
      s.setTargetAngle(toCenter);
      s.setBoost(distFromCenter > CONFIG.WORLD_RADIUS * 0.6);
      return;
    }

    // Near center — pick up nearby food, otherwise drift around center.
    const food = this.room.findNearestFood(hx, hy, 350);
    if (food) {
      s.setTargetAngle(Math.atan2(food.y - hy, food.x - hx));
      s.setBoost(false);
      return;
    }

    // Chill near center: small random drift, bias back toward (0,0).
    const toCenter = Math.atan2(-hy, -hx);
    const wander = s.angle + (Math.random() - 0.5) * 0.4;
    s.setTargetAngle(wrapAngle(toCenter * 0.5 + wander * 0.5));
    s.setBoost(false);
  }

  // ---- SMART bot: aggressive hunter, boosts to cut off, seeks center & powerups ----
  _thinkSmart(s, hx, hy, headR, myScore, distFromCenter) {
    // Flee from much bigger threats.
    const threat = this.room.findThreatTo(s);
    if (threat && threat.dist2 < 250 * 250) {
      const flee = Math.atan2(hy - threat.headY, hx - threat.headX);
      s.setTargetAngle(flee);
      s.setBoost(true); // boost away from danger
      return;
    }

    // Hunt smaller snakes aggressively.
    const prey = this.room.findPreyFor(s);
    if (prey && myScore > 30) {
      this._huntTarget = { headX: prey.headX, headY: prey.headY, score: prey.score, id: prey.id };
      this._huntTimer = 60; // remember target for 3 seconds
      // Predict prey trajectory for intercept.
      const predictDist = Math.sqrt(prey.d2) * 0.4;
      const tx = prey.headX + Math.cos(prey.angle) * predictDist;
      const ty = prey.headY + Math.sin(prey.angle) * predictDist;
      s.setTargetAngle(Math.atan2(ty - hy, tx - hx));
      // Boost aggressively to close distance.
      const close = Math.sqrt(prey.d2);
      s.setBoost(close < 400 && myScore > prey.score * 1.1);
      return;
    }

    // Continue chasing remembered target if still close.
    if (this._huntTimer > 0 && this._huntTarget) {
      this._huntTimer--;
      const dx = this._huntTarget.headX - hx;
      const dy = this._huntTarget.headY - hy;
      const d2 = dx * dx + dy * dy;
      if (d2 < 500 * 500) {
        s.setTargetAngle(Math.atan2(dy, dx));
        s.setBoost(d2 < 300 * 300 && myScore > 40);
        return;
      }
      this._huntTarget = null;
    }

    // Powerups — boost to grab them.
    const powerup = this.room.findNearestPowerup(hx, hy, 700);
    if (powerup) {
      s.setTargetAngle(Math.atan2(powerup.y - hy, powerup.x - hx));
      const pupDist = Math.sqrt(dist2(hx, hy, powerup.x, powerup.y));
      s.setBoost(pupDist > 200);
      return;
    }

    // Eat food — prefer dense clusters.
    const food = this.room.findNearestFood(hx, hy, 800);
    if (food) {
      s.setTargetAngle(Math.atan2(food.y - hy, food.x - hx));
      s.setBoost(false);
      return;
    }

    // Move toward center — smart bots prefer center of the map.
    const toCenter = Math.atan2(-hy, -hx);
    if (distFromCenter > CONFIG.WORLD_RADIUS * 0.3) {
      s.setTargetAngle(toCenter);
      s.setBoost(false);
    } else {
      // Already near center, patrol in a direction looking for prey.
      const patrol = s.angle + (Math.random() > 0.5 ? 0.3 : -0.3);
      s.setTargetAngle(patrol);
      s.setBoost(false);
    }
  }

  // Scan ahead for collisions.
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
