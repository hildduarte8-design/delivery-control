// js/menu-admin.js - Gestão e CRUD do Cardápio Digital (Modo Gestor)

// Auxiliar de sanitização contra XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(text || '')));
    return div.innerHTML;
}

const MenuAdminManager = {
    async uploadProductImage(file) {
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
            console.error('Erro ao processar imagem:', e);
            return null;
        }
    },

    async renderAdminProductsList() {
        const container = document.getElementById('admin-products-list');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center; color:#94A3B8; padding:20px;">Carregando pratos...</div>';

        try {
            if (typeof dbClient === 'undefined') return;

            const { data: products, error } = await dbClient
                .from('products')
                .select('*')
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) {
                container.innerHTML = `<div style="color:#EF4444; text-align:center;">Erro: ${escapeHtml(error.message)}</div>`;
                return;
            }

            if (!products || products.length === 0) {
                container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px;">Nenhum prato cadastrado ainda.</div>';
                return;
            }

            window.currentAdminProducts = products;

            container.innerHTML = products.map((p, index) => {
                const discount = Number(p.discount_pct || 0);
                const originalPrice = Number(p.price || 0);
                const finalPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;
                const safeName = escapeHtml(p.name);
                const safeCat = escapeHtml(p.category || 'Geral');

                return `
                    <div class="card product-admin-card" style="margin-bottom:10px; padding:12px; display:flex; justify-content:space-between; align-items:center; background:#1E293B; border-left:4px solid ${p.is_active ? '#10B981' : '#64748B'};">
                        <div style="display:flex; align-items:center; gap:10px; flex:1;">
                            <div class="reorder-btns" style="display:flex; flex-direction:column; gap:2px;">
                                <button class="btn-arrow" onclick="MenuAdminManager.moveProductOrder('${escapeHtml(p.id)}', ${p.display_order ?? index}, -1)" title="Subir Posição" style="background:none; border:none; color:#94A3B8; cursor:pointer; font-size:10px;">▲</button>
                                <button class="btn-arrow" onclick="MenuAdminManager.moveProductOrder('${escapeHtml(p.id)}', ${p.display_order ?? index}, 1)" title="Descer Posição" style="background:none; border:none; color:#94A3B8; cursor:pointer; font-size:10px;">▼</button>
                            </div>
                            ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" style="width:48px; height:48px; border-radius:8px; object-fit:cover;">` : '<span style="font-size:24px;">🍽️</span>'}
                            <div>
                                <strong style="color:#F1F5F9; font-size:14px; display:block;">
                                    ${safeName} ${p.is_cross_sell ? '<small style="color:#60A5FA;">[Peça Junto]</small>' : ''}
                                </strong>
                                <span style="font-size:11px; color:#94A3B8;">
                                    ${safeCat} • R$ ${finalPrice.toFixed(2)} 
                                    ${discount > 0 ? `<span style="color:#10B981;">(-${discount}%)</span>` : ''}
                                </span>
                            </div>
                        </div>

                        <div style="display:flex; gap:6px; align-items:center;">
                            <button class="btn btn-sm ${p.is_active ? 'btn-success' : 'btn-secondary'}" onclick="MenuAdminManager.toggleProductActive('${escapeHtml(p.id)}', ${!p.is_active})" title="${p.is_active ? 'Pausar item' : 'Ativar item'}">
                                ${p.is_active ? '🟢' : '⚪'}
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="MenuAdminManager.openProductModal('${escapeHtml(p.id)}')" title="Editar">✏️</button>
                            <button class="btn btn-sm btn-danger" onclick="MenuAdminManager.deleteProduct('${escapeHtml(p.id)}')" title="Excluir">🗑️</button>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (e) {
            console.error('Erro ao renderizar lista administrativa:', e);
        }
    },

    async openProductModal(productId = null) {
        let p = { name: '', description: '', price: '', category: 'Especialidades', discount_pct: 0, is_active: true, is_cross_sell: false, image_url: '', complements: [] };

        if (productId && typeof dbClient !== 'undefined') {
            const { data } = await dbClient.from('products').select('*').eq('id', productId).single();
            if (data) p = data;
        }

        const defaultCategories = ["Especialidades", "Marmitas", "Batatas Recheadas", "Pastéis", "Bebidas", "Sobremesas"];
        const customCategories = window.currentAdminProducts 
            ? window.currentAdminProducts.map(item => item.category).filter(Boolean)
            : [];
        const uniqueCategories = [...new Set([...defaultCategories, ...customCategories])];
        const categoryOptionsHtml = uniqueCategories.map(cat => `<option value="${escapeHtml(cat)}">`).join('');

        // Formata os adicionais gravados para exibição no campo de texto
        let complementsText = '';
        if (Array.isArray(p.complements)) {
            complementsText = p.complements.map(c => `${c.name}: ${Number(c.price || 0).toFixed(2)}`).join('\n');
        } else if (typeof p.complements === 'string') {
            try {
                const parsed = JSON.parse(p.complements);
                if (Array.isArray(parsed)) {
                    complementsText = parsed.map(c => `${c.name}: ${Number(c.price || 0).toFixed(2)}`).join('\n');
                }
            } catch(e) { complementsText = p.complements; }
        }

        const bodyHtml = `
            <div class="form-group">
                <label>Nome do Prato / Item *</label>
                <input type="text" id="prod_name" value="${escapeHtml(p.name || '')}" placeholder="Ex: Pastel Duplo de Carne">
            </div>
            <div class="form-group">
                <label>Categoria *</label>
                <input type="text" id="prod_category" value="${escapeHtml(p.category || 'Geral')}" placeholder="Ex: Pastéis, Bebidas..." list="cat_list">
                <datalist id="cat_list">
                    ${categoryOptionsHtml}
                </datalist>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="form-group">
                    <label>Preço (R$) *</label>
                    <input type="number" step="0.01" id="prod_price" value="${p.price || ''}" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label>Desconto (%)</label>
                    <input type="number" id="prod_discount" value="${p.discount_pct || 0}" placeholder="0" min="0" max="100">
                </div>
            </div>
            <div class="form-group">
                <label>Descrição / Ingredientes</label>
                <textarea id="prod_desc" rows="2" placeholder="Ex: Carne moída especial e tempero da casa">${escapeHtml(p.description || '')}</textarea>
            </div>

            <!-- CAMPO DE ADICIONAIS / OPCIONAIS -->
            <div class="form-group" style="background:#0F172A; padding:10px; border-radius:8px; border:1px solid #334155;">
                <label style="color:#F59E0B; font-weight:bold;">➕ Adicionais / Opcionais do Prato</label>
                <small style="display:block; color:#94A3B8; font-size:11px; margin-bottom:6px;">Digite um por linha no formato: <strong>Nome: Valor</strong></small>
                <textarea id="prod_complements" rows="3" placeholder="Ex: Queijo Extra: 3.50&#10;Bacon Crocante: 4.00&#10;Molho Especial: 2.00" style="font-size:12px; font-family:monospace;">${escapeHtml(complementsText)}</textarea>
            </div>

            <div class="form-group">
                <label>Foto do Prato (Galeria / PC)</label>
                <input type="file" id="prod_file" accept="image/*" style="padding:8px; font-size:12px;">
            </div>
            <div class="form-group">
                <label>Ou URL da Imagem</label>
                <input type="text" id="prod_img" value="${escapeHtml(p.image_url || '')}" placeholder="https://link-da-imagem.com/foto.jpg">
            </div>
            <div style="margin-bottom:14px; display:flex; gap:12px; flex-wrap:wrap;">
                <label style="font-size:12px; color:#CBD5E1; display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="prod_active" ${p.is_active ? 'checked' : ''}> Item Ativo
                </label>
                <label style="font-size:12px; color:#CBD5E1; display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="prod_cross" ${p.is_cross_sell ? 'checked' : ''}> Sugerir no Checkout (Peça Junto)
                </label>
            </div>
            <button class="btn btn-large" id="btn_save_prod" onclick="MenuAdminManager.saveProduct('${escapeHtml(productId || '')}')">💾 Salvar Prato</button>
        `;

        if (typeof openModal === 'function') {
            openModal(productId ? '✏️ Editar Prato' : '➕ Novo Prato', bodyHtml);
        }
    },

    async saveProduct(productId = '') {
        const name = document.getElementById('prod_name')?.value.trim();
        const category = document.getElementById('prod_category')?.value.trim() || 'Geral';
        const price = parseFloat(document.getElementById('prod_price')?.value) || 0;
        const discount_pct = parseInt(document.getElementById('prod_discount')?.value) || 0;
        const description = document.getElementById('prod_desc')?.value.trim() || '';
        const complementsRaw = document.getElementById('prod_complements')?.value.trim() || '';
        let image_url = document.getElementById('prod_img')?.value.trim() || '';
        const is_active = document.getElementById('prod_active')?.checked ?? true;
        const is_cross_sell = document.getElementById('prod_cross')?.checked ?? false;
        const fileInput = document.getElementById('prod_file');
        const saveBtn = document.getElementById('btn_save_prod');

        if (!name || price <= 0) {
            if (typeof showToast === 'function') showToast('Preencha o nome e um preço válido!', 'error');
            else alert('Preencha o nome e um preço válido!');
            return;
        }

        // Converte o texto digitado dos adicionais em Array de Objetos [{name, price}]
        const complements = complementsRaw ? complementsRaw.split('\n').filter(line => line.includes(':')).map(line => {
            const parts = line.split(':');
            return {
                name: parts[0].trim(),
                price: parseFloat(parts[1].trim().replace(',', '.')) || 0
            };
        }) : [];

        try {
            if (fileInput && fileInput.files && fileInput.files.length > 0) {
                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.textContent = '⌛ Enviando foto...';
                }
                const uploadedUrl = await this.uploadProductImage(fileInput.files[0]);
                if (uploadedUrl) {
                    image_url = uploadedUrl;
                }
            }

            const payload = { name, category, price, discount_pct, description, image_url, is_active, is_cross_sell, complements };

            if (productId) {
                await dbClient.from('products').update(payload).eq('id', productId);
            } else {
                await dbClient.from('products').insert([payload]);
            }

            if (typeof showToast === 'function') showToast('Prato salvo com sucesso!');
            if (typeof closeModal === 'function') closeModal();
            this.renderAdminProductsList();

        } catch (e) {
            console.error('Erro ao salvar produto:', e);
            if (typeof showToast === 'function') showToast('Erro ao salvar prato.', 'error');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Salvar Prato';
            }
        }
    },

    async moveProductOrder(id, currentOrder, direction) {
        try {
            if (typeof dbClient === 'undefined') return;

            const { data: products, error } = await dbClient
                .from('products')
                .select('id, display_order')
                .order('display_order', { ascending: true });

            if (error || !products || products.length === 0) return;

            const currentIndex = products.findIndex(p => p.id === id);
            if (currentIndex === -1) return;

            const swapIndex = currentIndex + direction;
            if (swapIndex < 0 || swapIndex >= products.length) return;

            const currentProduct = products[currentIndex];
            const swapProduct = products[swapIndex];

            const orderA = swapProduct.display_order ?? swapIndex;
            const orderB = currentProduct.display_order ?? currentIndex;

            await Promise.all([
                dbClient.from('products').update({ display_order: orderA === orderB ? swapIndex : orderA }).eq('id', currentProduct.id),
                dbClient.from('products').update({ display_order: orderA === orderB ? currentIndex : orderB }).eq('id', swapProduct.id)
            ]);

            this.renderAdminProductsList();
        } catch (e) {
            console.error('Erro ao reordenar:', e);
            if (typeof showToast === 'function') showToast('Erro ao reordenar pratos.', 'error');
        }
    },

    async toggleProductActive(productId, newStatus) {
        try {
            if (typeof dbClient === 'undefined') return;
            const { error } = await dbClient.from('products').update({ is_active: newStatus }).eq('id', productId);
            if (error) throw error;
            if (typeof showToast === 'function') showToast(newStatus ? 'Prato ativado!' : 'Prato pausado!');
            this.renderAdminProductsList();
        } catch (e) {
            console.error('Erro ao alterar status do produto:', e);
            if (typeof showToast === 'function') showToast('Erro ao atualizar produto.', 'error');
        }
    },

    async deleteProduct(productId) {
        if (!confirm('Tem certeza que deseja remover este prato do cardápio?')) return;
        try {
            if (typeof dbClient === 'undefined') return;
            const { error } = await dbClient.from('products').delete().eq('id', productId);
            if (error) throw error;
            if (typeof showToast === 'function') showToast('Prato removido do cardápio!');
            this.renderAdminProductsList();
        } catch (e) {
            console.error('Erro ao deletar produto:', e);
            if (typeof showToast === 'function') showToast('Erro ao remover prato.', 'error');
        }
    }
};

// Compatibilidade global
window.openNewProductModal = () => MenuAdminManager.openProductModal();
