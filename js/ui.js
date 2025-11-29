import { state } from './state.js';
import { saveData } from './api.js'; // 移除了 updateSyncStatus
import { debounce, t, showToast, generateUniqueId, updateSyncStatus } from './utils.js'; // 添加到了这里

export const debouncedSaveData = debounce(() => saveData(), 1000);

// --- 渲染核心 (Render) ---
export function render() {
    const oldScrollTops = [];
    document.querySelectorAll('.bookmark-page').forEach(p => oldScrollTops.push(p.scrollTop));

    createVisualPages();
    const swiperWrapper = document.getElementById('bookmark-swiper-wrapper');
    if (!swiperWrapper) return;
    swiperWrapper.innerHTML = '';

    state.sortableInstances.forEach(instance => instance.destroy());
    state.sortableInstances = [];

    state.visualPages.forEach((vPage, visualPageIndex) => {
        const pageEl = document.createElement('div');
        pageEl.className = 'bookmark-page';
        pageEl.dataset.visualPageIndex = visualPageIndex;
        pageEl.dataset.originalPageIndex = vPage.originalPageIndex;

        const content = document.createElement('div');
        content.className = 'bookmark-page-content';
        const title = document.createElement('h2');
        title.className = 'page-title';
        title.textContent = vPage.title || 'New Page';
        content.appendChild(title);

        vPage.bookmarks.forEach((item) => {
            const originalPageIndex = vPage.originalPageIndex;
            const originalBookmarkIndex = state.pages[originalPageIndex].bookmarks.findIndex(b => b.id === item.id);
            const div = document.createElement('div');
            let styleClass = '';
            if (item.style === 'white') styleClass = 'style-white';
            else if (item.style === 'fit') styleClass = 'style-fit';
            div.className = `bookmark-item ${styleClass}`;
            div.dataset.id = item.id;

            div.onclick = (e) => {
                if (state.isEditing) {
                    if (!e.target.classList.contains('delete-btn')) openModal(originalPageIndex, originalBookmarkIndex);
                } else {
                    if (!state.hasDragged) window.location.href = item.url;
                }
            };

            const firstChar = item.title ? item.title.charAt(0).toUpperCase() : 'A';
            let iconHtml = item.icon && item.icon.trim() !== "" ?
                `<img src="${item.icon}" onload="this.style.display='block'; this.nextElementSibling.style.display='none'" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"><div class="text-icon" style="display:none">${firstChar}</div>` :
                `<div class="text-icon">${firstChar}</div>`;
            div.innerHTML = `<div class="delete-btn" onclick="deleteBookmark(event, '${item.id}')">×</div><div class="icon-box">${iconHtml}</div><div class="bookmark-title">${item.title}</div>`;
            content.appendChild(div);
        });
        pageEl.appendChild(content);
        swiperWrapper.appendChild(pageEl);
        if(oldScrollTops[visualPageIndex]) pageEl.scrollTop = oldScrollTops[visualPageIndex];
    });

    if (state.currentPage >= state.visualPages.length) state.currentPage = Math.max(0, state.visualPages.length - 1);
    updateSwiperPosition(false);
    renderPaginationDots();
    if (state.isEditing) initSortable();
}

function createVisualPages() {
    state.visualPages = [];
    const isMobile = window.innerWidth < 768;
    const chunkSize = isMobile ? 16 : 32;

    if (!state.pages || state.pages.length === 0) {
        state.pages = [{ title: "Home", bookmarks: [] }];
    }

    state.pages.forEach((page, originalPageIndex) => {
        if (page.bookmarks.length === 0 && state.isEditing) {
            state.visualPages.push({ title: page.title, bookmarks: [], originalPageIndex: originalPageIndex, chunkIndex: 0 });
        } else if (page.bookmarks.length > 0) {
            for (let i = 0; i < page.bookmarks.length; i += chunkSize) {
                const chunk = page.bookmarks.slice(i, i + chunkSize);
                state.visualPages.push({ title: page.title, bookmarks: chunk, originalPageIndex: originalPageIndex, chunkIndex: i / chunkSize });
            }
        } else {
             // 即使为空，非编辑模式下也至少展示一页（如果只有一个空页）
             if (state.pages.length === 1) {
                 state.visualPages.push({ title: page.title, bookmarks: [], originalPageIndex: 0, chunkIndex: 0 });
             }
        }
    });
    // 防止完全空白
    if (state.visualPages.length === 0) {
        state.visualPages.push({ title: "New Page", bookmarks: [], originalPageIndex: 0, chunkIndex: 0 });
    }
}

