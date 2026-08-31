// js/expenses.js - Gestão Completa de Despesas (Contas Fixas e Logística)

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(text ?? '')));
    return div.innerHTML;
}

const ExpensesManager = {
    // Helper para interpretar datas sem erro de fuso ou sintaxe
    parseDateSafe(dateInput) {
        if (!dateInput) return null;
        if (dateInput instanceof Date) return dateInput;
        const d = new Date(String(dateInput).replace(' ', 'T'));
        return isNaN(d.getTime()) ? null : d;
    },

    // Carrega despesas do Supabase ou LocalStorage
    async fetchExpenses() {
        try {
            if (typeof dbClient !== 'undefined') {
                const { data, error } = await dbClient.from('expenses').select('*').order('created_at', { ascending: false });
                if (!error && data) {
                    const fixed = data.filter(e => e.type === 'fixed');
                    const logistics = data.filter(e => e.type === 'logistics');
                    
                    if (typeof state !== 'undefined') {
                        state.expenses = { fixed, logistics };
                        if (typeof DB !== 'undefined') DB.save('dly_expenses', state.expenses);
                    }
                    localStorage.setItem('dly_expenses', JSON.stringify({ fixed, logistics }));
                    return { fixed, logistics };
                }
            }
        } catch (e) {
            console.warn('Supabase offline ou erro ao carregar despesas:', e);
        }

        if (typeof state !== 'undefined' && state.expenses) {
            return state.expenses;
        }
        try {
            return JSON.parse(localStorage.getItem('dly_expenses') || '{"fixed":[],"logistics":[]}');
        } catch (e) {
            return { fixed: [], logistics: [] };
        }
    },

    // Salva ou Edita Conta Fixa
    async saveFixedExpense(editingId = null) {
        const desc = document.getElementById('exp_desc')?.value?.trim();
        const amt = parseFloat(document.getElementById('exp_amt')?.value) || 0;
        const due = parseInt(document.getElementById('exp_due')?.value) || 1;

        if (!desc || amt <= 0) {
            if (typeof showToast === 'function') showToast('Preencha a descrição e um valor válido!', 'error');
            else alert('Preencha a descrição e um valor válido!');
            return;
        }

        const id = editingId || `exp_${Date.now()}`;
        const payload = {
            id,
            type: 'fixed',
            description: desc,
            amount: amt,
            due_day: due,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        try {
            if (typeof dbClient !== 'undefined') {
                const { error } = await dbClient.from('expenses').upsert([payload]);
                if (error) console.error('Erro no Supabase ao salvar conta fixa:', error.message);
            }
        } catch (e) {
            console.error('Erro ao salvar conta fixa:', e);
        }

        if (typeof state === 'undefined') window.state = { expenses: { fixed: [], logistics: [] } };
        if (!state.expenses) state.expenses = { fixed: [], logistics: [] };
        if (!state.expenses.fixed) state.expenses.fixed = [];

        const index = state.expenses.fixed.findIndex(e => String(e.id) === String(id));
        if (index >= 0) {
            state.expenses.fixed[index] = { ...state.expenses.fixed[index], ...payload };
        } else {
            state.expenses.fixed.unshift(payload);
        }

        if (typeof DB !== 'undefined') DB.save('dly_expenses', state.expenses);
        localStorage.setItem('dly_expenses', JSON.stringify(state.expenses));

        if (typeof showToast === 'function') showToast(editingId ? 'Conta fixa atualizada!' : 'Conta fixa salva!');
        if (typeof closeModal === 'function') closeModal();

        renderExpenses();
        if (typeof renderDashboard === 'function') renderDashboard();
    },

    // Salva ou Edita Gasto de Logística
    async saveLogisticsExpense(editingId = null) {
        const desc = document.getElementById('log_desc')?.value?.trim();
        const amt = parseFloat(document.getElementById('log_amt')?.value) || 0;

        if (!desc || amt <= 0) {
            if (typeof showToast === 'function') showToast('Preencha a descrição e um valor válido!', 'error');
            else alert('Preencha a descrição e um valor válido!');
            return;
        }

        const id = editingId || `exp_${Date.now()}`;
        const payload = {
            id,
            type: 'logistics',
            description: desc,
            amount: amt,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        try {
            if (typeof dbClient !== 'undefined') {
                const { error } = await dbClient.from('expenses').upsert([payload]);
                if (error) console.error('Erro no Supabase ao salvar logística:', error.message);
            }
        } catch (e) {
            console.error('Erro ao salvar gasto de logística:', e);
        }

        if (typeof state === 'undefined') window.state = { expenses: { fixed: [], logistics: [] } };
        if (!state.expenses) state.expenses = { fixed: [], logistics: [] };
        if (!state.expenses.logistics) state.expenses.logistics = [];

        const index = state.expenses.logistics.findIndex(e => String(e.id) === String(id));
        if (index >= 0) {
            state.expenses.logistics[index] = { ...state.expenses.logistics[index], ...payload };
        } else {
            state.expenses.logistics.unshift(payload);
        }

        if (typeof DB !== 'undefined') DB.save('dly_expenses', state.expenses);
        localStorage.setItem('dly_expenses', JSON.stringify(state.expenses));

        if (typeof showToast === 'function') showToast(editingId ? 'Gasto de logística atualizado!' : 'Gasto salvo!');
        if (typeof closeModal === 'function') closeModal();

        renderLogisticsList();
        if (typeof renderDashboard === 'function') renderDashboard();
    },

    // Exclui Despesa (Fixa ou Logística)
    async deleteExpense(id, type = 'fixed') {
        if (!confirm('Tem certeza que deseja excluir esta despesa?')) return;

        try {
            if (typeof dbClient !== 'undefined') {
                await dbClient.from('expenses').delete().eq('id', id);
            }
        } catch (e) {
            console.error('Erro ao deletar no Supabase:', e);
        }

        if (typeof state !== 'undefined' && state.expenses && state.expenses[type]) {
            state.expenses[type] = state.expenses[type].filter(e => String(e.id) !== String(id));
            if (typeof DB !== 'undefined') DB.save('dly_expenses', state.expenses);
            localStorage.setItem('dly_expenses', JSON.stringify(state.expenses));
        }

        if (typeof showToast === 'function') showToast('Despesa removida!');
        
        if (type === 'fixed') renderExpenses();
        if (type === 'logistics') renderLogisticsList();
        if (typeof renderDashboard === 'function') renderDashboard();
    }
};

// Modal de Conta Fixa (Novo ou Edição)
function openFixedExpenseModal(id = null) {
    let exp = null;
    if (id && typeof state !== 'undefined' && state.expenses?.fixed) {
        exp = state.expenses.fixed.find(e => String(e.id) === String(id));
    }

    const safeId = id ? escapeHtml(id) : null;

    const modalBody = `
        <div class="form-group">
            <label>Descrição / Nome da Conta *</label>
            <input type="text" id="exp_desc" value="${escapeHtml(exp?.description || '')}" placeholder="Ex: Aluguel / Luz / MEI">
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div class="form-group">
                <label>Valor Mensal (R$) *</label>
                <input type="number" step="0.01" id="exp_amt" value="${exp?.amount || ''}" placeholder="0.00">
            </div>
            <div class="form-group">
                <label>Dia do Vencimento</label>
                <input type="number" min="1" max="31" id="exp_due" value="${exp?.due_day || exp?.dueDay || 10}" placeholder="Ex: 10">
            </div>
        </div>

        <button class="btn btn-large" onclick="ExpensesManager.saveFixedExpense(${safeId ? `'${safeId}'` : 'null'})" style="margin-top:12px; width:100%; min-height:44px; touch-action:manipulation;">
            💾 ${safeId ? 'Atualizar' : 'Salvar'} Conta Fixa
        </button>
    `;

    if (typeof openModal === 'function') {
        openModal(id ? '✏️ Editar Conta Fixa' : '📋 Nova Conta Fixa', modalBody);
    }
}

// Modal de Logística (Novo ou Edição)
function openLogisticsModal(id = null) {
    let exp = null;
    if (id && typeof state !== 'undefined' && state.expenses?.logistics) {
        exp = state.expenses.logistics.find(e => String(e.id) === String(id));
    }

    const safeId = id ? escapeHtml(id) : null;

    const modalBody = `
        <div class="form-group">
            <label>Descrição *</label>
            <input type="text" id="log_desc" value="${escapeHtml(exp?.description || '')}" placeholder="Ex: Gasolina / Moto / Manutenção">
        </div>
        <div class="form-group">
            <label>Valor (R$) *</label>
            <input type="number" step="0.01" id="log_amt" value="${exp?.amount || ''}" placeholder="0.00">
        </div>
        <button class="btn btn-large" onclick="ExpensesManager.saveLogisticsExpense(${safeId ? `'${safeId}'` : 'null'})" style="margin-top:12px; width:100%; min-height:44px; touch-action:manipulation;">
            💾 ${safeId ? 'Atualizar' : 'Salvar'} Gasto
        </button>
    `;

    if (typeof openModal === 'function') {
        openModal(id ? '✏️ Editar Gasto de Logística' : '🛵 Novo Gasto de Logística', modalBody);
    }
}

// Renderiza Contas Fixas e calcula Total
async function renderExpenses() {
    const listEl = document.getElementById('fixedList');
    const totalEl = document.getElementById('fixedTotal');

    const expensesData = await ExpensesManager.fetchExpenses();
    const fixedList = expensesData.fixed || [];

    const total = fixedList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    if (totalEl) {
        totalEl.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    }

    if (!listEl) return;

    if (fixedList.length === 0) {
        listEl.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px; font-size:12px;">Nenhuma conta fixa cadastrada.</div>';
        return;
    }

    listEl.innerHTML = fixedList.map(exp => {
        const amtFormatted = Number(exp.amount || 0).toFixed(2).replace('.', ',');
        const dueDay = exp.due_day || exp.dueDay || 1;
        const safeDesc = escapeHtml(exp.description);
        const safeId = escapeHtml(exp.id);

        return `
            <div class="card" style="margin-bottom:8px; padding:12px; background:#1E293B; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="color:#F1F5F9; font-size:14px; display:block;">${safeDesc}</strong>
                    <span style="font-size:11px; color:#94A3B8;">Vence dia ${dueDay}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <strong style="color:#EF4444; font-size:14px; margin-right:4px;">R$ ${amtFormatted}</strong>
                    <button class="btn btn-sm" onclick="openFixedExpenseModal('${safeId}')" style="background:#3B82F6; color:#fff; padding:6px 10px; min-height:36px; font-size:11px; touch-action:manipulation;" title="Editar">✏️</button>
                    <button class="btn btn-sm" onclick="ExpensesManager.deleteExpense('${safeId}', 'fixed')" style="background:#EF4444; color:#fff; padding:6px 10px; min-height:36px; font-size:11px; touch-action:manipulation;" title="Excluir">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

// Renderiza Gastos de Logística e calcula Total
async function renderLogisticsList() {
    const listEl = document.getElementById('logisticsList');
    const totalEl = document.getElementById('logisticsTotal');

    const expensesData = await ExpensesManager.fetchExpenses();
    const logisticsList = expensesData.logistics || [];

    const total = logisticsList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    if (totalEl) {
        totalEl.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    }

    if (!listEl) return;

    if (logisticsList.length === 0) {
        listEl.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px; font-size:12px;">Nenhum gasto de logística registrado.</div>';
        return;
    }

    listEl.innerHTML = logisticsList.map(exp => {
        const amtFormatted = Number(exp.amount || 0).toFixed(2).replace('.', ',');
        const safeDesc = escapeHtml(exp.description);
        const safeId = escapeHtml(exp.id);
        
        const dateObj = ExpensesManager.parseDateSafe(exp.created_at);
        const dateStr = dateObj ? dateObj.toLocaleDateString('pt-BR') : '';

        return `
            <div class="card" style="margin-bottom:8px; padding:12px; background:#1E293B; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="color:#F1F5F9; font-size:14px; display:block;">${safeDesc}</strong>
                    ${dateStr ? `<span style="font-size:11px; color:#94A3B8;">${dateStr}</span>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <strong style="color:#EF4444; font-size:14px; margin-right:4px;">R$ ${amtFormatted}</strong>
                    <button class="btn btn-sm" onclick="openLogisticsModal('${safeId}')" style="background:#3B82F6; color:#fff; padding:6px 10px; min-height:36px; font-size:11px; touch-action:manipulation;" title="Editar">✏️</button>
                    <button class="btn btn-sm" onclick="ExpensesManager.deleteExpense('${safeId}', 'logistics')" style="background:#EF4444; color:#fff; padding:6px 10px; min-height:36px; font-size:11px; touch-action:manipulation;" title="Excluir">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

// Aliases e retrocompatibilidade para o app.js / ui.js
function saveFixedExpense() { ExpensesManager.saveFixedExpense(); }
function saveLogisticsExpense() { ExpensesManager.saveLogisticsExpense(); }
function renderFixedList() { renderExpenses(); }

window.openFixedExpenseModal = openFixedExpenseModal;
window.openLogisticsModal = openLogisticsModal;
window.saveFixedExpense = saveFixedExpense;
window.saveLogisticsExpense = saveLogisticsExpense;
window.renderFixedList = renderFixedList;
window.renderLogisticsList = renderLogisticsList;

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('fixedList')) renderExpenses();
    if (document.getElementById('logisticsList')) renderLogisticsList();
});
