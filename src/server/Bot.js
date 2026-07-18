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
  'Proton', 'Neutron', 'Quark', 'Lepton', 'Boson', 'Higgs', 'W玻色子', 'Gluon',
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
  'Daxter', 'MasterChief', 'Cortana', 'Arbiter', 'Johnson', 'Keyes', 'Geralt', 'Yennefer',
  'Triss', 'Ciri', 'Dandelion', 'Zoltan', 'Kratos', 'Atreus', 'Freya', 'Mimir',
  'Baldur', 'Joel', 'Ellie', 'Abby', 'Tommy', 'Dina', 'Snake', 'Raiden',
  'Ocelot', 'BigBoss', 'VenomSnake', 'Solid', 'Liquid', 'Solidus', 'GrayFox', 'PsychoMantis',
  'NathanDrake', 'Sully', 'Elena', 'SamFisher', 'Agent47', 'LaraCroft', 'Aloy', 'Sekiro',
  'HollowKnight', 'Madeline', 'Cuphead', 'Undertale', 'Deltarune', 'Minecraft', 'Terraria', 'Roblox',
  'Fortnite', 'Apex', 'Valorant', 'Overwatch', 'LeaugeOfLegends', 'Dota', 'CSGO', 'RainbowSix',
  'Rust', 'AmongUs', 'FallGuys', 'RocketLeague', 'BrawlStars', 'ClashRoyale', 'ClashOfClans', 'SubwaySurfers',
  'TempleRun', 'FlappyBird', 'Tetris', 'Minesweeper', 'Solitaire', 'Chess', 'Checkers', 'Uno',
  'Monopoly', 'Jenga', 'Darts', 'Domino', 'Jazz', 'Blues', 'Rock', 'Metal',
  'Punk', 'Pop', 'Soul', 'Funk', 'Disco', 'Country', 'Folk', 'Indie',
  'Grunge', 'Techno', 'Dubstep', 'House', 'Trance', 'DrumAndBass', 'HipHop', 'Rap',
  'RnB', 'Classical', 'Opera', 'Symphony', 'Sonata', 'Concerto', 'Mozart', 'Beethoven',
  'Bach', 'Chopin', 'Vivaldi', 'Debussy', 'Tchaikovsky', 'Dvorak', 'Mendelssohn', 'Brahms',
  'Liszt', 'Wagner', 'Verdi', 'Puccini', 'Rossini', 'Handel', 'Einstein', 'Newton',
  'Tesla', 'Edison', 'Darwin', 'Hawking', 'Curie', 'Feynman', 'Bohr', 'Heisenberg',
  'Schrödinger', 'Dirac', 'Planck', 'Maxwell', 'Lorentz', 'Boltzmann', 'Gibbs', 'Shakespeare',
  'Hemingway', 'Twain', 'Austen', 'Dickens', 'Tolkien', 'Rowling', 'Martin', 'Asimov',
  'Bradbury', 'Clarke', 'Herbert', 'Orwell', 'Huxley', 'Vonnegut', 'Poe', 'Lovecraft',
  'King', 'Koontz', 'Rice', 'Red', 'Blue', 'Green', 'Yellow', 'Purple',
  'Pink', 'Teal', 'Coral', 'Ivory', 'Jade', 'Ruby', 'Sapphire', 'Emerald',
  'Topaz', 'Amber', 'Opal', 'Pearl', 'Onyx', 'Obsidian', 'Granite', 'Marble',
  'Quartz', 'Crystal', 'Diamond', 'Bronze', 'Steel', 'Chrome', 'RubyRed', 'SapphireBlue',
  'EmeraldGreen', 'DiamondWhite', 'TopazGold', 'AmberGlow', 'PearlShine', 'OnyxBlack', 'ObsidianDark', 'Zero',
  'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
  'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen', 'Twenty', 'Hundred', 'Thousand', 'Infinity', 'Omega',
  'Sigma', 'Delta', 'Theta', 'Lambda', 'Alpha', 'Beta', 'Gamma', 'Epsilon',
  'Zeta', 'Eta', 'Iota', 'Kappa', 'Mu', 'Nu', 'Xi', 'Omicron',
  'Pi', 'Rho', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Monday',
  'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February',
  'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December', 'Spring', 'Summer', 'Autumn', 'Winter', 'Earthquake', 'Volcano',
  'Tsunami', 'Avalanche', 'Landslide', 'Phoenix', 'Dragon', 'Griffin', 'Unicorn', 'Pegasus',
  'Chimera', 'Hydra', 'Minotaur', 'Centaur', 'Cyclops', 'Medusa', 'Cerberus', 'Kraken',
  'Leviathan', 'Behemoth', 'Manticore', 'Basilisk', 'Thunderbird', 'Garuda', 'Quetzalcoatl', 'Amphisbaena',
  'Serpent', 'Wyvern', 'Drake', 'Lindworm', 'Ormus', 'Naga', 'Fafnir', 'Jörmungandr',
  'Zmey', 'Tatzelwurm', 'PythonLord', 'CobraKing', 'ViperQueen', 'MambaLord', 'BoaMaster', 'EelKing',
  'SnakeGod', 'WormLord', 'NoodleMaster', 'SlinkyKing', 'CoilLord', 'FangMaster', 'ScaleLord', 'VenomKing',
  'HissMaster', 'SlitherPro', 'WiggleKing', 'TwistMaster', 'SquiggleLord', 'LoopKing', 'RattlerKing', 'SidewinderPro',
  'CopperKing', 'MoccasinLord', 'PitKing', 'KeelLord', 'GarterKing', 'RacerLord', 'ToxicWorm', 'VenomousWorm',
  'PoisonWorm', 'DeadlyWorm', 'KillerWorm', 'MegaViper', 'UltraCobra', 'HyperBoa', 'SuperEel', 'MegaNoodle',
  'UltraSlinky', 'HyperCoil', 'SuperFang', 'MegaScale', 'UltraVenom', 'WormLord420', 'NoodleGod69', 'SnekMaster9000',
  'DangerNoodle666', 'SlitherKing777', 'CoilGod888', 'FangMaster555', 'ViperLord333', 'ProGamer', 'NoobSlayer', 'MLGPro',
  'TryHard', 'EZClap', 'GGWP', 'GetRekt', 'L2P', 'GetGud', 'Owned', 'Rekt',
  'Pwned', 'N00b', 'xD', 'lol', 'bruh', 'oof', 'yeet', 'sus',
  'cap', 'fr', 'based', 'cringe', 'sigma', 'alpha', 'chad', 'virgin',
  'Goofy', 'Silly', 'Wacky', 'Zany', 'Bonkers', 'Loony', 'Quirky', 'Odd',
  'Weird', 'Strange', 'Bizarre', 'Peculiar', 'Eccentric', 'Nutty', 'Dotty', 'Batty',
  'Crackers', 'Dingus', 'Doofus', 'Dunce', 'Knucklehead', 'Bonehead', 'Meathead', 'Blockhead',
  'Airhead', 'Egghead', 'Fathead', 'Pinhead', 'Dullard', 'NoodleHead', 'WormBrain', 'SnekBrain',
  'CoilBrain', 'FangBrain', 'WormFace', 'SnekFace', 'CoilFace', 'FangFace', 'ScaleFace', 'TrollFace',
  'DerpFace', 'KappaFace', 'MonkaS', 'PepeHands', 'PepeLaugh', 'Pepega', 'PogChamp', 'Poggers',
  'KEKW', 'LUL', 'Sadge', 'Happyge', 'Copium', 'Hopium', 'Cope', 'Seethe',
  'Mald', 'TouchGrass', 'GoOutside', 'ReadABook', 'DrinkWater', 'TakeNap', 'Speedrun', 'AnyPercent',
  'Glitchless', 'Pacifist', 'TAS', 'Noclip', 'Debug', 'CheatCode', 'IDDQD', 'IDKFA',
  'BigHead', 'Konami', 'UpUp', 'DownDown', 'LeftRight', 'ABBA', 'SelectStart', 'GameOver',
  'InsertCoin', 'Continue', 'NewGame', 'LoadGame', 'SaveState', 'Checkpoint', 'Respawn', 'Revive',
  'Heal', 'Buff', 'Nerf', 'OP', 'Broken', 'Balanced', 'Fair', 'SkillIssue',
  'Diff', 'GG', 'WP', 'EZ', 'NoCap', 'Deadass', 'OnGod', 'FrFr',
  'Bussin', 'Slaps', 'HitsDifferent', 'Lowkey', 'Highkey', 'LowTaper', 'Fade', 'Mullet',
  'BuzzCut', 'Ponytail', 'Bun', 'BobCut', 'Lemonade', 'SweetTea', 'MountainDew', 'Gatorade',
  'RedBull', 'Monster', 'Bang', 'Rockstar', 'Celsius', 'Prime', 'Sprite', 'Fanta',
  'Pepsi', 'Cola', 'Faygo', 'Shasta', 'Pibb', 'MugRoot', 'Surge', 'Jolt',
  'Vault', 'Josta', 'Coffee', 'Espresso', 'Latte', 'Mocha', 'Cappuccino', 'Americano',
  'MochaMaster', 'BrewKing', 'BeanLord', 'CaffeineWorm', 'SleepyWorm', 'TiredSnek', 'NapCoil', 'DreamNoodle',
  'SnoreFang', 'PizzaTime', 'PastaLaVista', 'TacoTuesday', 'WaffleHouse', 'IHOP', 'Denny', 'Wendys',
  'TacoBell', 'Chipotle', 'Subway', 'McDonalds', 'BurgerKing', 'ChickFilA', 'Popeyes', 'KFC',
  'FiveGuys', 'ShakeShack', 'InNOut', 'SonicDrive', 'Canes', 'Zaxbys', 'Bojangles', 'Hardees',
  'CarlJr',
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
