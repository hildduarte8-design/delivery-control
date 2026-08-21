function loadSettingsUI() {
    const settings = DB.load('dly_settings', { storeName: '', phone: '' });
    document.getElementById('cfg_store_name').value = settings.storeName || '';
    document.getElementById('cfg_phone').value = settings.phone || '';
}

function saveSettings() {
    const storeName = document.getElementById('cfg_store_name').value.trim();
    const rawPhone = document.getElementById('cfg_phone').value.replace(/\D/g, '');

    if (!storeName) {
        showToast('Informe o nome da loja', 'error');
        return;
    }
    if (rawPhone.length < 10) {
        showToast('Informe um número válido com DDD', 'error');
        return;
    }

    const current = DB.load('dly_settings', {});
    const updated = {
        ...current,
        storeName,
        phone: rawPhone
    };

    DB.save('dly_settings', updated);
    state.settings = updated;
    showToast('Configurações salvas!');
}

// Carregar os dados ao abrir a aba
document.querySelector('.bottom-nav button[data-tab="settings"]')?.addEventListener('click', loadSettingsUI);
