import { initSupabase, loadData, saveData } from './api.js';
import { initAuth, handleLogin, handleRegister, handleLogout, handleOAuthLogin } from './auth.js';
import { i18n } from './i18n.js';
import { render, toggleEditMode, initSwiper, saveBookmark, deleteBookmark, openModal } from './ui.js';
import { t, showToast } from './utils.js';
import { state } from './state.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化
    document.body.style.visibility = 'hidden';
    i18n.updateTexts();
    initSwiper();

    // 2. 初始化 Supabase
    const sb = initSupabase();
    if (sb) {
        initAuth().then(() => { if (!state.currentUser) loadData(); });
    } else {
        loadData();
    }

    // 3. 挂载全局事件 (因为 HTML onclick 需要)
    window.handleLogin = () => {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-password').value;
        if(!email || !pass) return showToast(t("msg_input_req"), "error");
        handleLogin(email, pass);
    };

    window.handleRegister = () => {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-password').value;
        if(!email || !pass) return showToast(t("msg_input_req"), "error");
        handleRegister(email, pass, state.selectedAvatarUrl);
    };

    window.handleLogout = handleLogout;
    window.handleOAuthLogin = handleOAuthLogin;

    window.toggleAuthModal = () => {
         if (state.currentUser) {
            document.getElementById('user-dropdown').classList.toggle('active');
        } else {
            document.getElementById('auth-modal').classList.remove('hidden');
        }
    };

    window.handleMenuEdit = () => {
        document.getElementById('user-dropdown').classList.remove('active');
        toggleEditMode(true);
    };

    window.toggleEditMode = toggleEditMode;

    // 书签操作
    window.saveBookmark = saveBookmark;
    window.deleteBookmark = deleteBookmark;
    window.openModal = openModal;
    window.closeModal = () => document.getElementById('modal').classList.add('hidden');

    // 主题与样式选择
    window.changeTheme = (color) => {
        document.querySelector('.background-layer').style.backgroundColor = color;
        localStorage.setItem('themeColor', color);
    };
    window.selectStyle = (el) => {
        document.querySelectorAll('.style-option').forEach(o => o.classList.remove('active'));
        el.classList.add('active');
    };

    // 窗口调整
    window.addEventListener('resize', () => { render(); });
});