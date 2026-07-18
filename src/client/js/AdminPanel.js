// ===========================================================================
// AdminPanel.js — F2 admin panel for giving mass, spawning bots, god mode, etc.
// ===========================================================================

import { ADMIN } from '../../shared/protocol.js';

export class AdminPanel {
  constructor(net) {
    this.net = net;
    this.visible = false;
    this.el = document.getElementById('adminPanel');
    this.passwordEl = document.getElementById('adminPassword');

    this._bindButtons();
  }

  toggle() {
    this.visible = !this.visible;
    this.el.classList.toggle('hidden', !this.visible);
  }

  _pwd() {
    return this.passwordEl.value || 'admin';
  }

  _send(cmd, arg1 = 0, arg2 = 0) {
    this.net.sendAdmin(this._pwd(), cmd, arg1, arg2);
  }

  _bindButtons() {
    this.el.addEventListener('click', (e) => {
      const btn = e.target.closest('.admin-btn');
      if (!btn) return;
      this._handleCmd(btn.dataset.cmd);
    });
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
      case 'GIVE_MULTIPLIER': {
        const mult = parseInt(document.getElementById('adminMultVal').value) || 2;
        this._send(ADMIN.GIVE_MULTIPLIER, mult);
        break;
      }
      case 'GIVE_MAGNET': {
        this._send(ADMIN.GIVE_MAGNET, 40);
        break;
      }
    }
  }
}

export default AdminPanel;
