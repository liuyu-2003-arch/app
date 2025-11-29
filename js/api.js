import { CONFIG } from './config.js';
import { state } from './state.js';
import { generateUniqueId, updateSyncStatus } from './utils.js';
import { render } from './ui.js';

let supabaseClient = null;

export function initSupabase() {
    if (window.supabase && window.supabase.createClient) {
        try {
            supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        } catch (e) {
            console.error("Supabase Init Error", e);
        }
    }
    return supabaseClient;
}

export function getSupabase() {
    return supabaseClient;
}

export async function loadData() {
    const storedData = localStorage.getItem('pagedData');
    if (storedData) {
        state.pages = JSON.parse(storedData);
        render();
        document.body.style.visibility = 'visible';
    } else {
        try {
            const response = await fetch('homepage_config.json');
            if (response.ok) {
                const data = await response.json();
                state.pages = migrateData(data);
                state.pages = ensureBookmarkIds(state.pages);
                render();
            }
        } catch (e) { console.error(e); }
    }

    if (state.currentUser && supabaseClient) {
        try {
            const { data } = await supabaseClient
                .from('user_configs')
                .select('config_data')
                .eq('user_id', state.currentUser.id)
                .maybeSingle();

            if (data && data.config_data) {
                state.pages = ensureBookmarkIds(data.config_data);
                localStorage.setItem('pagedData', JSON.stringify(state.pages));
                render();
            }
        } catch (e) { console.error("Cloud load error", e); }
    }
    document.body.style.visibility = 'visible';
}

export async function saveData() {
    localStorage.setItem('pagedData', JSON.stringify(state.pages));

    if (state.currentUser && supabaseClient) {
        updateSyncStatus('saving');
        try {
            const { error } = await supabaseClient
                .from('user_configs')
                .upsert({
                    user_id: state.currentUser.id,
                    config_data: state.pages,
                    updated_at: new Date()
                }, { onConflict: 'user_id' });

            if (error) throw error;
            updateSyncStatus('saved');
        } catch (e) {
            console.error("Cloud save fail", e);
            updateSyncStatus('error');
        }
    }
}

function ensureBookmarkIds(pages) {
    if (!Array.isArray(pages)) return [];
    pages.forEach(page => {
        if(page.bookmarks) page.bookmarks.forEach(b => { if (!b.id) b.id = generateUniqueId(); });
    });
    return pages;
}

function migrateData(oldData) {
    const itemsPerPage = 32; const newPages = [];
    const pageTitles = oldData.pageTitles || ["Page 1", "Page 2", "Page 3"];
    let bookmarks = oldData.bookmarks || oldData;
    if (!Array.isArray(bookmarks)) bookmarks = [];
    if (bookmarks.length === 0 && !oldData.bookmarks && !Array.isArray(oldData)) return [];
    // 如果已经是新格式（数组且包含bookmarks字段），直接返回
    if (Array.isArray(oldData) && oldData.length > 0 && oldData[0].bookmarks) return oldData;

    const totalPages = Math.max(pageTitles.length, Math.ceil(bookmarks.length / itemsPerPage));
    for (let i = 0; i < totalPages; i++) {
        newPages.push({
            title: pageTitles[i] || `Page ${i+1}`,
            bookmarks: bookmarks.slice(i * itemsPerPage, (i + 1) * itemsPerPage)
        });
    }
    return ensureBookmarkIds(newPages);
}