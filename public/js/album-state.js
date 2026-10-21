// Shared structural contract for monthly albums (browser and save validator).
function validateAlbumState(value) {
  if (value === null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = ['timeZone', 'month', 'stamps', 'lastDay', 'lastStampAt', 'history'];
  if (Object.keys(value).length !== keys.length || !keys.every(k => Object.hasOwn(value, k))) return false;
  const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (typeof value.month !== 'string' || !monthPattern.test(value.month)) return false;
  if (!Number.isInteger(value.stamps) || value.stamps < 1 || value.stamps > 10) return false;
  if (typeof value.timeZone !== 'string' || value.timeZone.length > 100) return false;
  if (!Number.isSafeInteger(value.lastStampAt) || value.lastStampAt <= 0 || value.lastStampAt > 253402300799999) return false;
  if (typeof value.lastDay !== 'string' || value.lastDay.slice(0, 7) !== value.month) return false;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: value.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date(value.lastStampAt));
    const part = type => parts.find(p => p.type === type).value;
    if (value.lastDay !== `${part('year')}-${part('month')}-${part('day')}`) return false;
  } catch { return false; }
  const history = value.history;
  if (!history || typeof history !== 'object' || Array.isArray(history)) return false;
  return Object.entries(history).every(([month, stamps]) => monthPattern.test(month) && month < value.month &&
    Number.isInteger(stamps) && stamps >= 1 && stamps <= 10);
}

if (typeof window !== 'undefined') window.validateAlbumState = validateAlbumState;
if (typeof module !== 'undefined') module.exports = { validateAlbumState };
