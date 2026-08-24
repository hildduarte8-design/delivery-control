// js/sales.js - Lançamento e Gestão de Vendas Manuais com Vínculo de Cliente e Cardápio

async function openSaleModal() {
    if (typeof openModal !== 'function') return;

    openModal('💰 Nova Venda Manual', '<div style="text-align:center; padding:20px; color:#94A3B8;">Carregando dados...</div>');

    try {
        let products = [];
        let clients = [];

        if (typeof dbClient !== 'undefined') {
            // 1. Busca produtos ativos do cardápio
            const { data: prds } = await dbClient
                .from('products')
                .select('*')
                .eq('is_active', true)
                .order('name', { ascending: true });
            if (prds) products = prds;

            // 2. Busca clientes já existentes do histórico de pedidos
            const { data: ords } = await dbClient
                .from('orders')
                .select('client_name, phone')
                .order('created_at', { ascending: false });

            if (ords) {
                const uniqueMap = {};
                ords.forEach(o => {
                    if (o.client_name) {
                        const key = o.client_name.trim().toLowerCase();
                        if (!uniqueMap[key]) {
                            uniqueMap[key] = { name: o.client_name.trim(), phone: o.phone || '' };
                        }
                    }
                });
                clients = Object.values(uniqueMap);
            }
        }

        const clientOptionsHtml = clients
            .map(c => `<option value="${c.name}">${c.phone ? `📱 ${c.phone}` : ''}</option>`)
            .join('');

        const productOptionsHtml = products
            .map(p => `<option value="${p.id}" data-price="${p.price}" data-name="${p.name}">${p.name} — R$ ${Number(p.price).toFixed(2)}</option>`)
            .join('');

        openModal('💰 Nova Venda Manual', `
            <div class="form-group">
                <label>Cliente (Selecione existente ou digite o nome de um novo) *</label>
                <input type="text" id="sale_client_name" list="clients_datalist" placeholder="Digite ou selecione o cliente..." oninput="onClientInputSelected(this.value)">
                <datalist id="clients_datalist">
                    ${clientOptionsHtml}
                </datalist>
            </div>

            <div class="form-group">
                <label>WhatsApp / Telefone do Cliente (Opcional)</label>
                <input type="tel" id="sale_client_phone" placeholder="33999999999">
            </div>

            <div class="form-group">
                <label>Selecione o Item do Cardápio *</label>
                <select id="sale_product_select" onchange="onSaleProductChange(this)">
                    <option value="">-- Escolha um item do cardápio --</option>
                    ${productOptionsHtml}
                    <option value="custom">✏️ Outro / Valor Personalizado</option>
                </select>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div class="form-group">
                    <label>Quantidade *</label>
                    <input type="number" id="sale_qty" value="1" min="1" oninput="calculateSaleTotal()">
                </div>
                <div class="form-group">
                    <label>Valor Unitário (R$) *</label>
                    <input type="number" step="0.01" id="sale_unit_price" placeholder="0.00" oninput="calculateSaleTotal()">
                </div>
            </div>

            <div class="form-group">
                <label>Forma de Pagamento / Local</label>
                <select id="sale_channel">
                    <option value="Balcão (Dinheiro)">💵 Balcão (Dinheiro)</option>
                    <option value="Balcão (Pix)">⚡ Balcão (Pix)</option>
                    <option value="Balcão (Cartão)">💳 Balcão (Cartão)</option>
                    <option value="WhatsApp Direct">📱 WhatsApp Direct</option>
                </select>
            </div>

            <div style="background:#0F172A; padding:12px; border-radius:10px; margin-top:10px; text-align:right; border:1px solid #334155;">
                <span style="font-size:12px; color:#94A3B8;">Total da Venda:</span>
                <strong style="font-size:18px; color:#10B981; display:block;" id="sale_total_display">R$ 0.00</strong>
            </div>

            <button class="btn btn-large" id="btn_save_sale" onclick="saveManualSale()" style="margin-top:12px;">
                💾 Registrar Venda Manual
            </button>
        `);

        window.cachedClientsForSale = clients;

    } catch (e) {
        console.error('Erro ao abrir modal de venda:', e);
        if (typeof showToast === 'function') showToast('Erro ao carregar dados do cardápio', 'error');
    }
}

