let bookmarks = [];
let isEditing = false;
let sortableInstance = null;
let editingId = null;

const gridEl = document.getElementById('bookmark-grid');
const modal = document.getElementById('modal');
const editActions = document.getElementById('edit-actions');
const editToggleBtn = document.getElementById('edit-toggle-btn');

// 1. 初始化
async function init() {
    try {
        const res = await fetch(`./bookmarks.json?t=${new Date().getTime()}`);
        if (!res.ok) throw new Error('File not found');
        bookmarks = await res.json();
    } catch (e) {
        console.log('加载失败，使用默认数据');
        bookmarks = [
            { id: "1", title: "Google", url: "https://www.google.com", iconType: "auto", iconValue: "" },
            { id: "2", title: "Bilibili", url: "https://www.bilibili.com", iconType: "text", iconValue: "B" }
        ];
    }
    render();
}

// 2. 渲染
function render() {
    gridEl.innerHTML = '';
    bookmarks.forEach(item => {
        const el = document.createElement('div');
        el.className = 'bookmark-item';
        el.dataset.id = item.id;

        let iconHtml = '';
        if (item.iconType === 'image' && item.iconValue) {
            iconHtml = `<img src="${item.iconValue}" alt="${item.title}">`;
        } else if (item.iconType === 'text') {
            el.querySelector('.bookmark-icon')?.classList.add('text-icon');
            iconHtml = `<span>${item.iconValue || item.title.slice(0,1)}</span>`;
        } else {
            // Favicon API
            const domain = new URL(item.url).hostname;
            const favUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
            iconHtml = `<img src="${favUrl}" class="favicon" alt="${item.title}">`;
        }

        const isTextClass = item.iconType === 'text' ? 'text-icon' : '';

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
}

// 3. 编辑模式
editToggleBtn.addEventListener('click', () => {
    isEditing = !isEditing;
    document.body.classList.toggle('editing', isEditing);
    editToggleBtn.querySelector('span').textContent = isEditing ? "完成" : "编辑";

    if (isEditing) {
        editActions.classList.remove('hidden');
        enableDrag();
    } else {
        editActions.classList.add('hidden');
        disableDrag();
        updateOrderFromDOM();
    }
});

function enableDrag() {
    if (!sortableInstance) {
        sortableInstance = new Sortable(gridEl, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: updateOrderFromDOM
        });
    }
}
function disableDrag() {
    if (sortableInstance) {
        sortableInstance.destroy();
        sortableInstance = null;
    }
}
function updateOrderFromDOM() {
    const newIds = Array.from(gridEl.children).map(el => el.dataset.id);
    const newArr = [];
    newIds.forEach(id => {
        const item = bookmarks.find(b => b.id === id);
        if(item) newArr.push(item);
    });
    bookmarks = newArr;
}

window.deleteBookmark = (e, id) => {
    e.stopPropagation();
    if(confirm('确定删除?')) {
        bookmarks = bookmarks.filter(b => b.id !== id);
        render();
    }
};

// 4. Modal 逻辑修复
const titleIn = document.getElementById('input-title');
const urlIn = document.getElementById('input-url');
const radios = document.getElementsByName('icon-type');
const iconValIn = document.getElementById('input-icon-val');
const preview = document.getElementById('icon-preview');

// 打开弹窗
window.openEditModal = (id) => {
    editingId = id;
    // 1. 先设置 display block
    modal.style.display = 'flex';
    // 2. 强制重绘后设置 opacity 实现淡入
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
    });

    document.getElementById('modal-title').textContent = id ? '编辑书签' : '添加书签';

    if (id) {
        const item = bookmarks.find(b => b.id === id);
        titleIn.value = item.title;
        urlIn.value = item.url;
        [...radios].forEach(r => r.checked = (r.value === item.iconType));
        iconValIn.value = item.iconValue || "";
    } else {
        titleIn.value = ''; urlIn.value = ''; iconValIn.value = '';
        radios[0].checked = true;
    }
    updatePreview();
};

// 关闭弹窗
function closeModal() {
    modal.style.opacity = '0';
    // 动画结束后隐藏
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

document.getElementById('add-btn').addEventListener('click', () => openEditModal(null));
document.getElementById('modal-cancel').addEventListener('click', closeModal);

// 预览逻辑
function updatePreview() {
    const type = [...radios].find(r => r.checked).value;
    const img = preview.querySelector('img');
    const span = preview.querySelector('span');

    preview.className = 'bookmark-icon';
    img.classList.add('hidden');
    span.classList.add('hidden');
    iconValIn.classList.toggle('hidden', type === 'auto');

    if (type === 'auto' && urlIn.value) {
        try {
            const host = new URL(urlIn.value).hostname;
            img.src = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
            img.classList.remove('hidden');
        } catch(e){}
    } else if (type === 'image' && iconValIn.value) {
        img.src = iconValIn.value;
        img.classList.remove('hidden');
    } else if (type === 'text') {
        preview.classList.add('text-icon');
        span.textContent = iconValIn.value || titleIn.value.charAt(0) || "A";
        span.classList.remove('hidden');
    }
}

[titleIn, urlIn, iconValIn].forEach(el => el.addEventListener('input', updatePreview));
[...radios].forEach(el => el.addEventListener('change', updatePreview));

// 保存
document.getElementById('modal-save').addEventListener('click', () => {
    if (!titleIn.value || !urlIn.value) return alert('请填写完整');

    const newItem = {
        id: editingId || Date.now().toString(),
        title: titleIn.value,
        url: urlIn.value,
        iconType: [...radios].find(r => r.checked).value,
        iconValue: iconValIn.value
    };

    if (editingId) {
        const idx = bookmarks.findIndex(b => b.id === editingId);
        bookmarks[idx] = newItem;
    } else {
        bookmarks.push(newItem);
    }

    closeModal();
    render();
});

// 导出
document.getElementById('export-btn').addEventListener('click', () => {
    const str = JSON.stringify(bookmarks, null, 2);
    const blob = new Blob([str], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bookmarks.json';
    a.click();
});

init();