let bookmarks = [];
let isEditing = false;
let sortableInstance = null;
let editingId = null;

const gridEl = document.getElementById('bookmark-grid');
const modal = document.getElementById('modal');
const editActions = document.getElementById('edit-actions');
const editToggleBtn = document.getElementById('edit-toggle-btn');
const editTextSpan = document.getElementById('edit-text'); 

// 默认数据
const defaultData = [
    { id: "1", title: "Google", url: "https://www.google.com", iconType: "auto", iconValue: "" },
    { id: "2", title: "GitHub", url: "https://github.com", iconType: "image", iconValue: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" },
    { id: "3", title: "Bilibili", url: "https://www.bilibili.com", iconType: "auto", iconValue: "" }
];

async function init() {
    try {
        const res = await fetch(`./bookmarks.json?t=${new Date().getTime()}`);
        if (!res.ok) throw new Error('File not found');
        bookmarks = await res.json();
        if (!Array.isArray(bookmarks) || bookmarks.length === 0) bookmarks = defaultData;
    } catch (e) {
        console.warn('Using default data:', e);
        bookmarks = defaultData;
    }
    render();
}

function render() {
    if (!gridEl) return;
    gridEl.innerHTML = '';

    bookmarks.forEach(item => {
        const el = document.createElement('div');
        el.className = 'bookmark-item';
        el.dataset.id = item.id;

        let iconHtml = '';
        let isTextClass = '';

        // --- 核心修改：智能判断是否需要全填充 ---
        // 定义哪些域名需要撑满整个图标（去白边）
        const fullFillDomains = ['bilibili.com', 'douban.com', 'weibo.com', 'tmall.com', 'jd.com'];
        let imgClass = 'favicon'; // 默认有留白

        // 如果是图片模式或者自动模式，检查是否需要全填充
        if (item.url) {
            const isFullFill = fullFillDomains.some(domain => item.url.includes(domain));
            if (isFullFill) {
                imgClass = 'full-fill';
            }
        }
        // -------------------------------------

        if (item.iconType === 'image' && item.iconValue) {
            // 自定义图片通常也建议全填充，或者根据需要调整
            // 这里默认给自定义图片全填充逻辑，如果它是透明png可以改回
            iconHtml = `<img src="${item.iconValue}" class="full-fill" alt="${item.title}">`;
        } else if (item.iconType === 'text') {
            isTextClass = 'text-icon';
            iconHtml = `<span>${item.iconValue || item.title.slice(0,1)}</span>`;
        } else {
            try {
                const domain = new URL(item.url).hostname;
                const favUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                iconHtml = `<img src="${favUrl}" class="${imgClass}" alt="${item.title}">`;
            } catch(e) {
                isTextClass = 'text-icon';
                iconHtml = `<span>${item.title.slice(0,1)}</span>`;
            }
        }

        el.innerHTML = `
            <div class="delete-btn" onclick="deleteBookmark(event, '${item.id}')">✕</div>
            <div class="edit-overlay" onclick="openEditModal('${item.id}')"></div>
            <a href="${item.url}" class="bookmark-link" target="_blank">
                <div class="bookmark-icon ${isTextClass}">
                    ${iconHtml}
                </div>
                <div class="bookmark-title">${item.title}</div>
            </a>
        `;
        gridEl.appendChild(el);
    });

    if (isEditing) enableDrag();
    else disableDrag();
}

// 下面的代码保持不变
editToggleBtn.addEventListener('click', () => {
    isEditing = !isEditing;
    document.body.classList.toggle('editing', isEditing);
    editTextSpan.textContent = isEditing ? "完成编辑" : "编辑";

    if (isEditing) { editActions.classList.remove('hidden'); enableDrag(); }
    else { editActions.classList.add('hidden'); disableDrag(); updateOrderFromDOM(); }
});

function enableDrag() {
    if (!sortableInstance) sortableInstance = new Sortable(gridEl, { animation: 150, ghostClass: 'sortable-ghost', onEnd: updateOrderFromDOM });
}
function disableDrag() {
    if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; }
}
function updateOrderFromDOM() {
    const newIds = Array.from(gridEl.children).map(el => el.dataset.id);
    const newArr = [];
    newIds.forEach(id => { const item = bookmarks.find(b => b.id === id); if(item) newArr.push(item); });
    bookmarks = newArr;
}

