// ============================================
// 【配置区域】已填入你的 Supabase 信息
// ============================================
const SUPABASE_URL = 'https://ossrsfyqbrzeauzksvpv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zc3JzZnlxYnJ6ZWF1emtzdnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDgwMDksImV4cCI6MjA3OTY4NDAwOX0.IwEfjxM_wNBf2DXDC9ue8X6ztSOJV2rEN1vrQqv7eqI';

// 初始化 Supabase 客户端
let supabaseClient = null;
let currentUser = null;
let selectedAvatarUrl = '';

// 检测 SDK 是否加载
if (window.supabase && window.supabase.createClient) {
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log("Supabase 初始化成功");
    } catch (e) {
        console.error("Supabase 初始化失败:", e);
    }
}

// 全局变量
let pages = [];
let visualPages = [];
let isEditing = false;
let sortableInstances = [];
let currentEditInfo = { pageIndex: -1, bookmarkIndex: -1 };
let autoFillTimer = null;

// Swiper state
let currentPage = 0;
let isDragging = false;
let hasDragged = false;
let startPos = 0;
let currentTranslate = 0;
let prevTranslate = 0;
let animationID;
let dotsTimer = null;
let wheelTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    document.body.style.visibility = 'hidden';

    initTheme();
    initSwiper();
    initKeyboardControl();
    renderAvatarSelector(); // 初始化头像选择器

    // 初始化 Auth
    if (supabaseClient) {
        initAuth().then(() => {
             if (!currentUser) loadData();
        });
    } else {
        console.warn("SDK 未就绪，进入离线模式");
        loadData();
    }

    window.addEventListener('resize', () => {
        render();
        updateSwiperPosition(false);
    });
    document.getElementById('import-file-input').addEventListener('change', handleImport);
});

// --- 头像选择逻辑 ---
function renderAvatarSelector() {
    const container = document.getElementById('avatar-selector');
    container.innerHTML = '';
    const seeds = ['Felix', 'Aneka', 'Zoe', 'Jack', 'Bear'];
    seeds.forEach(seed => {
        const url = `https://api.dicebear.com/7.x/notionists/svg?seed=${seed + Math.random()}`;
        const div = document.createElement('div');
        div.className = 'avatar-option';
        div.innerHTML = `<img src="${url}">`;
        div.onclick = () => {
            document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            selectedAvatarUrl = url;
        };
        container.appendChild(div);
    });
    if (container.firstChild) container.firstChild.click();
}

// --- 优雅的提示框 (Toast) ---
function showToast(message, type = 'normal') {
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

// --- Auth 相关功能 (修复了 OAuth 回调后的 URL 清理) ---
// --- Auth 相关功能 ---
async function initAuth() {
    if (!supabaseClient) return;

    // 1. 自动处理 OAuth 跳转回来的情况
    // 如果地址栏里有 access_token，说明是第三方登录跳回来的
    if (window.location.hash && window.location.hash.includes('access_token')) {
        // 清理地址栏，去掉那些乱码
        window.history.replaceState(null, '', window.location.pathname);
        showToast("第三方登录成功！", "success");
    }

    // 2. 获取当前会话状态
    const { data: { session } } = await supabaseClient.auth.getSession();

    // 3. 更新界面 (显示头像等)
    updateUserStatus(session?.user);

    // 4. 监听后续状态变化 (比如登出)
    supabaseClient.auth.onAuthStateChange((_event, session) => {
        updateUserStatus(session?.user);
    });
}

function updateUserStatus(user) {
    currentUser = user;
    const fab = document.querySelector('.user-fab');
    const svgIcon = document.getElementById('user-icon-svg');
    const imgIcon = document.getElementById('user-avatar-img');
    const authActions = document.querySelector('.modal-actions');
    const infoPanel = document.getElementById('user-info-panel');

    if (user) {
        fab.classList.add('logged-in');
        document.getElementById('current-email').innerText = user.email;

        // 获取用户头像
        const avatarUrl = user.user_metadata?.avatar_url;
        if (avatarUrl) {
            imgIcon.src = avatarUrl;
            imgIcon.style.display = 'block';
            svgIcon.style.display = 'none';
        } else {
            imgIcon.style.display = 'none';
            svgIcon.style.display = 'block';
            svgIcon.setAttribute('fill', '#333');
        }

        if(authActions) authActions.style.display = 'flex';
        const regBtn = authActions.querySelector('.primary');
        if(regBtn) regBtn.textContent = "更新头像";

        if(infoPanel) infoPanel.classList.remove('hidden');
        loadData();
    } else {
        fab.classList.remove('logged-in');
        imgIcon.style.display = 'none';
        svgIcon.style.display = 'block';
        svgIcon.setAttribute('fill', 'white');

        if(authActions) authActions.style.display = 'flex';
        const regBtn = authActions.querySelector('.primary');
        if(regBtn) regBtn.textContent = "注册";

        if(infoPanel) infoPanel.classList.add('hidden');
    }
}

function toggleAuthModal() {
    document.getElementById('auth-modal').classList.remove('hidden');
}

// 社交登录
async function handleOAuthLogin(provider) {
    if (!supabaseClient) return showToast("SDK 未初始化", "error");

    showToast(`正在前往 ${provider} 认证...`, "normal");

    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: provider,
            options: {
                redirectTo: window.location.href, // 登录成功跳回当前页面
                queryParams: { access_type: 'offline', prompt: 'consent' },
            }
        });
        if (error) throw error;
    } catch (e) {
        console.error("OAuth Error:", e);
        showToast("登录请求失败: " + e.message, "error");
    }
}

