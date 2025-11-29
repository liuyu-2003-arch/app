import { state } from './state.js';
import { saveData } from './api.js';
import { debounce, t, showToast, updateSyncStatus, generateUniqueId } from './utils.js';

// 防抖保存
export const debouncedSaveData = debounce(() => saveData(), 1000);

// --- 渲染核心 ---
export function render() {
    const oldScrollTops = [];
    document.querySelectorAll('.bookmark-page').forEach(p => oldScrollTops.push(p.scrollTop));

    createVisualPages();
    const swiperWrapper = document.getElementById('bookmark-swiper-wrapper');
    swiperWrapper.innerHTML = '';

    // 销毁旧的 Sortable
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
    state.pages.forEach((page, originalPageIndex) => {
        if (page.bookmarks.length === 0 && state.isEditing) {
            state.visualPages.push({ title: page.title, bookmarks: [], originalPageIndex: originalPageIndex, chunkIndex: 0 });
        } else if (page.bookmarks.length > 0) {
            for (let i = 0; i < page.bookmarks.length; i += chunkSize) {
                const chunk = page.bookmarks.slice(i, i + chunkSize);
                state.visualPages.push({ title: page.title, bookmarks: chunk, originalPageIndex: originalPageIndex, chunkIndex: i / chunkSize });
            }
        }
    });
    if (state.visualPages.length === 0) state.visualPages.push({ title: "New Page", bookmarks: [], originalPageIndex: 0, chunkIndex: 0 });
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
    swiper.addEventListener('mousedown', dragStart);
    swiper.addEventListener('touchstart', dragStart, { passive: true });
    swiper.addEventListener('mouseup', dragEnd);
    swiper.addEventListener('mouseleave', dragEnd);
    swiper.addEventListener('touchend', dragEnd);
    swiper.addEventListener('mousemove', drag);
    swiper.addEventListener('touchmove', drag, { passive: false });
    swiper.addEventListener('wheel', handleWheel, { passive: false });
}

function dragStart(e) {
    if (state.isEditing && e.target.closest('.bookmark-item')) { state.isDragging = false; return; }
    state.isDragging = true; state.hasDragged = false;
    state.startPos = getPositionX(e);
    state.animationID = requestAnimationFrame(animation);
    document.getElementById('bookmark-swiper-wrapper').style.transition = 'none';
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
    const swiperWidth = document.getElementById('bookmark-swiper').clientWidth;
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
function setSwiperPosition() { document.getElementById('bookmark-swiper-wrapper').style.transform = `translateX(${state.currentTranslate}px)`; }
function updateSwiperPosition(withTransition = true) {
    const swiperWrapper = document.getElementById('bookmark-swiper-wrapper');
    const swiperWidth = document.getElementById('bookmark-swiper').clientWidth;
    state.currentTranslate = state.currentPage * -swiperWidth;
    state.prevTranslate = state.currentTranslate;
    if (withTransition) swiperWrapper.style.transition = 'transform 0.2s ease-out';
    setSwiperPosition();
}
function handleWheel(e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) return;
    e.preventDefault();
    const swiperWrapper = document.getElementById('bookmark-swiper-wrapper');
    const swiperWidth = document.getElementById('bookmark-swiper').clientWidth;
    swiperWrapper.style.transition = 'none';
    state.currentTranslate -= (e.deltaX * 0.5);
    setSwiperPosition();
    clearTimeout(state.wheelTimeout);
    state.wheelTimeout = setTimeout(() => {
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
    dotsContainer.innerHTML = '';
    for (let i = 0; i < state.visualPages.length; i++) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        if (i === state.currentPage) dot.classList.add('active');
        dot.onclick = (e) => { e.stopPropagation(); state.currentPage = i; updateSwiperPosition(true); renderPaginationDots(); };
        dotsContainer.appendChild(dot);
    }
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

export function saveBookmark() {
    const title = document.getElementById('input-title').value;
    let url = document.getElementById('input-url').value;
    const icon = document.getElementById('input-icon').value;
    const styleEl = document.querySelector('.style-option.active');
    const style = styleEl ? styleEl.dataset.style : 'full';

    if (!title || !url) return showToast(t('msg_title_url_req'), "error");
    if (!url.startsWith('http')) url = 'https://' + url;

    const { pageIndex, bookmarkIndex } = state.currentEditInfo;
    const newPageIndex = state.visualPages[state.currentPage] ? state.visualPages[state.currentPage].originalPageIndex : 0; // 简化处理，添加到当前页

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