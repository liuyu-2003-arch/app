import { state } from './state.js';
import { saveData, updateSyncStatus } from './api.js'; // 修正引用
import { debounce, t, showToast, generateUniqueId } from './utils.js';

// --- 渲染核心 (Render) ---
// ... (保留之前的 render, createVisualPages, toggleEditMode, initSwiper 等代码) ...
// 为节省篇幅，这里只列出 **新增/修改** 的部分，请把下面这些函数加到 ui.js 的末尾

// --- 🔄 新增：页面管理逻辑 (Page Edit) ---
export function openPageEditModal() {
    document.getElementById('page-edit-modal').classList.remove('hidden');
    renderPageList();
}

export function closePageEditModal() {
    document.getElementById('page-edit-modal').classList.add('hidden');
    render(); // 重新渲染主界面
}

export function renderPageList() {
    const list = document.getElementById('page-list');
    list.innerHTML = '';
    state.pages.forEach((page, index) => {
        const li = document.createElement('li');
        li.className = 'page-list-item';
        li.dataset.index = index;

        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.textContent = '☰';
        li.appendChild(handle);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'page-title-input';
        input.value = page.title;
        input.onblur = () => {
            state.pages[index].title = input.value;
            saveData();
        };
        li.appendChild(input);

        // 只有当页面为空且不是最后一页时才允许删除
        if ((!page.bookmarks || page.bookmarks.length === 0) && state.pages.length > 1) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-page-list-btn';
            deleteBtn.textContent = '×';
            // 注意：这里需要传入 event 以便定位元素
            deleteBtn.onclick = (e) => deletePage(e, index);
            li.appendChild(deleteBtn);
        }
        list.appendChild(li);
    });

    // 初始化页面列表的拖拽排序
    if (state.sortableInstances.pageList) state.sortableInstances.pageList.destroy();
    state.sortableInstances.pageList = new Sortable(list, {
        animation: 150,
        handle: '.drag-handle',
        onEnd: (evt) => {
            const [movedPage] = state.pages.splice(evt.oldIndex, 1);
            state.pages.splice(evt.newIndex, 0, movedPage);
            saveData();
            renderPageList();
        }
    });
}

export function addPage() {
    state.pages.push({ title: "New Page", bookmarks: [] });
    saveData();
    if (document.getElementById('page-edit-modal').classList.contains('hidden')) {
        state.currentPage = state.pages.length - 1;
        render();
    } else {
        renderPageList();
    }
}

export function deletePage(e, pageIndex) {
    if (state.pages[pageIndex].bookmarks.length > 0) return showToast("页面不为空 / Page not empty", "error");
    const listItem = e.target.closest('.page-list-item');
    listItem.classList.add('fading-out');
    setTimeout(() => {
        state.pages.splice(pageIndex, 1);
        saveData();
        if (state.currentPage >= state.pages.length) state.currentPage = Math.max(0, state.pages.length - 1);
        render();
        renderPageList();
    }, 300);
}

// --- 🎨 新增：主题控制 (Theme) ---
export function openThemeControls() {
    document.getElementById('user-dropdown').classList.remove('active');
    toggleEditMode(false); // 关闭编辑模式
    document.getElementById('theme-controls').classList.remove('hidden');
}

export function closeThemeControls() {
    document.getElementById('theme-controls').classList.add('hidden');
}

export function quickChangeTheme(color, pattern) {
    changeTheme(color, null, pattern);
}

export function initTheme() {
    const savedColor = localStorage.getItem('themeColor') || '#e4d0e5';
    const savedPattern = localStorage.getItem('themePattern') || 'none';
    changeTheme(savedColor, null, savedPattern);
}

export function changeTheme(color, element, pattern) {
    const bg = document.querySelector('.background-layer');
    if (color) {
        bg.style.backgroundColor = color;
        localStorage.setItem('themeColor', color);
        document.body.classList.toggle('dark-mode', color === '#1a1a1a');
        if (element) {
            document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
            element.classList.add('active');
        }
    }
    if (pattern) {
        localStorage.setItem('themePattern', pattern);
        bg.classList.remove('bg-pattern-lines-d', 'bg-pattern-aurora', 'bg-pattern-flow');
        if (pattern !== 'none') {
            bg.classList.add(pattern);
        }
        document.querySelectorAll('.pattern-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.pattern === pattern);
        });
    }
}

