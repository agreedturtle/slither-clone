// ===========================================================================
// filter.js — profanity / inappropriate word filter.
//
// Shared by server (registration, login) and client (nickname validation).
// Uses substring matching with common leetspeak substitutions.
// ===========================================================================

const RAW_BANNED = [
  // slurs
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded',
  'spic', 'kike', 'chink', 'wetback', 'towelhead',
  // sexual
  'penis', 'vagina', 'dick', 'cock', 'pussy', 'tits', 'asshole',
  'dildo', 'blowjob', 'handjob', 'cumshot', 'orgasm',
  'hentai', 'porn', 'xxx', 'nsfw', 'sexcam',
  // profanity
  'shit', 'fuck', 'fucker', 'fucking', 'fucked', 'motherfucker',
  'bitch', 'bastard', 'damn', 'ass', 'assface',
  // violence
  'kill', 'murder', 'rape', 'rapist',
  // drug
  'heroin', 'cocaine', 'meth', 'weed',
  // hate
  'hitler', 'nazi', 'holocaust',
];

// Build normalized list: lowercase, no spaces/hyphens/underscores
function normalize(s) {
  return s.toLowerCase().replace(/[\s\-_.!@#$%^&*()=+[\]{}|;:'",.<>?/\\~`]/g, '');
}

// Leetspeak -> normal mapping
const LEET = { '0':'o', '1':'i', '3':'e', '4':'a', '5':'s', '7':'t', '$':'s', '@':'a', '!':'i', '+':'t', '8':'b' };
function deleet(s) {
  return s.split('').map(c => LEET[c] || c).join('');
}

const NORMALIZED_BANNED = RAW_BANNED.map(w => normalize(deleet(w)));

export function isClean(name) {
  const n = normalize(deleet(name));
  if (n.length < 2) return false;
  for (const bad of NORMALIZED_BANNED) {
    if (bad.length < 3) continue;
    if (n.includes(bad)) return false;
  }
  return true;
}

export function filterName(name) {
  const trimmed = (name || '').trim().slice(0, 16);
  if (!trimmed) return null;
  if (!isClean(trimmed)) return null;
  return trimmed;
}