// --- 编辑与交互 ---
export function toggleEditMode(enable) {
    state.isEditing = enable;
    document.body.classList.toggle('is-editing', enable);
    const controls = document.getElementById('edit-controls');
    document.getElementById('theme-controls').classList.add('hidden');

    if (enable) controls.classList.remove('hidden');
    else {
        controls.classList.add('hidden');
        state.sortableInstances.forEach(instance => instance.destroy());
        state.sortableInstances = [];
    }
    render();
}

function initSortable() {
    if (!state.isEditing) return;
    document.querySelectorAll('.bookmark-page-content').forEach(content => {
        const instance = new Sortable(content, {
            group: 'shared-bookmarks', animation: 350, ghostClass: 'sortable-ghost', dragClass: 'sortable-drag', forceFallback: true,
            onEnd: function (evt) {
                const itemEl = evt.item; const newRect = itemEl.getBoundingClientRect(); const fallbackEl = document.querySelector('.sortable-drag');
                if (fallbackEl) {
                    const oldRect = fallbackEl.getBoundingClientRect(); const dx = oldRect.left - newRect.left; const dy = oldRect.top - newRect.top;
                    requestAnimationFrame(() => { itemEl.style.transform = `translate3d(${dx}px, ${dy}px, 0)`; itemEl.style.transition = 'transform 0s'; requestAnimationFrame(() => { itemEl.style.transform = 'translate3d(0, 0, 0)'; itemEl.style.transition = 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)'; }); });
                }
                const bookmarkMap = new Map(); state.pages.forEach(page => page.bookmarks.forEach(bookmark => bookmarkMap.set(bookmark.id, bookmark)));
                const newPages = []; const pageElements = document.querySelectorAll('.bookmark-page'); state.pages.forEach((p, i) => newPages[i] = { ...p, bookmarks: [] });
                pageElements.forEach(pageEl => {
                    const originalPageIndex = parseInt(pageEl.dataset.originalPageIndex); const bookmarkElements = pageEl.querySelectorAll('.bookmark-item');
                    bookmarkElements.forEach(itemEl => {
                        const bookmarkId = itemEl.dataset.id; const bookmark = bookmarkMap.get(bookmarkId);
                        if (bookmark && newPages[originalPageIndex]) newPages[originalPageIndex].bookmarks.push(bookmark);
                    });
                });
                state.pages = newPages.filter(p => p.title);

                updateSyncStatus('saving');
                debouncedSaveData();
                createVisualPages(); setTimeout(() => { render(); }, 10);
            }
        });
        state.sortableInstances.push(instance);
    });
}

// --- Swiper 逻辑 ---
export function initSwiper() {
    const swiper = document.getElementById('bookmark-swiper');
    if (!swiper) return;
    swiper.addEventListener('mousedown', dragStart);
    swiper.addEventListener('touchstart', dragStart, { passive: true });
    swiper.addEventListener('mouseup', dragEnd);
    swiper.addEventListener('mouseleave', dragEnd);
    swiper.addEventListener('touchend', dragEnd);
    swiper.addEventListener('mousemove', drag);
    swiper.addEventListener('touchmove', drag, { passive: false });
    swiper.addEventListener('wheel', handleWheel, { passive: false });

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
        if (e.key === 'ArrowLeft') {
            if (state.currentPage > 0) {
                state.currentPage--; updateSwiperPosition(true); renderPaginationDots();
            }
        }
        else if (e.key === 'ArrowRight') {
            if (state.currentPage < state.visualPages.length - 1) {
                state.currentPage++; updateSwiperPosition(true); renderPaginationDots();
            }
        }
    });
}

function dragStart(e) {
    if (state.isEditing && e.target.closest('.bookmark-item')) { state.isDragging = false; return; }
    state.isDragging = true; state.hasDragged = false;
    state.startPos = getPositionX(e);
    state.animationID = requestAnimationFrame(animation);
    const wrapper = document.getElementById('bookmark-swiper-wrapper');
    if(wrapper) wrapper.style.transition = 'none';
}

function drag(e) {
    if (state.isDragging) {
        const currentPosition = getPositionX(e);
        const diff = currentPosition - state.startPos;
        if (Math.abs(diff) > 10) state.hasDragged = true;
        if (state.hasDragged) {
            state.currentTranslate = state.prevTranslate + diff;
            if (e.cancelable) e.preventDefault();
        }
    }
}

function dragEnd(e) {
    if (!state.isDragging) return;
    state.isDragging = false;
    cancelAnimationFrame(state.animationID);
    const movedBy = state.currentTranslate - state.prevTranslate;
    const swiper = document.getElementById('bookmark-swiper');
    // const swiperWidth = swiper ? swiper.clientWidth : window.innerWidth;
    const swiperWidth = swiper ? swiper.clientWidth : 1;
    let targetPage = state.currentPage;
    if (state.hasDragged) {
        if (movedBy < -swiperWidth * 0.15 && state.currentPage < state.visualPages.length - 1) targetPage++;
        else if (movedBy > swiperWidth * 0.15 && state.currentPage > 0) targetPage--;
    }
    state.currentPage = targetPage;
    updateSwiperPosition(true);
    renderPaginationDots();
}

function getPositionX(e) { return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX; }
function animation() { setSwiperPosition(); if (state.isDragging) requestAnimationFrame(animation); }
function setSwiperPosition() {
    const wrapper = document.getElementById('bookmark-swiper-wrapper');
    if(wrapper) wrapper.style.transform = `translateX(${state.currentTranslate}px)`;
}
function updateSwiperPosition(withTransition = true) {
    const swiperWrapper = document.getElementById('bookmark-swiper-wrapper');
    const swiper = document.getElementById('bookmark-swiper');
    if (!swiperWrapper || !swiper) return;
    const swiperWidth = swiper.clientWidth;
    state.currentTranslate = state.currentPage * -swiperWidth;
    state.prevTranslate = state.currentTranslate;
    if (withTransition) swiperWrapper.style.transition = 'transform 0.2s ease-out';
    setSwiperPosition();
}
function handleWheel(e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) return;
    e.preventDefault();
    const swiperWrapper = document.getElementById('bookmark-swiper-wrapper');
    if(!swiperWrapper) return;
    swiperWrapper.style.transition = 'none';
    state.currentTranslate -= (e.deltaX * 0.5);
    setSwiperPosition();
    clearTimeout(state.wheelTimeout);
    state.wheelTimeout = setTimeout(() => {
        const swiper = document.getElementById('bookmark-swiper');
        const swiperWidth = swiper ? swiper.clientWidth : window.innerWidth;
        const moveOffset = state.currentTranslate - (state.currentPage * -swiperWidth);
        let targetPage = state.currentPage;
        if (moveOffset < -swiperWidth * 0.05) targetPage++;
        else if (moveOffset > swiperWidth * 0.05) targetPage--;
        state.currentPage = Math.max(0, Math.min(state.visualPages.length - 1, targetPage));
        updateSwiperPosition(true); renderPaginationDots();
    }, 60);
}

