// js/stock.js - Gestão Unificada e Persistente de Insumos / Estoque

// Auxiliar local de sanitização contra XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(text || '')));
    return div.innerHTML;
}

const StockManager = {
    // Calcula a prévia do custo unitário em tempo real dentro do modal
    calculateUnitCostPreview() {
        const totalPrice = parseFloat(document.getElementById('stk_total_price')?.value) || 0;
        const packageQty = parseFloat(document.getElementById('stk_package_qty')?.value) || 1;
        const unit = document.getElementById('stk_unit')?.value || 'un';

        const unitCost = packageQty > 0 ? totalPrice / packageQty : 0;

        const labelEl = document.getElementById('stk_unit_label');
        const previewEl = document.getElementById('stk_unit_cost_preview');

        if (labelEl) labelEl.textContent = unit;
        if (previewEl) previewEl.textContent = `R$ ${unitCost.toFixed(2)}`;
    },

    // Busca insumos (prioriza Supabase; se retornar sucesso — mesmo vazio —, sincroniza o cache)
    async fetchStock() {
        try {
            if (typeof dbClient !== 'undefined') {
                const { data, error } = await dbClient.from('stock').select('*').order('name', { ascending: true });
                
                if (!error && data !== null) {
                    if (typeof DB !== 'undefined') DB.save('dly_stock', data);
                    localStorage.setItem('dly_stock', JSON.stringify(data));
                    return data;
                }
            }
        } catch (e) {
            console.warn('Conexão Supabase indisponível, carregando dados locais:', e);
        }

        if (typeof DB !== 'undefined') {
            return DB.load('dly_stock', []);
        }
        return JSON.parse(localStorage.getItem('dly_stock') || '[]');
    },

    // Abre o modal de edição preenchendo os dados do insumo
    async openEditStockModal(id) {
        const items = await this.fetchStock();
        const item = items.find(i => i.id === id);
        if (!item) return;

        const template = document.getElementById('stockModalTemplate');
        if (!template) return;

        if (typeof openModal === 'function') {
            openModal('✏️ Editar Insumo', template.innerHTML);
        }

        setTimeout(() => {
            if (document.getElementById('stk_name')) document.getElementById('stk_name').value = item.name || '';
            if (document.getElementById('stk_category')) document.getElementById('stk_category').value = item.category || 'Insumos';
            if (document.getElementById('stk_total_price')) document.getElementById('stk_total_price').value = item.total_price ?? item.totalPrice ?? '';
            if (document.getElementById('stk_package_qty')) document.getElementById('stk_package_qty').value = item.package_qty ?? item.packageQty ?? '';
            if (document.getElementById('stk_unit')) document.getElementById('stk_unit').value = item.unit || 'kg';
            if (document.getElementById('stk_min_qty')) document.getElementById('stk_min_qty').value = item.min_quantity ?? item.min_qty ?? item.minQty ?? '';
            if (document.getElementById('stk_current_qty')) document.getElementById('stk_current_qty').value = item.quantity ?? item.current_qty ?? item.currentQty ?? 0;

            this.calculateUnitCostPreview();

            const saveBtn = document.querySelector('#modalBody button.btn-large');
            if (saveBtn) {
                saveBtn.setAttribute('onclick', `StockManager.saveStockItem('${id}')`);
                saveBtn.textContent = '💾 Salvar Alterações do Insumo';
            }
        }, 50);
    },

    // Modal para entrada rápida de estoque (somar quantidade ao comprar mais)
    quickAddStockModal(id, name, currentQty, unit) {
        const bodyHtml = `
            <div style="padding:10px;">
                <p style="font-size:13px; color:#CBD5E1; margin-bottom:12px;">
                    Insumo: <strong style="color:#F59E0B;">${escapeHtml(name)}</strong><br>
                    Estoque Atual: <strong>${currentQty} ${escapeHtml(unit)}</strong>
                </p>

                <div class="form-group" style="margin-bottom:14px;">
                    <label style="font-size:12px; color:#94A3B8;">Quantidade Comprada (+)</label>
                    <input type="number" id="add_qty_input" step="0.001" placeholder="Ex: 2.5 ou 10" autofocus style="font-size:16px; font-weight:700; text-align:center;">
                </div>

                <button class="btn btn-large btn-success" onclick="StockManager.applyQuickAdd('${id}', ${currentQty})">
                    ✅ Confirmar Entrada no Estoque
                </button>
            </div>
        `;

        if (typeof openModal === 'function') {
            openModal('➕ Repor Estoque', bodyHtml);
        }
    },

    // Aplica a soma da nova quantidade no Supabase e no Cache
    async applyQuickAdd(id, currentQty) {
        const addQtyInput = document.getElementById('add_qty_input');
        const addedQty = parseFloat(addQtyInput?.value) || 0;

        if (addedQty <= 0) {
            if (typeof showToast === 'function') showToast('Informe uma quantidade válida!', 'error');
            return;
        }

        const newQty = currentQty + addedQty;

        // 1. Atualização imediata no Cache local (UI responde na hora)
        let localStock = JSON.parse(localStorage.getItem('dly_stock') || '[]');
        const idx = localStock.findIndex(i => i.id === id);
        if (idx >= 0) {
            localStock[idx].quantity = newQty;
            localStock[idx].current_qty = newQty;
            localStock[idx].currentQty = newQty;
            localStorage.setItem('dly_stock', JSON.stringify(localStock));
            if (typeof state !== 'undefined') state.stock = localStock;
        }

        // 2. Atualização segura no Supabase
        if (typeof dbClient !== 'undefined') {
            try {
                // Tenta atualizar a coluna standard 'quantity'
                let { error } = await dbClient.from('stock').update({ 
                    quantity: newQty, 
                    updated_at: new Date().toISOString() 
                }).eq('id', id);

                // Se o banco usar 'current_qty', tenta como fallback
                if (error) {
                    await dbClient.from('stock').update({ 
                        current_qty: newQty, 
                        updated_at: new Date().toISOString() 
                    }).eq('id', id);
                }
            } catch (e) {
                console.warn('Erro ao sincronizar reposição no Supabase:', e);
            }
        }

        if (typeof closeModal === 'function') closeModal();
        if (typeof showToast === 'function') showToast(`+${addedQty} adicionado! Novo total: ${newQty}`);

        renderStockList();
        if (typeof CalculatorManager !== 'undefined' && CalculatorManager.refreshStockList) {
            CalculatorManager.refreshStockList(true);
        }
    },

    // Salva ou edita insumo garantindo gravação no Banco e no Cache local
    async saveStockItem(editingId = null) {
        const name = document.getElementById('stk_name')?.value.trim();
        const category = document.getElementById('stk_category')?.value || 'Insumos';
        const totalPrice = parseFloat(document.getElementById('stk_total_price')?.value) || 0;
        const packageQty = parseFloat(document.getElementById('stk_package_qty')?.value) || 1;
        const unit = document.getElementById('stk_unit')?.value || 'un';
        const minQty = parseFloat(document.getElementById('stk_min_qty')?.value) || 0;
        const currentQty = parseFloat(document.getElementById('stk_current_qty')?.value) || packageQty;

        if (!name || totalPrice <= 0) {
            if (typeof showToast === 'function') showToast('Preencha o nome e o valor total!', 'error');
            else alert('Preencha o nome e o valor total!');
            return;
        }

        const unitCost = packageQty > 0 ? totalPrice / packageQty : 0;
        const itemId = editingId || `stk_${Date.now()}`;

        const itemPayload = {
            id: itemId,
            name,
            category,
            total_price: totalPrice,
            package_qty: packageQty,
            unit,
            unit_cost: unitCost,
            min_quantity: minQty,
            quantity: currentQty,
            current_qty: currentQty,
            updated_at: new Date().toISOString()
        };

        // 1. Grava no Supabase
        try {
            if (typeof dbClient !== 'undefined') {
                const { error } = await dbClient.from('stock').upsert([itemPayload]);
                if (error) console.error('Erro ao salvar no Supabase:', error);
            }
        } catch (e) {
            console.error('Erro ao salvar no Supabase:', e);
        }

        // 2. Grava no Cache Local
        let localStock = JSON.parse(localStorage.getItem('dly_stock') || '[]');
        const index = localStock.findIndex(i => i.id === itemId || i.name === name);

        if (index >= 0) {
            localStock[index] = { ...localStock[index], ...itemPayload };
        } else {
            localStock.unshift(itemPayload);
        }

        localStorage.setItem('dly_stock', JSON.stringify(localStock));
        if (typeof DB !== 'undefined') DB.save('dly_stock', localStock);
        if (typeof state !== 'undefined') state.stock = localStock;

        if (typeof showToast === 'function') showToast(editingId ? 'Insumo atualizado!' : 'Insumo salvo no estoque!');
        if (typeof closeModal === 'function') closeModal();

        // Atualiza a listagem e os seletores da calculadora
        renderStockList();
        if (typeof CalculatorManager !== 'undefined' && CalculatorManager.refreshStockList) {
            CalculatorManager.refreshStockList(true);
        }
    },

    // Remove o insumo do estoque
    async deleteStockItem(id) {
        if (!confirm('Deseja remover este insumo do estoque?')) return;

        try {
            if (typeof dbClient !== 'undefined') {
                await dbClient.from('stock').delete().eq('id', id);
            }
        } catch (e) {
            console.error('Erro ao excluir do Supabase:', e);
        }

        let localStock = JSON.parse(localStorage.getItem('dly_stock') || '[]');
        localStock = localStock.filter(i => i.id !== id);

        localStorage.setItem('dly_stock', JSON.stringify(localStock));
        if (typeof DB !== 'undefined') DB.save('dly_stock', localStock);
        if (typeof state !== 'undefined') state.stock = localStock;

        if (typeof showToast === 'function') showToast('Insumo removido!');
        renderStockList();

        if (typeof CalculatorManager !== 'undefined' && CalculatorManager.refreshStockList) {
            CalculatorManager.refreshStockList(true);
        }
    }
};