// --- 👤 新增：偏好设置与头像 (Preferences) ---
export function openPrefModal() {
    if (!state.currentUser) {
        showToast(t("msg_login_success") ? "Please login first" : "请先登录", "error");
        return;
    }
    const meta = state.currentUser.user_metadata || {};
    document.getElementById('pref-name').value = meta.full_name || meta.display_name || '';
    document.getElementById('pref-phone').value = meta.phone_number || meta.phone || '';

    const currentAvatar = meta.avatar_url || "https://api.dicebear.com/7.x/notionists/svg?seed=Guest";
    document.getElementById('pref-current-img').src = currentAvatar;
    state.prefAvatarUrl = currentAvatar;

    renderAvatarGrid(currentAvatar);
    switchAvatarTab('emoji');

    document.getElementById('user-dropdown').classList.remove('active');
    document.getElementById('pref-modal').classList.remove('hidden');
}

export function switchAvatarTab(tabName) {
    document.querySelectorAll('.avatar-tab-item').forEach(el => {
        el.classList.remove('active');
        if(el.getAttribute('onclick').includes(tabName)) el.classList.add('active');
    });
    document.getElementById('avatar-panel-emoji').classList.add('hidden');
    document.getElementById('avatar-panel-upload').classList.add('hidden');
    document.getElementById(`avatar-panel-${tabName}`).classList.remove('hidden');
}

export function handleAvatarFile(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.size > 2 * 1024 * 1024) {
            showToast(t("msg_upload_hint"), "error");
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Url = e.target.result;
            state.prefAvatarUrl = base64Url;
            document.getElementById('pref-current-img').src = base64Url;
            document.querySelectorAll('.emoji-item').forEach(item => item.classList.remove('selected'));
        }
        reader.readAsDataURL(file);
    }
}

// 内部函数：渲染头像选择网格
function renderAvatarGrid(currentUrl) {
    const container = document.getElementById('pref-avatar-grid');
    if(!container) return;
    container.innerHTML = '';

    // 当前头像作为第一个选项
    if (currentUrl && !currentUrl.includes('seed=Guest')) {
        const div = document.createElement('div');
        div.className = 'emoji-item';
        div.style.border = "2px solid #007AFF";
        div.innerHTML = `<img src="${currentUrl}" style="width:100%; height:100%; object-fit: cover;">`;
        div.onclick = () => selectNewAvatar(div, currentUrl);
        container.appendChild(div);
    }

    const collections = [
        { style: 'notionists', count: 12 },
        { style: 'adventurer', count: 12 },
        { style: 'fun-emoji', count: 12 },
        { style: 'micah', count: 6 }
    ];

    collections.forEach(c => {
        for(let i=0; i<c.count; i++) {
            const seed = `${c.style}-${i}-${Math.random().toString(36).substring(7)}`;
            const url = `https://api.dicebear.com/9.x/${c.style}/svg?seed=${seed}`;
            const div = document.createElement('div');
            div.className = 'emoji-item';
            div.innerHTML = `<img src="${url}" style="width:100%; height:100%;" loading="lazy">`;
            div.onclick = () => selectNewAvatar(div, url);
            container.appendChild(div);
        }
    });
}

export function selectNewAvatar(el, url) {
    document.querySelectorAll('.emoji-item').forEach(item => item.classList.remove('selected'));
    el.classList.add('selected');
    state.prefAvatarUrl = url;
    document.getElementById('pref-current-img').src = url;
}

// 注册时用的简易头像选择器
export function createAvatarSelector(containerId, onSelect) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '';
    const seeds = ['Felix', 'Aneka', 'Zoe', 'Jack', 'Bear', 'Molly'];
    seeds.forEach(seed => {
        const url = `https://api.dicebear.com/7.x/notionists/svg?seed=${seed + Math.random()}`;
        const div = document.createElement('div');
        div.className = 'avatar-option';
        div.innerHTML = `<img src="${url}">`;
        div.onclick = () => {
            container.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            if(onSelect) onSelect(url);
        };
        container.appendChild(div);
    });
}