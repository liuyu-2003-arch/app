import { CONFIG } from './config.js';
import { state } from './state.js';
import { generateUniqueId, updateSyncStatus, showToast, t } from './utils.js'; // 引入缺失的工具
import { render } from './ui.js';

// ... (保留之前的 initSupabase, getSupabase, loadData, saveData) ...

// --- 📂 新增：导入/导出功能 ---
export function exportConfig() {
    const dataStr = JSON.stringify(state.pages, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "homepage_config.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function importConfig() {
    document.getElementById('import-file-input').click();
}

export function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let importedData = JSON.parse(e.target.result);
            // 简单的迁移逻辑
            if (Array.isArray(importedData) && (importedData.length === 0 || importedData[0].hasOwnProperty('bookmarks'))) {
                state.pages = importedData;
            } else {
                state.pages = migrateData(importedData);
            }
            state.pages = ensureBookmarkIds(state.pages);
            saveData();
            render();
            showToast(t('msg_import_success'), "success");
        } catch (err) {
            showToast(t('msg_import_fail'), "error");
        }
    };
    reader.readAsText(file);
}

// ... (保留 ensureBookmarkIds 和 migrateData) ...