// Catnip Tycoon — Central game constants
// Load BEFORE game.js (see index.html script order)
//
// NOTE: This project uses plain script tags with window globals.
// A full ES modules migration (type="module", import/export, removing
// inline onclick handlers) is a future project — tracked as LOW priority.
// Constants live here to avoid circular dependencies between files.

// --- Offline time ---
const OFFLINE_STEP_MIN = 30;        // minutes added per purchase
const OFFLINE_MAX_MIN = 360;        // 6h hard cap
const OFFLINE_COST_CATNIP = 15;     // catnip price per purchase
const OFFLINE_COST_DIAMOND = 8;     // diamond price per purchase

// --- Particles ---
const MAX_PARTICLES = 60;           // max concurrent DOM particle elements

// --- Leaderboard ---
const LB_FETCH_INTERVAL = 30000;    // ms between refetches

// --- API ---
const API_TIMEOUT_MS = 30000;       // fetch timeout

// --- UI ---
const RENDER_TICK_MS = 100;         // main render loop interval
const PARTICLE_LIFE_MS = 800;       // particle animation duration

window.OFFLINE_STEP_MIN = OFFLINE_STEP_MIN;
window.OFFLINE_MAX_MIN = OFFLINE_MAX_MIN;
window.OFFLINE_COST_CATNIP = OFFLINE_COST_CATNIP;
window.OFFLINE_COST_DIAMOND = OFFLINE_COST_DIAMOND;
window.MAX_PARTICLES = MAX_PARTICLES;
window.LB_FETCH_INTERVAL = LB_FETCH_INTERVAL;
window.API_TIMEOUT_MS = API_TIMEOUT_MS;
window.RENDER_TICK_MS = RENDER_TICK_MS;
window.PARTICLE_LIFE_MS = PARTICLE_LIFE_MS;
