// The wardrobe reads the existing catalogs and ownership, without purchases or rewards.
const WARDROBE_FIELDS = { skin: 'equippedSkin', outfit: 'equippedOutfit', effect: 'equippedEffect' };

function wardrobeOwnership() {
  return { purchasedItems: window.purchasedItems || [], gacha: game.gacha };
}

function wardrobeItems() {
  const items = new Map();
  for (const [catalog, source] of [[SHOP_ITEMS, 'shop'], [GACHA_POOL, 'gacha']]) {
    for (const item of catalog) {
      const category = item.id.split('_')[0];
      if (!isCosmeticId(item.id, category)) continue;
      if (!items.has(item.id)) items.set(item.id, { id: item.id, category, sources: [] });
      items.get(item.id).sources.push(source);
    }
  }
  // Show this month's reward even before the first confirmed album visit,
  // plus every recorded or owned edition. No stamps or rewards are granted here.
  const now = new Date();
  const month = game.album ? game.album.month : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const albumIds = [albumSkinId(month), ...Object.keys(game.album ? game.album.history : {}).map(albumSkinId),
    ...(window.purchasedItems || []), ...Object.keys(game.gacha ? game.gacha.counts : {})];
  for (const id of albumIds) {
    if (!isCosmeticId(id, 'skin') || !id.startsWith('skin_album_')) continue;
    items.set(id, { id, category: 'skin', sources: ['album'], month: id.slice('skin_album_'.length) });
  }
  return [...items.values()];
}

function equipCosmetic(category, id) {
  if (!game.isReady || game.saveConflict || !Object.hasOwn(WARDROBE_FIELDS, category) ||
      !validateEquippedCosmetic(id, category, wardrobeOwnership())) return false;
  const field = WARDROBE_FIELDS[category];
  if (game[field] === id) return false;
  game[field] = id;
  saveGame();
  drawCat();
  render();
  return true;
}

let _wardrobeRenderState = null;
function renderWardrobe() {
  const title = i18n.t('wardrobe.title');
  const nav = document.getElementById('wardrobeNav');
  if (nav) {
    nav.title = title;
    nav.setAttribute('aria-label', title);
  }
  const open = document.getElementById('wardrobeOpen');
  if (open && open.textContent !== '👒 ' + title) open.textContent = '👒 ' + title;
  const heading = document.getElementById('wardrobeTitle');
  if (heading && heading.textContent !== title) heading.textContent = title;
  const container = document.getElementById('wardrobeContent');
  if (!container) return;
  const items = wardrobeItems();
  const ownership = wardrobeOwnership();
  const unavailable = !game.isReady || game.saveConflict;
  let html = '';
  for (const [category, field] of Object.entries(WARDROBE_FIELDS)) {
    html += `<section class="wardrobe-section" aria-labelledby="wardrobe-${category}">
      <h3 id="wardrobe-${category}">${escapeHtml(i18n.t('wardrobe.' + category))}</h3>
      <button class="btn btn-secondary btn-sm" onclick="equipCosmetic('${category}', null)" ${game[field] === null || unavailable ? 'disabled' : ''}>${escapeHtml(i18n.t('wardrobe.default'))}</button>
      <div class="shop-grid wardrobe-grid">`;
    for (const item of items.filter(item => item.category === category)) {
      const owned = ownsCosmetic(ownership, item.id);
      const equipped = game[field] === item.id;
      const name = item.month ? albumSkinName(item.month) : i18n.t('shop.item.' + item.id);
      const source = item.sources.map(source => i18n.t('wardrobe.source.' + source).replace('{month}', item.month || '')).join(' · ');
      html += `<div class="shop-item wardrobe-item ${owned ? '' : 'wardrobe-locked'} ${equipped ? 'wardrobe-equipped' : ''}" data-cosmetic="${item.id}">
        <span class="shop-item-icon" aria-hidden="true">${gachaItemIcon(item.id)}</span>
        <div class="shop-item-name">${escapeHtml(name)}</div>
        <p class="wardrobe-source">${escapeHtml(source)}</p>
        <p class="wardrobe-status">${escapeHtml(i18n.t(equipped ? 'wardrobe.equipped' : owned ? 'wardrobe.owned' : 'wardrobe.locked'))}</p>
        <button class="btn btn-primary btn-sm" onclick="equipCosmetic('${category}', '${item.id}')" aria-pressed="${equipped}" ${!owned || equipped || unavailable ? 'disabled' : ''}>${escapeHtml(i18n.t('wardrobe.equip'))}</button>
      </div>`;
    }
    html += '</div></section>';
  }
  // Keep focused buttons and pointer targets stable across the 100ms game tick.
  // Browsers normalize boolean attributes (disabled -> disabled=""). Cache
  // both the template and serialized DOM, and detect replaced/cleared panels.
  if (_wardrobeRenderState && _wardrobeRenderState.container === container &&
      _wardrobeRenderState.html === html && _wardrobeRenderState.dom === container.innerHTML) return;
  container.innerHTML = html;
  _wardrobeRenderState = { container, html, dom: container.innerHTML };
}
