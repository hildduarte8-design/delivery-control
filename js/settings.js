// js/settings.js - Configurações, Identidade Visual, Validações, Upload, Reordenação, Cross-Sell e PDF

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

// --- GESTÃO DE PRATOS, REORDENAÇÃO, UPLOAD E CROSS-SELL ---

async function uploadProductImage(file) {
    try {
        if (typeof dbClient === 'undefined') return null;
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `dishes/${fileName}`;

        const { data, error } = await dbClient.storage
            .from('product-images')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (error) {
            console.error('Erro no upload da imagem:', error);
            return null;
        }

        const { data: publicUrlData } = dbClient.storage
            .from('product-images')
            .getPublicUrl(filePath);

        return publicUrlData.publicUrl;
    } catch (e) {
        console.error('Erro ao processar imagem:', e);
        return null;
    }
}

async function renderAdminProductsList() {
    const container = document.getElementById('admin-products-list');
    if (!container) return;

    try {
        if (typeof dbClient === 'undefined') return;

        const { data: products, error } = await dbClient
            .from('products')
            .select('*')
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (error || !products || products.length === 0) {
            container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px; font-size:13px;">Nenhum prato cadastrado no momento.</div>';
            return;
        }

        container.innerHTML = products.map((p, index) => {
            const discount = Number(p.discount_pct || 0);
            const originalPrice = Number(p.price);
            const finalPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;

            return `
                <div class="card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:10px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="reorder-btns">
                            <button class="btn-arrow" onclick="moveProductOrder('${p.id}', ${p.display_order || index}, -1)" title="Subir Posição">▲</button>
                            <button class="btn-arrow" onclick="moveProductOrder('${p.id}', ${p.display_order || index}, 1)" title="Descer Posição">▼</button>
                        </div>
                        ${p.image_url ? `<img src="${p.image_url}" style="width:42px; height:42px; border-radius:8px; object-fit:cover;">` : '<span style="font-size:22px;">🍽️</span>'}
                        <div>
                            <div style="font-weight:700; color:#F1F5F9; font-size:13px;">
                                ${p.name} ${p.is_cross_sell ? '<small style="color:#60A5FA;">[Cross-Sell]</small>' : ''}
                            </div>
                            <div style="font-size:12px; color:#FF6B35; font-weight:600;">
                                R$ ${finalPrice.toFixed(2)} ${discount > 0 ? `<small style="color:#EF4444;">(-${discount}%)</small>` : ''}
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-sm ${p.is_active ? 'btn-success' : 'btn-danger'}" onclick="toggleProductActive('${p.id}', ${!p.is_active})" style="width:auto; padding:6px 10px; font-size:11px;">
                        ${p.is_active ? '🟢 Ativo' : '🔴 Pausado'}
                    </button>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px; font-size:13px;">Erro ao carregar cardápio.</div>';
    }
}

async function moveProductOrder(id, currentOrder, direction) {
    try {
        const newOrder = currentOrder + direction;
        if (typeof dbClient !== 'undefined') {
            await dbClient.from('products').update({ display_order: newOrder }).eq('id', id);
            renderAdminProductsList();
        }
    } catch (e) {
        showToast('Erro ao reordenar prato', 'error');
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
            <label>Categoria *</label>
            <input type="text" id="prd_category" placeholder="Ex: Marmitas, Batatas, Bebidas, Sobremesas" list="cat_list">
            <datalist id="cat_list">
                <option value="Especialidades">
                <option value="Marmitas">
                <option value="Batatas Recheadas">
                <option value="Pastéis">
                <option value="Bebidas">
                <option value="Sobremesas">
            </datalist>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div class="form-group">
                <label>Preço (R$) *</label>
                <input type="number" step="0.01" id="prd_price" placeholder="20.00">
            </div>
            <div class="form-group">
                <label>Desconto (%)</label>
                <input type="number" id="prd_discount" placeholder="Ex: 10" min="0" max="100">
            </div>
        </div>
        <div class="form-group">
            <label>Descrição detalhada</label>
            <textarea id="prd_desc" placeholder="Ingredientes e detalhes do prato..."></textarea>
        </div>
        <div class="form-group">
            <label>Foto do Prato (Galeria/PC)</label>
            <input type="file" id="prd_file" accept="image/*" style="padding: 10px; font-size: 12px;">
        </div>
        <div class="form-group">
            <label>Ou Cole a URL da Foto (Opcional)</label>
            <input type="text" id="prd_img" placeholder="https://link-da-foto.com/imagem.jpg">
        </div>
        <div class="form-group" style="display:flex; align-items:center; gap:8px; margin-top:10px;">
            <input type="checkbox" id="prd_cross_sell" style="width:18px; height:18px;">
            <label for="prd_cross_sell" style="margin:0; font-size:12px; color:#F1F5F9;">Ofertar como Acompanhamento/Bebida (Cross-Sell)</label>
        </div>
        <button class="btn btn-large" id="btn_save_prd" onclick="saveNewProduct()" style="margin-top:10px;">Salvar no Cardápio</button>
    `);
}

async function saveNewProduct() {
    const name = document.getElementById('prd_name')?.value.trim();
    const category = document.getElementById('prd_category')?.value.trim() || 'Geral';
    const price = Number(document.getElementById('prd_price')?.value || 0);
    const discount_pct = Number(document.getElementById('prd_discount')?.value || 0);
    const description = document.getElementById('prd_desc')?.value.trim() || '';
    const urlInput = document.getElementById('prd_img')?.value.trim() || '';
    const is_cross_sell = document.getElementById('prd_cross_sell')?.checked || false;
    const fileInput = document.getElementById('prd_file');
    const saveBtn = document.getElementById('btn_save_prd');

    if (!name || price <= 0) {
        showToast('Preencha o nome e um preço válido!', 'error');
        return;
    }

    try {
        let imageUrl = urlInput;

        if (fileInput && fileInput.files.length > 0) {
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = '⌛ Enviando foto...';
            }

            const uploadedUrl = await uploadProductImage(fileInput.files[0]);
            if (uploadedUrl) {
                imageUrl = uploadedUrl;
            } else {
                showToast('Erro ao enviar foto. Verifique o bucket no Supabase.', 'error');
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Salvar no Cardápio';
                }
                return;
            }
        }

        if (typeof dbClient !== 'undefined') {
            const { error } = await dbClient.from('products').insert([{ 
                name, 
                category,
                price, 
                discount_pct, 
                description, 
                image_url: imageUrl, 
                is_cross_sell, 
                is_active: true 
            }]);

            if (error) {
                showToast('Erro ao salvar produto no banco', 'error');
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Salvar no Cardápio';
                }
                return;
            }

            if (typeof closeModal === 'function') closeModal();
            showToast('Prato adicionado com sucesso!');
            renderAdminProductsList();
        }
    } catch (e) {
        showToast('Erro inesperado ao salvar produto', 'error');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar no Cardápio';
        }
    }
}

        if (typeof dbClient !== 'undefined') {
            const { error } = await dbClient.from('products').insert([{ 
                name, 
                price, 
                discount_pct, 
                description, 
                image_url: imageUrl, 
                is_cross_sell, 
                is_active: true 
            }]);

            if (error) {
                showToast('Erro ao salvar produto no banco', 'error');
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Salvar no Cardápio';
                }
                return;
            }

            if (typeof closeModal === 'function') closeModal();
            showToast('Prato adicionado com sucesso!');
            renderAdminProductsList();
        }
    } catch (e) {
        showToast('Erro inesperado ao salvar produto', 'error');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar no Cardápio';
        }
    }
}

