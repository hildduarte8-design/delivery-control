// js/menu-admin.js - Gestão e CRUD do Cardápio Digital (Modo Gestor)

const MenuAdminManager = {
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
                container.innerHTML = `<div style="color:#EF4444; text-align:center;">Erro: ${error.message}</div>`;
                return;
            }

            if (!products || products.length === 0) {
                container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px;">Nenhum prato cadastrado ainda.</div>';
                return;
            }

            container.innerHTML = products.map((p, index) => `
                <div class="card product-admin-card" style="margin-bottom:10px; padding:12px; display:flex; justify-content:space-between; align-items:center; background:#1E293B; border-left:4px solid ${p.is_active ? '#10B981' : '#64748B'};">
                    <div style="display:flex; align-items:center; gap:10px; flex:1;">
                        ${p.image_url ? `<img src="${p.image_url}" style="width:48px; height:48px; border-radius:8px; object-fit:cover;">` : '<span style="font-size:24px;">🍽️</span>'}
                        <div>
                            <strong style="color:#F1F5F9; font-size:14px; display:block;">${p.name}</strong>
                            <span style="font-size:11px; color:#94A3B8;">
                                ${p.category || 'Geral'} • R$ ${Number(p.price || 0).toFixed(2)} 
                                ${p.discount_pct > 0 ? `<span style="color:#10B981;">(-${p.discount_pct}%)</span>` : ''}
                            </span>
                        </div>
                    </div>

                    <div style="display:flex; gap:6px; align-items:center;">
                        <button class="btn btn-sm ${p.is_active ? 'btn-success' : 'btn-secondary'}" onclick="MenuAdminManager.toggleProductActive('${p.id}', ${!p.is_active})" title="${p.is_active ? 'Pausar item' : 'Ativar item'}">
                            ${p.is_active ? '🟢' : '⚪'}
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="MenuAdminManager.openProductModal('${p.id}')" title="Editar">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="MenuAdminManager.deleteProduct('${p.id}')" title="Excluir">🗑️</button>
                    </div>
                </div>
            `).join('');

        } catch (e) {
            console.error('Erro ao renderizar lista administrativa:', e);
        }
    },

    async openProductModal(productId = null) {
        let p = { name: '', description: '', price: '', category: 'Geral', discount_pct: 0, is_active: true, is_cross_sell: false, image_url: '' };

        if (productId) {
            const { data } = await dbClient.from('products').select('*').eq('id', productId).single();
            if (data) p = data;
        }

        const bodyHtml = `
            <div class="form-group">
                <label>Nome do Prato / Item</label>
                <input type="text" id="prod_name" value="${p.name}" placeholder="Ex: Pastel Duplo de Carne">
            </div>
            <div class="form-group">
                <label>Categoria</label>
                <input type="text" id="prod_category" value="${p.category}" placeholder="Ex: Pastéis, Bebidas, Porções">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="form-group">
                    <label>Preço (R$)</label>
                    <input type="number" step="0.01" id="prod_price" value="${p.price}" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label>Desconto (%)</label>
                    <input type="number" id="prod_discount" value="${p.discount_pct}" placeholder="0">
                </div>
            </div>
            <div class="form-group">
                <label>Descrição / Ingredientes</label>
                <textarea id="prod_desc" rows="2" placeholder="Ex: Carne moída especial, azeitona e tempero da casa">${p.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label>URL da Imagem</label>
                <input type="text" id="prod_img" value="${p.image_url || ''}" placeholder="https://link-da-imagem.com/foto.jpg">
            </div>
            <div style="margin-bottom:14px; display:flex; gap:12px;">
                <label style="font-size:12px; color:#CBD5E1; display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="prod_active" ${p.is_active ? 'checked' : ''}> Item Ativo
                </label>
                <label style="font-size:12px; color:#CBD5E1; display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="prod_cross" ${p.is_cross_sell ? 'checked' : ''}> Sugerir no Carrinho (Cross-sell)
                </label>
            </div>
            <button class="btn btn-large" onclick="MenuAdminManager.saveProduct('${productId || ''}')">💾 Salvar Prato</button>
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
        const image_url = document.getElementById('prod_img')?.value.trim() || '';
        const is_active = document.getElementById('prod_active')?.checked ?? true;
        const is_cross_sell = document.getElementById('prod_cross')?.checked ?? false;

        if (!name || price <= 0) {
            return alert('Preencha o nome e um preço válido!');
        }

        const payload = { name, category, price, discount_pct, description, image_url, is_active, is_cross_sell };

        if (productId) {
            await dbClient.from('products').update(payload).eq('id', productId);
        } else {
            await dbClient.from('products').insert([payload]);
        }

        if (typeof showToast === 'function') showToast('Prato salvo com sucesso!');
        if (typeof closeModal === 'function') closeModal();
        this.renderAdminProductsList();
    },

    async toggleProductActive(productId, newStatus) {
        await dbClient.from('products').update({ is_active: newStatus }).eq('id', productId);
        this.renderAdminProductsList();
    },

    async deleteProduct(productId) {
        if (confirm('Tem certeza que deseja remover este prato do cardápio?')) {
            await dbClient.from('products').delete().eq('id', productId);
            this.renderAdminProductsList();
        }
    }
};

// Exposição global para chamadas diretas no HTML/onClick
window.openNewProductModal = () => MenuAdminManager.openProductModal();
