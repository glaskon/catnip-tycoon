// Internationalization module - handles translations for multiple languages
const i18n = {
  currentLang: 'en',
  translations: {},

  // Detect browser language or use stored preference
  detectLanguage() {
    const stored = localStorage.getItem('catnip-lang');
    if (stored && ['en', 'pl', 'es', 'de'].includes(stored)) {
      return stored;
    }
    // Map browser language codes to supported languages
    const navLang = (navigator.language || 'en').split('-')[0];
    const supported = ['en', 'pl', 'es', 'de'];
    return supported.includes(navLang) ? navLang : 'en';
  },

  // Initialize: load translations for detected language
  async init() {
    this.currentLang = this.detectLanguage();
    await this.loadLanguage(this.currentLang);
  },

  // Fetch translation JSON for a given language
  async loadLanguage(lang) {
    try {
      const response = await fetch(`/locales/${lang}.json`);
      if (!response.ok) throw new Error('Failed to load');
      this.translations = await response.json();
      this.currentLang = lang;
      localStorage.setItem('catnip-lang', lang);
    } catch (err) {
      console.warn(`[i18n] Failed to load ${lang}, falling back to en`);
      if (lang !== 'en') await this.loadLanguage('en');
    }
  },

  // Change language
  async setLanguage(lang) {
    await this.loadLanguage(lang);
    // Re-render all UI after language change
    if (typeof render === 'function') render();
  },

  // Get translation for a key, with optional fallback
  t(key, fallback) {
    return this.translations[key] || fallback || key;
  },
};

// Export as global (no module system used on frontend)
window.i18n = i18n;