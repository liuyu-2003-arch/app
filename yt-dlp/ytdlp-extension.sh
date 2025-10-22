#!/usr/bin/env bash
set -e

EXT_DIR="$HOME/Documents/ytdlp-extension"
echo "正在创建扩展到：$EXT_DIR"
mkdir -p "$EXT_DIR"

# manifest.json
cat > "$EXT_DIR/manifest.json" <<'EOF'
{
  "manifest_version": 3,
  "name": "YT / Bili yt-dlp helper",
  "version": "1.0",
  "description": "在 YouTube 与 Bilibili 视频页右下角显示下载按钮，点击复制 yt-dlp 命令到剪贴板（不自动下载）。",
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "permissions": [
    "scripting",
    "clipboardWrite",
    "activeTab"
  ],
  "host_permissions": [
    "*://*.youtube.com/*",
    "*://*.bilibili.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "*://*.youtube.com/*",
        "*://*.bilibili.com/*"
      ],
      "js": ["content.js"],
      "css": ["styles.css"]
    }
  ]
}
EOF

# content.js
cat > "$EXT_DIR/content.js" <<'EOF'
/*
  content.js
  - 在页面右下角注入按钮组件
  - 点击后将 yt-dlp 命令复制到剪贴板
  - 适配 YouTube / Bilibili 的典型页 URL / 标题抽取
*/

(function () {
  if (window._ytb_helper_injected) return;
  window._ytb_helper_injected = true;

  const container = document.createElement('div');
  container.id = 'ytb-helper-root';
  document.documentElement.appendChild(container);

  container.innerHTML = `
    <div id="ytb-hotspot" title="下载工具（移入显示）"></div>
    <div id="ytb-widget" aria-hidden="true">
      <div id="ytb-buttons" class="">
        <button class="ytb-btn ytb-video" data-type="video" title="视频下载">
          <svg viewBox="0 0 24 24" class="ytb-ic"><path d="M10 8v8l6-4z"/></svg>
        </button>
        <button class="ytb-btn ytb-audio" data-type="audio" title="音频下载">
          <svg viewBox="0 0 24 24" class="ytb-ic"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>
        </button>
        <button class="ytb-btn ytb-sub" data-type="subtitles" title="字幕下载">
          <svg viewBox="0 0 24 24" class="ytb-ic"><path d="M21 6H3v9h14l4 4V6z"/></svg>
        </button>
      </div>
      <div id="ytb-toast" class="hidden">已复制</div>
    </div>
  `;

  // Helper: extract URL and title in a robust-ish way
  function getVideoInfo() {
    const url = location.href;
    // title fallback
    let title = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
      || document.title || '';
    title = title.replace(/\s+[-|]\s+YouTube.*$/i, '').trim();
    title = title.replace(/\s+[-|]\s+哔哩哔哩.*$/i, '').trim();
    // sanitize filename-ish
    const safeTitle = title.replace(/[\/\\?%*:|"<>]/g, '-').trim();
    return { url, title: title || safeTitle || 'video' , safeTitle: safeTitle || 'video' };
  }

  function buildCommand(type) {
    const { url, safeTitle } = getVideoInfo();
    // output path into 文稿/Downloads（可以按需修改）
    const output = `"${HOME_REPL}/Documents/yt-dl-downloads/%(title)s.%(ext)s"`;
    // We'll substitute HOME_REPL later in runtime; content scripts can't access shell env,
    // so put a sensible default using ~ expansion handled by user when pasting.
    const outputUser = `"${encodeURIComponent(safeTitle)}.%(ext)s"`;
    let cmd = '';
    if (type === 'video') {
      cmd = `yt-dlp -f "bestvideo+bestaudio/best" --merge-output-format mp4 -o "~/Documents/yt-dl-downloads/%(title)s.%(ext)s" "${url}"`;
    } else if (type === 'audio') {
      cmd = `yt-dlp -f bestaudio --extract-audio --audio-format mp3 -o "~/Documents/yt-dl-downloads/%(title)s.%(ext)s" "${url}"`;
    } else if (type === 'subtitles') {
      cmd = `yt-dlp --write-subs --write-auto-sub --sub-lang "en,zh-Hans,zh" -o "~/Documents/yt-dl-downloads/%(title)s.%(ext)s" "${url}"`;
    }
    return cmd;
  }

  // copy to clipboard (with fallback)
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // fallback by creating textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      } catch (err) {
        document.body.removeChild(ta);
        return false;
      }
    }
  }

  const HOME_REPL = (function(){
    try {
      // attempt to approximate home dir for nice commands; content script cannot access env,
      // but "~" is fine for most terminals. Keep "~" to be safe.
      return '~';
    } catch (e) { return '~'; }
  })();

  const btns = container.querySelectorAll('.ytb-btn');
  const toast = container.querySelector('#ytb-toast');
  const widget = container.querySelector('#ytb-widget');
  const hotspot = container.querySelector('#ytb-hotspot');
  let toastTimeout = null;

  function showToast(msg) {
    if (toastTimeout) clearTimeout(toastTimeout);
    toast.textContent = msg || '已复制';
    toast.classList.remove('hidden');
    toast.classList.add('visible');
    toastTimeout = setTimeout(()=> {
      toast.classList.remove('visible');
      toast.classList.add('hidden');
    }, 1600);
  }

  btns.forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const type = btn.dataset.type;
      const cmd = buildCommand(type);
      // animate: add clicked class to container
      widget.classList.add('clicked');
      btn.classList.add('active');

      // animate siblings to merge toward clicked (we'll use CSS transitions)
      btns.forEach(b => { if (b !== btn) b.classList.add('merge'); });

      // copy command
      const ok = await copyText(cmd);
      showToast(ok ? '命令已复制到剪贴板' : '复制失败，请手动复制');

      // restore after a short delay
      setTimeout(() => {
        widget.classList.remove('clicked');
        btn.classList.remove('active');
        btns.forEach(b => { b.classList.remove('merge'); });
      }, 900);
    });
  });

  // hotspot mouseenter -> show widget; mouseleave -> hide after delay
  let hideTimer = null;
  hotspot.addEventListener('mouseenter', () => {
    widget.setAttribute('aria-hidden', 'false');
    widget.classList.add('visible');
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  });
  hotspot.addEventListener('mouseleave', () => {
    hideTimer = setTimeout(()=> {
      widget.classList.remove('visible');
      widget.setAttribute('aria-hidden', 'true');
    }, 500);
  });

  // also hide when mouse leaves the whole widget
  widget.addEventListener('mouseleave', () => {
    hideTimer = setTimeout(()=> {
      widget.classList.remove('visible');
      widget.setAttribute('aria-hidden', 'true');
    }, 500);
  });
  widget.addEventListener('mouseenter', () => {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    widget.classList.add('visible');
  });

  // small accessibility: show when pressing Ctrl+Shift+Y
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'y') {
      const vis = widget.classList.contains('visible');
      if (vis) {
        widget.classList.remove('visible'); widget.setAttribute('aria-hidden','true');
      } else {
        widget.classList.add('visible'); widget.setAttribute('aria-hidden','false');
      }
    }
  });

  // initial style tweak for certain pages that may overlap
  document.documentElement.style.setProperty('--ytb-helper-z', '99999');

})();
EOF

