const DATA_URL = 'https://324893.xyz/bookmarks.json';

let bookmarks = [];
let isEditing = false;
let sortableInstance = null;
let currentEditIndex = -1;

document.addEventListener('DOMContentLoaded', () => {
    loadBookmarks();
});

// 1. 加载数据
async function loadBookmarks() {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error("Fetch failed");
        bookmarks = await response.json();
    } catch (error) {
        console.warn("无法加载远程JSON", error);
        bookmarks = [
            { title: "GitHub", url: "https://github.com", icon: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png", style: "white" },
            { title: "Bilibili", url: "https://www.bilibili.com", icon: "https://icons.duckduckgo.com/ip3/bilibili.com.ico", style: "white" }
        ];
    }
    render();
}

// 2. 渲染主界面
function render() {
    const grid = document.getElementById('bookmark-grid');
    grid.innerHTML = '';

    bookmarks.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = `bookmark-item ${item.style === 'white' ? 'style-white' : ''}`;
        div.dataset.index = index;

        div.onclick = (e) => {
            if (isEditing) {
                if (!e.target.classList.contains('delete-btn')) openModal(index);
            } else {
                window.location.href = item.url;
            }
        };

        const firstChar = item.title ? item.title.charAt(0).toUpperCase() : 'A';

        // 图标逻辑：如果有链接，显示图片；否则显示文字
        // 图片加载失败(onerror)时，自动隐藏图片并显示后面的文字div
        let iconHtml = '';
        if (item.icon && item.icon.trim() !== "") {
             iconHtml = `
                <img src="${item.icon}"
                     onload="this.style.display='block'; this.nextElementSibling.style.display='none'"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                <div class="text-icon" style="display:none">${firstChar}</div>
            `;
        } else {
            iconHtml = `<div class="text-icon">${firstChar}</div>`;
        }

        div.innerHTML = `
            <div class="delete-btn" onclick="deleteBookmark(event, ${index})">×</div>
            <div class="icon-box">
                ${iconHtml}
            </div>
            <div class="bookmark-title">${item.title}</div>
        `;
        grid.appendChild(div);
    });

    if (isEditing) initSortable();
}

// 3. 模态框：打开
function openModal(index = -1) {
    currentEditIndex = index;
    const modal = document.getElementById('modal');
    const titleInput = document.getElementById('input-title');
    const urlInput = document.getElementById('input-url');
    const iconInput = document.getElementById('input-icon');
    const radios = document.getElementsByName('icon-style');

    if (index >= 0) {
        const item = bookmarks[index];
        titleInput.value = item.title;
        urlInput.value = item.url;
        iconInput.value = item.icon || "";
        for(let r of radios) if(r.value === item.style) r.checked = true;
    } else {
        titleInput.value = '';
        urlInput.value = '';
        iconInput.value = '';
        radios[0].checked = true;
    }

    updatePreview(); // 初始化预览
    modal.classList.remove('hidden');
}

// 4. 自动填充逻辑 (修正版)
function autoFillInfo() {
    const urlVal = document.getElementById('input-url').value;
    const titleInput = document.getElementById('input-title');
    const iconInput = document.getElementById('input-icon');

    // 只有当包含点号(.)时才认为是有效的域名输入，避免 "yout" 就触发
    if (urlVal.includes('.') && urlVal.length > 4) {
        let safeUrl = urlVal;
        if (!safeUrl.startsWith('http')) safeUrl = 'https://' + safeUrl;

        try {
            const urlObj = new URL(safeUrl);
            const domain = urlObj.hostname; // 例如 youtube.com

            // 只有当图标为空时才自动填充
            if (!iconInput.value) {
                // 使用完整域名获取图标，确保准确
                const autoIconUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
                iconInput.value = autoIconUrl;
            }

            // 只有当标题为空时才自动填充
            if (!titleInput.value) {
                // 提取域名主体: www.youtube.com -> youtube
                let domainName = domain.replace('www.', '').split('.')[0];
                if(domainName) {
                    // 首字母大写
                    domainName = domainName.charAt(0).toUpperCase() + domainName.slice(1);
                    titleInput.value = domainName;
                }
            }

            updatePreview(); // 实时刷新预览
        } catch (e) {
            // 输入尚未构成有效URL，忽略
        }
    }
}

// 5. 核心：更新预览卡片 (整合了图片、文字、样式、标题)
function updatePreview() {
    const titleVal = document.getElementById('input-title').value || "标题预览";
    const iconVal = document.getElementById('input-icon').value;
    const styleVal = document.querySelector('input[name="icon-style"]:checked').value;

    const previewCard = document.getElementById('preview-card');
    const previewImg = document.getElementById('preview-img');
    const previewText = document.getElementById('preview-text');
    const previewTitle = document.getElementById('preview-title');

    // 1. 更新标题
    previewTitle.innerText = titleVal;

    // 2. 更新样式 (Full vs White)
    if (styleVal === 'white') {
        previewCard.classList.add('style-white');
    } else {
        previewCard.classList.remove('style-white');
    }

    // 3. 更新图标 (图片 vs 文字)
    const firstChar = titleVal.charAt(0).toUpperCase() || "A";
    previewText.innerText = firstChar;

    if (iconVal) {
        previewImg.src = iconVal;
        // 图片加载成功显示图片，失败显示文字
        previewImg.onload = () => {
            previewImg.classList.remove('hidden');
            previewText.classList.add('hidden');
        };
        previewImg.onerror = () => {
            previewImg.classList.add('hidden');
            previewText.classList.remove('hidden');
        };
    } else {
        // 没有输入链接，直接显示文字
        previewImg.classList.add('hidden');
        previewText.classList.remove('hidden');
    }
}

// 6. 保存
function saveBookmark() {
    const title = document.getElementById('input-title').value;
    let url = document.getElementById('input-url').value;
    const icon = document.getElementById('input-icon').value;
    const style = document.querySelector('input[name="icon-style"]:checked').value;

    if (!title || !url) {
        alert('标题和网址是必填的');
        return;
    }
    if (!url.startsWith('http')) url = 'https://' + url;

    const newItem = { title, url, icon, style };

    if (currentEditIndex >= 0) {
        bookmarks[currentEditIndex] = newItem;
    } else {
        bookmarks.push(newItem);
    }

    closeModal();
    render();
}

// ... 保持原来的辅助函数不变 ...
function closeModal() { document.getElementById('modal').classList.add('hidden'); }
function toggleEditMode(enable) {
    isEditing = enable;
    const container = document.querySelector('.container');
    const controls = document.getElementById('edit-controls');
    if (enable) {
        container.classList.add('is-editing'); controls.classList.remove('hidden'); initSortable();
    } else {
        container.classList.remove('is-editing'); controls.classList.add('hidden');
        if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; }
    }
}
function initSortable() {
    const grid = document.getElementById('bookmark-grid');
    if (sortableInstance) sortableInstance.destroy();
    sortableInstance = new Sortable(grid, {
        animation: 350, ghostClass: 'sortable-ghost', delay: 100,
        onEnd: function (evt) {
            const item = bookmarks.splice(evt.oldIndex, 1)[0];
            bookmarks.splice(evt.newIndex, 0, item);
        }
    });
}
function deleteBookmark(e, index) {
    e.stopPropagation();
    if (confirm('确定删除这个书签吗？')) { bookmarks.splice(index, 1); render(); }
}
function exportConfig() {
    const dataStr = JSON.stringify(bookmarks, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = "bookmarks.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}