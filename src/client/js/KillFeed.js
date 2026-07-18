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
