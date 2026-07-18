// ===========================================================================
// colors.js — skins and food palettes.
// ===========================================================================

// Distinct, attractive skin colors. Index = skin id sent over the wire.
export const SKINS = [
  { name: 'Red',        main: '#FF4444', shade: '#B31E1E', glow: '#FF7777' },
  { name: 'Blue',       main: '#3388FF', shade: '#1E55B3', glow: '#66AAFF' },
  { name: 'Green',      main: '#44CC44', shade: '#1E8C1E', glow: '#77FF77' },
  { name: 'Yellow',     main: '#FFD700', shade: '#B39500', glow: '#FFE94D' },
  { name: 'Orange',     main: '#FF8C1A', shade: '#B35F0E', glow: '#FFB355' },
  { name: 'Light Blue', main: '#55CCFF', shade: '#2E8CB3', glow: '#99E0FF' },
  { name: 'Sunset',     main: 'combo',   shade: '#B35F0E', glow: '#FFFFFF',
    colors: ['#FF8C1A', '#F0F0F0', '#55CCFF'] },
  { name: 'Ocean',      main: 'combo',   shade: '#1E55B3', glow: '#99E0FF',
    colors: ['#55CCFF', '#FFD700', '#3388FF'] },
  { name: 'Sandy',      main: 'combo',   shade: '#8B6914', glow: '#FFD700',
    colors: ['#FF8C1A', '#8B6914', '#D2B48C', '#D2B48C', '#8B6914'] },
  { name: 'Frost',      main: 'combo',   shade: '#0E6B6B', glow: '#7FFFFF',
    colors: ['#00CED1', '#20B2AA', '#20B2AA', '#00CED1'] },
  { name: 'Crimson',    main: 'combo',   shade: '#8B1A1A', glow: '#FF6666',
    colors: ['#FF4444', '#3388FF', '#FF4444', '#3388FF'] },
  { name: 'Royal',      main: 'split',   shade: '#1A3A8B', glow: '#00FFFF',
    split: ['#2255CC', '#E8D44D'] },
];

export const RAINBOW_STOPS = [
  '#ff5252', '#ff9a1f', '#ffd24d', '#7CFC4D',
  '#2CE0B0', '#19E0FF', '#5CB8FF', '#9D6BFF', '#FF3DC4',
];

// Food pellet colors (random pick).
export const FOOD_COLORS = [
  '#19E0FF', '#FF3DC4', '#FFD24D', '#7CFC4D',
  '#9D6BFF', '#FF9A1F', '#2CE0B0', '#FF5C5C',
];

// Death food uses brighter / larger glow sprites.
export const FOOD_DEATH_COLOR = '#FFEA66';

export function skinById(id) {
  return SKINS[id % SKINS.length];
}

export function randomSkinId() {
  return Math.floor(Math.random() * SKINS.length);
}

export function randomFoodColor() {
  return FOOD_COLORS[(Math.random() * FOOD_COLORS.length) | 0];
}
