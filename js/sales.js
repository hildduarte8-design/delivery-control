function openSaleModal() {
    openModal('💰 Nova Entrada', `
        <div class="form-group">
            <label>Descrição</label>
            <input type="text" id="sale_desc" placeholder="Ex: Venda Balcão">
        </div>
        <div class="form-group">
            <label>Valor (R$)</label>
            <input type="number" step="0.01" id="sale_amt" placeholder="0.00">
        </div>
        <button class="btn btn-large" onclick="saveSale()" style="margin-top:12px;">Registrar Entrada</button>
    `);
}

async function saveSale() {
    const desc = document.getElementById('sale_desc').value;
    const amt = Number(document.getElementById('sale_amt').value || 0);

    if (!desc || amt <= 0) return showToast('Preencha os dados corretamente!', 'error');

    const newSale = { id: Date.now().toString(), description: desc, amount: amt, created_at: new Date().toISOString() };
    state.sales.push(newSale);
    DB.save('dly_sales', state.sales);

    try { await dbClient.from('sales').insert([{ description: desc, amount: amt }]); } catch(e){}

    closeModal();
    showToast('Entrada registrada!');
    renderSalesList();
    renderDashboard();
}

function renderSalesList() {
    const list = document.getElementById('salesList');
    if (!list) return;

    if (state.sales.length === 0) {
        list.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px;">Nenhuma entrada salva.</div>';
        return;
    }

    list.innerHTML = state.sales.map(s => `
        <div class="card" style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-weight:700; color:#F1F5F9;">${s.description}</div>
                <div style="font-size:12px; color:#94A3B8;">${new Date(s.created_at).toLocaleDateString('pt-BR')}</div>
            </div>
            <div style="font-weight:800; color:#10B981;">+ R$ ${Number(s.amount).toFixed(2)}</div>
        </div>
    `).join('');
}
