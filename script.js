let pages = [];
let visualPages = []; // New global to hold the rendered page structure
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
let isWheeling = false;
let dotsTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    document.body.style.visibility = 'hidden';
    loadData();
    initTheme();
    initSwiper();
    window.addEventListener('resize', () => {
        render();
        updateSwiperPosition(false);
    });
    document.getElementById('import-file-input').addEventListener('change', handleImport);
});

function migrateData(oldData) {
    const itemsPerPage = 32;
    const newPages = [];
    const pageTitles = oldData.pageTitles || ["个人收藏", "常用工具", "学习资源"];
    const bookmarks = oldData.bookmarks || oldData;

    const totalPages = Math.max(pageTitles.length, Math.ceil(bookmarks.length / itemsPerPage));

    for (let i = 0; i < totalPages; i++) {
        newPages.push({
            title: pageTitles[i] || "新页面",
            bookmarks: bookmarks.slice(i * itemsPerPage, (i + 1) * itemsPerPage)
        });
    }
    return newPages;
}

async function loadData() {
    try {
        const response = await fetch('homepage_config.json');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        if (Array.isArray(data) && (data.length === 0 || data[0].hasOwnProperty('bookmarks'))) {
            pages = data;
        } else {
            pages = migrateData(data);
        }
        saveData();
    } catch (error) {
        console.warn("无法从 homepage_config.json 加载, 尝试从 localStorage 加载...", error);
        const storedData = localStorage.getItem('pagedData');
        if (storedData) {
            pages = JSON.parse(storedData);
        } else {
            pages = [
                { title: "个人收藏", bookmarks: [
                    { title: "GitHub", url: "https://github.com", icon: "https://manifest.im/icon/github.com", style: "white" },
                    { title: "Bilibili", url: "https://www.bilibili.com", icon: "https://manifest.im/icon/bilibili.com", style: "fit" }
                ]},
                { title: "常用工具", bookmarks: [] }
            ];
            saveData();
        }
    }
    render();
    document.body.style.visibility = 'visible';
}

function saveData() {
    localStorage.setItem('pagedData', JSON.stringify(pages));
}

function createVisualPages() {
    visualPages = [];
    const isMobile = window.innerWidth < 768;
    const chunkSize = isMobile ? 12 : 32;

    pages.forEach((page, originalPageIndex) => {
        if (page.bookmarks.length === 0) {
            visualPages.push({
                title: page.title,
                bookmarks: [],
                originalPageIndex: originalPageIndex,
                chunkIndex: 0
            });
        } else {
            for (let i = 0; i < page.bookmarks.length; i += chunkSize) {
                const chunk = page.bookmarks.slice(i, i + chunkSize);
                visualPages.push({
                    title: page.title,
                    bookmarks: chunk,
                    originalPageIndex: originalPageIndex,
                    chunkIndex: i / chunkSize
                });
            }
        }
    });
    if (visualPages.length === 0) {
         visualPages.push({ title: "新页面", bookmarks: [], originalPageIndex: 0, chunkIndex: 0 });
    }
}


function initTheme() {
    const savedColor = localStorage.getItem('themeColor') || '#f8e8ee';
    document.querySelector('.background-layer').style.backgroundColor = savedColor;
    const swatches = document.querySelectorAll('.swatch');
    swatches.forEach(swatch => {
        if (rgbToHex(swatch.style.backgroundColor) === savedColor.toLowerCase()) {
            swatch.classList.add('active');
        }
    });
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
    if(!rgb) return '#f8e8ee';
    return "#" + ((1 << 24) + (parseInt(rgb[0]) << 16) + (parseInt(rgb[1]) << 8) + parseInt(rgb[2])).toString(16).slice(1);
}

