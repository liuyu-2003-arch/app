// 在 js/auth.js 末尾添加
export async function savePreferences() {
    const sb = getSupabase();
    if (!sb || !state.currentUser) return;

    if (state.prefAvatarUrl && state.prefAvatarUrl.length > 20000) {
        showToast(t("msg_img_too_large"), "error");
        return;
    }

    const name = document.getElementById('pref-name').value;
    const phone = document.getElementById('pref-phone').value;

    const updates = {
        data: {
            full_name: name,
            phone_number: phone,
            avatar_url: state.prefAvatarUrl
        }
    };

    const btn = document.querySelector('#pref-modal .primary');
    if(btn) {
        btn.textContent = 'Saving...';
        btn.disabled = true;
    }

    try {
        const { data, error } = await sb.auth.updateUser(updates);
        if (error) throw error;

        // 刷新 Session
        const { data: refreshData } = await sb.auth.refreshSession();
        updateUserStatus(refreshData.user || data.user);

        showToast(t("msg_save_success"), "success");
        document.getElementById('pref-modal').classList.add('hidden');
    } catch (e) {
        showToast(e.message, "error");
    } finally {
        if(btn) {
            btn.textContent = t('btn_save') || 'Save';
            btn.disabled = false;
        }
    }
}