// js/sales.js - Vendas Manuais de Balcão (Múltiplos Itens, Clientes e Descontos)

const SalesManager = {
    currentSaleItems: [],

    async openSaleModal() {
        this.currentSaleItems = [];
        
        // Carrega produtos do cardápio e clientes do banco
        let products = window.currentAdminProducts || [];
        if (products.length === 0 && typeof dbClient !== 'undefined') {
            const { data } = await dbClient.from('products').select('*').eq('is_active', true);
            products = data || [];
        }

        let customers = [];
        if (typeof CustomersManager !== 'undefined' && CustomersManager.allCustomers) {
            customers = CustomersManager.allCustomers;
        } else if (typeof dbClient !== 'undefined') {
            const { data } = await dbClient.from('orders').select('client_name, phone, address');
            customers = data || [];
        }

        const customerOptions = customers.map(c => `
            <option value="${c.name.replace(/"/g, '&quot;')}" data-phone="${c.phone || ''}" data-address="${c.address || ''}">
                ${c.name} ${c.phone ? `(${c.phone})` : ''}
            </option>
        `).join('');

        const productOptions = products.map(p => `
            <option value="${p.id}" data-name="${p.name.replace(/"/g, '&quot;')}" data-price="${p.price}">
                ${p.name} - R$ ${Number(p.price).toFixed(2)}
            </option>
        `).join('');

        const modalBody = `
            <!-- SELEÇÃO DE CLIENTE CADASTRADO -->
            <div class="form-group" style="margin-bottom: 10px;">
                <label style="font-size:12px; color:#CBD5E1;">Cliente Cadastrado (Opcional)</label>
                <select id="sale_customer_select" onchange="SalesManager.onSelectCustomer(this)" style="font-size:13px; padding:8px;">
                    <option value="">-- Cliente Avulso / Balcão --</option>
                    ${customerOptions}
                </select>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:10px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px; color:#94A3B8;">Nome do Cliente</label>
                    <input type="text" id="sale_client_name" placeholder="Ex: Maria Souza" style="font-size:12px; padding:6px;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px; color:#94A3B8;">WhatsApp</label>
                    <input type="tel" id="sale_phone" placeholder="33999999999" style="font-size:12px; padding:6px;">
                </div>
            </div>

            <div class="form-group" style="margin-bottom:12px;">
                <label style="font-size:11px; color:#94A3B8;">Endereço de Entrega / Observação</label>
                <input type="text" id="sale_address" placeholder="Rua, Número, Bairro (ou Balcão)" style="font-size:12px; padding:6px;">
            </div>

            <!-- ADICIONAR ITENS DO CARDÁPIO -->
            <div style="border-top:1px solid #334155; padding-top:10px; margin-top:10px;">
                <div style="font-size:12px; font-weight:700; color:#FF6B35; margin-bottom:8px;">🛍️ Adicionar Itens do Cardápio</div>
                <div style="display:flex; gap:6px; margin-bottom:10px;">
                    <select id="sale_product_select" style="flex:1; font-size:12px; padding:6px;">
                        <option value="">-- Selecione o Prato/Item --</option>
                        ${productOptions}
                    </select>
                    <input type="number" id="sale_product_qty" value="1" min="1" style="width:60px; font-size:12px; padding:6px; text-align:center;">
                    <button class="btn btn-sm btn-success" onclick="SalesManager.addItemToSale()" style="width:auto; padding:0 12px;">+ Add</button>
                </div>

                <!-- LISTA DE ITENS SELECIONADOS -->
                <div id="sale_selected_items_list" style="background:#0F172A; border:1px solid #334155; border-radius:8px; padding:8px; min-height:60px; margin-bottom:12px;">
                    <div style="color:#94A3B8; font-size:11px; text-align:center; padding:15px;">Nenhum item adicionado ainda.</div>
                </div>
            </div>

            <!-- VALORES, DESCONTO E TOTAL -->
            <div style="background:#1E293B; border-radius:8px; padding:10px; border:1px solid #334155;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#CBD5E1; margin-bottom:6px;">
                    <span>Subtotal dos Itens:</span>
                    <strong id="sale_subtotal_display" style="color:#F1F5F9;">R$ 0,00</strong>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; align-items:center;">
                    <div>
                        <label style="font-size:11px; color:#94A3B8;">Desconto (R$)</label>
                        <input type="number" step="0.01" id="sale_discount_input" value="0.00" oninput="SalesManager.updateSaleTotals()" style="font-size:12px; padding:6px;">
                    </div>
                    <div>
                        <label style="font-size:11px; color:#94A3B8;">Valor Final a Cobrar</label>
                        <input type="number" step="0.01" id="sale_final_total" value="0.00" style="font-size:14px; font-weight:800; color:#10B981; padding:6px;">
                    </div>
                </div>
            </div>

            <button class="btn btn-large" onclick="SalesManager.saveManualSale()" style="margin-top:14px;">💾 Finalizar Venda Manual</button>
        `;

        if (typeof openModal === 'function') {
            openModal('💰 Nova Venda / Entrada Manual', modalBody);
        }
    },

    onSelectCustomer(selectEl) {
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        const name = selectEl.value;
        const phone = selectedOption.getAttribute('data-phone') || '';
        const address = selectedOption.getAttribute('data-address') || '';

        const nameInput = document.getElementById('sale_client_name');
        const phoneInput = document.getElementById('sale_phone');
        const addressInput = document.getElementById('sale_address');

        if (nameInput) nameInput.value = name;
        if (phoneInput) phoneInput.value = phone;
        if (addressInput) addressInput.value = address;
    },

    addItemToSale() {
        const select = document.getElementById('sale_product_select');
        const qtyInput = document.getElementById('sale_product_qty');
        
        if (!select || !select.value) return;

        const opt = select.options[select.selectedIndex];
        const id = select.value;
        const name = opt.getAttribute('data-name');
        const price = parseFloat(opt.getAttribute('data-price')) || 0;
        const qty = parseInt(qtyInput.value) || 1;

        this.currentSaleItems.push({
            id,
            name,
            price,
            qty,
            total: price * qty
        });

        this.renderSelectedItemsList();
        this.updateSaleTotals();
    },

    removeItemFromSale(index) {
        this.currentSaleItems.splice(index, 1);
        this.renderSelectedItemsList();
        this.updateSaleTotals();
    },

    renderSelectedItemsList() {
        const container = document.getElementById('sale_selected_items_list');
        if (!container) return;

        if (this.currentSaleItems.length === 0) {
            container.innerHTML = '<div style="color:#94A3B8; font-size:11px; text-align:center; padding:15px;">Nenhum item adicionado ainda.</div>';
            return;
        }

        container.innerHTML = this.currentSaleItems.map((item, idx) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #1E293B; font-size:12px;">
                <div>
                    <strong style="color:#F1F5F9;">${item.qty}x ${item.name}</strong>
                    <div style="font-size:10px; color:#94A3B8;">Unit: R$ ${item.price.toFixed(2)}</div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="color:#10B981; font-weight:700;">R$ ${item.total.toFixed(2)}</span>
                    <button class="btn btn-sm" onclick="SalesManager.removeItemFromSale(${idx})" style="background:#EF4444; color:#fff; padding:1px 6px; font-size:10px;">✕</button>
                </div>
            </div>
        `).join('');
    },

    updateSaleTotals() {
        const subtotal = this.currentSaleItems.reduce((acc, i) => acc + i.total, 0);
        const discount = parseFloat(document.getElementById('sale_discount_input')?.value) || 0;
        const finalTotal = Math.max(0, subtotal - discount);

        const subtotalEl = document.getElementById('sale_subtotal_display');
        const finalTotalInput = document.getElementById('sale_final_total');

        if (subtotalEl) subtotalEl.textContent = `R$ ${subtotal.toFixed(2)}`;
        if (finalTotalInput) finalTotalInput.value = finalTotal.toFixed(2);
    },

    async saveManualSale() {
        const client_name = document.getElementById('sale_client_name')?.value.trim() || 'Cliente Balcão';
        const phone = document.getElementById('sale_phone')?.value.trim() || '';
        const address = document.getElementById('sale_address')?.value.trim() || 'Venda no Balcão';
        const discount = parseFloat(document.getElementById('sale_discount_input')?.value) || 0;
        const total = parseFloat(document.getElementById('sale_final_total')?.value) || 0;

        if (this.currentSaleItems.length === 0 && total <= 0) {
            return alert('Adicione pelo menos um item ou informe o valor da venda!');
        }

        const subtotal = this.currentSaleItems.reduce((acc, i) => acc + i.total, 0);

        const orderData = {
            client_name,
            phone,
            address,
            order_type: 'pickup',
            payment_method: 'Dinheiro/Pix',
            items: this.currentSaleItems,
            subtotal: subtotal > 0 ? subtotal : total,
            delivery_fee: 0,
            discount: discount,
            total: total,
            status: 'completed',
            created_at: new Date().toISOString()
        };

        try {
            if (typeof dbClient !== 'undefined') {
                await dbClient.from('orders').insert([orderData]);
            }

            if (typeof showToast === 'function') showToast('Venda manual registrada com sucesso!');
            if (typeof closeModal === 'function') closeModal();

            if (typeof renderDashboard === 'function') renderDashboard();
            if (typeof OrdersManager !== 'undefined') OrdersManager.fetchOrders();

        } catch (e) {
            console.error('Erro ao registrar venda:', e);
            alert('Erro ao salvar venda.');
        }
    }
};

window.openSaleModal = () => SalesManager.openSaleModal();
