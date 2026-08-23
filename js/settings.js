// js/settings.js - Configurações, Logo, Identidade Visual, Cardápio em PDF, Upload, Edição e Exclusão

function applyDynamicTheme(color) {
    if (!color) return;
    document.documentElement.style.setProperty('--primary-color', color);
}

function loadSettingsUI() {
    const settings = (typeof DB !== 'undefined' && DB.load) 
        ? DB.load('dly_settings', { storeName: '', phone: '', password: '', storeLat: '', storeLon: '', logoUrl: '', primaryColor: '#FF6B35' })
        : { storeName: '', phone: '', password: '', storeLat: '', storeLon: '', logoUrl: '', primaryColor: '#FF6B35' };
    
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
            if (typeof showToast === 'function') showToast('GPS da loja capturado! Lembre-se de clicar em Salvar.');
        },
        () => {
            if (btn) btn.textContent = '📍 Capturar GPS Atual da Loja';
            if (typeof showToast === 'function') showToast('Erro ao obter sinal do GPS. Verifique a permissão.', 'error');
        },
        { enableHighAccuracy: true }
    );
}

async function uploadProductImage(file) {
    try {
        if (typeof dbClient === 'undefined') return null;
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `dishes/${fileName}`;

        const { error } = await dbClient.storage
            .from('product-images')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (error) {
            console.error('Erro no upload:', error);
            return null;
        }

        const { data: publicUrlData } = dbClient.storage
            .from('product-images')
            .getPublicUrl(filePath);

        return publicUrlData.publicUrl;
    } catch (e) {
        console.error('Erro ao processar upload:', e);
        return null;
    }
}