async function handleRegister() {
    if (!supabaseClient) return showToast("SDK 初始化失败", "error");

    // 更新资料模式
    if (currentUser) {
        if (!selectedAvatarUrl) return showToast("请先选择一个头像", "error");
        const { data, error } = await supabaseClient.auth.updateUser({ data: { avatar_url: selectedAvatarUrl } });
        if (error) showToast("更新失败: " + error.message, "error");
        else {
            showToast("头像更新成功！", "success");
            document.getElementById('auth-modal').classList.add('hidden');
            updateUserStatus(data.user);
        }
        return;
    }

    // 注册模式
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    if(!email || !password) return showToast("请输入邮箱和密码", "error");

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email, password, options: { data: { avatar_url: selectedAvatarUrl } }
        });
        if (error) showToast(error.message, "error");
        else {
            showToast("注册成功！请去邮箱确认", "success");
            document.getElementById('auth-modal').classList.add('hidden');
        }
    } catch(e) {
        showToast("网络请求出错: " + e.message, "error");
    }
}

async function handleLogin() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    if(!email || !password) return showToast("请输入邮箱和密码", "error");
    if (!supabaseClient) return showToast("连接失败：SDK 未初始化", "error");

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) showToast("登录失败：" + error.message, "error");
    else {
        showToast("登录成功！", "success");
        document.getElementById('auth-modal').classList.add('hidden');
    }
}

async function handleLogout() {
    if (supabaseClient) await supabaseClient.auth.signOut();
    document.getElementById('auth-modal').classList.add('hidden');
    showToast("已退出登录", "normal");
    loadData();
}

// --- 数据加载与保存 ---

async function loadData() {
    if (currentUser && supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('user_configs')
                .select('config_data')
                .eq('user_id', currentUser.id)
                .single();
            if (data && data.config_data) {
                pages = data.config_data;
                pages = ensureBookmarkIds(pages);
                localStorage.setItem('pagedData', JSON.stringify(pages));
                render();
                document.body.style.visibility = 'visible';
                return;
            }
        } catch (e) { console.error("云端加载失败", e); }
    }

    const storedData = localStorage.getItem('pagedData');
    if (storedData) {
        pages = JSON.parse(storedData);
    } else {
        try {
            const response = await fetch('homepage_config.json');
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && (data.length === 0 || data[0].hasOwnProperty('bookmarks'))) pages = data;
                else pages = migrateData(data);
            }
        } catch (e) {
            pages = [{ title: "个人收藏", bookmarks: [
                { title: "GitHub", url: "https://github.com", icon: "https://manifest.im/icon/github.com", style: "white" },
                { title: "Bilibili", url: "https://www.bilibili.com", icon: "https://manifest.im/icon/bilibili.com", style: "fit" }
            ]}];
        }
    }
    pages = ensureBookmarkIds(pages);
    render();
    document.body.style.visibility = 'visible';
}

