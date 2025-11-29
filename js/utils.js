import { i18n } from './i18n.js';

export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

export function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function showToast(message, type = 'normal') {
    const container = document.getElementById('toast-container');
    if (!container) return alert(message);
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function t(key) {
    return i18n.t(key);
}

export function updateSyncStatus(status) {
    const el = document.getElementById('sync-status');
    if (!el) return;

    // 简单处理，实际项目中可以把 timer 放在 state 中
    if (window._syncTimer) clearTimeout(window._syncTimer);

    if (status === 'saving') {
        el.innerHTML = '<span class="spinner">↻</span> ' + t('msg_saving');
        el.className = 'sync-status visible saving';
    } else if (status === 'saved') {
        el.innerHTML = '✓ ' + t('msg_saved');
        el.className = 'sync-status visible saved';
        window._syncTimer = setTimeout(() => el.classList.remove('visible'), 2000);
    } else if (status === 'error') {
        el.innerHTML = '⚠ ' + t('msg_save_fail');
        el.className = 'sync-status visible error';
    }
}