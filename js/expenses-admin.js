// js/expenses-admin.js - Gestão Financeira Multi-Itens & Fixes QA

const ExpensesAdminManager = {
    rowCounter: 0,

    async init() {
        await this.renderExpensesList();
    },

    async renderExpensesList() {
        const container = document.getElementById('expenses-list-container');
        const totalCard = document.getElementById('total-expenses-month');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center; color:#94A3B8; padding:20px;">Carregando despesas...</div>';

        try {
            if (!dbClient) {
                container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px;">Modo offline ou sem conexão.</div>';
                return;
            }

            const { data: expenses, error } = await dbClient
                .from('expenses')
                .select('*')
                .order('expense_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                container.innerHTML = '<div style="color:#EF4444; text-align:center;">Erro ao carregar despesas.</div>';
                return;
            }

            if (!expenses || expenses.length === 0) {
                container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px;">Nenhum gasto registrado ainda.</div>';
                if (totalCard) totalCard.textContent = 'R$ 0,00';
                return;
            }

            // CORREÇÃO EA-04: Soma apenas os gastos do MÊS ATUAL para o card de resumo
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            const monthExpenses = expenses.filter(item => {
                const dateVal = item.expense_date ? item.expense_date + 'T00:00:00' : item.created_at;
                const d = new Date(dateVal);
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            });

            const totalMonth = monthExpenses.reduce((acc, item) => acc + Number(item.amount || 0), 0);
            if (totalCard) {
                totalCard.textContent = totalMonth.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }

            container.innerHTML = expenses.map(item => {
                const amountFormatted = Number(item.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const dateFormatted = item.expense_date ? new Date(item.expense_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem data';

                return `
                    <div class="list-item" style="border-left: 4px solid #EF4444;">
                        <div class="li-icon" style="background: rgba(239, 68, 68, 0.15); color: #EF4444;">💸</div>
                        <div class="li-body">
                            <div class="li-title">${escapeHtml(item.description)}</div>
                            <div class="li-sub">${escapeHtml(item.category || 'Geral')} • ${dateFormatted}</div>
                        </div>
                        <div class="li-amount negative" style="margin-right: 8px;">- ${amountFormatted}</div>
                        <div class="li-actions">
                            <button onclick="ExpensesAdminManager.deleteExpense('${escapeHtml(item.id)}')" title="Excluir Gasto">🗑️</button>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (e) {
            console.error('Erro ao listar gastos:', e);
        }
    },

    openExpenseModal() {
        const today = new Date().toISOString().split('T')[0];
        this.rowCounter = 0;

        const bodyHtml = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:12px;">
                <div class="form-group" style="margin-bottom:0;">
                    <label>Data da Compra *</label>
                    <input type="date" id="exp_date" value="${today}">
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label>Categoria Principal</label>
                    <select id="exp_category">
                        <option value="Insumos / Ingredientes">Insumos / Ingredientes</option>
                        <option value="Embalagens">Embalagens</option>
                        <option value="Contas (Água/Luz/Net)">Contas (Água/Luz/Net)</option>
                        <option value="Equipamentos">Equipamentos</option>
                        <option value="Outros">Outros</option>
                    </select>
                </div>
            </div>

            <div style="font-size:12px; font-weight:700; color:#F59E0B; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <span>🛒 Itens Comprados</span>
                <span style="font-size:11px; color:#94A3B8;">Preencha os valores para somar</span>
            </div>

            <div id="modal_items_list" style="display:flex; flex-direction:column; gap:8px; max-height:260px; overflow-y:auto; padding-right:4px; margin-bottom:12px;">
            </div>

            <button type="button" class="btn btn-sm btn-secondary" onclick="ExpensesAdminManager.addItemRow()" style="margin-bottom:14px; width:100%; border:1px dashed var(--primary-color, #FF6B35); color:var(--primary-color, #FF6B35);">
                ➕ Adicionar Outro Item
            </button>

            <div style="background:#0F172A; padding:12px 16px; border-radius:12px; border:1px solid #334155; display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <span style="font-size:13px; font-weight:700; color:#CBD5E1;">TOTAL DA COMPRA:</span>
                <strong id="modal_live_total" style="font-size:22px; font-weight:800; color:#10B981;">R$ 0,00</strong>
            </div>

            <button class="btn btn-large btn-danger" id="btn_save_exp" onclick="ExpensesAdminManager.saveExpenseBatch()">
                💾 Registrar Compra & Gastos
            </button>
        `;

        if (typeof openModal === 'function') {
            openModal('🛒 Nova Compra / Lista de Insumos', bodyHtml);
            this.addItemRow();
        }
    },

    addItemRow() {
        const container = document.getElementById('modal_items_list');
        if (!container) return;

        this.rowCounter++;
        const rowId = `exp_row_${this.rowCounter}`;

        const rowHtml = document.createElement('div');
        rowHtml.id = rowId;
        rowHtml.style.cssText = 'display:grid; grid-template-columns: 2fr 1fr 1fr 32px; gap:6px; align-items:center; background:#0F172A; padding:8px; border-radius:8px; border:1px solid #334155;';

        rowHtml.innerHTML = `
            <input type="text" class="item-name" placeholder="Item (Ex: Carne, Caixas...)" style="padding:8px; font-size:13px;">
            <input type="number" step="0.001" min="0" class="item-qty" value="1" placeholder="Qtd" oninput="ExpensesAdminManager.calculateModalTotal()" style="padding:8px; font-size:13px; text-align:center;">
            <input type="number" step="0.01" min="0" class="item-price" placeholder="R$ Unit" oninput="ExpensesAdminManager.calculateModalTotal()" style="padding:8px; font-size:13px;">
            <button type="button" onclick="ExpensesAdminManager.removeItemRow('${rowId}')" style="background:none; border:none; color:#EF4444; font-weight:bold; font-size:16px; cursor:pointer;">✕</button>
        `;

        container.appendChild(rowHtml);
        this.calculateModalTotal();
    },

    removeItemRow(rowId) {
        const row = document.getElementById(rowId);
        if (row) {
            row.remove();
            this.calculateModalTotal();
        }
    },

    calculateModalTotal() {
        const container = document.getElementById('modal_items_list');
        const totalDisplay = document.getElementById('modal_live_total');
        if (!container || !totalDisplay) return;

        let totalGeral = 0;
        const rows = container.querySelectorAll('div[id^="exp_row_"]');

        rows.forEach(row => {
            const qty = Math.max(0, parseFloat(row.querySelector('.item-qty')?.value) || 0);
            const price = Math.max(0, parseFloat(row.querySelector('.item-price')?.value) || 0);
            totalGeral += (qty * price);
        });

        totalDisplay.textContent = totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    async saveExpenseBatch() {
        const date = document.getElementById('exp_date')?.value;
        const category = document.getElementById('exp_category')?.value || 'Insumos / Ingredientes';
        const saveBtn = document.getElementById('btn_save_exp');
        const container = document.getElementById('modal_items_list');

        if (!date) {
            if (typeof showToast === 'function') showToast('Informe a data da compra!', 'error');
            return;
        }

        const rows = container ? container.querySelectorAll('div[id^="exp_row_"]') : [];
        const itemsToSave = [];
        let totalCompra = 0;

        rows.forEach(row => {
            const name = row.querySelector('.item-name')?.value.trim();
            const qty = Math.max(0, parseFloat(row.querySelector('.item-qty')?.value) || 0);
            const unitPrice = Math.max(0, parseFloat(row.querySelector('.item-price')?.value) || 0);
            const rowTotal = qty * unitPrice;

            if (name && rowTotal >= 0.01) {
                itemsToSave.push({
                    item_name: name,
                    category: category.split(' ')[0],
                    quantity: qty,
                    unit_price: unitPrice,
                    total_price: rowTotal,
                    type: 'expense'
                });
                totalCompra += rowTotal;
            }
        });

        if (itemsToSave.length === 0 || totalCompra < 0.01) {
            if (typeof showToast === 'function') showToast('Preencha ao menos um item válido com valor mínimo de R$ 0,01!', 'error');
            return;
        }

        try {
            if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⌛ Gravando Compra...'; }

            const summaryDesc = itemsToSave.length === 1 
                ? itemsToSave[0].item_name 
                : `Compra (${itemsToSave.length} itens: ${itemsToSave[0].item_name}...)`;

            if (dbClient) {
                const { error: expError } = await dbClient.from('expenses').insert([{
                    description: summaryDesc,
                    amount: totalCompra,
                    expense_date: date,
                    category: category,
                    type: 'expense'
                }]);

                if (expError) throw expError;

                try {
                    await dbClient.from('shopping_list').insert(itemsToSave);
                } catch (errShopping) {
                    console.warn('Integração com shopping_list ignorada.', errShopping);
                }
            }

            if (typeof showToast === 'function') showToast('✅ Compra registrada com sucesso!');
            if (typeof closeModal === 'function') closeModal();

            await this.renderExpensesList();
            if (typeof renderDashboard === 'function') renderDashboard();
            if (typeof ShoppingListManager !== 'undefined' && ShoppingListManager.renderList) {
                ShoppingListManager.renderList();
            }

        } catch (e) {
            console.error('Erro ao salvar lote de compras:', e);
            if (typeof showToast === 'function') showToast('Erro ao salvar despesas.', 'error');
        } finally {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Registrar Compra & Gastos'; }
        }
    },

    async deleteExpense(id) {
        if (!confirm('Tem certeza que deseja excluir esta despesa?')) return;
        try {
            if (dbClient) {
                const { error } = await dbClient.from('expenses').delete().eq('id', id);
                if (error) throw error;
            }
            if (typeof showToast === 'function') showToast('Gasto removido!');
            await this.renderExpensesList();
            if (typeof renderDashboard === 'function') renderDashboard();
        } catch (e) {
            console.error('Erro ao excluir gasto:', e);
            if (typeof showToast === 'function') showToast('Erro ao remover gasto.', 'error');
        }
    }
};

window.ExpensesAdminManager = ExpensesAdminManager;

document.addEventListener('DOMContentLoaded', () => {
    ExpensesAdminManager.init();
});
