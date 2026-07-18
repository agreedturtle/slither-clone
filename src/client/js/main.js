// ===========================================================================
// main.js — client entry point. Wires UI, Net, Game and global key bindings.
// ===========================================================================

import Net from './Net.js';
import Input from './Input.js';
import Camera from './Camera.js';
import Renderer from './Renderer.js';
import Game from './Game.js';
import Hud from './Hud.js';
import Ui from './ui.js';
import AdminPanel from './AdminPanel.js';
import KillFeed from './KillFeed.js';

const canvas = document.getElementById('game');

const net = new Net();
const input = new Input(canvas);
const camera = new Camera(canvas);
const renderer = new Renderer(canvas);
const hud = new Hud();
const ui = new Ui();
const adminPanel = new AdminPanel(net);
const killFeed = new KillFeed();

const game = new Game({ net, renderer, camera, input, hud, ui });

// ---- Auth state ----
let authState = { token: null, username: null };

// Clear previous session — require re-login each time
localStorage.removeItem('slither_token');
localStorage.removeItem('slither_username');

// ---- Auth UI wiring ----
let authMode = 'login'; // 'login' or 'register'

ui.loginBtn.addEventListener('click', () => {
  ui.hideMenu();
  ui.showLoginScreen();
});

ui.authLoginTab.addEventListener('click', () => {
  authMode = 'login';
  ui.setAuthMode('login');
});

ui.authRegisterTab.addEventListener('click', () => {
  authMode = 'register';
  ui.setAuthMode('register');
});

ui.authSubmitBtn.addEventListener('click', () => {
  const username = ui.authUsername.value.trim();
  const password = ui.authPassword.value;
  if (!username || !password) {
    ui.showAuthError('Enter username and password');
    return;
  }
  if (authMode === 'login') {
    net.sendLogin(username, password);
  } else {
    net.sendRegister(username, password);
  }
});

ui.authBackBtn.addEventListener('click', () => {
  ui.hideLoginScreen();
  ui.showMenu();
});

ui.authGuestBtn.addEventListener('click', () => {
  authState.token = null;
  authState.username = null;
  ui.hideLoginScreen();
  ui.showMenu();
});

ui.profileBtn.addEventListener('click', () => {
  ui.hideMenu();
  ui.showProfile();
  net.sendProfileRequest();
});

ui.profileBackBtn.addEventListener('click', () => {
  ui.hideProfile();
  ui.showMenu();
});

ui.profileLogoutBtn.addEventListener('click', () => {
  authState.token = null;
  authState.username = null;
  net.setAuthToken(null);
  ui.showLoggedOut();
  adminPanel.setAdminUser(null);
  ui.hideProfile();
  ui.showMenu();
});

// ---- Auth results ----
net.on('authResult', (d) => {
  if (d.ok) {
    authState.token = d.token;
    authState.username = d.username;
    net.setAuthToken(d.token);
    ui.showAuthSuccess(`Logged in as ${d.username}`);
    ui.showLoggedIn(d.username);
    adminPanel.setAdminUser(d.username);
    setTimeout(() => {
      ui.hideLoginScreen();
      ui.showMenu();
    }, 800);
  } else {
    ui.showAuthError(d.msg || 'Failed');
  }
});

net.on('profileData', (d) => {
  ui.updateProfile(d);
});

net.on('headshot', (d) => {
  killFeed.addChat('System', `${d.killer} landed a headshot on ${d.victim}!`);
});

net.on('killFeed', (d) => {
  killFeed.addKill(d.killer, d.victim, d.isHeadshot);
  // Kill streak tracking
  if (d.killer === authState.username) {
    myKillStreak++;
    clearTimeout(myKillStreakTimer);
    if (myKillStreak >= 2) killFeed.showKillStreak(myKillStreak, 'You');
    myKillStreakTimer = setTimeout(() => { myKillStreak = 0; }, 5000);
  } else {
    myKillStreak = 0;
  }
});

net.on('chat', (d) => {
  killFeed.addChat(d.senderName, d.message);
});

// ---- Kill streak state ----
let myKillStreak = 0;
let myKillStreakTimer = null;

// ---- Chat ----
killFeed.onSend((msg) => {
  net.sendChat(msg);
});

// ---- Button wiring ----
ui.playBtn.addEventListener('click', () => {
  if (!net.connected) return;
  game.join(ui.getName(), ui.getSkin());
});
ui.respawnBtn.addEventListener('click', () => {
  game.respawn();
});
ui.menuBtn.addEventListener('click', () => {
  ui.hideDeath();
  ui.hideHud();
  ui.showMenu();
});
ui.skinsBtn.addEventListener('click', () => {
  ui.hideMenu();
  ui.showSkins();
});
ui.skinsBackBtn.addEventListener('click', () => {
  ui.hideSkins();
  ui.showMenu();
});

// ---- All-time leaderboard ----
let alltimeData = [];
let alltimeSortBy = 'score';

ui.alltimeBtn.addEventListener('click', () => {
  ui.hideMenu();
  ui.showAlltime();
  net.requestLeaderboardAlltime();
});
ui.alltimeBackBtn.addEventListener('click', () => {
  ui.hideAlltime();
  ui.showMenu();
});

// Tab switching
document.querySelectorAll('.alltime-tabs .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    alltimeSortBy = btn.dataset.tab;
    document.querySelectorAll('.alltime-tabs .tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    ui.updateAlltime(alltimeData, alltimeSortBy, authState.username);
  });
});

net.on('leaderboardAlltime', (d) => {
  alltimeData = d.entries;
  ui.updateAlltime(d.entries, alltimeSortBy, authState.username);
});

// Touch boost button: hold to boost.
if (ui.boostBtn) {
  const setBoost = (on) => input.setTouchBoost(on);
  ui.boostBtn.addEventListener('touchstart', (e) => { e.preventDefault(); setBoost(true); }, { passive: false });
  ui.boostBtn.addEventListener('touchend',   (e) => { e.preventDefault(); setBoost(false); }, { passive: false });
  ui.boostBtn.addEventListener('mousedown',  () => setBoost(true));
  ui.boostBtn.addEventListener('mouseup',    () => setBoost(false));
  ui.boostBtn.addEventListener('mouseleave', () => setBoost(false));
}

// ---- Keyboard ----
window.addEventListener('keydown', (e) => {
  // Enter: open chat if in game, play from menu, or respawn from death.
  if (e.code === 'Enter') {
    if (killFeed.chatOpen) return; // let chat handle it
    if (hud && !hud.el.classList.contains('hidden') && !ui.death.classList.contains('hidden')) {
      // dead — respawn
    } else if (hud && !hud.el.classList.contains('hidden')) {
      e.preventDefault();
      killFeed.openChat();
      return;
    } else if (!ui.menu.classList.contains('hidden') && net.connected) {
      game.join(ui.getName(), ui.getSkin());
    } else if (!ui.death.classList.contains('hidden')) {
      game.respawn();
    }
  }
  // G: toggle low graphics.
  if (e.code === 'KeyG') {
    renderer.toggleLowGraphics();
  }
  // F2: toggle admin panel.
  if (e.code === 'F2') {
    e.preventDefault();
    adminPanel.toggle();
  }
});

// ---- Connection lifecycle ----
net.on('open', () => ui.hideConnecting());
net.on('close', () => ui.showConnecting('Disconnected. Refresh to retry.'));
net.on('error', () => ui.showConnecting('Connection error. Refresh to retry.'));
net.on('welcome', () => { ui.hideConnecting(); });

ui.showConnecting('Connecting to server…');
game.start();