async function saveData() {
    localStorage.setItem('pagedData', JSON.stringify(pages));
    if (currentUser && supabaseClient) {
        const { error } = await supabaseClient
            .from('user_configs')
            .upsert({ user_id: currentUser.id, config_data: pages, updated_at: new Date() }, { onConflict: 'user_id' });
        if (error) console.error("云端保存失败:", error);
    }
}

// --- 工具函数 ---
function generateUniqueId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
function ensureBookmarkIds(pages) {
    pages.forEach(page => page.bookmarks.forEach(bookmark => { if (!bookmark.id) bookmark.id = generateUniqueId(); }));
    return pages;
}
function migrateData(oldData) {
    const itemsPerPage = 32; const newPages = [];
    const pageTitles = oldData.pageTitles || ["个人收藏", "常用工具", "学习资源"];
    let bookmarks = oldData.bookmarks || oldData;
    if (!Array.isArray(bookmarks)) bookmarks = [];
    const totalPages = Math.max(pageTitles.length, Math.ceil(bookmarks.length / itemsPerPage));
    for (let i = 0; i < totalPages; i++) {
        newPages.push({ title: pageTitles[i] || "新页面", bookmarks: bookmarks.slice(i * itemsPerPage, (i + 1) * itemsPerPage) });
    }
    return ensureBookmarkIds(newPages);
}
function createVisualPages() {
    visualPages = [];
    const isMobile = window.innerWidth < 768;
    const chunkSize = isMobile ? 16 : 32;
    pages.forEach((page, originalPageIndex) => {
        if (page.bookmarks.length === 0 && isEditing) {
            visualPages.push({ title: page.title, bookmarks: [], originalPageIndex: originalPageIndex, chunkIndex: 0 });
        } else if (page.bookmarks.length > 0) {
            for (let i = 0; i < page.bookmarks.length; i += chunkSize) {
                const chunk = page.bookmarks.slice(i, i + chunkSize);
                visualPages.push({ title: page.title, bookmarks: chunk, originalPageIndex: originalPageIndex, chunkIndex: i / chunkSize });
            }
        }
    });
    if (visualPages.length === 0) visualPages.push({ title: "新页面", bookmarks: [], originalPageIndex: 0, chunkIndex: 0 });
}
function initTheme() {
    const savedColor = localStorage.getItem('themeColor') || '#e4d0e5';
    document.querySelector('.background-layer').style.backgroundColor = savedColor;
    const swatches = document.querySelectorAll('.swatch');
    swatches.forEach(swatch => { if (rgbToHex(swatch.style.backgroundColor) === savedColor.toLowerCase()) swatch.classList.add('active'); });
}
function changeTheme(color, element) {
    document.querySelector('.background-layer').style.backgroundColor = color;
    localStorage.setItem('themeColor', color);
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    if (element) element.classList.add('active');
}
function rgbToHex(col) {
    if(col.charAt(0)=='#') return col;
    let rgb = col.match(/\d+/g);
    if(!rgb) return '#e4d0e5';
    return "#" + ((1 << 24) + (parseInt(rgb[0]) << 16) + (parseInt(rgb[1]) << 8) + parseInt(rgb[2])).toString(16).slice(1);
}

