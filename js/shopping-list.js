// js/shopping-list.js - Módulo de Lista de Compras Blindado

const ShoppingListManager = {
    items: [],
    _saving: false,

    async init() {
        await this.renderList();
    },

    async renderList() {
        const container = document.getElementById('shopping-list-container');
        if (!container) return;

        try {
            if (!dbClient) {
                container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px;">Modo offline ou sem conexão.</div>';
                return;
            }

            const { data, error } = await dbClient
                .from('shopping_list')
                .select('*')
                .order('is_purchased', { ascending: true })
                .order('created_at', { ascending: true });

            if (error) throw error;

            this.items = data || [];

            if (this.items.length === 0) {
                container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:30px;">Sua lista de compras está vazia.</div>';
                this.updateTotals();
                return;
            }

            this.updateTotals();

            container.innerHTML = this.items.map(item => {
                const isChecked = item.is_purchased ? 'checked' : '';
                const textStyle = item.is_purchased ? 'text-decoration: line-through; color: #64748B;' : 'color: #F1F5F9;';

                return `
                    <div class="list-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: #1E293B; border-bottom: 1px solid #334155; margin-bottom: 6px; border-radius: 10px;">
                        <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                            <input type="checkbox" ${isChecked} onchange="ShoppingListManager.toggleCheck('${item.id}', this.checked)" style="width: 22px; height: 22px; accent-color: #10B981; cursor: pointer; flex-shrink: 0;">
                            <div style="min-width: 0;">
                                <div style="font-weight: 700; font-size: 15px; ${textStyle} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.item_name)}</div>
                                <div style="font-size: 11px; color: #94A3B8;">Qtd: ${item.quantity || 1} • ${escapeHtml(item.category || 'Insumos')}</div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                            <div style="display: flex; align-items: center; background: #0F172A; border: 1px solid #334155; border-radius: 8px; padding: 2px 8px;">
                                <span style="font-size: 12px; color: #94A3B8; margin-right: 4px;">R$</span>
                                <input type="number" step="0.01" min="0" value="${item.unit_price > 0 ? item.unit_price : ''}" placeholder="0,00" 
                                    onchange="ShoppingListManager.updatePrice('${item.id}', this.value)" 
                                    style="width: 65px; background: transparent; border: none; color: #10B981; font-weight: 800; font-size: 14px; text-align: right; outline: none;">
                            </div>
                            <button onclick="ShoppingListManager.deleteItem('${item.id}')" title="Excluir" style="background: none; border: none; color: #EF4444; font-size: 16px; cursor: pointer; padding: 4px;">🗑️</button>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (e) {
            console.error('Erro ao listar itens de compras:', e);
            container.innerHTML = `<div style="color:#EF4444; text-align:center;">Erro ao carregar lista.</div>`;
        }
    },

    updateTotals() {
        const totalCard = document.getElementById('shopping-total-value');
        const topExpenseCard = document.getElementById('shopping-top-expense');

        const grandTotal = this.items.reduce((acc, i) => acc + (Number(i.quantity || 1) * Number(i.unit_price || 0)), 0);
        const sorted = [...this.items].sort((a, b) => ((b.quantity || 1) * (b.unit_price || 0)) - ((a.quantity || 1) * (a.unit_price || 0)));
        const topItem = sorted[0];
        const topVal = topItem ? ((topItem.quantity || 1) * (topItem.unit_price || 0)) : 0;

        if (totalCard) totalCard.textContent = grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        if (topExpenseCard) topExpenseCard.textContent = topVal > 0 ? `${topItem.item_name} (${topVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})` : 'Nenhum item';
    },

    async toggleCheck(id, isChecked) {
        const item = this.items.find(i => i.id === id);
        if (item) item.is_purchased = isChecked;
        this.updateTotals();

        try {
            if (dbClient) await dbClient.from('shopping_list').update({ is_purchased: isChecked }).eq('id', id);
            await this.renderList();
        } catch (e) {
            console.error('Erro ao marcar item:', e);
        }
    },

    async updatePrice(id, newPrice) {
        const price = Math.max(0, parseFloat(newPrice) || 0);
        const item = this.items.find(i => i.id === id);
        
        // Proteção contra item indefinido (evita TypeError)
        if (!item) return;

        item.unit_price = price;
        item.total_price = price * (item.quantity || 1);
        this.updateTotals();

        try {
            if (dbClient) {
                await dbClient.from('shopping_list').update({ 
                    unit_price: price, 
                    total_price: price * (item.quantity || 1) 
                }).eq('id', id);
            }
        } catch (e) {
            console.error('Erro ao atualizar preço:', e);
        }
    },

    openModal() {
        const bodyHtml = `
            <div class="form-group">
                <label>Nome do Item / Produto *</label>
                <input type="text" id="shop_name" placeholder="Ex: Queijo Muçarela, Caixa de Pizza, Óleo...">
            </div>
            <div class="form-group">
                <label>Categoria</label>
                <select id="shop_category">
                    <option value="Insumos">🧀 Insumos / Ingredientes</option>
                    <option value="Embalagens">📦 Embalagens</option>
                    <option value="Bebidas">🥤 Bebidas</option>
                    <option value="Outros">Outros</option>
                </select>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="form-group">
                    <label>Quantidade *</label>
                    <input type="number" step="0.001" min="0.001" id="shop_qty" value="1" oninput="ShoppingListManager.calcPreview()">
                </div>
                <div class="form-group">
                    <label>Preço Unitário Estimado (R$)</label>
                    <input type="number" step="0.01" min="0" id="shop_unit_price" placeholder="0.00" oninput="ShoppingListManager.calcPreview()">
                </div>
            </div>
            <div style="background:#0F172A; padding:12px; border-radius:8px; text-align:right; margin-bottom:14px; border:1px solid #334155;">
                <span style="font-size:12px; color:#94A3B8;">Total do Item: </span>
                <strong id="shop_total_preview" style="color:#10B981; font-size:16px;">R$ 0,00</strong>
            </div>
            <button class="btn btn-large btn-success" id="btn_save_shop" onclick="ShoppingListManager.saveItem()">💾 Adicionar à Lista</button>
        `;

        if (typeof openModal === 'function') openModal('🛒 Novo Item de Compra', bodyHtml);
    },

    calcPreview() {
        const qty = Math.max(0, parseFloat(document.getElementById('shop_qty')?.value) || 0);
        const price = Math.max(0, parseFloat(document.getElementById('shop_unit_price')?.value) || 0);
        const total = qty * price;
        const previewEl = document.getElementById('shop_total_preview');
        if (previewEl) previewEl.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    async saveItem() {
        if (this._saving) return;

        const item_name = document.getElementById('shop_name')?.value.trim();
        const category = document.getElementById('shop_category')?.value || 'Insumos';
        const quantity = Math.max(0.001, parseFloat(document.getElementById('shop_qty')?.value) || 1);
        const unit_price = Math.max(0, parseFloat(document.getElementById('shop_unit_price')?.value) || 0);
        const total_price = quantity * unit_price;
        const saveBtn = document.getElementById('btn_save_shop');

        if (!item_name) {
            if (typeof showToast === 'function') showToast('Preencha o nome do produto!', 'error');
            return;
        }

        try {
            this._saving = true;
            if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⌛ Adicionando...'; }

            if (dbClient) {
                const { error } = await dbClient.from('shopping_list').insert([{ item_name, category, quantity, unit_price, total_price, is_purchased: false }]);
                if (error) throw error;
            }

            if (typeof showToast === 'function') showToast('Item adicionado à lista!');
            if (typeof closeModal === 'function') closeModal();
            await this.renderList();

        } catch (e) {
            console.error('Erro ao salvar item da lista:', e);
            if (typeof showToast === 'function') showToast('Erro ao salvar item.', 'error');
        } finally {
            this._saving = false;
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Adicionar à Lista'; }
        }
    },

    async deleteItem(id) {
        if (!confirm('Deseja remover este item da lista?')) return;
        try {
            if (dbClient) await dbClient.from('shopping_list').delete().eq('id', id);
            if (typeof showToast === 'function') showToast('Item removido!');
            await this.renderList();
        } catch (e) {
            console.error('Erro ao excluir item:', e);
        }
    },

    exportCSV() {
        if (!this.items || this.items.length === 0) {
            if (typeof showToast === 'function') showToast('Sua lista está vazia para exportar.', 'error');
            return;
        }

        const csvEscape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
        let csvContent = "Status;Item;Categoria;Quantidade;Preco_Unitario_R$;Total_R$\n";

        this.items.forEach(item => {
            const status = item.is_purchased ? 'Comprado' : 'Pendente';
            const row = [
                csvEscape(status),
                csvEscape(item.item_name),
                csvEscape(item.category || 'Insumos'),
                item.quantity || 1,
                (item.unit_price || 0).toFixed(2),
                ((item.quantity || 1) * (item.unit_price || 0)).toFixed(2)
            ];
            csvContent += row.join(";") + "\n";
        });

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        const today = new Date().toISOString().split('T')[0];
        link.setAttribute("href", url);
        link.setAttribute("download", `lista_de_compras_${today}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Liberação de memória após o clique de download
        setTimeout(() => URL.revokeObjectURL(url), 100);

        if (typeof showToast === 'function') showToast('📊 CSV baixado com sucesso!');
    }
};

window.ShoppingListManager = ShoppingListManager;

document.addEventListener('DOMContentLoaded', () => {
    ShoppingListManager.init();
});