# styles.css
cat > "$EXT_DIR/styles.css" <<'EOF'
/* styles.css - 控制右下角的 UI、渐变与动效 */
#ytb-helper-root { all: initial; position: fixed; z-index: 99999; right: 24px; bottom: 24px; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; pointer-events: none; }

#ytb-hotspot {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 72px;
  height: 72px;
  border-radius: 14px;
  /* hotspot 透明但更容易触发 hover */
  background: transparent;
  pointer-events: auto;
  transition: background 200ms;
}

/* the visible widget */
#ytb-widget {
  position: fixed;
  right: 28px;
  bottom: 28px;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  transform-origin: 100% 100%;
  transition: opacity 280ms ease, transform 300ms cubic-bezier(.2,.9,.25,1);
  opacity: 0;
  transform: translateY(8px) scale(.98);
}

/* when visible */
#ytb-widget.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* buttons container */
#ytb-buttons {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(6px);
  border-radius: 999px;
  box-shadow: 0 10px 30px rgba(12,18,30,0.18);
  border: 1px solid rgba(0,0,0,0.06);
  transition: transform 280ms cubic-bezier(.2,.9,.25,1), opacity 240ms;
}

/* individual button */
.ytb-btn {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: linear-gradient(180deg,#ffffff,#f7f7fb);
  box-shadow: 0 6px 14px rgba(13,20,40,0.08), inset 0 -1px 0 rgba(0,0,0,0.03);
  transition: transform 220ms cubic-bezier(.2,.9,.25,1), box-shadow 160ms;
  outline: none;
  padding: 0;
}

/* icon size */
.ytb-ic { width: 20px; height: 20px; display:block; fill: #243447; opacity: .95; }

/* hover / active */
.ytb-btn:hover { transform: translateY(-6%) scale(1.04); box-shadow: 0 10px 20px rgba(12,18,30,0.12); }
.ytb-btn.active { transform: scale(1.12); box-shadow: 0 18px 30px rgba(25,40,60,0.16); }

/* merge animation: when a non-clicked button gets merge class, it will slide to center and fade */
.ytb-btn.merge {
  transform: translateY(0) scale(0.6);
  opacity: 0;
  transition: transform 360ms cubic-bezier(.2,.9,.25,1), opacity 300ms;
}

/* clicked container effect */
#ytb-widget.clicked #ytb-buttons {
  transform: scale(0.98);
}

/* toast */
#ytb-toast {
  margin-right: 12px;
  padding: 8px 12px;
  background: #0b76ff;
  color: white;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 8px 22px rgba(11,118,255,0.18);
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 240ms, transform 260ms;
  pointer-events: none;
  white-space: nowrap;
}

