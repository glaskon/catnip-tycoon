// Stable per-browser device id (decision 6B). Not a login — just a key the
// server uses to remember a guest's own stamp album before they have an
// account. Generated once and kept for the lifetime of this browser profile.
function getDeviceId() {
  let id = localStorage.getItem('catnip-device');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('catnip-device', id);
  }
  return id;
}

if (typeof window !== 'undefined') window.getDeviceId = getDeviceId;
if (typeof module !== 'undefined') module.exports = { getDeviceId };