async function saveSettings() {
    const storeName = document.getElementById('cfg_store_name')?.value.trim() || '';
    let rawPhone = document.getElementById('cfg_phone')?.value.replace(/\D/g, '') || '';
    const password = document.getElementById('cfg_password')?.value.trim() || '';
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
        const uploadedLogo = await uploadProductImage(logoFileInput.files[0]);
        if (uploadedLogo) {
            logoUrl = uploadedLogo;
            const logoUrlInput = document.getElementById('cfg_logo_url');
            if (logoUrlInput) logoUrlInput.value = logoUrl;
        }
    }

    const updated = { storeName, phone: rawPhone, password, storeLat, storeLon, logoUrl, primaryColor };
    if (typeof DB !== 'undefined' && DB.save) DB.save('dly_settings', updated);
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

    if (typeof showToast === 'function') showToast('Configurações e marca salvas!');
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

        window.currentAdminProducts = products;

        container.innerHTML = products.map((p, index) => {
            const discount = Number(p.discount_pct || 0);
            const originalPrice = Number(p.price);
            const finalPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;

            return `
                <div class="card" style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px; padding:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
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
                                <div style="font-size:11px; color:#94A3B8;">Cat: <strong>${p.category || 'Geral'}</strong></div>
                                <div style="font-size:12px; color:#FF6B35; font-weight:600;">
                                    R$ ${finalPrice.toFixed(2)} ${discount > 0 ? `<small style="color:#EF4444;">(-${discount}%)</small>` : ''}
                                </div>
                            </div>
                        </div>
                        <button class="btn btn-sm ${p.is_active ? 'btn-success' : 'btn-danger'}" onclick="toggleProductActive('${p.id}', ${!p.is_active})" style="width:auto; padding:4px 8px; font-size:11px;">
                            ${p.is_active ? '🟢 Ativo' : '🔴 Pausado'}
                        </button>
                    </div>
                    
                    <div style="display:flex; gap:6px; border-top:1px solid #334155; padding-top:8px; margin-top:2px;">
                        <button class="btn btn-sm btn-secondary" onclick="openProductModal('${p.id}')" style="flex:1; font-size:11px; padding:6px;">✏️ Editar</button>
                        <button class="btn btn-sm" onclick="deleteProduct('${p.id}', '${p.name.replace(/'/g, "\\'")}')" style="background:#EF4444; color:#fff; font-size:11px; padding:6px; width:auto;">🗑️ Excluir</button>
                    </div>
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
        if (typeof showToast === 'function') showToast('Erro ao reordenar prato', 'error');
    }
}

async function toggleProductActive(id, newStatus) {
    try {
        if (typeof dbClient !== 'undefined') {
            await dbClient.from('products').update({ is_active: newStatus }).eq('id', id);
            if (typeof showToast === 'function') showToast(newStatus ? 'Prato ativado!' : 'Prato pausado!');
            renderAdminProductsList();
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('Erro ao alterar status do prato', 'error');
    }
}

function openProductModal(productId = null) {
    if (typeof openModal !== 'function') return;

    let p = { name: '', category: 'Especialidades', price: '', discount_pct: '', description: '', image_url: '', is_cross_sell: false };
    let isEdit = false;

    if (productId && window.currentAdminProducts) {
        const found = window.currentAdminProducts.find(item => item.id === productId);
        if (found) {
            p = found;
            isEdit = true;
        }
    }

    const defaultCategories = ["Especialidades", "Marmitas", "Batatas Recheadas", "Pastéis", "Bebidas", "Sobremesas"];
    const customCategories = window.currentAdminProducts 
        ? window.currentAdminProducts.map(item => item.category).filter(Boolean)
        : [];
    
    const uniqueCategories = [...new Set([...defaultCategories, ...customCategories])];
    const categoryOptionsHtml = uniqueCategories.map(cat => `<option value="${cat}">`).join('');

    openModal(isEdit ? '✏️ Editar Prato' : '🍔 Novo Prato', `
        <input type="hidden" id="prd_id" value="${productId || ''}">
        <div class="form-group">
            <label>Nome do Prato *</label>
            <input type="text" id="prd_name" value="${p.name || ''}" placeholder="Ex: Marmita Executiva">
        </div>
        <div class="form-group">
            <label>Categoria *</label>
            <input type="text" id="prd_category" value="${p.category || 'Geral'}" placeholder="Ex: Marmitas, Bebidas..." list="cat_list">
            <datalist id="cat_list">
                ${categoryOptionsHtml}
            </datalist>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div class="form-group">
                <label>Preço (R$) *</label>
                <input type="number" step="0.01" id="prd_price" value="${p.price || ''}" placeholder="20.00">
            </div>
            <div class="form-group">
                <label>Desconto (%)</label>
                <input type="number" id="prd_discount" value="${p.discount_pct || ''}" placeholder="Ex: 10" min="0" max="100">
            </div>
        </div>
        <div class="form-group">
            <label>Descrição detalhada</label>
            <textarea id="prd_desc" placeholder="Ingredientes e detalhes do prato...">${p.description || ''}</textarea>
        </div>
        <div class="form-group">
            <label>Foto do Prato (Galeria/PC)</label>
            <input type="file" id="prd_file" accept="image/*" style="padding: 10px; font-size: 12px;">
        </div>
        <div class="form-group">
            <label>Ou URL da Foto</label>
            <input type="text" id="prd_img" value="${p.image_url || ''}" placeholder="https://link-da-foto.com/imagem.jpg">
        </div>
        <div class="form-group" style="display:flex; align-items:center; gap:8px; margin-top:10px;">
            <input type="checkbox" id="prd_cross_sell" ${p.is_cross_sell ? 'checked' : ''} style="width:18px; height:18px;">
            <label for="prd_cross_sell" style="margin:0; font-size:12px; color:#F1F5F9;">Ofertar como Acompanhamento/Bebida (Cross-Sell)</label>
        </div>
        <button class="btn btn-large" id="btn_save_prd" onclick="saveProduct()" style="margin-top:10px;">
            ${isEdit ? 'Atualizar Prato' : 'Salvar no Cardápio'}
        </button>
    `);
}

function openNewProductModal() {
    openProductModal(null);
}

async function saveProduct() {
    const id = document.getElementById('prd_id')?.value || null;
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
        if (typeof showToast === 'function') showToast('Preencha o nome e um preço válido!', 'error');
        return;
    }

    try {
        let imageUrl = urlInput;

        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = '⌛ Enviando foto...';
            }

            const uploadedUrl = await uploadProductImage(fileInput.files[0]);
            if (uploadedUrl) {
                imageUrl = uploadedUrl;
            } else {
                if (typeof showToast === 'function') showToast('Erro ao enviar foto. Tente novamente.', 'error');
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Salvar no Cardápio';
                }
                return;
            }
        }

        if (typeof dbClient !== 'undefined') {
            const payload = { 
                name, category, price, discount_pct, description, image_url: imageUrl, is_cross_sell, is_active: true 
            };

            let error = null;
            if (id) {
                const res = await dbClient.from('products').update(payload).eq('id', id);
                error = res.error;
            } else {
                const res = await dbClient.from('products').insert([payload]);
                error = res.error;
            }

            if (error) {
                if (typeof showToast === 'function') showToast('Erro ao salvar no banco', 'error');
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Salvar no Cardápio';
                }
                return;
            }

            if (typeof closeModal === 'function') closeModal();
            if (typeof showToast === 'function') showToast(id ? 'Prato atualizado!' : 'Prato adicionado!');
            renderAdminProductsList();
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('Erro inesperado ao salvar', 'error');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar no Cardápio';
        }
    }
}

async function deleteProduct(id, name) {
    if (!confirm(`Tem certeza que deseja excluir "${name}" do cardápio?`)) return;

    try {
        if (typeof dbClient !== 'undefined') {
            const { error } = await dbClient.from('products').delete().eq('id', id);
            if (error) {
                if (typeof showToast === 'function') showToast('Erro ao excluir prato', 'error');
                return;
            }

            if (typeof showToast === 'function') showToast('Prato excluído!');
            renderAdminProductsList();
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('Erro ao excluir prato', 'error');
    }
}

async function exportMenuToPDF() {
    const pdfWindow = window.open('', '_blank');
    if (!pdfWindow) {
        if (typeof showToast === 'function') showToast('Permita pop-ups no navegador para abrir o PDF', 'error');
        else alert('Permita pop-ups no navegador para abrir o PDF');
        return;
    }

    pdfWindow.document.write(`
        <html>
            <head><title>Gerando Cardápio PDF...</title></head>
            <body style="font-family: system-ui, sans-serif; text-align: center; padding: 50px; background: #0F172A; color: #F1F5F9;">
                <h2>⌛ Gerando seu Cardápio...</h2>
                <p style="color: #94A3B8;">Formatando layout e imagens.</p>
            </body>
        </html>
    `);

    try {
        if (typeof dbClient === 'undefined') {
            pdfWindow.close();
            return typeof showToast === 'function' ? showToast('Sem conexão com o banco', 'error') : alert('Sem conexão');
        }

        const { data: products, error } = await dbClient
            .from('products')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (error || !products || products.length === 0) {
            pdfWindow.document.body.innerHTML = `
                <div style="text-align:center; padding:40px; color:#EF4444;">
                    <h3>Nenhum prato ativo encontrado no cardápio.</h3>
                    <p style="color:#94A3B8;">Ative pelo menos um item no gestor para gerar o PDF.</p>
                </div>
            `;
            return;
        }

        const settings = (typeof DB !== 'undefined' && DB.load) 
            ? DB.load('dly_settings', { storeName: 'Nosso Delivery', logoUrl: '', phone: '', primaryColor: '#FF6B35' }) 
            : { storeName: 'Nosso Delivery', logoUrl: '', phone: '', primaryColor: '#FF6B35' };

        const primaryColor = settings.primaryColor || '#FF6B35';

        const grouped = {};
        products.forEach(p => {
            const cat = p.category || 'Geral';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(p);
        });

        let categoriesHtml = '';
        for (const [catName, items] of Object.entries(grouped)) {
            categoriesHtml += `
                <div style="margin-top: 22px; margin-bottom: 10px; page-break-inside: avoid;">
                    <div style="display: flex; align-items: center; gap: 8px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 4px;">
                        <span style="font-size: 15px;">📌</span>
                        <h3 style="margin: 0; color: #0F172A; font-size: 15px; font-weight: 800; text-transform: uppercase;">${catName}</h3>
                    </div>
                </div>
            `;

            items.forEach(p => {
                const discount = Number(p.discount_pct || 0);
                const originalPrice = Number(p.price);
                const finalPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;

                const itemImg = p.image_url ? `<img src="${p.image_url}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; flex-shrink: 0; border: 1px solid #E2E8F0;">` : '';

                categoriesHtml += `
                    <div style="display: flex; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px dashed #CBD5E1; page-break-inside: avoid;">
                        ${itemImg}
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; justify-content: space-between; align-items: baseline;">
                                <strong style="font-size: 14px; color: #0F172A; font-weight: 700;">${p.name}</strong>
                                <div style="text-align: right; margin-left: 10px; flex-shrink: 0;">
                                    <span style="font-size: 15px; font-weight: 800; color: ${primaryColor};">R$ ${finalPrice.toFixed(2)}</span>
                                    ${discount > 0 ? `<br><s style="color: #94A3B8; font-size: 11px;">R$ ${originalPrice.toFixed(2)}</s>` : ''}
                                </div>
                            </div>
                            ${p.description ? `<p style="margin: 2px 0 0 0; font-size: 11px; color: #64748B; line-height: 1.3;">${p.description}</p>` : ''}
                        </div>
                    </div>
                `;
            });
        }

        const logoHtml = settings.logoUrl 
            ? `<img src="${settings.logoUrl}" style="max-height: 80px; max-width: 180px; object-fit: contain; margin-bottom: 8px;">` 
            : '';

        const phoneFormatted = settings.phone ? `📱 WhatsApp: (${settings.phone.substring(0,2)}) ${settings.phone.substring(2)}` : '';

        pdfWindow.document.open();
        pdfWindow.document.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Cardápio - ${settings.storeName}</title>
                <style>
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    * { box-sizing: border-box; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        margin: 0;
                        padding: 15mm 18mm;
                        color: #1E293B;
                        background: #FFFFFF;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .menu-header {
                        text-align: center;
                        padding-bottom: 14px;
                        border-bottom: 3px double #CBD5E1;
                        margin-bottom: 8px;
                    }
                    .menu-header h1 {
                        margin: 4px 0 2px 0;
                        font-size: 24px;
                        font-weight: 900;
                        color: #0F172A;
                        letter-spacing: 0.5px;
                    }
                    .menu-header p {
                        margin: 0;
                        color: #64748B;
                        font-size: 12px;
                        font-weight: 600;
                    }
                    .menu-footer {
                        text-align: center;
                        margin-top: 24px;
                        padding-top: 12px;
                        border-top: 2px solid #E2E8F0;
                        font-size: 12px;
                        color: #64748B;
                        font-weight: 700;
                    }
                </style>
            </head>
            <body>
                <div class="menu-header">
                    ${logoHtml}
                    <h1>${settings.storeName.toUpperCase() || 'NOSSO DELIVERY'}</h1>
                    <p>Cardápio Oficial de Pedidos ${phoneFormatted ? '• ' + phoneFormatted : ''}</p>
                </div>

                ${categoriesHtml}

                <div class="menu-footer">
                    🛵 Faça seu pedido diretamente pelo nosso WhatsApp!
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 400);
                    }
                </script>
            </body>
            </html>
        `);
        pdfWindow.document.close();

    } catch (e) {
        if (pdfWindow) pdfWindow.document.body.innerHTML = '<h3 style="color:#EF4444; text-align:center; padding-top:40px;">Erro ao gerar PDF do cardápio.</h3>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof loadSettingsUI === 'function') loadSettingsUI();
    document.querySelector('.bottom-nav button[data-tab="settings"]')?.addEventListener('click', loadSettingsUI);
});
