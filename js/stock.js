// js/stock.js - Gestão Unificada e Persistente de Insumos / Estoque

const StockManager = {
    // Calcula a prévia do custo unitário em tempo real dentro do modal
    calculateUnitCostPreview() {
        const totalPrice = parseFloat(document.getElementById('stk_total_price')?.value) || 0;
        const packageQty = parseFloat(document.getElementById('stk_package_qty')?.value) || 1;
        const unit = document.getElementById('stk_unit')?.value || 'un';

        const unitCost = totalPrice / packageQty;

        const labelEl = document.getElementById('stk_unit_label');
        const previewEl = document.getElementById('stk_unit_cost_preview');

        if (labelEl) labelEl.textContent = unit;
        if (previewEl) previewEl.textContent = `R$ ${unitCost.toFixed(2)}`;
    },

    // Busca insumos (prioriza Supabase com fallback no LocalStorage)
    async fetchStock() {
        try {
            if (typeof dbClient !== 'undefined') {
                const { data, error } = await dbClient.from('stock').select('*').order('name', { ascending: true });
                if (!error && data && data.length > 0) return data;
            }
        } catch (e) {
            console.warn('Conexão Supabase indisponível, carregando dados locais:', e);
        }

        if (typeof DB !== 'undefined') {
            return DB.load('dly_stock', []);
        }
        return JSON.parse(localStorage.getItem('dly_stock') || '[]');
    },

    // Salva insumo garantindo gravação no Banco e no Cache local
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

        const unitCost = totalPrice / packageQty;
        const itemPayload = {
            id: editingId || `stk_${Date.now()}`,
            name,
            category,
            total_price: totalPrice,
            package_qty: packageQty,
            unit,
            unit_cost: unitCost,
            min_quantity: minQty,
            quantity: currentQty,
            updated_at: new Date().toISOString()
        };

        // 1. Tenta gravar no Supabase
        try {
            if (typeof dbClient !== 'undefined') {
                await dbClient.from('stock').upsert([itemPayload]);
            }
        } catch (e) {
            console.error('Erro ao salvar no Supabase:', e);
        }

        // 2. Grava no LocalStorage como garantia de persistência
        const localStock = await this.fetchStock();
        const index = localStock.findIndex(i => i.id === itemPayload.id || i.name === itemPayload.name);

        if (index >= 0) {
            localStock[index] = { ...localStock[index], ...itemPayload };
        } else {
            localStock.push(itemPayload);
        }

        localStorage.setItem('dly_stock', JSON.stringify(localStock));
        if (typeof state !== 'undefined') state.stock = localStock;

        if (typeof showToast === 'function') showToast('Insumo salvo no estoque!');
        if (typeof closeModal === 'function') closeModal();

        // Atualiza a listagem na tela e recalcula os selects da calculadora
        renderStockList();
        if (typeof CalculatorManager !== 'undefined') {
            CalculatorManager.refreshStockList();
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

        if (typeof showToast === 'function') showToast('Insumo removido!');
        renderStockList();

        if (typeof CalculatorManager !== 'undefined') {
            CalculatorManager.refreshStockList();
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
        const isLow = Number(item.quantity || 0) <= Number(item.min_quantity || 0);
        const unitCost = Number(item.unit_cost || (item.total_price / (item.package_qty || 1)) || 0);

        return `
            <div class="card" style="margin-bottom:8px; padding:12px; background:#1E293B; border-left:4px solid ${isLow ? '#EF4444' : '#10B981'};">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="color:#F1F5F9; font-size:14px; display:block;">
                            ${item.name} ${isLow ? '<small style="color:#EF4444; font-size:10px;">(Abaixo do Mínimo)</small>' : ''}
                        </strong>
                        <span style="font-size:11px; color:#94A3B8;">
                            Emb: ${item.package_qty} ${item.unit} • Custo: <strong style="color:#10B981;">R$ ${unitCost.toFixed(2)}/${item.unit}</strong>
                        </span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:13px; font-weight:800; color:${isLow ? '#EF4444' : '#F1F5F9'};">
                            ${item.quantity} ${item.unit}
                        </span>
                        <button class="btn btn-sm" onclick="StockManager.deleteStockItem('${item.id}')" style="background:none; border:none; color:#EF4444; cursor:pointer; font-size:14px;" title="Excluir">🗑️</button>
                    </div>
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

// Executa automaticamente ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    renderStockList();
});