function renderPaginationDots() {
    const dotsContainer = document.getElementById('pagination-dots');
    if(!dotsContainer) return;
    dotsContainer.innerHTML = '';
    for (let i = 0; i < state.visualPages.length; i++) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        if (i === state.currentPage) dot.classList.add('active');
        dot.onclick = (e) => { e.stopPropagation(); state.currentPage = i; updateSwiperPosition(true); renderPaginationDots(); };
        dotsContainer.appendChild(dot);
    }
    dotsContainer.classList.add('visible');
    if(state.dotsTimer) clearTimeout(state.dotsTimer);
    state.dotsTimer = setTimeout(() => dotsContainer.classList.remove('visible'), 2000);
}

// --- 模态框与书签操作 ---
export function openModal(pageIndex = -1, bookmarkIndex = -1) {
    state.currentEditInfo = { pageIndex, bookmarkIndex };
    document.getElementById('modal').classList.remove('hidden');
    const titleInput = document.getElementById('input-title'); const urlInput = document.getElementById('input-url'); const iconInput = document.getElementById('input-icon');
    if (pageIndex >= 0 && bookmarkIndex >= 0) {
        const item = state.pages[pageIndex].bookmarks[bookmarkIndex];
        titleInput.value = item.title; urlInput.value = item.url; iconInput.value = item.icon || "";
    } else {
        titleInput.value = ''; urlInput.value = ''; iconInput.value = '';
    }
}

