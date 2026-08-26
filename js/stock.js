// js/stock.js - Gestão Enriquecida de Insumos e Estoque

const StockManager = {
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

    async saveStockItem() {
        const name = document.getElementById('stk_name')?.value.trim();
        const category = document.getElementById('stk_category')?.value || 'Insumos';
        const totalPrice = parseFloat(document.getElementById('stk_total_price')?.value) || 0;
        const packageQty = parseFloat(document.getElementById('stk_package_qty')?.value) || 1;
        const unit = document.getElementById('stk_unit')?.value || 'un';
        const minQty = parseFloat(document.getElementById('stk_min_qty')?.value) || 0;
        const currentQty = parseFloat(document.getElementById('stk_current_qty')?.value) || packageQty;

        if (!name || totalPrice <= 0) {
            if (typeof showToast === 'function') showToast('Preencha o nome e o valor total pago!', 'error');
            return;
        }

        const unitCost = totalPrice / packageQty;

        const itemPayload = {
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

        try {
            if (typeof dbClient !== 'undefined') {
                await dbClient.from('stock').upsert([itemPayload]);
            } else if (typeof DB !== 'undefined') {
                const local = DB.load('dly_stock', []);
                local.push(itemPayload);
                DB.save('dly_stock', local);
            }

            if (typeof showToast === 'function') showToast('Insumo cadastrado no estoque!');
            if (typeof closeModal === 'function') closeModal();

            // Atualiza a visualização do estoque
            if (typeof renderStockList === 'function') renderStockList();

            // SINCRONIZAÇÃO AUTOMÁTICA: Notifica a calculadora para recarregar o estoque
            if (typeof CalculatorManager !== 'undefined') {
                CalculatorManager.refreshStockList();
            }

        } catch (e) {
            console.error('Erro ao salvar insumo:', e);
        }
    }
};

window.openStockModal = () => {
    if (typeof openModal === 'function') {
        const html = document.getElementById('stockModalTemplate')?.innerHTML || '';
        openModal('📦 Novo Insumo no Estoque', html);
    }
};
