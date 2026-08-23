// js/settings.js - Configurações da Loja, Identidade Visual e Gestão do Cardápio

function applyDynamicTheme(color) {
    if (!color) return;
    document.documentElement.style.setProperty('--primary-color', color);
}

function loadSettingsUI() {
    const settings = DB.load('dly_settings', { 
        storeName: '', 
        phone: '', 
        password: '', 
        storeLat: '', 
        storeLon: '',
        logoUrl: '',
        primaryColor: '#FF6B35'
    });
    
    const nameEl = document.getElementById('cfg_store_name');
    const phoneEl = document.getElementById('cfg_phone');
    const passEl = document.getElementById('cfg_password');
    const latEl = document.getElementById('cfg_store_lat');
    const lonEl = document.getElementById('cfg_store_lon');
    const logoEl = document.getElementById('cfg_logo_url');
    const colorPicker = document.getElementById('cfg_primary_color');
    const colorHex = document.getElementById('cfg_color_hex');
    const btnGps = document.getElementById('btn_store_gps');

    if (nameEl) nameEl.value = settings.storeName || '';
    if (phoneEl) phoneEl.value = settings.phone || '';
    if (passEl) passEl.value = settings.password || '';
    if (latEl) latEl.value = settings.storeLat || '';
    if (lonEl) lonEl.value = settings.storeLon || '';
    if (logoEl) logoEl.value = settings.logoUrl || '';

    if (colorPicker && colorHex) {
        colorPicker.value = settings.primaryColor || '#FF6B35';
        colorHex.value = settings.primaryColor || '#FF6B35';
        colorPicker.oninput = (e) => {
            colorHex.value = e.target.value;
            applyDynamicTheme(e.target.value);
        };
    }

    if (btnGps && settings.storeLat) {
        btnGps.textContent = "✅ Localização da Loja Gravada!";
        btnGps.style.background = "#10B981";
    }

    applyDynamicTheme(settings.primaryColor);
    renderAdminProductsList();
}

function getStoreGPS() {
    if (!navigator.geolocation) {
        showToast('Seu navegador não suporta GPS', 'error');
        return;
    }
    const btn = document.getElementById('btn_store_gps');
    if (btn) btn.textContent = '⌛ Capturando posição da loja...';

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;

            const latEl = document.getElementById('cfg_store_lat');
            const lonEl = document.getElementById('cfg_store_lon');
            if (latEl) latEl.value = lat;
            if (lonEl) lonEl.value = lon;

            if (btn) {
                btn.textContent = '✅ Localização da Loja Capturada!';
                btn.style.background = '#10B981';
            }
            showToast('GPS da loja capturado! Lembre-se de clicar em Salvar.');
        },
        (err) => {
            if (btn) btn.textContent = '📍 Capturar GPS Atual da Loja';
            showToast('Erro ao obter sinal do GPS. Verifique a permissão.', 'error');
        },
        { enableHighAccuracy: true }
    );
}

async function saveSettings() {
    const storeName = document.getElementById('cfg_store_name')?.value.trim() || '';
    let rawPhone = document.getElementById('cfg_phone')?.value.replace(/\D/g, '') || '';
    const password = document.getElementById('cfg_password')?.value.trim() || '';
    const storeLat = document.getElementById('cfg_store_lat')?.value || '';
    const storeLon = document.getElementById('cfg_store_lon')?.value || '';
    const logoUrl = document.getElementById('cfg_logo_url')?.value.trim() || '';
    const primaryColor = document.getElementById('cfg_primary_color')?.value || '#FF6B35';

    if (rawPhone.startsWith('55') && rawPhone.length > 11) {
        rawPhone = rawPhone.slice(2);
    }

    if (!storeName) {
        showToast('Informe o nome da loja', 'error');
        return;
    }
    
    if (rawPhone.length < 10 || rawPhone.length > 11) {
        showToast('Informe um WhatsApp válido com DDD', 'error');
        return;
    }

    const updated = {
        storeName,
        phone: rawPhone,
        password,
        storeLat,
        storeLon,
        logoUrl,
        primaryColor
    };

    DB.save('dly_settings', updated);
    if (typeof state !== 'undefined') state.settings = updated;

    try {
        if (typeof dbClient !== 'undefined') {
            await dbClient.from('store_settings').upsert({
                id: 1,
                store_name: storeName,
                phone: rawPhone,
                password: password,
                logo_url: logoUrl,
                primary_color: primaryColor,
                updated_at: new Date().toISOString()
            });
        }
    } catch (e) {
        console.error('Erro ao salvar no Supabase:', e);
    }

    showToast('Configurações e marca salvas!');
}

