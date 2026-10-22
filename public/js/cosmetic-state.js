// Shared equipment contract for the browser and server save validator.
// These ids mirror the existing shop/gacha catalogs; albums are dated editions.
const COSMETIC_IDS = [
  'skin_orange', 'skin_black', 'skin_siamese', 'skin_galaxy',
  'outfit_hat', 'outfit_crown',
  'effect_sparkle', 'effect_rainbow', 'effect_aurora',
];

function isCosmeticId(id, category) {
  if (typeof id !== 'string' || !['skin', 'outfit', 'effect'].includes(category) ||
      !id.startsWith(category + '_')) return false;
  return COSMETIC_IDS.includes(id) ||
    (category === 'skin' && /^skin_album_\d{4}-(0[1-9]|1[0-2])$/.test(id));
}

function ownsCosmetic(state, id) {
  if (Array.isArray(state.purchasedItems) && state.purchasedItems.includes(id)) return true;
  const counts = state.gacha && state.gacha.counts;
  return !!counts && Object.hasOwn(counts, id) && Number.isInteger(counts[id]) && counts[id] > 0;
}

function validateEquippedCosmetic(id, category, state) {
  return id === null || (isCosmeticId(id, category) && ownsCosmetic(state, id));
}

if (typeof module !== 'undefined') module.exports = { isCosmeticId, ownsCosmetic, validateEquippedCosmetic };