// --- 核心渲染函数 (修复了点击逻辑) ---
function render() {
    const oldScrollTops = [];
    document.querySelectorAll('.bookmark-page').forEach(p => oldScrollTops.push(p.scrollTop));

    createVisualPages();
    const swiperWrapper = document.getElementById('bookmark-swiper-wrapper');
    swiperWrapper.innerHTML = '';
    sortableInstances.forEach(instance => instance.destroy());
    sortableInstances = [];

    visualPages.forEach((vPage, visualPageIndex) => {
        const pageEl = document.createElement('div');
        pageEl.className = 'bookmark-page';
        pageEl.dataset.visualPageIndex = visualPageIndex;
        pageEl.dataset.originalPageIndex = vPage.originalPageIndex;

        const content = document.createElement('div');
        content.className = 'bookmark-page-content';
        const title = document.createElement('h2');
        title.className = 'page-title';
        title.textContent = vPage.title || '新页面';
        content.appendChild(title);

        vPage.bookmarks.forEach((item) => {
            const originalPageIndex = vPage.originalPageIndex;
            const originalBookmarkIndex = pages[originalPageIndex].bookmarks.findIndex(b => b.id === item.id);
            const div = document.createElement('div');
            let styleClass = '';
            if (item.style === 'white') styleClass = 'style-white';
            else if (item.style === 'fit') styleClass = 'style-fit';
            div.className = `bookmark-item ${styleClass}`;
            div.dataset.id = item.id;

            // 【点击/跳转修复】
            div.onclick = (e) => {
                if (isEditing) {
                    if (!e.target.classList.contains('delete-btn')) openModal(originalPageIndex, originalBookmarkIndex);
                } else {
                    if (!hasDragged) window.location.href = item.url;
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

    if (currentPage >= visualPages.length) currentPage = Math.max(0, visualPages.length - 1);
    updateSwiperPosition(false);
    renderPaginationDots();
    if (isEditing) initSortable();
}

// --- Swiper 逻辑 (含拖拽/触摸修复) ---
function initSwiper() {
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
    if (isEditing && e.target.closest('.bookmark-item')) { isDragging = false; return; }
    isDragging = true; hasDragged = false;
    startPos = getPositionX(e);
    animationID = requestAnimationFrame(animation);
    document.getElementById('bookmark-swiper-wrapper').style.transition = 'none';
}

function drag(e) {
    if (isDragging) {
        const currentPosition = getPositionX(e);
        const diff = currentPosition - startPos;
        // 修复：10px 阈值，防止误触
        if (Math.abs(diff) > 10) hasDragged = true;
        if (hasDragged) {
            currentTranslate = prevTranslate + diff;
            if (e.cancelable) e.preventDefault();
        }
    }
}

function dragEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    cancelAnimationFrame(animationID);

    // 修复：触摸结束时手动跳转
    if (!hasDragged && e.type === 'touchend') {
        const targetItem = e.target.closest('.bookmark-item');
        if (targetItem && !isEditing && !e.target.classList.contains('delete-btn')) {
            const bookmarkId = targetItem.dataset.id;
            for (const page of pages) {
                const bookmark = page.bookmarks.find(b => b.id === bookmarkId);
                if (bookmark && bookmark.url) {
                    window.location.href = bookmark.url;
                    return;
                }
            }
        }
    }

    const movedBy = currentTranslate - prevTranslate;
    const swiperWidth = document.getElementById('bookmark-swiper').clientWidth;
    let targetPage = currentPage;

    if (hasDragged) {
        if (movedBy < -swiperWidth * 0.15 && currentPage < visualPages.length - 1) targetPage++;
        else if (movedBy > swiperWidth * 0.15 && currentPage > 0) targetPage--;
    }
    currentPage = targetPage;
    updateSwiperPosition(true);
    renderPaginationDots();
    showPaginationDots();
}

function getPositionX(e) { return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX; }
function animation() { setSwiperPosition(); if (isDragging) requestAnimationFrame(animation); }
function setSwiperPosition() { document.getElementById('bookmark-swiper-wrapper').style.transform = `translateX(${currentTranslate}px)`; }
function updateSwiperPosition(withTransition = true) {
    const swiperWrapper = document.getElementById('bookmark-swiper-wrapper');
    const swiperWidth = document.getElementById('bookmark-swiper').clientWidth;
    currentTranslate = currentPage * -swiperWidth;
    prevTranslate = currentTranslate;
    if (withTransition) swiperWrapper.style.transition = 'transform 0.2s ease-out';
    setSwiperPosition();
}
function handleWheel(e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) return;
    e.preventDefault(); showPaginationDots();
    const swiperWrapper = document.getElementById('bookmark-swiper-wrapper');
    const swiperWidth = document.getElementById('bookmark-swiper').clientWidth;
    swiperWrapper.style.transition = 'none';
    let nextTranslate = currentTranslate - (e.deltaX * 0.5);
    currentTranslate = nextTranslate;
    setSwiperPosition();
    clearTimeout(wheelTimeout);
    wheelTimeout = setTimeout(() => {
        const moveOffset = currentTranslate - (currentPage * -swiperWidth);
        let targetPage = currentPage;
        if (moveOffset < -swiperWidth * 1.5) targetPage = visualPages.length - 1;
        else if (moveOffset > swiperWidth * 1.5) targetPage = 0;
        else if (moveOffset < -swiperWidth * 0.05) targetPage = currentPage + 1;
        else if (moveOffset > swiperWidth * 0.05) targetPage = currentPage - 1;
        currentPage = Math.max(0, Math.min(visualPages.length - 1, targetPage));
        updateSwiperPosition(true); renderPaginationDots();
    }, 60);
}

function showPaginationDots() {
    const dotsContainer = document.getElementById('pagination-dots');
    if (!dotsContainer || visualPages.length <= 1) return;
    dotsContainer.classList.add('visible');
    clearTimeout(dotsTimer);
    dotsTimer = setTimeout(() => dotsContainer.classList.remove('visible'), 2000);
}
function renderPaginationDots() {
    const dotsContainer = document.getElementById('pagination-dots');
    dotsContainer.innerHTML = '';
    for (let i = 0; i < visualPages.length; i++) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        if (i === currentPage) dot.classList.add('active');
        dot.setAttribute('data-title', visualPages[i].title || `第 ${i + 1} 页`);
        dot.onclick = (e) => { e.stopPropagation(); currentPage = i; updateSwiperPosition(true); renderPaginationDots(); };
        dotsContainer.appendChild(dot);
    }
}

// --- 模态框逻辑 ---
function selectStyle(element) { document.querySelectorAll('.style-option').forEach(opt => opt.classList.remove('active')); element.classList.add('active'); updatePreview(); }
function selectPage(element) { document.querySelectorAll('.page-option').forEach(opt => opt.classList.remove('active')); element.classList.add('active'); }
function renderPageOptions(selectedPageIndex) {
    const container = document.getElementById('page-options-container'); container.innerHTML = '';
    pages.forEach((page, index) => {
        const option = document.createElement('div'); option.className = 'page-option'; option.textContent = page.title || `第 ${index + 1} 页`; option.dataset.index = index;
        option.onclick = () => selectPage(option);
        if (index === selectedPageIndex) option.classList.add('active'); container.appendChild(option);
    });
}
function openModal(pageIndex = -1, bookmarkIndex = -1) {
    currentEditInfo = { pageIndex, bookmarkIndex };
    document.getElementById('modal').classList.remove('hidden');
    const titleInput = document.getElementById('input-title'); const urlInput = document.getElementById('input-url'); const iconInput = document.getElementById('input-icon');
    let currentStyle = 'full', currentPageIndex = 0;
    if (pageIndex >= 0 && bookmarkIndex >= 0) {
        const item = pages[pageIndex].bookmarks[bookmarkIndex];
        titleInput.value = item.title; urlInput.value = item.url; iconInput.value = item.icon || ""; currentStyle = item.style || 'full'; currentPageIndex = pageIndex;
        autoFillInfo();
    } else {
        const currentVisualPage = visualPages[currentPage];
        titleInput.value = ''; urlInput.value = ''; iconInput.value = ''; currentPageIndex = currentVisualPage ? currentVisualPage.originalPageIndex : 0;
        document.getElementById('icon-candidates').innerHTML = '';
    }
    document.querySelectorAll('.style-option').forEach(opt => opt.classList.toggle('active', opt.dataset.style === currentStyle));
    renderPageOptions(currentPageIndex); updatePreview();
}
function closeModal() { document.getElementById('modal').classList.add('hidden'); }
function openPageEditModal() { document.getElementById('page-edit-modal').classList.remove('hidden'); renderPageList(); }
function closePageEditModal() { document.getElementById('page-edit-modal').classList.add('hidden'); render(); }
function renderPageList() {
    const list = document.getElementById('page-list'); list.innerHTML = '';
    pages.forEach((page, index) => {
        const li = document.createElement('li'); li.className = 'page-list-item'; li.dataset.index = index;
        const handle = document.createElement('span'); handle.className = 'drag-handle'; handle.textContent = '☰'; li.appendChild(handle);
        const input = document.createElement('input'); input.type = 'text'; input.className = 'page-title-input'; input.value = page.title;
        input.onblur = () => { pages[index].title = input.value; saveData(); }; li.appendChild(input);
        if (page.bookmarks.length === 0 && pages.length > 1) {
            const deleteBtn = document.createElement('button'); deleteBtn.className = 'delete-page-list-btn'; deleteBtn.textContent = '×';
            deleteBtn.onclick = (e) => deletePage(e, index); li.appendChild(deleteBtn);
        }
        list.appendChild(li);
    });
    if (sortableInstances.pageList) sortableInstances.pageList.destroy();
    sortableInstances.pageList = new Sortable(list, {
        animation: 150, handle: '.drag-handle',
        onEnd: (evt) => { const [movedPage] = pages.splice(evt.oldIndex, 1); pages.splice(evt.newIndex, 0, movedPage); saveData(); renderPageList(); }
    });
}
function generateIconCandidates(urlVal) {
    const list = document.getElementById('icon-candidates'); list.innerHTML = '';
    if (!urlVal || !urlVal.includes('.') || urlVal.length < 4) { renderRandomButtons(list); return; }
    let safeUrl = urlVal; if (!safeUrl.startsWith('http')) safeUrl = 'https://' + safeUrl;
    let domain = "", protocol = "https:";
    try { const urlObj = new URL(safeUrl); domain = urlObj.hostname; protocol = urlObj.protocol; if (domain.endsWith('.')) domain = domain.slice(0, -1); } catch(e) { renderRandomButtons(list); return; }
    renderRandomButtons(list);
    const sources = [
        { name: 'Manifest', url: `https://manifest.im/icon/${domain}` }, { name: 'Vemetric', url: `https://favicon.vemetric.com/${domain}` },
        { name: 'Logo.dev', url: `https://img.logo.dev/${domain}?token=pk_CD4SuapcQDq1yZFMwSaYeA&size=100&format=png` },
        { name: 'Brandfetch', url: `https://cdn.brandfetch.io/${domain}?c=1idVW8VN57Jat7AexnZ` }, { name: 'Direct', url: `${protocol}//${domain}/favicon.ico` }
    ];
    for (let i = sources.length - 1; i >= 0; i--) {
        const src = sources[i]; const item = document.createElement('div'); item.className = 'candidate-item'; item.title = src.name;
        const img = document.createElement('img'); img.src = src.url;
        item.onclick = () => { document.getElementById('input-icon').value = src.url; updatePreview(); document.querySelectorAll('.candidate-item').forEach(el => el.classList.remove('active')); item.classList.add('active'); };
        img.onerror = () => { item.style.display = 'none'; }; item.appendChild(img); list.insertBefore(item, list.firstChild);
    }
}
function renderRandomButtons(container) {
    const randomTypes = [ { type: 'random-shapes', icon: '🎲' }, { type: 'random-identicon', icon: '🧩' }, { type: 'random-emoji', icon: '😀' }, { type: 'random-bottts', icon: '🤖' }, { type: 'random-avataaars', icon: '🧑' } ];
    randomTypes.forEach(rnd => {
        const item = document.createElement('div'); item.className = 'candidate-item candidate-random'; item.innerText = rnd.icon;
        item.onclick = () => {
            const seed = Math.random().toString(36).substring(7); let url = '';
            if(rnd.type === 'random-shapes') url = `https://api.dicebear.com/9.x/shapes/svg?seed=${seed}`;
            else if(rnd.type === 'random-identicon') url = `https://api.dicebear.com/9.x/identicon/svg?seed=${seed}`;
            else if(rnd.type === 'random-bottts') url = `https://api.dicebear.com/9.x/bottts/svg?seed=${seed}`;
            else if(rnd.type === 'random-avataaars') url = `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
            else url = `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${seed}`;
            document.getElementById('input-icon').value = url; updatePreview(); document.querySelectorAll('.candidate-item').forEach(el => el.classList.remove('active')); item.classList.add('active');
        }; container.appendChild(item);
    });
}
function autoFillInfo() {
    if (autoFillTimer) clearTimeout(autoFillTimer);
    autoFillTimer = setTimeout(() => {
        const urlVal = document.getElementById('input-url').value; const titleInput = document.getElementById('input-title'); const iconInput = document.getElementById('input-icon');
        generateIconCandidates(urlVal);
        if (urlVal.includes('.') && urlVal.length > 4) {
            let safeUrl = urlVal; if (!safeUrl.startsWith('http')) safeUrl = 'https://' + safeUrl;
            try {
                const urlObj = new URL(safeUrl); let domain = urlObj.hostname; if (domain.endsWith('.')) domain = domain.slice(0, -1);
                if (!iconInput.value) iconInput.value = `https://manifest.im/icon/${domain}`;
                if (!titleInput.value) { let domainName = domain.replace('www.', '').split('.')[0]; if(domainName) titleInput.value = domainName.charAt(0).toUpperCase() + domainName.slice(1); }
                updatePreview();
            } catch (e) {}
        }
    }, 500);
}
function updatePreview() {
    const titleVal = document.getElementById('input-title').value || "标题预览"; const iconVal = document.getElementById('input-icon').value; const styleEl = document.querySelector('.style-option.active'); const styleVal = styleEl ? styleEl.dataset.style : 'full';
    const previewCard = document.getElementById('preview-card'); const previewImg = document.getElementById('preview-img'); const previewText = document.getElementById('preview-text'); const previewTitle = document.getElementById('preview-title');
    previewTitle.innerText = titleVal; previewCard.classList.remove('style-white', 'style-fit');
    if (styleVal === 'white') previewCard.classList.add('style-white'); else if (styleVal === 'fit') previewCard.classList.add('style-fit');
    const firstChar = titleVal.charAt(0).toUpperCase() || "A"; previewText.innerText = firstChar;
    if (iconVal) { previewImg.src = iconVal; previewImg.style.display = 'block'; previewText.style.display = 'none'; previewImg.onerror = () => { previewImg.style.display = 'none'; previewText.style.display = 'flex'; }; }
    else { previewImg.style.display = 'none'; previewText.style.display = 'flex'; }
}
function saveBookmark() {
    const title = document.getElementById('input-title').value; let url = document.getElementById('input-url').value; const icon = document.getElementById('input-icon').value; const styleEl = document.querySelector('.style-option.active'); const style = styleEl ? styleEl.dataset.style : 'full'; const pageEl = document.querySelector('.page-option.active'); const newPageIndex = pageEl ? parseInt(pageEl.dataset.index) : 0;
    if (!title || !url) return showToast('标题和网址是必填的', "error");
    if (!url.startsWith('http')) url = 'https://' + url;
    const { pageIndex, bookmarkIndex } = currentEditInfo;
    if (pageIndex >= 0 && bookmarkIndex >= 0) {
        const itemToUpdate = pages[pageIndex].bookmarks[bookmarkIndex]; const newItem = { ...itemToUpdate, title, url, icon, style };
        if (pageIndex !== newPageIndex) { pages[pageIndex].bookmarks.splice(bookmarkIndex, 1); pages[newPageIndex].bookmarks.push(newItem); }
        else { pages[pageIndex].bookmarks[bookmarkIndex] = newItem; }
    } else {
        const newItem = { id: generateUniqueId(), title, url, icon, style };
        if (!pages[newPageIndex]) pages[newPageIndex] = { title: "新页面", bookmarks: [] };
        pages[newPageIndex].bookmarks.push(newItem); currentPage = newPageIndex;
    }
    saveData(); closeModal(); render();
}
function toggleEditMode(enable) {
    isEditing = enable; document.body.classList.toggle('is-editing', enable);
    const controls = document.getElementById('edit-controls');
    if (enable) controls.classList.remove('hidden');
    else { controls.classList.add('hidden'); sortableInstances.forEach(instance => instance.destroy()); sortableInstances = []; }
    render();
}
function addPage() { pages.push({ title: "新页面", bookmarks: [] }); saveData(); if (document.getElementById('page-edit-modal').classList.contains('hidden')) { currentPage = pages.length - 1; render(); } else { renderPageList(); } }
function deletePage(e, pageIndex) {
    if (pages[pageIndex].bookmarks.length > 0) return showToast("页面不为空", "error");
    const listItem = e.target.closest('.page-list-item'); listItem.classList.add('fading-out');
    setTimeout(() => { pages.splice(pageIndex, 1); saveData(); if (currentPage >= pages.length) currentPage = Math.max(0, pages.length - 1); render(); renderPageList(); }, 300);
}
function initSortable() {
    if (!isEditing) return;
    document.querySelectorAll('.bookmark-page-content').forEach(content => {
        const instance = new Sortable(content, {
            group: 'shared-bookmarks', animation: 350, ghostClass: 'sortable-ghost', dragClass: 'sortable-drag', forceFallback: true,
            onEnd: function (evt) {
                const itemEl = evt.item; const newRect = itemEl.getBoundingClientRect(); const fallbackEl = document.querySelector('.sortable-drag');
                if (fallbackEl) {
                    const oldRect = fallbackEl.getBoundingClientRect(); const dx = oldRect.left - newRect.left; const dy = oldRect.top - newRect.top;
                    requestAnimationFrame(() => { itemEl.style.transform = `translate3d(${dx}px, ${dy}px, 0)`; itemEl.style.transition = 'transform 0s'; requestAnimationFrame(() => { itemEl.style.transform = 'translate3d(0, 0, 0)'; itemEl.style.transition = 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)'; }); });
                }
                const bookmarkMap = new Map(); pages.forEach(page => page.bookmarks.forEach(bookmark => bookmarkMap.set(bookmark.id, bookmark)));
                const newPages = []; const pageElements = document.querySelectorAll('.bookmark-page'); pages.forEach((p, i) => newPages[i] = { ...p, bookmarks: [] });
                pageElements.forEach(pageEl => {
                    const originalPageIndex = parseInt(pageEl.dataset.originalPageIndex); const bookmarkElements = pageEl.querySelectorAll('.bookmark-item');
                    bookmarkElements.forEach(itemEl => {
                        const bookmarkId = itemEl.dataset.id; const bookmark = bookmarkMap.get(bookmarkId);
                        if (bookmark && newPages[originalPageIndex]) newPages[originalPageIndex].bookmarks.push(bookmark);
                    });
                });
                pages = newPages.filter(p => p.title); saveData(); createVisualPages(); setTimeout(() => { render(); }, 10);
            }
        }); sortableInstances.push(instance);
    });
}
function deleteBookmark(e, bookmarkId) {
    e.stopPropagation();
    if (confirm('确定删除这个书签吗？')) {
        let found = false;
        for (const page of pages) { const index = page.bookmarks.findIndex(b => b.id === bookmarkId); if (index !== -1) { page.bookmarks.splice(index, 1); found = true; break; } }
        if (found) { saveData(); render(); }
    }
}
function exportConfig() {
    const dataStr = JSON.stringify(pages, null, 2); const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = "homepage_config.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
function importConfig() { document.getElementById('import-file-input').click(); }
function handleImport(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try { let importedData = JSON.parse(e.target.result); if (Array.isArray(importedData) && (importedData.length === 0 || importedData[0].hasOwnProperty('bookmarks'))) pages = importedData; else pages = migrateData(importedData); pages = ensureBookmarkIds(pages); saveData(); render(); showToast('导入成功', "success"); } catch (err) { showToast('导入失败，格式错误', "error"); }
    }; reader.readAsText(file);
}
function initKeyboardControl() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
        const swiperWidth = document.getElementById('bookmark-swiper').clientWidth; const bounceOffset = swiperWidth * 0.2;
        if (e.key === 'ArrowLeft') { if (currentPage > 0) { currentPage--; updateSwiperPosition(true); renderPaginationDots(); showPaginationDots(); } else triggerKeyboardBounce(bounceOffset); }
        else if (e.key === 'ArrowRight') { if (currentPage < visualPages.length - 1) { currentPage++; updateSwiperPosition(true); renderPaginationDots(); showPaginationDots(); } else triggerKeyboardBounce(-bounceOffset); }
    });
}
function triggerKeyboardBounce(offset) {
    const swiperWrapper = document.getElementById('bookmark-swiper-wrapper'); const swiperWidth = document.getElementById('bookmark-swiper').clientWidth; const baseTranslate = currentPage * -swiperWidth;
    swiperWrapper.style.transition = 'transform 0.15s cubic-bezier(0.215, 0.610, 0.355, 1.000)'; swiperWrapper.style.transform = `translateX(${baseTranslate + offset}px)`;
    setTimeout(() => { swiperWrapper.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'; swiperWrapper.style.transform = `translateX(${baseTranslate}px)`; }, 150);
}