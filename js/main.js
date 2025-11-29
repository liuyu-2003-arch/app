import { initSupabase, loadData, saveData, exportConfig, importConfig, handleImport } from './api.js';
import { initAuth, handleLogin, handleRegister, handleLogout, handleOAuthLogin, savePreferences } from './auth.js';
import { i18n } from './i18n.js';
import {
    render, toggleEditMode, initSwiper, saveBookmark, deleteBookmark, openModal, closeModal,
    addPage, deletePage, openPageEditModal, closePageEditModal, renderPageList,
    initTheme, changeTheme, quickChangeTheme, openThemeControls, closeThemeControls,
    openPrefModal, switchAvatarTab, handleAvatarFile, selectNewAvatar, createAvatarSelector
} from './ui.js';
import { t, showToast } from './utils.js';
import { state } from './state.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化基础配置
    document.body.style.visibility = 'hidden';
    i18n.updateTexts();
    initTheme(); // 初始化主题
    initSwiper();

    // 2. 注册页面的头像选择器
    createAvatarSelector('avatar-selector', (url) => {
        state.selectedAvatarUrl = url;
    });
    // 默认选中第一个
    const authContainer = document.getElementById('avatar-selector');
    if (authContainer && authContainer.firstChild) authContainer.firstChild.click();

    // 3. 初始化 Supabase
    const sb = initSupabase();
    if (sb) {
        initAuth().then(() => { if (!state.currentUser) loadData(); });
    } else {
        loadData();
    }

    // 4. 监听导入文件 (HTML中没有 onclick，是通过id绑定的)
    const importInput = document.getElementById('import-file-input');
    if(importInput) importInput.addEventListener('change', handleImport);

    // 5. 绑定反馈按钮
    window.handleFeedback = () => {
        const subject = encodeURIComponent("Homepage Feedback");
        const body = encodeURIComponent("Hi Developer,\n\nI have some feedback:");
        window.location.href = `mailto:jemchmi@gmail.com?subject=${subject}&body=${body}`;
    };

    // ============================================================
    // 🔥 核心修复：将模块内的函数挂载到 window，让 HTML onclick 能找到
    // ============================================================

    // --- 账户 (Auth) ---
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
    window.savePreferences = savePreferences;

    // --- 菜单与弹窗 (Menus & Modals) ---
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
    window.openModal = openModal;
    window.closeModal = closeModal;

    // --- 编辑模式 (Edit Mode) ---
    window.toggleEditMode = toggleEditMode;

    // --- 书签操作 (Bookmarks) ---
    window.saveBookmark = saveBookmark;
    window.deleteBookmark = deleteBookmark;

    // --- 页面管理 (Page Management) ---
    // 之前这些按钮点不动，是因为这里漏了挂载
    window.addPage = addPage;
    window.deletePage = deletePage;
    window.openPageEditModal = openPageEditModal;
    window.closePageEditModal = closePageEditModal;

    // --- 导入导出 (Import/Export) ---
    window.importConfig = importConfig;
    window.exportConfig = exportConfig;

    // --- 主题控制 (Themes) ---
    window.openThemeControls = openThemeControls;
    window.closeThemeControls = closeThemeControls;
    window.quickChangeTheme = quickChangeTheme;
    // changeTheme 需要透传参数
    window.changeTheme = (color, el, pattern) => changeTheme(color, el, pattern);

    // --- 偏好设置与头像 (Preferences & Avatar) ---
    window.openPrefModal = openPrefModal;
    window.switchAvatarTab = switchAvatarTab;
    window.handleAvatarFile = handleAvatarFile;
    window.selectNewAvatar = selectNewAvatar;
    window.selectStyle = (el) => {
        document.querySelectorAll('.style-option').forEach(o => o.classList.remove('active'));
        el.classList.add('active');
        // 如果需要实时预览更新，可以在这里调用 updatePreview()，需从 ui.js 导出
    };

    // --- 语言切换 (Language) ---
    window.changeLanguage = (lang) => {
        i18n.setLang(lang);
        // 简单粗暴：刷新页面以更新所有文本（或者你可以手动调用 render）
        location.reload();
    };

    // 窗口调整事件
    window.addEventListener('resize', () => { render(); });

    // 点击外部关闭菜单
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('user-dropdown');
        const fab = document.querySelector('.user-fab');
        if (menu && menu.classList.contains('active')) {
            if (!menu.contains(e.target) && !fab.contains(e.target)) {
                menu.classList.remove('active');
            }
        }
    });
});