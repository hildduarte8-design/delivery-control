// js/expenses-admin.js - Gestão Financeira de Gastos e Despesas

const ExpensesAdminManager = {
    async init() {
        await this.renderExpensesList();
    },

    async renderExpensesList() {
        const container = document.getElementById('expenses-list-container');
        const totalCard = document.getElementById('total-expenses-month');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center; color:#94A3B8; padding:20px;">Carregando despesas...</div>';

        try {
            if (typeof dbClient === 'undefined') return;

            const { data: expenses, error } = await dbClient
                .from('expenses')
                .select('*')
                .order('expense_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                container.innerHTML = `<div style="color:#EF4444; text-align:center;">Erro: ${escapeHtml(error.message)}</div>`;
                return;
            }

            if (!expenses || expenses.length === 0) {
                container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px;">Nenhum gasto registrado ainda.</div>';
                if (totalCard) totalCard.textContent = 'R$ 0,00';
                return;
            }

            // Soma do total de gastos
            const total = expenses.reduce((acc, item) => acc + Number(item.amount || 0), 0);
            if (totalCard) {
                totalCard.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }

            container.innerHTML = expenses.map(item => {
                const amountFormatted = Number(item.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const dateFormatted = item.expense_date ? new Date(item.expense_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem data';

                return `
                    <div class="list-item" style="border-left: 4px solid #EF4444;">
                        <div class="li-icon" style="background: rgba(239, 68, 68, 0.15); color: #EF4444;">
                            💸
                        </div>
                        <div class="li-body">
                            <div class="li-title">${escapeHtml(item.description)}</div>
                            <div class="li-sub">${escapeHtml(item.category || 'Geral')} • ${dateFormatted}</div>
                        </div>
                        <div class="li-amount negative" style="margin-right: 8px;">
                            - ${amountFormatted}
                        </div>
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

        const bodyHtml = `
            <div class="form-group">
                <label>Descrição da Despesa *</label>
                <input type="text" id="exp_desc" placeholder="Ex: Compra de embalagens, Carne, Luz...">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="form-group">
                    <label>Valor (R$) *</label>
                    <input type="number" step="0.01" id="exp_amount" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label>Data *</label>
                    <input type="date" id="exp_date" value="${today}">
                </div>
            </div>
            <div class="form-group">
                <label>Categoria</label>
                <select id="exp_category">
                    <option value="Insumos / Ingredientes">Insumos / Ingredientes</option>
                    <option value="Embalagens">Embalagens</option>
                    <option value="Contas (Água/Luz/Net)">Contas (Água/Luz/Net)</option>
                    <option value="Equipamentos / Manutenção">Equipamentos / Manutenção</option>
                    <option value="Outros">Outros</option>
                </select>
            </div>
            <button class="btn btn-large btn-danger" id="btn_save_exp" onclick="ExpensesAdminManager.saveExpense()">💾 Registrar Gasto</button>
        `;

        if (typeof openModal === 'function') {
            openModal('💸 Novo Gasto / Despesa', bodyHtml);
        }
    },

    async saveExpense() {
        const description = document.getElementById('exp_desc')?.value.trim();
        const amount = parseFloat(document.getElementById('exp_amount')?.value) || 0;
        const expense_date = document.getElementById('exp_date')?.value;
        const category = document.getElementById('exp_category')?.value || 'Insumos';
        const saveBtn = document.getElementById('btn_save_exp');

        if (!description || amount <= 0) {
            if (typeof showToast === 'function') showToast('Informe a descrição e um valor válido!', 'error');
            else alert('Informe a descrição e um valor válido!');
            return;
        }

        try {
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = '⌛ Gravando...';
            }

            const { error } = await dbClient.from('expenses').insert([{
                description,
                amount,
                expense_date,
                category
            }]);

            if (error) throw error;

            if (typeof showToast === 'function') showToast('Gasto registrado!');
            if (typeof closeModal === 'function') closeModal();
            this.renderExpensesList();

        } catch (e) {
            console.error('Erro ao salvar gasto:', e);
            if (typeof showToast === 'function') showToast('Erro ao registrar gasto.', 'error');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Registrar Gasto';
            }
        }
    },

    async deleteExpense(id) {
        if (!confirm('Tem certeza que deseja excluir esta despesa?')) return;
        try {
            const { error } = await dbClient.from('expenses').delete().eq('id', id);
            if (error) throw error;
            if (typeof showToast === 'function') showToast('Gasto removido!');
            this.renderExpensesList();
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
