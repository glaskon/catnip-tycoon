// Sound FX module — synthesized WebAudio (no audio files, zero assets).
// Lazy-init: AudioContext starts on the first user gesture (browser autoplay policy).
// Toggle: localStorage 'catnip-sound' = 'off' mutes; default ON.

const sound = {
  enabled: localStorage.getItem('catnip-sound') !== 'off',
  _ctx: null,

  init() {
    if (this._ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this._ctx = new AC();
    } catch (e) { /* no WebAudio — stay silent */ }
  },

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('catnip-sound', this.enabled ? 'on' : 'off');
    if (typeof updateSoundToggle === 'function') updateSoundToggle();
    return this.enabled;
  },

  // One-shot oscillator blip
  _blip(freq, dur, type, vol, delay) {
    if (!this.enabled || !this._ctx) return;
    if (this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
      return;
    }
    const t0 = this._ctx.currentTime + (delay || 0);
    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol || 0.14, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this._ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },

  // Cat click — short blip with a little pitch jitter (feels alive)
  click() { this._blip(620 + Math.random() * 140, 0.06, 'triangle', 0.09); },

  // Critical hit — sharp double note
  crit() { this._blip(880, 0.08, 'square', 0.11); this._blip(1318, 0.12, 'square', 0.09, 0.06); },

  // Purchase — rising two-note
  buy() { this._blip(520, 0.07, 'sine', 0.13); this._blip(780, 0.10, 'sine', 0.13, 0.07); },

  // Achievement — small ascending arpeggio
  achievement() { [523, 659, 784, 1047].forEach((f, i) => this._blip(f, 0.12, 'sine', 0.12, i * 0.07)); },

  // "Gold glow ding" — bright high tones with shimmer (legendary-drop bell)
  lucky() {
    this._blip(1568, 0.35, 'sine', 0.15);
    this._blip(2093, 0.30, 'sine', 0.09, 0.03);
    this._blip(3136, 0.25, 'sine', 0.05, 0.08);
  },

  // Prestige — bigger ascending chord
  prestige() { [392, 523, 659, 784, 1047].forEach((f, i) => this._blip(f, 0.30, 'sine', 0.11, i * 0.09)); },
};

window.sound = sound;

// First user gesture unlocks the AudioContext
document.addEventListener('pointerdown', () => sound.init(), { once: true });
document.addEventListener('keydown', () => sound.init(), { once: true });

// --- Screen shake (critical hits) ---
function screenShake() {
  const app = document.getElementById('app');
  if (!app) return;
  app.classList.remove('screen-shake');
  void app.offsetWidth; // restart animation
  app.classList.add('screen-shake');
}

// --- Golden flash (rare drops: lucky catnip, diamond) ---
function luckyFlash() {
  const el = document.getElementById('luckyFlash');
  if (!el) return;
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

window.screenShake = screenShake;
window.luckyFlash = luckyFlash;