// --- EXPORTAR CARDÁPIO EM PDF PARA CLIENTES LEIGOS ---
async function exportMenuToPDF() {
    try {
        if (typeof dbClient === 'undefined') return showToast('Sem conexão com o banco', 'error');

        const { data: products } = await dbClient
            .from('products')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        const settings = DB.load('dly_settings', { storeName: 'Nosso Delivery' });

        const pdfWindow = window.open('', '_blank');
        if (!pdfWindow) return showToast('Permita pop-ups no navegador para gerar o PDF', 'error');

        const itemsHtml = (products || []).map(p => {
            const discount = Number(p.discount_pct || 0);
            const originalPrice = Number(p.price);
            const finalPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;

            return `
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:10px 0; align-items:center;">
                    <div>
                        <strong style="font-size:15px; color:#222;">${p.name}</strong><br>
                        <span style="font-size:12px; color:#666;">${p.description || ''}</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-weight:bold; font-size:15px; color:#e65100;">R$ ${finalPrice.toFixed(2)}</span>
                        ${discount > 0 ? `<br><s style="color:#999; font-size:11px;">R$ ${originalPrice.toFixed(2)}</s>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        pdfWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cardápio - ${settings.storeName}</title>
                <meta charset="UTF-8">
            </head>
            <body style="font-family: Arial, sans-serif; padding: 30px; max-width: 600px; margin: 0 auto; color: #333;">
                <h1 style="text-align:center; margin-bottom:4px; color:#111;">${settings.storeName.toUpperCase()}</h1>
                <p style="text-align:center; color:#777; font-size:13px; margin-bottom:24px;">Cardápio Oficial de Pedidos</p>
                ${itemsHtml}
                <div style="text-align:center; margin-top:30px; font-size:12px; color:#888;">
                    Faça seu pedido diretamente pelo nosso WhatsApp!
                </div>
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `);
        pdfWindow.document.close();
    } catch (e) {
        showToast('Erro ao gerar PDF do cardápio', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadSettingsUI();
    document.querySelector('.bottom-nav button[data-tab="settings"]')?.addEventListener('click', loadSettingsUI);
});
