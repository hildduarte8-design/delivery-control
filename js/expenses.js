function openFixedExpenseModal() {
    openModal('📋 Nova Conta Fixa', `
        <div class="form-group">
            <label>Descrição da Conta</label>
            <input type="text" id="exp_desc" placeholder="Ex: Aluguel / Luz">
        </div>
        <div class="form-group">
            <label>Valor Mensal (R$)</label>
            <input type="number" step="0.01" id="exp_amt" placeholder="0.00">
        </div>
        <div class="form-group">
            <label>Dia do Vencimento</label>
            <input type="number" id="exp_due" placeholder="Ex: 10">
        </div>
        <button class="btn btn-large" onclick="saveFixedExpense()" style="margin-top:12px;">Salvar Conta</button>
    `);
}

async function saveFixedExpense() {
    const desc = document.getElementById('exp_desc').value;
    const amt = Number(document.getElementById('exp_amt').value || 0);
    const due = Number(document.getElementById('exp_due').value || 1);

    if (!desc || amt <= 0) return showToast('Preencha os dados corretamente!', 'error');

    const newExp = { id: Date.now().toString(), type: 'fixed', description: desc, amount: amt, dueDay: due };
    state.expenses.fixed.push(newExp);
    DB.save('dly_expenses', state.expenses);

    try { await dbClient.from('expenses').insert([{ type: 'fixed', description: desc, amount: amt, due_day: due }]); } catch(e){}

    closeModal();
    showToast('Conta fixa salva!');
    renderExpenses();
    renderDashboard();
}

function openLogisticsModal() {
    openModal('🛵 Novo Gasto de Logística', `
        <div class="form-group">
            <label>Descrição</label>
            <input type="text" id="log_desc" placeholder="Ex: Gasolina / Moto">
        </div>
        <div class="form-group">
            <label>Valor (R$)</label>
            <input type="number" step="0.01" id="log_amt" placeholder="0.00">
        </div>
        <button class="btn btn-large" onclick="saveLogisticsExpense()" style="margin-top:12px;">Salvar Gasto</button>
    `);
}

async function saveLogisticsExpense() {
    const desc = document.getElementById('log_desc').value;
    const amt = Number(document.getElementById('log_amt').value || 0);

    if (!desc || amt <= 0) return showToast('Preencha os dados corretamente!', 'error');

    const newLog = { id: Date.now().toString(), type: 'logistics', description: desc, amount: amt, created_at: new Date().toISOString() };
    state.expenses.logistics.push(newLog);
    DB.save('dly_expenses', state.expenses);

    try { await dbClient.from('expenses').insert([{ type: 'logistics', description: desc, amount: amt }]); } catch(e){}

    closeModal();
    showToast('Gasto salvo!');
    renderExpenses();
    renderDashboard();
}

function renderExpenses() {
    const fixedList = document.getElementById('fixedList');
    if (fixedList) {
        fixedList.innerHTML = state.expenses.fixed.map(e => `
            <div class="card" style="margin-bottom:8px; display:flex; justify-content:space-between;">
                <div>
                    <div style="font-weight:700; color:#F1F5F9;">${e.description}</div>
                    <div style="font-size:12px; color:#94A3B8;">Vence dia ${e.dueDay}</div>
                </div>
                <div style="font-weight:800; color:#EF4444;">R$ ${Number(e.amount).toFixed(2)}</div>
            </div>
        `).join('');
    }
}
