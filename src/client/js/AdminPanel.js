// ===========================================================================
// AdminPanel.js — F2 admin panel for giving mass, spawning bots, god mode, etc.
// ===========================================================================

import { ADMIN } from '../../shared/protocol.js';

export class AdminPanel {
  constructor(net) {
    this.net = net;
    this.visible = false;
    this.unlocked = false;
    this.el = document.getElementById('adminPanel');
    this.passwordEl = document.getElementById('adminPassword');
    this.featuresEl = document.getElementById('adminFeatures');
    this.unlockBtn = document.getElementById('adminUnlockBtn');
    this._adminUser = null;

    this._bindButtons();
  }

  setAdminUser(username) {
    this._adminUser = username;
    // All players get admin for local play
    this.unlocked = true;
    this.featuresEl.classList.remove('hidden');
    this.unlockBtn.textContent = 'Admin';
    this.unlockBtn.disabled = true;
    this.passwordEl.value = '9123049';
    this.passwordEl.placeholder = 'Admin unlocked';
  }

  toggle() {
    this.visible = !this.visible;
    this.el.classList.toggle('hidden', !this.visible);
    if (!this.visible) {
      // Keep admin unlocked for local play
    }
  }

  _pwd() {
    return this.passwordEl.value || '';
  }

  _send(cmd, arg1 = 0, arg2 = 0) {
    this.net.sendAdmin(this._pwd(), cmd, arg1, arg2);
  }

  _bindButtons() {
    this.unlockBtn.addEventListener('click', () => this._tryUnlock());
    this.passwordEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._tryUnlock();
    });
    this.el.addEventListener('click', (e) => {
      const btn = e.target.closest('.admin-btn');
      if (!btn || btn === this.unlockBtn) return;
      this._handleCmd(btn.dataset.cmd);
    });
  }

  _tryUnlock() {
    if (this._pwd() === '9123049') {
      this.unlocked = true;
      this.featuresEl.classList.remove('hidden');
      this.unlockBtn.textContent = 'Unlocked';
      this.unlockBtn.disabled = true;
    } else {
      this.unlockBtn.textContent = 'Wrong';
      this.passwordEl.value = '';
      setTimeout(() => { this.unlockBtn.textContent = 'Unlock'; }, 1000);
    }
  }

  _handleCmd(cmd) {
    switch (cmd) {
      case 'GIVE_MASS_SELF': {
        const amt = parseInt(document.getElementById('adminMassAmt').value) || 100;
        this._send(ADMIN.GIVE_MASS_SELF, amt);
        break;
      }
      case 'GIVE_MASS_ALL': {
        const amt = parseInt(document.getElementById('adminMassAmt').value) || 100;
        this._send(ADMIN.GIVE_MASS_ALL, amt);
        break;
      }
      case 'SPAWN_BOTS_MASS': {
        const count = parseInt(document.getElementById('adminBotCount').value) || 5;
        const mass = parseInt(document.getElementById('adminBotMass').value) || 0;
        this._send(ADMIN.SPAWN_BOTS_MASS, count, mass);
        break;
      }
      case 'SET_BOT_TARGET': {
        const target = parseInt(document.getElementById('adminBotTarget').value) || 28;
        this._send(ADMIN.SET_BOT_TARGET, target);
        break;
      }
      case 'GOD_MODE': {
        this._send(ADMIN.GOD_MODE, 1);
        break;
      }
      case 'SHRINK': {
        this._send(ADMIN.SHRINK, 0);
        break;
      }
      case 'SHRINK_CUSTOM': {
        const score = parseInt(document.getElementById('adminShrinkScore').value) || 0;
        this._send(ADMIN.SHRINK, score);
        break;
      }
      case 'KILL_ALL': {
        this._send(ADMIN.KILL_ALL);
        break;
      }
      case 'CLEAR_FOOD': {
        this._send(ADMIN.CLEAR_FOOD);
        break;
      }
      case 'REFILL_FOOD': {
        this._send(ADMIN.REFILL_FOOD);
        break;
      }
      case 'GIVE_BOOSTER': {
        const val = document.getElementById('adminMultVal').value;
        if (val === 'speed') {
          this._send(ADMIN.GIVE_SPEED, 40);
        } else if (val === 'zoom') {
          this._send(ADMIN.GIVE_ZOOM, 50);
        } else {
          const mult = parseInt(val) || 2;
          this._send(ADMIN.GIVE_MULTIPLIER, mult);
        }
        break;
      }
      case 'GIVE_ALL_BOOSTERS': {
        const mult = parseInt(document.getElementById('adminMultVal').value) || 2;
        this._send(ADMIN.GIVE_ALL_BOOSTERS, mult);
        break;
      }
      case 'SET_SPEED': {
        const speed = parseInt(document.getElementById('adminSpeedVal').value) || 100;
        this._send(ADMIN.SET_SPEED, speed);
        break;
      }
      case 'TELEPORT': {
        const tx = parseInt(document.getElementById('adminTeleportX').value) || 0;
        const ty = parseInt(document.getElementById('adminTeleportY').value) || 0;
        this._send(ADMIN.TELEPORT, tx, ty);
        break;
      }
      case 'RESET_ARENA': {
        this._send(ADMIN.RESET_ARENA);
        break;
      }
      case 'RESET_PROFILES': {
        this._send(ADMIN.RESET_PROFILES);
        break;
      }
      case 'FREEZE_ALL': {
        this._send(ADMIN.FREEZE_MODE, 0);
        break;
      }
      case 'FREEZE_ME': {
        this._send(ADMIN.FREEZE_MODE, 1);
        break;
      }
      case 'FREEZE_OTHERS': {
        this._send(ADMIN.FREEZE_MODE, 2);
        break;
      }
      case 'UNFREEZE': {
        this._send(ADMIN.FREEZE_MODE, 3);
        break;
      }
      case 'GAME_SPEED': {
        const speed = parseInt(document.getElementById('adminGameSpeed').value) || 100;
        this._send(ADMIN.GAME_SPEED, speed);
        break;
      }
    }
  }
}

export default AdminPanel;
