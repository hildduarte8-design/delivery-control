// js/settings.js - Configurações da Loja, Identidade Visual, GPS e Senha

function applyDynamicTheme(color) {
    if (!color) return;
    document.documentElement.style.setProperty('--primary-color', color);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', color);
}

if (typeof window.applyThemeColor === 'undefined') {
    window.applyThemeColor = applyDynamicTheme;
}

function loadSettingsUI() {
    const settings = (typeof DB !== 'undefined' && DB.load) 
        ? DB.load('dly_settings', { storeName: '', phone: '', password: '', pixKey: '', storeLat: '', storeLon: '', logoUrl: '', primaryColor: '#FF6B35' })
        : { storeName: '', phone: '', password: '', pixKey: '', storeLat: '', storeLon: '', logoUrl: '', primaryColor: '#FF6B35' };
    
    const nameEl = document.getElementById('cfg_store_name');
    const phoneEl = document.getElementById('cfg_phone');
    const passEl = document.getElementById('cfg_password');
    const pixEl = document.getElementById('cfg_pix_key');
    const latEl = document.getElementById('cfg_store_lat');
    const lonEl = document.getElementById('cfg_store_lon');
    const logoEl = document.getElementById('cfg_logo_url');
    const colorPicker = document.getElementById('cfg_primary_color');
    const colorHex = document.getElementById('cfg_color_hex');
    const btnGps = document.getElementById('btn_store_gps');

    if (nameEl) nameEl.value = settings.storeName || settings.store_name || '';
    if (phoneEl) phoneEl.value = settings.phone || '';
    if (passEl) passEl.value = settings.password || '';
    if (pixEl) pixEl.value = settings.pixKey || settings.pix_key || '';
    if (latEl) latEl.value = settings.storeLat || '';
    if (lonEl) lonEl.value = settings.storeLon || '';
    if (logoEl) logoEl.value = settings.logoUrl || settings.logo_url || '';

    const activeColor = settings.primaryColor || settings.primary_color || '#FF6B35';

    if (colorPicker && colorHex) {
        colorPicker.value = activeColor;
        colorHex.value = activeColor;
        colorPicker.oninput = (e) => {
            colorHex.value = e.target.value;
            applyDynamicTheme(e.target.value);
        };
        colorHex.oninput = (e) => {
            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                colorPicker.value = e.target.value;
                applyDynamicTheme(e.target.value);
            }
        };
    }

    if (btnGps && settings.storeLat) {
        btnGps.textContent = "✅ Localização da Loja Gravada!";
        btnGps.style.background = "#10B981";
    }

    applyDynamicTheme(activeColor);
}

function getStoreGPS() {
    if (!navigator.geolocation) {
        if (typeof showToast === 'function') showToast('Seu navegador não suporta GPS', 'error');
        return;
    }
    const btn = document.getElementById('btn_store_gps');
    if (btn) btn.textContent = '⌛ Capturando posição da loja...';

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const latEl = document.getElementById('cfg_store_lat');
            const lonEl = document.getElementById('cfg_store_lon');
            if (latEl) latEl.value = pos.coords.latitude;
            if (lonEl) lonEl.value = pos.coords.longitude;

            if (btn) {
                btn.textContent = '✅ Localização da Loja Capturada!';
                btn.style.background = '#10B981';
            }
            if (typeof showToast === 'function') showToast('GPS capturado! Clique em Salvar para gravar.');
        },
        () => {
            if (btn) btn.textContent = '📍 Capturar GPS Atual da Loja';
            if (typeof showToast === 'function') showToast('Erro ao obter sinal do GPS.', 'error');
        },
        { enableHighAccuracy: true }
    );
}

async function uploadStoreLogo(file) {
    try {
        if (typeof dbClient === 'undefined') return null;
        const fileExt = file.name.split('.').pop();
        const fileName = `logo_${Date.now()}.${fileExt}`;
        const filePath = `store/${fileName}`;

        const { error } = await dbClient.storage
            .from('product-images')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (error) {
            console.error('Erro no upload do logo:', error);
            return null;
        }

        const { data: publicUrlData } = dbClient.storage
            .from('product-images')
            .getPublicUrl(filePath);

        return publicUrlData.publicUrl;
    } catch (e) {
        console.error('Erro ao enviar logo:', e);
        return null;
    }
}

async function saveSettings() {
    const storeName = document.getElementById('cfg_store_name')?.value.trim() || '';
    let rawPhone = document.getElementById('cfg_phone')?.value.replace(/\D/g, '') || '';
    const password = document.getElementById('cfg_password')?.value.trim() || '';
    const pixKey = document.getElementById('cfg_pix_key')?.value.trim() || '';
    const storeLat = document.getElementById('cfg_store_lat')?.value || '';
    const storeLon = document.getElementById('cfg_store_lon')?.value || '';
    let logoUrl = document.getElementById('cfg_logo_url')?.value.trim() || '';
    const logoFileInput = document.getElementById('cfg_logo_file');
    const primaryColor = document.getElementById('cfg_primary_color')?.value || '#FF6B35';

    if (rawPhone.startsWith('55') && rawPhone.length > 11) rawPhone = rawPhone.slice(2);

    if (!storeName) {
        if (typeof showToast === 'function') showToast('Informe o nome da loja', 'error');
        return;
    }
    if (rawPhone.length < 10 || rawPhone.length > 11) {
        if (typeof showToast === 'function') showToast('Informe um WhatsApp válido com DDD', 'error');
        return;
    }

    if (logoFileInput && logoFileInput.files && logoFileInput.files.length > 0) {
        if (typeof showToast === 'function') showToast('⌛ Enviando logo da loja...');
        const uploadedLogo = await uploadStoreLogo(logoFileInput.files[0]);
        if (uploadedLogo) {
            logoUrl = uploadedLogo;
            const logoUrlInput = document.getElementById('cfg_logo_url');
            if (logoUrlInput) logoUrlInput.value = logoUrl;
        }
    }

    const updated = { storeName, phone: rawPhone, password, pixKey, storeLat, storeLon, logoUrl, primaryColor };
    if (typeof DB !== 'undefined' && DB.save) DB.save('dly_settings', updated);
    if (typeof state !== 'undefined') state.settings = updated;

    applyDynamicTheme(primaryColor);

    try {
        if (typeof dbClient !== 'undefined') {
            await dbClient.from('store_settings').upsert({
                id: 1,
                store_name: storeName,
                phone: rawPhone,
                password: password,
                pix_key: pixKey,
                logo_url: logoUrl,
                primary_color: primaryColor,
                updated_at: new Date().toISOString()
            });
        }
    } catch (e) {
        console.error('Erro ao salvar no Supabase:', e);
    }

    if (typeof showToast === 'function') showToast('Configurações salvas!');
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof loadSettingsUI === 'function') loadSettingsUI();
    document.querySelector('.bottom-nav button[data-tab="settings"]')?.addEventListener('click', loadSettingsUI);
});