#ytb-toast.visible {
  opacity: 1;
  transform: translateY(0);
}

#ytb-toast.hidden {
  opacity: 0;
}

/* small responsive tweak */
@media (max-width: 640px) {
  #ytb-hotspot { width: 64px; height:64px; right: 16px; bottom: 16px; }
  #ytb-widget { right: 18px; bottom: 18px; }
  .ytb-btn { width: 40px; height: 40px; }
}
EOF

# icons (simple SVG -> PNG fallback). We'll write small PNG placeholders using base64-encoded 1x1 PNG? better to include small SVG files as .png via converting — but conversion not available.
# Instead include tiny PNG placeholders (transparent) and also include SVG icons as png is optional for Chrome but nice to have.
mkdir -p "$EXT_DIR/icons"

# write simple SVGs as PNG-like .png via data URL isn't necessary; we'll add .png placeholder files (small)
# Create a 1x1 transparent PNG via base64
cat > "$EXT_DIR/icons/icon-16.png" <<'PNG_BASE64'
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX///+nxBvIAAAACklEQVQI12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==
PNG_BASE64

cat > "$EXT_DIR/icons/icon-48.png" <<'PNG_BASE64'
iVBORw0KGgoAAAANSUhEUgAAADAAAAAwAQMAAAD3b3FjAAAABlBMVEX////MzMy8vLxJc1+UAAAAAXRSTlMAQObYZgAAABxJREFUeNpjYBgFo2AUjIJRMAoGAAAZAAHnQtgGAAAAAElFTkSuQmCC
PNG_BASE64

cat > "$EXT_DIR/icons/icon-128.png" <<'PNG_BASE64'
iVBORw0KGgoAAAANSUhEUgAAACAAAAAgAQMAAABi6f5SAAAABlBMVEX////MzMy8vLxJc1+UAAAAAXRSTlMAQObYZgAAABhJREFUeNpjYBgFo2AUIAAzYgAAABAAEAG3g+7WwAAAABJRU5ErkJggg==
PNG_BASE64

# Create a README to explain how to load and a note about yt-dlp path
cat > "$EXT_DIR/README.md" <<'EOF'
YT / Bili yt-dlp helper — 使用说明
---------------------------------

已生成扩展文件，路径：
  ~/Documents/ytlp-extension

如何使用：
1. 在终端运行本脚本后，打开 Chrome -> 扩展程序 -> 开发者模式 -> 加载已解压的扩展，选择上面的目录。
2. 进入 YouTube 或 Bilibili 的视频页面，鼠标移到右下角（页面右下）会出现三个按钮：视频 / 音频 / 字幕。
3. 点击按钮会把相应的 yt-dlp 命令复制到剪贴板（不会自动运行）。
   例如：
     yt-dlp -f "bestvideo+bestaudio/best" --merge-output-format mp4 -o "~/Documents/yt-dl-downloads/%(title)s.%(ext)s" "https://..."
4. 建议你在终端里先确保安装 yt-dlp：pip install -U yt-dlp 或使用系统包管理器。
5. 默认输出路径为：~/Documents/yt-dl-downloads ，你可以修改 content.js 中的命令模板以改动路径或格式。

注意：
- 扩展仅复制命令到剪贴板，出于安全考虑不会自动执行或直接下载。
- 若需把生成的命令自动运行，请在本地创建并使用自己的脚本执行（谨慎）。
EOF

# Make sure files saved and permissions set
chmod -R 644 "$EXT_DIR" || true
chmod 755 "$EXT_DIR" || true

echo "生成完成：$EXT_DIR"
echo ""
echo "下一步：在 Chrome 扩展页面启用开发者模式，然后 '加载已解压的扩展程序'，选择：$EXT_DIR"
echo "扩展会在 YouTube / Bilibili 视频页右下角显示（将鼠标移到右下区域以出现）。"
