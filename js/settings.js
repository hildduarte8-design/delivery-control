// js/settings.js

function loadSettingsUI() {
    const settings = DB.load('dly_settings', { storeName: '', phone: '', password: '' });
    
    const nameEl = document.getElementById('cfg_store_name');
    const phoneEl = document.getElementById('cfg_phone');
    const passEl = document.getElementById('cfg_password');

    if (nameEl) nameEl.value = settings.storeName || '';
    if (phoneEl) phoneEl.value = settings.phone || '';
    if (passEl) passEl.value = settings.password || '';
}

async function saveSettings() {
    const storeName = document.getElementById('cfg_store_name')?.value.trim() || '';
    let rawPhone = document.getElementById('cfg_phone')?.value.replace(/\D/g, '') || '';
    const password = document.getElementById('cfg_password')?.value.trim() || '';

    // Se a pessoa digitou 55 no início do DDD, ajusta para salvar apenas o DDD + Número
    if (rawPhone.startsWith('55') && rawPhone.length > 11) {
        rawPhone = rawPhone.slice(2);
    }

    if (!storeName) {
        showToast('Informe o nome da loja', 'error');
        return;
    }
    
    if (rawPhone.length < 10 || rawPhone.length > 11) {
        showToast('Informe um WhatsApp válido com DDD (Ex: 33999999999)', 'error');
        return;
    }

    const updated = {
        storeName,
        phone: rawPhone,
        password
    };

    // 1. Salva na memória do navegador (offline)
    DB.save('dly_settings', updated);
    state.settings = updated;

    // 2. Salva permanentemente no Supabase (Nuvem)
    try {
        if (typeof dbClient !== 'undefined') {
            await dbClient.from('store_settings').upsert({
                id: 1,
                store_name: storeName,
                phone: rawPhone,
                password: password,
                updated_at: new Date().toISOString()
            });
        }
    } catch (e) {
        console.error('Erro ao sincronizar configurações com o Supabase:', e);
    }

    showToast('Configurações salvas com sucesso!');
}

// Garante o carregamento automático dos dados nos campos ao abrir o app e ao clicar na aba
document.addEventListener('DOMContentLoaded', () => {
    loadSettingsUI();
    document.querySelector('.bottom-nav button[data-tab="settings"]')?.addEventListener('click', loadSettingsUI);
});