// --- GESTÃO DE PRATOS DO CARDÁPIO (LISTAR / LIGA / DESLIGA / NOVO) ---

async function renderAdminProductsList() {
    const container = document.getElementById('admin-products-list');
    if (!container) return;

    try {
        if (typeof dbClient === 'undefined') return;

        const { data: products, error } = await dbClient
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error || !products || products.length === 0) {
            container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px; font-size:13px;">Nenhum prato cadastrado no momento.</div>';
            return;
        }

        container.innerHTML = products.map(p => `
            <div class="card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:12px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    ${p.image_url ? `<img src="${p.image_url}" style="width:44px; height:44px; border-radius:10px; object-fit:cover;">` : '<span style="font-size:24px;">🍽️</span>'}
                    <div>
                        <div style="font-weight:700; color:#F1F5F9; font-size:14px;">${p.name}</div>
                        <div style="font-size:12px; color:#FF6B35; font-weight:600;">R$ ${Number(p.price).toFixed(2)}</div>
                    </div>
                </div>
                <button class="btn btn-sm ${p.is_active ? 'btn-success' : 'btn-danger'}" onclick="toggleProductActive('${p.id}', ${!p.is_active})" style="width:auto; padding:6px 12px; font-size:12px;">
                    ${p.is_active ? '🟢 Ativo' : '🔴 Pausado'}
                </button>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px; font-size:13px;">Erro ao carregar cardápio.</div>';
    }
}

async function toggleProductActive(id, newStatus) {
    try {
        if (typeof dbClient !== 'undefined') {
            await dbClient.from('products').update({ is_active: newStatus }).eq('id', id);
            showToast(newStatus ? 'Prato ativado!' : 'Prato pausado!');
            renderAdminProductsList();
        }
    } catch (e) {
        showToast('Erro ao alterar status do prato', 'error');
    }
}

function openNewProductModal() {
    if (typeof openModal !== 'function') return;

    openModal('🍔 Novo Prato', `
        <div class="form-group">
            <label>Nome do Prato *</label>
            <input type="text" id="prd_name" placeholder="Ex: Marmita Executiva">
        </div>
        <div class="form-group">
            <label>Preço (R$) *</label>
            <input type="number" step="0.01" id="prd_price" placeholder="20.00">
        </div>
        <div class="form-group">
            <label>Descrição</label>
            <textarea id="prd_desc" placeholder="Ingredientes e detalhes do prato..."></textarea>
        </div>
        <div class="form-group">
            <label>URL da Foto (Opcional)</label>
            <input type="text" id="prd_img" placeholder="https://link-da-foto.com/imagem.jpg">
        </div>
        <button class="btn btn-large" onclick="saveNewProduct()">Salvar no Cardápio</button>
    `);
}

async function saveNewProduct() {
    const name = document.getElementById('prd_name')?.value.trim();
    const price = Number(document.getElementById('prd_price')?.value || 0);
    const description = document.getElementById('prd_desc')?.value.trim() || '';
    const image_url = document.getElementById('prd_img')?.value.trim() || '';

    if (!name || price <= 0) {
        showToast('Preencha o nome e um preço válido!', 'error');
        return;
    }

    try {
        if (typeof dbClient !== 'undefined') {
            await dbClient.from('products').insert([{ 
                name, 
                price, 
                description, 
                image_url, 
                is_active: true 
            }]);
            
            if (typeof closeModal === 'function') closeModal();
            showToast('Prato adicionado com sucesso!');
            renderAdminProductsList();
        }
    } catch (e) {
        showToast('Erro ao salvar produto no banco', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadSettingsUI();
    document.querySelector('.bottom-nav button[data-tab="settings"]')?.addEventListener('click', loadSettingsUI);
});
