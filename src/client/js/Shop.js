import { SKINS, SKIN_PRICES, SKIN_TIERS, skinTier } from '../../shared/colors.js';

export class Shop {
  constructor(net, ui) {
    this.net = net;
    this.ui = ui;
    this.coins = 0;
    this.unlockedSkins = new Set([0, 1, 2, 3]);
    this._onShopData = this._onShopData.bind(this);
    this._onShopResult = this._onShopResult.bind(this);

    // DOM
    this.screen = document.getElementById('shopScreen');
    this.grid = document.getElementById('shopGrid');
    this.coinCount = document.getElementById('shopCoinCount');
    this.dailyBtn = document.getElementById('dailyBtn');
    this.backBtn = document.getElementById('shopBackBtn');

    this.backBtn.addEventListener('click', () => this.hide());
    this.dailyBtn.addEventListener('click', () => {
      this.net.sendClaimDaily();
    });

    net.on('shopData', this._onShopData);
    net.on('shopResult', this._onShopResult);

    this._buildGrid();
  }

  _onShopData(d) {
    this.coins = d.coins;
    this.unlockedSkins = new Set(d.unlockedSkins.split(',').map(Number).filter(n => !isNaN(n)));
    this._updateUI();
    if (this.ui) this.ui.setUnlockedSkins(this.unlockedSkins);
  }

  _onShopResult(d) {
    if (d.ok) {
      this.coins = d.coins;
      if (d.unlockedSkins) {
        this.unlockedSkins = new Set(d.unlockedSkins.split(',').map(Number).filter(n => !isNaN(n)));
      }
    }
    this._updateUI();
    if (this.ui) this.ui.setUnlockedSkins(this.unlockedSkins);
    if (d.msg) this._flashMsg(d.msg, d.ok);
  }

  _buildGrid() {
    this.grid.innerHTML = '';
    for (let i = 0; i < SKINS.length; i++) {
      const skin = SKINS[i];
      const price = SKIN_PRICES[i];
      const tier = skinTier(price);
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.dataset.skin = i;

      // Swatch
      const swatch = document.createElement('div');
      swatch.className = 'shop-swatch';
      if (skin.main === 'combo') {
        swatch.style.background = `linear-gradient(135deg, ${skin.colors.join(', ')})`;
      } else {
        swatch.style.background = skin.main;
      }
      el.appendChild(swatch);

      // Name
      const name = document.createElement('div');
      name.className = 'shop-item-name';
      name.textContent = skin.name;
      el.appendChild(name);

      // Tier
      const tierEl = document.createElement('div');
      tierEl.className = 'shop-item-tier';
      tierEl.textContent = tier.name;
      tierEl.style.color = tier.color;
      el.appendChild(tierEl);

      // Price
      const priceEl = document.createElement('div');
      priceEl.className = 'shop-item-price';
      priceEl.textContent = price === 0 ? 'FREE' : `${price}`;
      el.appendChild(priceEl);

      // Buy overlay
      const overlay = document.createElement('div');
      overlay.className = 'shop-buy-overlay';
      if (price > 0) {
        const buyBtn = document.createElement('button');
        buyBtn.className = 'btn buy-btn';
        buyBtn.textContent = `Buy ${price}`;
        buyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.net.sendBuySkin(i);
        });
        overlay.appendChild(buyBtn);
      }
      el.appendChild(overlay);

      this.grid.appendChild(el);
    }
  }

  _updateUI() {
    this.coinCount.textContent = this.coins.toLocaleString();
    // Update coin display in HUD
    const coinVal = document.getElementById('coinVal');
    if (coinVal) coinVal.textContent = this.coins.toLocaleString();

    // Update grid items
    const items = this.grid.querySelectorAll('.shop-item');
    items.forEach(el => {
      const id = parseInt(el.dataset.skin);
      const owned = this.unlockedSkins.has(id);
      el.classList.toggle('owned', owned);
      el.classList.toggle('locked', !owned);
      const price = SKIN_PRICES[id];
      el.classList.toggle('free', price === 0);
    });
  }

  show() {
    this.screen.classList.remove('hidden');
    this.net.sendProfileRequest(); // refresh stats
  }

  hide() {
    this.screen.classList.add('hidden');
  }

  isVisible() {
    return !this.screen.classList.contains('hidden');
  }

  _flashMsg(msg, ok) {
    // Quick toast
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;
      z-index: 100; pointer-events: none;
      background: ${ok ? 'rgba(110, 232, 74, 0.9)' : 'rgba(248, 113, 113, 0.9)'};
      color: ${ok ? '#000' : '#fff'};
      animation: toastFade 1.5s forwards;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1500);
  }
}