function render() {
    createVisualPages();
    const swiperWrapper = document.getElementById('bookmark-swiper-wrapper');
    swiperWrapper.innerHTML = '';
    sortableInstances.forEach(instance => instance.destroy());
    sortableInstances = [];

    visualPages.forEach((vPage, visualPageIndex) => {
        const page = document.createElement('div');
        page.className = 'bookmark-page';
        page.dataset.visualPageIndex = visualPageIndex;

        const pageContainer = document.createElement('div');
        pageContainer.className = 'page-container';

        const header = document.createElement('div');
        header.className = 'page-header';

        const title = document.createElement('h2');
        title.className = 'page-title';
        title.textContent = vPage.title || '新页面';
        header.appendChild(title);
        
        pageContainer.appendChild(header);

        const content = document.createElement('div');
        content.className = 'bookmark-page-content';
        pageContainer.appendChild(content);

        vPage.bookmarks.forEach((item) => {
            const originalPageIndex = vPage.originalPageIndex;
            const originalBookmarkIndex = pages[originalPageIndex].bookmarks.indexOf(item);

            const div = document.createElement('div');
            let styleClass = '';
            if (item.style === 'white') styleClass = 'style-white';
            else if (item.style === 'fit') styleClass = 'style-fit';

            div.className = `bookmark-item ${styleClass}`;
            div.dataset.originalPageIndex = originalPageIndex;
            div.dataset.originalBookmarkIndex = originalBookmarkIndex;

            div.onclick = (e) => {
                if (isEditing) {
                    if (!e.target.classList.contains('delete-btn')) openModal(originalPageIndex, originalBookmarkIndex);
                } else {
                    if (!hasDragged) window.location.href = item.url;
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
                <div class="delete-btn" onclick="deleteBookmark(event, ${originalPageIndex}, ${originalBookmarkIndex})">×</div>
                <div class="icon-box">
                    ${iconHtml}
                </div>
                <div class="bookmark-title">${item.title}</div>
            `;
            content.appendChild(div);
        });

        page.appendChild(pageContainer);
        swiperWrapper.appendChild(page);
    });

    if (currentPage >= visualPages.length) currentPage = Math.max(0, visualPages.length - 1);
    updateSwiperPosition(false);
    renderPaginationDots();
    if (isEditing) initSortable();
}

function showPaginationDots() {
    const dotsContainer = document.getElementById('pagination-dots');
    if (!dotsContainer || visualPages.length <= 1) return;

    dotsContainer.classList.add('visible');
    clearTimeout(dotsTimer);
    dotsTimer = setTimeout(() => {
        dotsContainer.classList.remove('visible');
    }, 2000);
}

function renderPaginationDots() {
    const dotsContainer = document.getElementById('pagination-dots');
    dotsContainer.innerHTML = '';
    if (visualPages.length <= 1) return;

    for (let i = 0; i < visualPages.length; i++) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        if (i === currentPage) dot.classList.add('active');
        dotsContainer.appendChild(dot);
    }
}

function initSwiper() {
    const swiper = document.getElementById('bookmark-swiper');
    swiper.addEventListener('mousedown', dragStart);
    swiper.addEventListener('touchstart', dragStart, { passive: true });
    swiper.addEventListener('mouseup', dragEnd);
    swiper.addEventListener('mouseleave', dragEnd);
    swiper.addEventListener('touchend', dragEnd);
    swiper.addEventListener('mousemove', drag);
    swiper.addEventListener('touchmove', drag, { passive: true });
    swiper.addEventListener('wheel', handleWheel, { passive: false });
}

function handleWheel(e) {
    e.preventDefault();
    if (isWheeling) return;

    if (Math.abs(e.deltaX) > 20) {
        let pageChanged = false;
        if (e.deltaX > 1 && currentPage < visualPages.length - 1) {
            currentPage++;
            pageChanged = true;
        } else if (e.deltaX < -1 && currentPage > 0) {
            currentPage--;
            pageChanged = true;
        }

        if (pageChanged) {
            isWheeling = true;
            updateSwiperPosition(true);
            renderPaginationDots();
            showPaginationDots();
            setTimeout(() => { isWheeling = false; }, 500);
        }
    }
}

function dragStart(e) {
    if (isEditing && e.target.closest('.bookmark-item')) {
        isDragging = false;
        return;
    }
    isDragging = true;
    hasDragged = false;
    startPos = getPositionX(e);
    animationID = requestAnimationFrame(animation);
    const swiperWrapper = document.getElementById('bookmark-swiper-wrapper');
    swiperWrapper.style.transition = 'none';
}

function drag(e) {
    if (isDragging) {
        const currentPosition = getPositionX(e);
        if (Math.abs(currentPosition - startPos) > 5) {
            hasDragged = true;
        }
        currentTranslate = prevTranslate + currentPosition - startPos;
    }
}

function dragEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    cancelAnimationFrame(animationID);

    const movedBy = currentTranslate - prevTranslate;
    let pageChanged = false;
    if (movedBy < -50 && currentPage < visualPages.length - 1) {
        currentPage++;
        pageChanged = true;
    }
    if (movedBy > 50 && currentPage > 0) {
        currentPage--;
        pageChanged = true;
    }
    
    updateSwiperPosition(true);
    renderPaginationDots();
    if (pageChanged) showPaginationDots();
}

function getPositionX(e) {
    return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
}

function animation() {
    setSwiperPosition();
    if (isDragging) requestAnimationFrame(animation);
}

function setSwiperPosition() {
    const swiperWrapper = document.getElementById('bookmark-swiper-wrapper');
    swiperWrapper.style.transform = `translateX(${currentTranslate}px)`;
}

function updateSwiperPosition(withTransition = true) {
    const swiperWrapper = document.getElementById('bookmark-swiper-wrapper');
    const swiperWidth = document.getElementById('bookmark-swiper').clientWidth;
    currentTranslate = currentPage * -swiperWidth;
    prevTranslate = currentTranslate;
    if (withTransition) {
        swiperWrapper.style.transition = 'transform 0.3s ease-out';
    }
    setSwiperPosition();
}

function openModal(pageIndex = -1, bookmarkIndex = -1) {
    currentEditInfo = { pageIndex, bookmarkIndex };
    const modal = document.getElementById('modal');
    modal.classList.remove('hidden');
    const titleInput = document.getElementById('input-title');
    const urlInput = document.getElementById('input-url');
    const iconInput = document.getElementById('input-icon');
    const radios = document.getElementsByName('icon-style');
    const pageSelector = document.getElementById('input-page');
    
    pageSelector.innerHTML = '';
    pages.forEach((page, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = page.title || `第 ${index + 1} 页`;
        pageSelector.appendChild(option);
    });

    if (pageIndex >= 0 && bookmarkIndex >= 0) {
        const item = pages[pageIndex].bookmarks[bookmarkIndex];
        titleInput.value = item.title;
        urlInput.value = item.url;
        iconInput.value = item.icon || "";
        for(let r of radios) {
            if(r.value === (item.style || 'full')) r.checked = true;
        }
        pageSelector.value = pageIndex;
    } else {
        titleInput.value = '';
        urlInput.value = '';
        iconInput.value = '';
        radios[0].checked = true;
        const currentVisualPage = visualPages[currentPage];
        pageSelector.value = currentVisualPage ? currentVisualPage.originalPageIndex : 0;
    }

    updatePreview();
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

function openPageEditModal() {
    const modal = document.getElementById('page-edit-modal');
    modal.classList.remove('hidden');
    renderPageList();
}

function closePageEditModal() {
    document.getElementById('page-edit-modal').classList.add('hidden');
    render();
}

function renderPageList() {
    const list = document.getElementById('page-list');
    list.innerHTML = '';
    pages.forEach((page, index) => {
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
            pages[index].title = input.value;
            saveData();
        };
        li.appendChild(input);

        if (page.bookmarks.length === 0 && pages.length > 1) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-page-list-btn';
            deleteBtn.textContent = '×';
            deleteBtn.onclick = () => deletePage(index);
            li.appendChild(deleteBtn);
        }

        list.appendChild(li);
    });

    if (sortableInstances.pageList) sortableInstances.pageList.destroy();
    sortableInstances.pageList = new Sortable(list, {
        animation: 150,
        handle: '.drag-handle',
        onEnd: (evt) => {
            const [movedPage] = pages.splice(evt.oldIndex, 1);
            pages.splice(evt.newIndex, 0, movedPage);
            saveData();
            renderPageList();
        }
    });
}

function generateIconCandidates(urlVal) {
    if (!urlVal || !urlVal.includes('.') || urlVal.length < 4) return;
    let safeUrl = urlVal;
    if (!safeUrl.startsWith('http')) safeUrl = 'https://' + safeUrl;
    let domain = "", protocol = "https:";
    try {
        const urlObj = new URL(safeUrl);
        domain = urlObj.hostname;
        protocol = urlObj.protocol;
        if (domain.endsWith('.')) domain = domain.slice(0, -1);
    } catch(e) { return; }
    const list = document.getElementById('icon-candidates');
    renderRandomButtons(list);
    const sources = [
        { name: 'Manifest', url: `https://manifest.im/icon/${domain}` },
        { name: 'Vemetric', url: `https://favicon.vemetric.com/${domain}` },
        { name: 'Logo.dev', url: `https://img.logo.dev/${domain}?token=pk_CD4SuapcQDq1yZFMwSaYeA&size=100&format=png` },
        { name: 'Brandfetch', url: `https://cdn.brandfetch.io/${domain}?c=1idVW8VN57Jat7AexnZ` },
        { name: 'Direct', url: `${protocol}//${domain}/favicon.ico` },
        { name: 'Web Icon', url: `${protocol}//${domain}/icon.png` }
    ];
    for (let i = sources.length - 1; i >= 0; i--) {
        const src = sources[i];
        const item = document.createElement('div');
        item.className = 'candidate-item';
        item.title = src.name;
        const img = document.createElement('img');
        img.src = src.url;
        item.onclick = () => {
            document.getElementById('input-icon').value = src.url;
            updatePreview();
            document.querySelectorAll('.candidate-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
        };
        img.onerror = () => { item.style.display = 'none'; };
        item.appendChild(img);
        list.insertBefore(item, list.firstChild);
    }
}

function renderRandomButtons(container) {
    container.innerHTML = '';
    const randomTypes = [
        { type: 'random-shapes', icon: '🎲', name: '几何' },
        { type: 'random-identicon', icon: '🧩', name: '像素' },
        { type: 'random-emoji', icon: '😀', name: '表情' }
    ];
    randomTypes.forEach(rnd => {
        const item = document.createElement('div');
        item.className = 'candidate-item candidate-random';
        item.innerText = rnd.icon;
        item.title = rnd.name;
        item.onclick = () => {
            const seed = Math.random().toString(36).substring(7);
            let url = '';
            if(rnd.type === 'random-shapes') url = `https://api.dicebear.com/9.x/shapes/svg?seed=${seed}`;
            else if(rnd.type === 'random-identicon') url = `https://api.dicebear.com/9.x/identicon/svg?seed=${seed}`;
            else url = `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${seed}`;
            document.getElementById('input-icon').value = url;
            updatePreview();
            document.querySelectorAll('.candidate-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
        };
        container.appendChild(item);
    });
}

function autoFillInfo() {
    if (autoFillTimer) clearTimeout(autoFillTimer);
    autoFillTimer = setTimeout(() => {
        const urlVal = document.getElementById('input-url').value;
        const titleInput = document.getElementById('input-title');
        const iconInput = document.getElementById('input-icon');
        generateIconCandidates(urlVal);
        if (urlVal.includes('.') && urlVal.length > 4) {
            let safeUrl = urlVal;
            if (!safeUrl.startsWith('http')) safeUrl = 'https://' + safeUrl;
            try {
                const urlObj = new URL(safeUrl);
                let domain = urlObj.hostname;
                if (domain.endsWith('.')) domain = domain.slice(0, -1);
                if (!iconInput.value) {
                    const defaultUrl = `https://manifest.im/icon/${domain}`;
                    iconInput.value = defaultUrl;
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
    previewCard.classList.remove('style-white', 'style-fit');
    if (styleVal === 'white') previewCard.classList.add('style-white');
    else if (styleVal === 'fit') previewCard.classList.add('style-fit');
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
    const newPageIndex = parseInt(document.getElementById('input-page').value);

    if (!title || !url) { alert('标题和网址是必填的'); return; }
    if (!url.startsWith('http')) url = 'https://' + url;
    
    const newItem = { title, url, icon, style };
    const { pageIndex, bookmarkIndex } = currentEditInfo;

    if (pageIndex >= 0 && bookmarkIndex >= 0) { // Editing existing
        const itemToUpdate = pages[pageIndex].bookmarks[bookmarkIndex];
        Object.assign(itemToUpdate, newItem);
        
        if (pageIndex !== newPageIndex) {
            const itemToMove = pages[pageIndex].bookmarks.splice(bookmarkIndex, 1)[0];
            pages[newPageIndex].bookmarks.push(itemToMove);
        }
    } else { // Adding new
        if (!pages[newPageIndex]) pages[newPageIndex] = { title: "新页面", bookmarks: [] };
        pages[newPageIndex].bookmarks.push(newItem);
        currentPage = newPageIndex;
    }

    saveData();
    closeModal();
    render();
}

function toggleEditMode(enable) {
    isEditing = enable;
    document.body.classList.toggle('is-editing', enable);
    const controls = document.getElementById('edit-controls');
    if (enable) {
        controls.classList.remove('hidden');
    } else {
        controls.classList.add('hidden');
        sortableInstances.forEach(instance => instance.destroy());
        sortableInstances = [];
    }
    render();
}

function addPage() {
    pages.push({ title: "新页面", bookmarks: [] });
    saveData();
    if (document.getElementById('page-edit-modal').classList.contains('hidden')) {
        currentPage = pages.length - 1;
        render();
    } else {
        renderPageList();
    }
}

function deletePage(pageIndex) {
    if (pages[pageIndex].bookmarks.length > 0) {
        alert("请先移除或移动此页面的所有书签才能删除页面。");
        return;
    }

    if (!confirm(`确定要删除 "${pages[pageIndex].title}" 吗？`)) return;
    
    pages.splice(pageIndex, 1);
    saveData();
    
    if (currentPage >= pages.length) {
        currentPage = Math.max(0, pages.length - 1);
    }
    render();
    renderPageList();
}

function initSortable() {
    if (!isEditing) return;

    document.querySelectorAll('.bookmark-page-content').forEach(content => {
        const instance = new Sortable(content, {
            group: 'shared-bookmarks',
            animation: 350,
            ghostClass: 'sortable-ghost',
            delay: 100,
            onEnd: function (evt) {
                const fromVisualPageIndex = parseInt(evt.from.closest('.bookmark-page').dataset.visualPageIndex);
                const toVisualPageIndex = parseInt(evt.to.closest('.bookmark-page').dataset.visualPageIndex);

                const fromVPage = visualPages[fromVisualPageIndex];
                const toVPage = visualPages[toVisualPageIndex];

                const fromOriginalPageIndex = fromVPage.originalPageIndex;
                const toOriginalPageIndex = toVPage.originalPageIndex;

                const item = fromVPage.bookmarks.splice(evt.oldIndex, 1)[0];
                toVPage.bookmarks.splice(evt.newIndex, 0, item);
                
                // This is a simplified move, now update the main `pages` array
                const originalItem = pages[fromOriginalPageIndex].bookmarks.find(bm => bm === item);
                const originalItemIndex = pages[fromOriginalPageIndex].bookmarks.indexOf(originalItem);
                pages[fromOriginalPageIndex].bookmarks.splice(originalItemIndex, 1);

                // This is the tricky part, finding the correct new index in the original array
                const isMobile = window.innerWidth < 768;
                const chunkSize = isMobile ? 12 : 32;
                const newOriginalIndex = (toVPage.chunkIndex * chunkSize) + evt.newIndex;
                pages[toOriginalPageIndex].bookmarks.splice(newOriginalIndex, 0, originalItem);

                saveData();
                render();
            }
        });
        sortableInstances.push(instance);
    });
}

function deleteBookmark(e, pageIndex, bookmarkIndex) {
    e.stopPropagation();
    if (confirm('确定删除这个书签吗？')) {
        pages[pageIndex].bookmarks.splice(bookmarkIndex, 1);
        saveData();
        render();
    }
}

function exportConfig() {
    const dataStr = JSON.stringify(pages, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = "homepage_config.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function importConfig() {
    document.getElementById('import-file-input').click();
}

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (Array.isArray(importedData) && (importedData.length === 0 || importedData[0].hasOwnProperty('bookmarks'))) {
                pages = importedData;
            } else {
                pages = migrateData(importedData);
            }
            saveData();
            render();
            alert('配置导入成功！');
        } catch (err) {
            alert('导入失败，请确保文件是正确的 JSON 格式。');
            console.error(err);
        }
    };
    reader.readAsText(file);
}