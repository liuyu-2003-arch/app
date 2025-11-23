const DATA_URL = 'https://324893.xyz/bookmarks.json';

let bookmarks = [];
let isEditing = false;
let sortableInstances = [];
let currentEditIndex = -1;
let autoFillTimer = null;

// Swiper state
let currentPage = 0;
let totalPages = 0;
let itemsPerPage = 16;
let isDragging = false;
let startPos = 0;
let currentTranslate = 0;
let prevTranslate = 0;
let animationID;
let isWheeling = false; // For trackpad swipe throttling

document.addEventListener('DOMContentLoaded', () => {
    loadBookmarks();
    initTheme();
    initSwiper();
    window.addEventListener('resize', () => {
        render();
        updateSwiperPosition(false);
    });
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
            { title: "Bilibili", url: "https://www.bilibili.com", icon: "https://manifest.im/icon/bilibili.com", style: "fit" }
        ];
    }
    render();
}

function calculateItemsPerPage() {
    const page = document.querySelector('.bookmark-page');
    if (!page) { // Fallback for initial load
        const containerWidth = window.innerWidth * 0.9;
        const cardSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-size')) || 80;
        const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 30;
        const itemsPerRow = Math.floor((containerWidth - gap) / (cardSize + gap));
        return Math.max(1, itemsPerRow * 4);
    }

    const pageStyles = getComputedStyle(page);
    const pageHeight = page.clientHeight - parseFloat(pageStyles.paddingTop) - parseFloat(pageStyles.paddingBottom);
    const pageWidth = page.clientWidth - parseFloat(pageStyles.paddingLeft) - parseFloat(pageStyles.paddingRight);
    const cardSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-size')) || 80;
    const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 30;
    const itemHeight = cardSize + 20; // title height approx
    const itemWidth = cardSize;

    const itemsPerRow = Math.floor((pageWidth + gap) / (itemWidth + gap));
    const calculatedRows = Math.floor((pageHeight + gap) / (itemHeight + gap));
    const itemsPerCol = Math.min(4, calculatedRows > 0 ? calculatedRows : 1);

    return Math.max(1, (itemsPerRow > 0 ? itemsPerRow : 1) * itemsPerCol);
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
    const swiperWrapper = document.getElementById('bookmark-swiper-wrapper');
    swiperWrapper.innerHTML = '';
    sortableInstances.forEach(instance => instance.destroy());
    sortableInstances = [];

    const tempPage = document.createElement('div');
    tempPage.className = 'bookmark-page';
    tempPage.style.visibility = 'hidden';
    swiperWrapper.appendChild(tempPage);
    itemsPerPage = calculateItemsPerPage();
    swiperWrapper.removeChild(tempPage);

    totalPages = Math.ceil(bookmarks.length / itemsPerPage);
    if (totalPages === 0) totalPages = 1;

    for (let i = 0; i < totalPages; i++) {
        const page = document.createElement('div');
        page.className = 'bookmark-page';
        page.dataset.pageIndex = i;
        swiperWrapper.appendChild(page);
    }

    bookmarks.forEach((item, index) => {
        const pageIndex = Math.floor(index / itemsPerPage);
        const page = swiperWrapper.children[pageIndex];
        if (!page) return;

        const div = document.createElement('div');
        let styleClass = '';
        if (item.style === 'white') styleClass = 'style-white';
        else if (item.style === 'fit') styleClass = 'style-fit';

        div.className = `bookmark-item ${styleClass}`;
        div.dataset.index = index;

        div.onclick = (e) => {
            if (isEditing) {
                if (!e.target.classList.contains('delete-btn')) {
                    openModal(index);
                }
            } else {
                if (!isDragging) window.location.href = item.url;
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
        page.appendChild(div);
    });

    if (currentPage >= totalPages) {
        currentPage = totalPages - 1;
    }
    updateSwiperPosition(false);
    renderPaginationDots();
    if (isEditing) initSortable();
}

function renderPaginationDots() {
    const dotsContainer = document.getElementById('pagination-dots');
    dotsContainer.innerHTML = '';
    if (totalPages <= 1) return;

    for (let i = 0; i < totalPages; i++) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        if (i === currentPage) {
            dot.classList.add('active');
        }
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

    swiper.addEventListener('click', (e) => {
        if(Math.abs(currentTranslate - prevTranslate) > 5) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
}

function handleWheel(e) {
    if (isEditing) return;
    e.preventDefault();
    if (isWheeling) return;

    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        let pageChanged = false;
        if (e.deltaX > 1 && currentPage < totalPages - 1) {
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
            setTimeout(() => {
                isWheeling = false;
            }, 400); // Throttle duration
        }
    }
}

function dragStart(e) {
    if (isEditing) return;
    isDragging = true;
    startPos = getPositionX(e);
    animationID = requestAnimationFrame(animation);
    const swiperWrapper = document.getElementById('bookmark-swiper-wrapper');
    swiperWrapper.style.transition = 'none';
}

function drag(e) {
    if (isDragging) {
        const currentPosition = getPositionX(e);
        currentTranslate = prevTranslate + currentPosition - startPos;
    }
}

function dragEnd(e) {
    if (!isDragging) return;
    
    cancelAnimationFrame(animationID);

    const movedBy = currentTranslate - prevTranslate;

    if (movedBy < -50 && currentPage < totalPages - 1) {
        currentPage++;
    }
    if (movedBy > 50 && currentPage > 0) {
        currentPage--;
    }

    updateSwiperPosition(true);
    renderPaginationDots();
    
    setTimeout(() => {
        isDragging = false;
    }, 50);
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


function openModal(index = -1) {
    currentEditIndex = index;
    const modal = document.getElementById('modal');
    const titleInput = document.getElementById('input-title');
    const urlInput = document.getElementById('input-url');
    const iconInput = document.getElementById('input-icon');
    const radios = document.getElementsByName('icon-style');
    const candidates = document.getElementById('icon-candidates');

    renderRandomButtons(candidates);

    if (index >= 0) {
        const item = bookmarks[index];
        titleInput.value = item.title;
        urlInput.value = item.url;
        iconInput.value = item.icon || "";
        for(let r of radios) {
            if(r.value === (item.style || 'full')) r.checked = true;
        }
        if (item.url) generateIconCandidates(item.url);
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
        itemsPerPage = calculateItemsPerPage();
        totalPages = Math.ceil(bookmarks.length / itemsPerPage);
        currentPage = totalPages - 1;
    }

    closeModal();
    render();
}

function toggleEditMode(enable) {
    isEditing = enable;
    document.body.classList.toggle('is-editing', enable);
    const controls = document.getElementById('edit-controls');
    if (enable) {
        controls.classList.remove('hidden');
        initSortable();
    } else {
        controls.classList.add('hidden');
        sortableInstances.forEach(instance => instance.destroy());
        sortableInstances = [];
    }
    render();
}

function initSortable() {
    if (!isEditing) return;
    const pages = document.querySelectorAll('.bookmark-page');
    sortableInstances.forEach(instance => instance.destroy());
    sortableInstances = [];

    pages.forEach((page, pageIndex) => {
        const instance = new Sortable(page, {
            group: 'shared',
            animation: 350,
            ghostClass: 'sortable-ghost',
            delay: 100,
            onEnd: function (evt) {
                const fromPageIndex = parseInt(evt.from.dataset.pageIndex);
                const toPageIndex = parseInt(evt.to.dataset.pageIndex);
                const oldItemIndex = (fromPageIndex * itemsPerPage) + evt.oldIndex;
                
                const item = bookmarks.splice(oldItemIndex, 1)[0];

                const toPageItems = Array.from(evt.to.children).filter(el => el !== evt.item);
                let newItemIndex;

                if (evt.newIndex < toPageItems.length) {
                    const referenceItemIndex = parseInt(toPageItems[evt.newIndex].dataset.index);
                    const referenceBookmark = bookmarks.find((b, i) => i === referenceItemIndex);
                    newItemIndex = bookmarks.indexOf(referenceBookmark);
                } else if (toPageItems.length > 0) {
                    const lastItemIndex = parseInt(toPageItems[toPageItems.length - 1].dataset.index);
                    const lastBookmark = bookmarks.find((b, i) => i === lastItemIndex);
                    newItemIndex = bookmarks.indexOf(lastBookmark) + 1;
                } else {
                    newItemIndex = toPageIndex * itemsPerPage;
                }
                
                bookmarks.splice(newItemIndex, 0, item);

                render();
            }
        });
        sortableInstances.push(instance);
    });
}

function deleteBookmark(e, index) {
    e.stopPropagation();
    if (confirm('确定删除这个书签吗？')) {
        bookmarks.splice(index, 1);
        render();
    }
}

function exportConfig() {
    const dataStr = JSON.stringify(bookmarks, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = "bookmarks.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}