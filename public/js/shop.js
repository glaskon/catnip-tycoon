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
];

// Player's purchased shop items
let purchasedItems = [];

// Load purchased items from localStorage
function loadPurchasedItems() {
  try {
    const stored = localStorage.getItem('catnip-purchased');
    purchasedItems = stored ? JSON.parse(stored) : [];
  } catch {
    purchasedItems = [];
  }
}

// Save purchased items to localStorage
function savePurchasedItems() {
  localStorage.setItem('catnip-purchased', JSON.stringify(purchasedItems));
}

// Check if an item has been purchased
function hasItem(itemId) {
  return purchasedItems.includes(itemId);
}

// Render the shop grid
function renderShop() {
  const container = document.getElementById('shopContent');
  if (!container) return;

  let html = '<div class="shop-grid">';

  for (const item of SHOP_ITEMS) {
    const owned = hasItem(item.id);
    const currencyIcon = item.currency === 'diamonds' ? '💎' : '🐟';
    const canAfford = item.currency === 'diamonds'
      ? game.diamonds >= item.cost
      : game.fish >= item.cost;

    html += `<div class="shop-item">`;
    html += `<span class="shop-item-icon">${item.icon}</span>`;
    html += `<div class="shop-item-name">${item.name}</div>`;
    html += `<div style="font-size: 0.7rem; color: var(--text-secondary); margin: 4px 0;">${item.desc}</div>`;

    if (owned) {
      html += `<div class="shop-item-price" style="color: var(--success);">✅ Owned</div>`;
    } else {
      html += `<div class="shop-item-price">${currencyIcon} ${item.cost}</div>`;
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
}

// Buy a shop item
function buyShopItem(itemId) {
  if (hasItem(itemId)) return;

  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  // Check currency
  if (item.currency === 'diamonds' && game.diamonds < item.cost) return;
  if (item.currency === 'fish' && game.fish < item.cost) return;

  // Deduct cost
  if (item.currency === 'diamonds') game.diamonds -= item.cost;
  else game.fish -= item.cost;

  // Mark as purchased
  purchasedItems.push(itemId);
  savePurchasedItems();

  // Apply cosmetic/effect immediately
  applyShopItem(itemId);

  // Show toast
  showToast(`🛒 ${item.name} purchased!`);
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