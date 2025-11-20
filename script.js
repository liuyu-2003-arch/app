const DATA_URL = 'https://324893.xyz/bookmarks.json';

let bookmarks = [];
let isEditing = false;
let sortableInstance = null;
let currentEditIndex = -1;
let autoFillTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    loadBookmarks();
});

async function loadBookmarks() {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error("Fetch failed");
        bookmarks = await response.json();
    } catch (error) {
        console.warn("无法加载远程JSON", error);
        bookmarks = [
            { title: "GitHub", url: "https://github.com", icon: "https://manifest.im/icon/github.com", style: "white" },
            { title: "Bilibili", url: "https://www.bilibili.com", icon: "https://manifest.im/icon/bilibili.com", style: "white" }
        ];
    }
    render();
}

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

// --- 新增：切换图标源 ---
function switchIconSource(type) {
    const urlVal = document.getElementById('input-url').value;
    const iconInput = document.getElementById('input-icon');

    if (!urlVal || !urlVal.includes('.')) {
        alert('请先输入正确的网址');
        return;
    }

    let safeUrl = urlVal;
    if (!safeUrl.startsWith('http')) safeUrl = 'https://' + safeUrl;

    try {
        const urlObj = new URL(safeUrl);
        let domain = urlObj.hostname;
        if (domain.endsWith('.')) domain = domain.slice(0, -1);

        let newIconUrl = "";
        if (type === 'manifest') {
            newIconUrl = `https://manifest.im/icon/${domain}`;
        } else if (type === 'vemetric') {
            newIconUrl = `https://favicon.vemetric.com/${domain}`;
        } else if (type === 'direct') {
            // 官网直接：尝试 https://domain/favicon.ico
            newIconUrl = `${urlObj.protocol}//${domain}/favicon.ico`;
        }

        iconInput.value = newIconUrl;
        updatePreview(); // 立即刷新预览看看行不行
    } catch (e) {
        console.error("URL解析错误");
    }
}

// 自动填充 (默认使用 Manifest)
function autoFillInfo() {
    if (autoFillTimer) clearTimeout(autoFillTimer);

    autoFillTimer = setTimeout(() => {
        const urlVal = document.getElementById('input-url').value;
        const titleInput = document.getElementById('input-title');
        const iconInput = document.getElementById('input-icon');

        if (urlVal.includes('.') && urlVal.length > 4) {
            let safeUrl = urlVal;
            if (!safeUrl.startsWith('http')) safeUrl = 'https://' + safeUrl;

            try {
                const urlObj = new URL(safeUrl);
                let domain = urlObj.hostname;
                if (domain.endsWith('.')) domain = domain.slice(0, -1);

                // 默认源：Manifest
                if (!iconInput.value) {
                    iconInput.value = `https://manifest.im/icon/${domain}`;
                }

                if (!titleInput.value) {
                    let domainName = domain.replace('www.', '').split('.')[0];
                    if(domainName) {
                        domainName = domainName.charAt(0).toUpperCase() + domainName.slice(1);
                        titleInput.value = domainName;
                    }
                }
                updatePreview();
            } catch (e) {}
        }
    }, 500);
}

function updatePreview() {
    const titleVal = document.getElementById('input-title').value || "标题预览";
    const iconVal = document.getElementById('input-icon').value;
    const styleVal = document.querySelector('input[name="icon-style"]:checked').value;

    const previewCard = document.getElementById('preview-card');
    const previewImg = document.getElementById('preview-img');
    const previewText = document.getElementById('preview-text');
    const previewTitle = document.getElementById('preview-title');

    previewTitle.innerText = titleVal;

    if (styleVal === 'white') {
        previewCard.classList.add('style-white');
    } else {
        previewCard.classList.remove('style-white');
    }

    const firstChar = titleVal.charAt(0).toUpperCase() || "A";
    previewText.innerText = firstChar;

    if (iconVal) {
        previewImg.src = iconVal;
        previewImg.classList.remove('hidden');
        previewText.classList.add('hidden');
        previewImg.onload = () => {
            previewImg.classList.remove('hidden');
            previewText.classList.add('hidden');
        };
        previewImg.onerror = () => {
            previewImg.classList.add('hidden');
            previewText.classList.remove('hidden');
        };
    } else {
        previewImg.classList.add('hidden');
        previewText.classList.remove('hidden');
    }
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