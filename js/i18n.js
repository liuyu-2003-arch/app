// js/i18n.js

let translations = {};

async function fetchTranslations(lang) {
    try {
        const response = await fetch(`locales/${lang}.json`);
        if (!response.ok) {
            throw new Error(`Could not load ${lang}.json`);
        }
        return await response.json();
    } catch (error) {
        console.error(error);
        // Fallback to English if the language file is not found
        if (lang !== 'en') {
            return await fetchTranslations('en');
        }
        return {};
    }
}

export const i18n = {
    currentLang: localStorage.getItem('appLang') || 'en',

    async loadTranslations(lang) {
        translations = await fetchTranslations(lang);
        this.currentLang = lang;
        localStorage.setItem('appLang', lang);
        this.updateTexts();
    },

    t(key) {
        return translations[key] || key;
    },

    updateTexts() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) el.textContent = this.t(key);
        });
        const ids = {
            'input-url': 'ph_url', 'input-title': 'ph_title', 'input-icon': 'ph_icon',
            'auth-email': 'ph_email', 'auth-password': 'ph_password',
            'pref-name': 'label_display_name', 'pref-phone': 'label_phone'
        };
        for (const [id, key] of Object.entries(ids)) {
            const el = document.getElementById(id);
            if (el) el.placeholder = this.t(key);
        }
    }
};
