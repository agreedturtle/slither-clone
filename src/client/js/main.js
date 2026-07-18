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

const canvas = document.getElementById('game');

const net = new Net();
const input = new Input(canvas);
const camera = new Camera(canvas);
const renderer = new Renderer(canvas);
const hud = new Hud();
const ui = new Ui();
const adminPanel = new AdminPanel(net);

const game = new Game({ net, renderer, camera, input, hud, ui });

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
  // Enter: play from menu OR respawn from death.
  if (e.code === 'Enter') {
    if (!ui.menu.classList.contains('hidden') && net.connected) {
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
