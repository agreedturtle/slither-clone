// ===========================================================================
// KillFeed.js — on-screen kill/headshot notifications during gameplay.
// ===========================================================================

export class KillFeed {
  constructor() {
    this.el = document.getElementById('killFeed');
    this._maxEntries = 6;
    this._chatInput = document.getElementById('chatInput');
    this._chatBox = document.getElementById('chatBox');
    this._chatStarter = document.getElementById('chatStarter');
    this._chatMessages = document.getElementById('chatMessages');
    this._chatOpen = false;
    this._chatCooldown = 0;
    this._bindChat();
  }

  addKill(killer, victim, isHeadshot) {
    const entry = document.createElement('div');
    entry.className = 'kill-feed-entry' + (isHeadshot ? ' headshot' : '');
    entry.innerHTML = `<span class="feed-killer">${this._esc(killer)}</span><span class="feed-action">${isHeadshot ? '💥' : ' killed '}</span><span class="feed-victim">${this._esc(victim)}</span>`;
    this.el.appendChild(entry);
    while (this.el.children.length > this._maxEntries) {
      this.el.removeChild(this.el.firstChild);
    }
    setTimeout(() => { if (entry.parentNode) entry.remove(); }, 4000);
  }

  addChat(name, message) {
    const el = document.createElement('div');
    el.className = 'chat-msg';
    el.innerHTML = `<span class="chat-name">${this._esc(name)}</span>${this._esc(message)}`;
    this._chatMessages.appendChild(el);
    this._chatMessages.scrollTop = this._chatMessages.scrollHeight;
    while (this._chatMessages.children.length > 50) {
      this._chatMessages.removeChild(this._chatMessages.firstChild);
    }
  }

  addSystemMsg(message) {
    const el = document.createElement('div');
    el.className = 'chat-msg system';
    el.textContent = message;
    this._chatMessages.appendChild(el);
    this._chatMessages.scrollTop = this._chatMessages.scrollHeight;
  }

  showKillStreak(count, name) {
    const el = document.getElementById('killStreak');
    if (!el) return;
    const labels = ['', '', 'Double Kill!', 'Triple Kill!', 'Quadra Kill!', 'Penta Kill!', 'HEXAKILL!', 'UNSTOPPABLE!'];
    const text = count >= labels.length ? `${count} KILL STREAK!` : labels[count];
    el.textContent = `${name} — ${text}`;
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetHeight;
    el.style.animation = '';
    clearTimeout(this._streakTimer);
    this._streakTimer = setTimeout(() => el.classList.add('hidden'), 2500);
  }

  _bindChat() {
    if (!this._chatInput) return;
    this._chatInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        this.closeChat();
      }
      if (e.key === 'Enter') {
        const msg = this._chatInput.value.trim();
        if (msg && this._onSend) this._onSend(msg);
        this._chatInput.value = '';
        this.closeChat();
      }
    });
    this._chatInput.addEventListener('focus', () => {
      this._chatOpen = true;
    });
  }

  openChat() {
    if (!this._chatInput || !this._chatBox) return;
    this._chatOpen = true;
    this._chatBox.classList.remove('hidden');
    this._chatStarter.style.opacity = '0';
    this._chatInput.focus();
  }

  closeChat() {
    this._chatOpen = false;
    if (this._chatBox) this._chatBox.classList.add('hidden');
    if (this._chatStarter) this._chatStarter.style.opacity = '1';
    if (this._chatInput) this._chatInput.blur();
  }

  get chatOpen() { return this._chatOpen; }

  onSend(fn) { this._onSend = fn; }

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
}

export default KillFeed;
