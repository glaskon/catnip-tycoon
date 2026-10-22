// Server-authoritative album calendar math (decision 6B). Shared by the
// /api/album routes (live stamping) and the save route (one-time guest
// transplant on import). The server's own clock is the only time source —
// no device wall clock, no client-submitted timestamp, is ever consulted.

function albumDayKey(epochMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(epochMs));
  const get = t => parts.find(p => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function isIanaTimeZone(tz) {
  if (typeof tz !== 'string' || tz.length < 1 || tz.length > 100) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// current: {timeZone, month, stamps, lastStampDay, history} or null (no record yet).
// Returns the same shape, advanced by at most one calendar day in the chosen
// zone. Same-day calls are a no-op (idempotent) and stamps never exceed ten
// per month. The zone is fixed on the first-ever stamp and ignores later
// client-supplied zones, so travelling cannot manufacture extra days.
function advanceAlbum(current, now, requestedZone) {
  const timeZone = (current && current.timeZone) || (isIanaTimeZone(requestedZone) ? requestedZone : 'UTC');
  const day = albumDayKey(now, timeZone);
  const month = day.slice(0, 7);
  if (!current) return { timeZone, month, stamps: 1, lastStampDay: day, history: {} };
  if (day === current.lastStampDay) return { ...current, timeZone };
  let { stamps, history } = current;
  if (month !== current.month) {
    history = { ...history, [current.month]: stamps };
    stamps = 0;
  }
  stamps = Math.min(10, stamps + 1);
  return { timeZone, month, stamps, lastStampDay: day, history };
}

// Reconstructs an epoch that formats back to dayStr at noon in timeZone, so a
// transplanted record satisfies validateAlbumState's lastDay/lastStampAt
// cross-check. A two-step fixed point on the zone offset is exact for every
// real IANA zone (DST shifts are at most a few hours, far short of noon's
// margin to midnight).
function noonEpochForDay(dayStr, timeZone) {
  const utcNoon = Date.parse(`${dayStr}T12:00:00Z`);
  const offsetAt = epoch => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(new Date(epoch));
    const get = t => parts.find(p => p.type === t).value;
    const hour = get('hour') === '24' ? 0 : Number(get('hour'));
    const localAsUTC = Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day')),
      hour, Number(get('minute')), Number(get('second')));
    return localAsUTC - epoch;
  };
  const firstPass = utcNoon - offsetAt(utcNoon);
  return utcNoon - offsetAt(firstPass);
}

module.exports = { albumDayKey, isIanaTimeZone, advanceAlbum, noonEpochForDay };