function onClientInputSelected(val) {
    if (!window.cachedClientsForSale) return;
    const found = window.cachedClientsForSale.find(c => c.name.toLowerCase() === val.trim().toLowerCase());
    const phoneInput = document.getElementById('sale_client_phone');
    if (found && found.phone && phoneInput) {
        phoneInput.value = found.phone;
    }
}

function onSaleProductChange(selectEl) {
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const price = selectedOption.getAttribute('data-price');
    const priceInput = document.getElementById('sale_unit_price');

    if (price && priceInput) {
        priceInput.value = Number(price).toFixed(2);
    } else if (priceInput && selectEl.value === 'custom') {
        priceInput.value = '';
        priceInput.focus();
    }
    calculateSaleTotal();
}

function calculateSaleTotal() {
    const qty = Number(document.getElementById('sale_qty')?.value || 1);
    const price = Number(document.getElementById('sale_unit_price')?.value || 0);
    const total = qty * price;
    const display = document.getElementById('sale_total_display');
    if (display) display.textContent = `R$ ${total.toFixed(2)}`;
}

async function saveManualSale() {
    const clientName = document.getElementById('sale_client_name')?.value.trim();
    const clientPhone = document.getElementById('sale_client_phone')?.value.trim() || '';
    const productSelect = document.getElementById('sale_product_select');
    const selectedOption = productSelect?.options[productSelect.selectedIndex];
    const productName = selectedOption?.getAttribute('data-name') || (productSelect?.value === 'custom' ? 'Venda Avulsa' : 'Item do Cardápio');
    const qty = Number(document.getElementById('sale_qty')?.value || 1);
    const unitPrice = Number(document.getElementById('sale_unit_price')?.value || 0);
    const channel = document.getElementById('sale_channel')?.value || 'Balcão';
    const saveBtn = document.getElementById('btn_save_sale');

    if (!clientName) {
        if (typeof showToast === 'function') showToast('Informe o nome do cliente!', 'error');
        return;
    }
    if (unitPrice <= 0 || qty <= 0) {
        if (typeof showToast === 'function') showToast('Informe uma quantidade e valor válidos!', 'error');
        return;
    }

    const totalFinal = qty * unitPrice;

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = '⌛ Registrando...';
        }

        if (typeof dbClient !== 'undefined') {
            const { error: orderError } = await dbClient.from('orders').insert([{
                client_name: clientName,
                phone: clientPhone,
                order_type: 'pickup',
                address: channel,
                items: [{ name: productName, qty: qty, unit_price: unitPrice, total: totalFinal }],
                subtotal: totalFinal,
                delivery_fee: 0,
                total: totalFinal,
                status: 'completed'
            }]);

            if (orderError) console.error('Erro ao salvar no banco:', orderError);
        }

        if (typeof closeModal === 'function') closeModal();
        if (typeof showToast === 'function') showToast('Venda manual registrada com sucesso!');

        if (typeof renderSalesList === 'function') renderSalesList();
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof CustomersManager !== 'undefined') CustomersManager.fetchCustomers();

    } catch (e) {
        console.error('Erro ao salvar venda:', e);
        if (typeof showToast === 'function') showToast('Erro inesperado ao salvar venda', 'error');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Registrar Venda Manual';
        }
    }
}

async function renderSalesList() {
    const container = document.getElementById('salesList');
    if (!container) return;

    try {
        if (typeof dbClient === 'undefined') return;

        const { data: orders, error } = await dbClient
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error || !orders || orders.length === 0) {
            container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px; font-size:13px;">Nenhuma venda registrada ainda.</div>';
            return;
        }

        container.innerHTML = orders.map(o => {
            const dateFormatted = new Date(o.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            return `
                <div class="card" style="margin-bottom:8px; padding:12px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="color:#F1F5F9; font-size:14px;">👤 ${o.client_name || 'Cliente'}</strong>
                        <div style="font-size:11px; color:#94A3B8;">⏰ ${dateFormatted} • ${o.address || 'Balcão'}</div>
                    </div>
                    <div style="text-align:right;">
                        <strong style="color:#10B981; font-size:14px;">R$ ${Number(o.total || 0).toFixed(2)}</strong>
                        <div style="font-size:10px; color:#94A3B8;">${o.status === 'completed' ? '✅ Concluído' : '🟡 ' + o.status}</div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px;">Erro ao carregar lista de vendas.</div>';
    }
}
