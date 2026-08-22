function openStockModal() {
    openModal('📦 Novo Insumo', `
        <div class="form-group">
            <label>Nome do Insumo</label>
            <input type="text" id="stk_name" placeholder="Ex: Embalagem Marmita">
        </div>
        <div class="form-group">
            <label>Quantidade Atual</label>
            <input type="number" id="stk_qty" placeholder="Ex: 50">
        </div>
        <div class="form-group">
            <label>Custo Unitário (R$)</label>
            <input type="number" step="0.01" id="stk_cost" placeholder="Ex: 1.50">
        </div>
        <button class="btn btn-large" onclick="saveStockItem()" style="margin-top:12px;">Salvar Insumo</button>
    `);
}

async function saveStockItem() {
    const name = document.getElementById('stk_name').value;
    const qty = Number(document.getElementById('stk_qty').value || 0);
    const cost = Number(document.getElementById('stk_cost').value || 0);

    if (!name) return showToast('Preencha o nome do insumo!', 'error');

    const newItem = { id: Date.now().toString(), name, quantity: qty, unitCost: cost, minQty: 5 };
    state.stock.push(newItem);
    DB.save('dly_stock', state.stock);
    
    try { await dbClient.from('stock').insert([{ name, quantity: qty, unit_cost: cost }]); } catch(e){}

    closeModal();
    showToast('Insumo salvo!');
    renderStockList();
}

function renderStockList() {
    const list = document.getElementById('stockList');
    if (!list) return;
    document.getElementById('stockCount').textContent = `${state.stock.length} itens`;

    if (state.stock.length === 0) {
        list.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px;">Nenhum insumo cadastrado.</div>';
        return;
    }

    list.innerHTML = state.stock.map(i => `
        <div class="card" style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-weight:700; color:#F1F5F9;">${i.name}</div>
                <div style="font-size:12px; color:#94A3B8;">Qtd: ${i.quantity} | Custo: R$ ${Number(i.unitCost || 0).toFixed(2)}</div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="deleteStockItem('${i.id}')">🗑️</button>
        </div>
    `).join('');
}

function deleteStockItem(id) {
    state.stock = state.stock.filter(i => i.id !== id);
    DB.save('dly_stock', state.stock);
    renderStockList();
}