// Renderiza os cards de insumos na aba de estoque
async function renderStockList() {
    const container = document.getElementById('stockList');
    if (!container) return;

    const items = await StockManager.fetchStock();

    if (typeof state !== 'undefined') {
        state.stock = items;
    }

    const countEl = document.getElementById('stockCount');
    if (countEl) countEl.textContent = `${items.length} itens`;

    if (!items || items.length === 0) {
        container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px; font-size:12px;">Nenhum insumo cadastrado no estoque ainda.</div>';
        return;
    }

    container.innerHTML = items.map(item => {
        const currentQty = Number(item.quantity ?? item.current_qty ?? item.currentQty ?? 0);
        const minQty = Number(item.min_quantity ?? item.min_qty ?? item.minQty ?? 0);
        const packageQty = Number(item.package_qty ?? item.packageQty ?? 1);
        const totalPrice = Number(item.total_price ?? item.totalPrice ?? 0);
        const unitCost = Number(item.unit_cost ?? item.unitCost ?? (packageQty > 0 ? totalPrice / packageQty : 0));

        const isLow = currentQty <= minQty;
        const safeId = escapeHtml(item.id || '');
        const safeName = escapeHtml(item.name || '');
        const safeUnit = escapeHtml(item.unit || 'un');

        return `
            <div class="card" style="margin-bottom:10px; padding:12px; background:#1E293B; border-left:4px solid ${isLow ? '#EF4444' : '#10B981'}; border-radius:8px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div>
                        <strong style="color:#F1F5F9; font-size:14px; display:block;">
                            ${safeName} ${isLow ? '<small style="color:#EF4444; font-size:10px; font-weight:700;">(Abaixo do Mínimo)</small>' : ''}
                        </strong>
                        <span style="font-size:11px; color:#94A3B8;">
                            Emb: ${packageQty} ${safeUnit} • Custo: <strong style="color:#10B981;">R$ ${unitCost.toFixed(2)}/${safeUnit}</strong>
                        </span>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:15px; font-weight:800; color:${isLow ? '#EF4444' : '#F1F5F9'};">
                            ${currentQty} <small style="font-size:11px; font-weight:normal; color:#94A3B8;">${safeUnit}</small>
                        </span>
                    </div>
                </div>

                <!-- BARRINHA DE AÇÕES -->
                <div style="display:flex; gap:6px; justify-content:flex-end; border-top:1px dashed #334155; padding-top:8px; margin-top:6px;">
                    <button class="btn btn-sm" onclick="StockManager.quickAddStockModal('${safeId}', '${safeName.replace(/'/g, "\\'")}', ${currentQty}, '${safeUnit}')" style="background:#10B981; color:#fff; padding:4px 10px; font-size:11px;">
                        ➕ Repor
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="StockManager.openEditStockModal('${safeId}')" style="padding:4px 10px; font-size:11px;">
                        ✏️ Editar
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="StockManager.deleteStockItem('${safeId}')" style="padding:4px 8px; font-size:11px;" title="Excluir">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Suporte para abertura do modal
window.openStockModal = () => {
    if (typeof openModal === 'function') {
        const template = document.getElementById('stockModalTemplate');
        if (template) {
            openModal('📦 Novo Insumo no Estoque', template.innerHTML);
        }
    }
};

window.StockManager = StockManager;

// Executa automaticamente ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    renderStockList();
});
