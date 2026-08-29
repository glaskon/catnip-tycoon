// Shop module - in-game store for cosmetics, skins, and boosts
// Items can be purchased with diamonds or real money (Stripe placeholder)

const SHOP_ITEMS = [
  {
    id: 'skin_orange',
    name: 'Orange Tabby Skin',
    icon: '🐈',
    desc: 'Change your cat to an orange tabby',
    cost: 50,
    currency: 'diamonds',
  },
  {
    id: 'skin_black',
    name: 'Black Cat Skin',
    icon: '🐈‍⬛',
    desc: 'Change your cat to a sleek black cat',
    cost: 50,
    currency: 'diamonds',
  },
  {
    id: 'skin_siamese',
    name: 'Siamese Skin',
    icon: '😺',
    desc: 'Elegant Siamese cat appearance',
    cost: 100,
    currency: 'diamonds',
  },
  {
    id: 'effect_sparkle',
    name: 'Sparkle Effect',
    icon: '✨',
    desc: 'Sparkles fly when you click',
    cost: 30,
    currency: 'diamonds',
  },
  {
    id: 'effect_rainbow',
    name: 'Rainbow Fish',
    icon: '🌈',
    desc: 'Rainbow particle effects on click',
    cost: 75,
    currency: 'diamonds',
  },
  {
    id: 'boost_speed_1h',
    name: 'Speed Boost (1h)',
    icon: '⚡',
    desc: '2x speed for 1 hour',
    cost: 25,
    currency: 'diamonds',
  },
  {
    id: 'boost_click_1h',
    name: 'Click Boost (1h)',
    icon: '👆',
    desc: '3x click power for 1 hour',
    cost: 25,
    currency: 'diamonds',
  },
  {
    id: 'outfit_hat',
    name: 'Top Hat',
    icon: '🎩',
    desc: 'Your cat wears a fancy top hat',
    cost: 40,
    currency: 'diamonds',
  },
  {
    id: 'outfit_crown',
    name: 'Crown',
    icon: '👑',
    desc: 'Your cat wears a royal crown',
    cost: 100,
    currency: 'diamonds',
  },
  {
    id: 'offline_catnip',
    name: '+30min Offline (catnip)',
    icon: '⏰',
    desc: 'Extends offline earnings by 30 min',
    baseCost: 15,
    currency: 'catnip',
    type: 'stackable',
    costGrowth: 2,
  },
  {
    id: 'offline_diamond',
    name: '+30min Offline (diamonds)',
    icon: '⏰',
    desc: 'Extends offline earnings by 30 min',
    baseCost: 15,
    currency: 'diamonds',
    type: 'stackable',
    costGrowth: 2,
  },
];

// Player's purchased shop items (once-type)
let purchasedItems = [];
// Stackable shop purchases count { itemId: count }
let shopCounts = {};

// Load purchased items from localStorage
function loadPurchasedItems() {
  try {
    const stored = localStorage.getItem('catnip-purchased');
    purchasedItems = stored ? JSON.parse(stored) : [];
  } catch {
    purchasedItems = [];
  }
  try {
    const stored = localStorage.getItem('catnip-shopcounts');
    shopCounts = stored ? JSON.parse(stored) : {};
  } catch {
    shopCounts = {};
  }
}

// Save purchased items to localStorage
function savePurchasedItems() {
  localStorage.setItem('catnip-purchased', JSON.stringify(purchasedItems));
  localStorage.setItem('catnip-shopcounts', JSON.stringify(shopCounts));
}

// Check if an once-type item has been purchased
function hasItem(itemId) {
  return purchasedItems.includes(itemId);
}

// Get the current cost of a shop item (handles stackable pricing)
function getShopItemCost(item) {
  if (item.type === 'stackable') {
    const count = shopCounts[item.id] || 0;
    return Math.floor(item.baseCost * Math.pow(item.costGrowth, count));
  }
  return item.cost;
}

// Check if item is stackable (can be bought multiple times)
function isItemStackable(item) {
  return item.type === 'stackable';
}

// Get the count of a stackable item purchased
function getShopItemCount(itemId) {
  return shopCounts[itemId] || 0;
}

