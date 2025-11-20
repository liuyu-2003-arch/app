// 你的线上数据文件地址
const DATA_URL = 'https://324893.xyz/bookmarks.json';

let bookmarks = [];
let isEditing = false;
let sortableInstance = null;
let currentEditIndex = -1;

// 初始化
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
        console.warn("无法加载远程JSON，加载默认演示数据", error);
        // 默认演示数据
        bookmarks = [
            { title: "GitHub", url: "https://github.com", icon: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png", style: "white" },
            { title: "Bilibili", url: "https://www.bilibili.com", icon: "https://icons.duckduckgo.com/ip3/bilibili.com.ico", style: "white" },
            { title: "无图标示例", url: "https://example.com", icon: "", style: "full" }
        ];
    }
    render();
}

// 2. 渲染函数 (核心逻辑)
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

        // 获取首字母（用于文字Logo）
        const firstChar = item.title ? item.title.charAt(0).toUpperCase() : 'A';

        // 渲染逻辑：如果有图标链接，渲染图片（带onerror回退）；否则直接渲染文字
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

// 3. 切换编辑模式
function toggleEditMode(enable) {
    isEditing = enable;
    const container = document.querySelector('.container');
    const controls = document.getElementById('edit-controls');

    if (enable) {
        container.classList.add('is-editing');
        controls.classList.remove('hidden');
        initSortable();
    } else {
        container.classList.remove('is-editing');
        controls.classList.add('hidden');
        if (sortableInstance) {
            sortableInstance.destroy();
            sortableInstance = null;
        }
    }
}

// 4. 拖拽逻辑
function initSortable() {
    const grid = document.getElementById('bookmark-grid');
    if (sortableInstance) sortableInstance.destroy();

    sortableInstance = new Sortable(grid, {
        animation: 350,
        ghostClass: 'sortable-ghost',
        delay: 100,
        onEnd: function (evt) {
            const item = bookmarks.splice(evt.oldIndex, 1)[0];
            bookmarks.splice(evt.newIndex, 0, item);
        }
    });
}

// 5. 删除
function deleteBookmark(e, index) {
    e.stopPropagation();
    if (confirm('确定删除这个书签吗？')) {
        bookmarks.splice(index, 1);
        render();
    }
}

// 6. 模态框逻辑
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

    updatePreview();
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

// 自动填充信息 (增强版：提取域名做标题)
function autoFillInfo() {
    const urlVal = document.getElementById('input-url').value;
    const titleInput = document.getElementById('input-title');
    const iconInput = document.getElementById('input-icon');

    if (urlVal.length > 3) {
        // 智能补全 https
        let safeUrl = urlVal;
        if (!safeUrl.startsWith('http')) safeUrl = 'https://' + safeUrl;

        try {
            const urlObj = new URL(safeUrl);
            const domain = urlObj.hostname;

            // 自动填充图标 (仅当图标栏为空时)
            if (!iconInput.value) {
                const autoIconUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
                iconInput.value = autoIconUrl;
                updatePreview();
            }

            // 自动填充标题 (从域名提取，如 www.youtube.com -> Youtube)
            if (!titleInput.value) {
                let domainName = domain.replace('www.', '').split('.')[0];
                if(domainName) {
                    domainName = domainName.charAt(0).toUpperCase() + domainName.slice(1);
                    titleInput.value = domainName;
                    updatePreviewText();
                }
            }
        } catch (e) {
            // 忽略不完整的URL
        }
    }
}

function updatePreview() {
    const iconUrl = document.getElementById('input-icon').value;
    const img = document.getElementById('preview-img');
    const txt = document.getElementById('preview-text');

    if (iconUrl) {
        img.src = iconUrl;
        img.classList.remove('hidden');
        txt.classList.add('hidden');
    } else {
        handlePreviewError();
    }
}

// 图片加载失败或无图片时显示文字
function handlePreviewError() {
    const img = document.getElementById('preview-img');
    const txt = document.getElementById('preview-text');

    img.classList.add('hidden');
    txt.classList.remove('hidden');
    updatePreviewText();
}

function updatePreviewText() {
    const titleVal = document.getElementById('input-title').value;
    const txt = document.getElementById('preview-text');
    txt.innerText = titleVal ? titleVal.charAt(0).toUpperCase() : 'A';
}

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

// 7. 导出配置
function exportConfig() {
    const dataStr = JSON.stringify(bookmarks, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = "bookmarks.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}