export function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

export function saveBookmark() {
    const title = document.getElementById('input-title').value;
    let url = document.getElementById('input-url').value;
    const icon = document.getElementById('input-icon').value;
    const styleEl = document.querySelector('.style-option.active');
    const style = styleEl ? styleEl.dataset.style : 'full';

    if (!title || !url) return showToast(t('msg_title_url_req'), "error");
    if (!url.startsWith('http')) url = 'https://' + url;

    const { pageIndex, bookmarkIndex } = state.currentEditInfo;
    const newPageIndex = state.visualPages[state.currentPage] ? state.visualPages[state.currentPage].originalPageIndex : 0;

    if (pageIndex >= 0 && bookmarkIndex >= 0) {
        const itemToUpdate = state.pages[pageIndex].bookmarks[bookmarkIndex];
        itemToUpdate.title = title; itemToUpdate.url = url; itemToUpdate.icon = icon; itemToUpdate.style = style;
    } else {
        const newItem = { id: generateUniqueId(), title, url, icon, style };
        if (!state.pages[newPageIndex]) state.pages[newPageIndex] = { title: "New Page", bookmarks: [] };
        state.pages[newPageIndex].bookmarks.push(newItem);
    }
    saveData(); document.getElementById('modal').classList.add('hidden'); render();
}

export function deleteBookmark(e, bookmarkId) {
    e.stopPropagation();
    if (confirm('Are you sure?')) {
        let found = false;
        for (const page of state.pages) {
            const index = page.bookmarks.findIndex(b => b.id === bookmarkId);
            if (index !== -1) { page.bookmarks.splice(index, 1); found = true; break; }
        }
        if (found) { saveData(); render(); }
    }
}

// --- 页面管理逻辑 ---
export function openPageEditModal() {
    document.getElementById('page-edit-modal').classList.remove('hidden');
    renderPageList();
}

export function closePageEditModal() {
    document.getElementById('page-edit-modal').classList.add('hidden');
    render();
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

        if ((!page.bookmarks || page.bookmarks.length === 0) && state.pages.length > 1) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-page-list-btn';
            deleteBtn.textContent = '×';
            deleteBtn.onclick = (e) => deletePage(e, index);
            li.appendChild(deleteBtn);
        }
        list.appendChild(li);
    });

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

// --- 主题控制 ---
export function openThemeControls() {
    document.getElementById('user-dropdown').classList.remove('active');
    toggleEditMode(false);
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

// --- 偏好设置与头像 ---
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

function renderAvatarGrid(currentUrl) {
    const container = document.getElementById('pref-avatar-grid');
    if(!container) return;
    container.innerHTML = '';

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