// Render the shop grid
let _shopRenderSig = null;
function renderShop() {
  const container = document.getElementById('shopContent');
  if (!container) return;

  // Same click-swallowing + hover-blink fix as renderCats/renderUpgrades:
  // only rebuild the DOM when something actually changed. Rebuilding every
  // 100ms tick dropped :hover (blinking border) and replaced buy buttons
  // mid-click (swallowed clicks).
  let sig = i18n.currentLang;
  for (const item of SHOP_ITEMS) {
    const owned = !isItemStackable(item) && hasItem(item.id);
    const count = getShopItemCount(item.id);
    const cost = getShopItemCost(item);
    const afford = item.currency === 'diamonds' ? game.diamonds >= cost
      : item.currency === 'catnip' ? game.catnip >= cost
      : game.fish >= cost;
    sig += '|' + (owned ? 1 : 0) + ':' + count + ':' + (afford ? 1 : 0);
  }
  sig += '|' + Math.floor(game.diamonds);
  if (sig === _shopRenderSig) return;
  _shopRenderSig = sig;

  let html = '<div class="shop-grid">';

  for (const item of SHOP_ITEMS) {
    const owned = !isItemStackable(item) && hasItem(item.id);
    const currencyIcon = item.currency === 'diamonds' ? '💎' : item.currency === 'catnip' ? '🌿' : '🐟';
    const cost = getShopItemCost(item);
    const canAfford = item.currency === 'diamonds'
      ? game.diamonds >= cost
      : item.currency === 'catnip'
        ? game.catnip >= cost
        : game.fish >= cost;

    html += `<div class="shop-item">`;
    html += `<span class="shop-item-icon">${item.icon}</span>`;
    html += `<div class="shop-item-name">${i18n.t('shop.item.' + item.id, item.name)}</div>`;
    html += `<div style="font-size: 0.7rem; color: var(--text-secondary); margin: 4px 0;">${i18n.t('shop.itemDesc.' + item.id, item.desc)}</div>`;

    if (isItemStackable(item)) {
      const count = getShopItemCount(item.id);
      if (count > 0) {
        html += `<div style="font-size: 0.7rem; color: var(--cat-orange);">${i18n.t('shop.purchasedCount', 'Purchased {count}x').replace('{count}', String(count))}</div>`;
      }
      html += `<div class="shop-item-price">${currencyIcon} ${formatNumber(cost)}</div>`;
      html += `<button class="btn btn-primary btn-sm" 
                onclick="buyShopItem('${item.id}')"
                ${!canAfford ? 'disabled' : ''}
                style="margin-top: 6px;">${i18n.t('shop.buy')}</button>`;
    } else if (owned) {
      html += `<div class="shop-item-price" style="color: var(--success);">✅ Owned</div>`;
    } else {
      html += `<div class="shop-item-price">${currencyIcon} ${formatNumber(cost)}</div>`;
      html += `<button class="btn btn-primary btn-sm" 
                onclick="buyShopItem('${item.id}')"
                ${!canAfford ? 'disabled' : ''}
                style="margin-top: 6px;">${i18n.t('shop.buy')}</button>`;
    }

    html += `</div>`;
  }

  html += '</div>';

  // Show diamond balance
  html += `<div style="margin-top: 16px; text-align: center; color: var(--text-secondary); font-size: 0.85rem;">`;
  html += `💎 Your Diamonds: ${formatNumber(Math.floor(game.diamonds))}`;
  html += `</div>`;

  container.innerHTML = html;

  // Stable hover for shop items (same as cards) — border must not blink
  // after a rebuild while the cursor sits on an item.
  const grid = container.querySelector('.shop-grid');
  if (grid) {
    initCardHoverTracking(grid, '.shop-item', 'shop-item-hovered');
    restoreCardHover(grid, '.shop-item', 'shop-item-hovered');
  }
}

// Buy a shop item
function buyShopItem(itemId) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  const cost = getShopItemCost(item);

  // Check currency
  if (item.currency === 'diamonds' && game.diamonds < cost) return;
  if (item.currency === 'catnip' && game.catnip < cost) return;
  if (item.currency === 'fish' && game.fish < cost) return;

  // Deduct cost
  if (item.currency === 'diamonds') game.diamonds -= cost;
  else if (item.currency === 'catnip') game.catnip -= cost;
  else game.fish -= cost;

  // Track purchase
  if (isItemStackable(item)) {
    shopCounts[itemId] = (shopCounts[itemId] || 0) + 1;
  } else {
    if (hasItem(itemId)) return; // already owned
    purchasedItems.push(itemId);
  }
  savePurchasedItems();

  // Apply cosmetic/effect immediately
  applyShopItem(itemId);

  // Show toast
  showToast(i18n.t('shop.purchasedToast', '🛒 {name} purchased!').replace('{name}', i18n.t('shop.item.' + item.id, item.name)));
  render();
}

// Apply a purchased shop item effect
function applyShopItem(itemId) {
  switch (itemId) {
    case 'boost_speed_1h':
      game.speedMultiplier = 2;
      setTimeout(() => {
        game.speedMultiplier = 1;
        showToast('⚡ Speed boost expired');
        render();
      }, 3600000); // 1 hour
      break;
    case 'boost_click_1h':
      game.fishPerClick *= 3;
      setTimeout(() => {
        game.fishPerClick /= 3;
        showToast('👆 Click boost expired');
        render();
      }, 3600000);
      break;
    case 'offline_catnip':
    case 'offline_diamond':
      game.offlineTimeMinutes += 30;
      showToast(i18n.t('shop.timeExtended', '⏰ Offline time extended to {m} min').replace('{m}', String(game.offlineTimeMinutes)));
      break;
    case 'effect_sparkle':
    case 'effect_rainbow':
      // Cosmetic effects handled in render/spawnParticles
      break;
  }
}

// Expose to global scope
window.SHOP_ITEMS = SHOP_ITEMS;
window.renderShop = renderShop;
window.buyShopItem = buyShopItem;
window.hasItem = hasItem;
window.loadPurchasedItems = loadPurchasedItems;