window.deleteBookmark = (e, id) => {
    e.stopPropagation();
    if(confirm('确定删除?')) { bookmarks = bookmarks.filter(b => b.id !== id); render(); }
};

const titleIn = document.getElementById('input-title');
const urlIn = document.getElementById('input-url');
const radios = document.getElementsByName('icon-type');
const iconValIn = document.getElementById('input-icon-val');
const preview = document.getElementById('icon-preview');

window.openEditModal = (id) => {
    editingId = id;
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.style.opacity = '1');
    document.getElementById('modal-title').textContent = id ? '编辑书签' : '添加书签';

    if (id) {
        const item = bookmarks.find(b => b.id === id);
        titleIn.value = item.title; urlIn.value = item.url;
        [...radios].forEach(r => r.checked = (r.value === item.iconType));
        iconValIn.value = item.iconValue || "";
    } else {
        titleIn.value = ''; urlIn.value = ''; iconValIn.value = ''; radios[0].checked = true;
    }
    updatePreview();
};

function closeModal() {
    modal.style.opacity = '0'; setTimeout(() => modal.style.display = 'none', 300);
}
document.getElementById('add-btn').addEventListener('click', () => openEditModal(null));
document.getElementById('modal-cancel').addEventListener('click', closeModal);

urlIn.addEventListener('blur', () => {
    let rawUrl = urlIn.value.trim();
    if (!rawUrl) return;
    if (!/^https?:\/\//i.test(rawUrl)) { rawUrl = 'https://' + rawUrl; urlIn.value = rawUrl; }
    if (!titleIn.value.trim()) {
        try {
            const hostname = new URL(rawUrl).hostname;
            let name = hostname.replace(/^www\./, '').split('.')[0];
            if (name) titleIn.value = name.charAt(0).toUpperCase() + name.slice(1);
        } catch (e) {}
    }
    updatePreview();
});

function updatePreview() {
    const type = [...radios].find(r => r.checked).value;
    let rawUrl = urlIn.value.trim();
    if (rawUrl && !/^https?:\/\//i.test(rawUrl)) rawUrl = 'https://' + rawUrl;

    const img = preview.querySelector('img');
    const span = preview.querySelector('span');

    preview.className = 'bookmark-icon';
    img.classList.add('hidden'); span.classList.add('hidden');
    iconValIn.classList.toggle('hidden', type === 'auto');
    img.className = ''; // Reset classes

    // 预览逻辑也加上全填充判断
    const fullFillDomains = ['bilibili.com', 'douban.com', 'weibo.com'];
    let previewImgClass = 'favicon';
    if (rawUrl && fullFillDomains.some(d => rawUrl.includes(d))) {
        previewImgClass = 'full-fill';
    }

    if (type === 'image' && iconValIn.value) {
        img.src = iconValIn.value; img.classList.remove('hidden');
        img.className = 'full-fill'; // 自定义图片预览默认全填充
    } else if (type === 'text') {
        preview.classList.add('text-icon');
        span.textContent = iconValIn.value || titleIn.value.charAt(0) || "A";
        span.classList.remove('hidden');
    } else if (type === 'auto' && rawUrl) {
        try {
            const host = new URL(rawUrl).hostname;
            img.src = `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
            img.classList.remove('hidden');
            img.className = previewImgClass;
        } catch(e){}
    }
}

[titleIn, urlIn, iconValIn].forEach(el => el.addEventListener('input', updatePreview));
[...radios].forEach(el => el.addEventListener('change', updatePreview));

document.getElementById('modal-save').addEventListener('click', () => {
    let finalUrl = urlIn.value.trim(); let finalTitle = titleIn.value.trim();
    if (!finalUrl) return alert('请填写网址');
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
    if (!finalTitle) {
        try { finalTitle = new URL(finalUrl).hostname.replace('www.','').split('.')[0]; finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1); }
        catch (e) { finalTitle = "未命名"; }
    }
    const newItem = {
        id: editingId || Date.now().toString(),
        title: finalTitle, url: finalUrl,
        iconType: [...radios].find(r => r.checked).value, iconValue: iconValIn.value
    };
    if (editingId) { const idx = bookmarks.findIndex(b => b.id === editingId); bookmarks[idx] = newItem; }
    else { bookmarks.push(newItem); }
    closeModal(); render();
});

document.getElementById('export-btn').addEventListener('click', () => {
    const str = JSON.stringify(bookmarks, null, 2);
    const blob = new Blob([str], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'bookmarks.json'; a.click();
});

init();