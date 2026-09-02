// js/shopping-list.js - Módulo de Lista de Compras & Exportação CSV

const ShoppingListManager = {
    items: [],

    async init() {
        await this.renderList();
    },

    async renderList() {
        const container = document.getElementById('shopping-list-container');
        const totalCard = document.getElementById('shopping-total-value');
        const topExpenseCard = document.getElementById('shopping-top-expense');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center; color:#94A3B8; padding:20px;">Carregando lista de compras...</div>';

        try {
            if (typeof dbClient === 'undefined') return;

            const { data, error } = await dbClient
                .from('shopping_list')
                .select('*')
                .order('total_price', { ascending: false }); // Ordena do mais caro para o mais barato

            if (error) throw error;

            this.items = data || [];

            if (this.items.length === 0) {
                container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:30px;">Sua lista de compras está vazia.</div>';
                if (totalCard) totalCard.textContent = 'R$ 0,00';
                if (topExpenseCard) topExpenseCard.textContent = 'Nenhum item';
                return;
            }

            // Cálculo dos totais e do maior gasto
            const grandTotal = this.items.reduce((acc, i) => acc + Number(i.total_price || 0), 0);
            const topItem = this.items[0]; // Como já vem ordenado por total_price DESC

            if (totalCard) {
                totalCard.textContent = grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }
            if (topExpenseCard && topItem) {
                topExpenseCard.textContent = `${topItem.item_name} (${Number(topItem.total_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`;
            }

            container.innerHTML = this.items.map((item, index) => {
                const totalFormatted = Number(item.total_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const unitFormatted = Number(item.unit_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                return `
                    <div class="list-item" style="border-left: 4px solid ${index === 0 ? '#EF4444' : '#F59E0B'};">
                        <div class="li-icon" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B;">
                            🛒
                        </div>
                        <div class="li-body">
                            <div class="li-title">${escapeHtml(item.item_name)} ${index === 0 ? '<span style="font-size:10px; background:#EF4444; color:#fff; padding:2px 6px; border-radius:4px; margin-left:6px;">Maior Gasto</span>' : ''}</div>
                            <div class="li-sub">${item.quantity}x a ${unitFormatted} • ${escapeHtml(item.category || 'Geral')}</div>
                        </div>
                        <div class="li-amount" style="color: #F1F5F9; font-weight: 800; margin-right: 8px;">
                            ${totalFormatted}
                        </div>
                        <div class="li-actions">
                            <button onclick="ShoppingListManager.deleteItem('${escapeHtml(item.id)}')" title="Excluir">🗑️</button>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (e) {
            console.error('Erro ao listar itens de compras:', e);
            container.innerHTML = `<div style="color:#EF4444; text-align:center;">Erro ao carregar lista.</div>`;
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
                    <option value="Limpeza">Mecânica / Limpeza</option>
                    <option value="Outros">Outros</option>
                </select>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="form-group">
                    <label>Quantidade *</label>
                    <input type="number" step="0.001" id="shop_qty" value="1" oninput="ShoppingListManager.calcPreview()">
                </div>
                <div class="form-group">
                    <label>Preço Unitário (R$) *</label>
                    <input type="number" step="0.01" id="shop_unit_price" placeholder="0.00" oninput="ShoppingListManager.calcPreview()">
                </div>
            </div>
            <div style="background:#0F172A; padding:12px; border-radius:8px; text-align:right; margin-bottom:14px; border:1px solid #334155;">
                <span style="font-size:12px; color:#94A3B8;">Total do Item: </span>
                <strong id="shop_total_preview" style="color:#10B981; font-size:16px;">R$ 0,00</strong>
            </div>
            <button class="btn btn-large btn-success" id="btn_save_shop" onclick="ShoppingListManager.saveItem()">💾 Adicionar à Lista</button>
        `;

        if (typeof openModal === 'function') {
            openModal('🛒 Novo Item de Compra', bodyHtml);
        }
    },

    calcPreview() {
        const qty = parseFloat(document.getElementById('shop_qty')?.value) || 0;
        const price = parseFloat(document.getElementById('shop_unit_price')?.value) || 0;
        const total = qty * price;
        const previewEl = document.getElementById('shop_total_preview');
        if (previewEl) {
            previewEl.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
    },

    async saveItem() {
        const item_name = document.getElementById('shop_name')?.value.trim();
        const category = document.getElementById('shop_category')?.value || 'Insumos';
        const quantity = parseFloat(document.getElementById('shop_qty')?.value) || 0;
        const unit_price = parseFloat(document.getElementById('shop_unit_price')?.value) || 0;
        const total_price = quantity * unit_price;
        const saveBtn = document.getElementById('btn_save_shop');

        if (!item_name || quantity <= 0 || unit_price <= 0) {
            if (typeof showToast === 'function') showToast('Preencha o nome, quantidade e preço válidos!', 'error');
            else alert('Preencha o nome, quantidade e preço válidos!');
            return;
        }

        try {
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = '⌛ Adicionando...';
            }

            const { error } = await dbClient.from('shopping_list').insert([{
                item_name,
                category,
                quantity,
                unit_price,
                total_price
            }]);

            if (error) throw error;

            if (typeof showToast === 'function') showToast('Item adicionado à lista!');
            if (typeof closeModal === 'function') closeModal();
            this.renderList();

        } catch (e) {
            console.error('Erro ao salvar item da lista:', e);
            if (typeof showToast === 'function') showToast('Erro ao salvar item.', 'error');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Adicionar à Lista';
            }
        }
    },

    async deleteItem(id) {
        if (!confirm('Deseja remover este item da lista?')) return;
        try {
            const { error } = await dbClient.from('shopping_list').delete().eq('id', id);
            if (error) throw error;
            if (typeof showToast === 'function') showToast('Item removido!');
            this.renderList();
        } catch (e) {
            console.error('Erro ao excluir item:', e);
        }
    },

    // EXPORTAÇÃO PARA CSV PRONTO PARA IA
    exportCSV() {
        if (!this.items || this.items.length === 0) {
            if (typeof showToast === 'function') showToast('Sua lista está vazia para exportar.', 'error');
            else alert('Sua lista está vazia.');
            return;
        }

        // Cabeçalho compatível com Excel / Sheets / IAs
        let csvContent = "Item;Categoria;Quantidade;Preco_Unitario_R$;Total_R$\n";

        this.items.forEach(item => {
            const row = [
                `"${item.item_name.replace(/"/g, '""')}"`,
                `"${item.category || 'Insumos'}"`,
                item.quantity,
                item.unit_price.toFixed(2),
                item.total_price.toFixed(2)
            ];
            csvContent += row.join(";") + "\n";
        });

        // Adiciona BOM para caracteres especiais no Excel (ç, ã, é)
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        const today = new Date().toISOString().split('T')[0];
        link.setAttribute("href", url);
        link.setAttribute("download", `lista_de_compras_${today}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (typeof showToast === 'function') showToast('📊 CSV baixado com sucesso!');
    }
};

window.ShoppingListManager = ShoppingListManager;

document.addEventListener('DOMContentLoaded', () => {
    ShoppingListManager.init();
});
