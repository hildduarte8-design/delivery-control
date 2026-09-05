// js/sales.js - Vendas Manuais de Balcão (Integrado ao Fluxo de Pedidos com Data Retroativa + Alerta Fidelidade)

if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = function(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(text ?? '')));
        return div.innerHTML;
    };
}

function parseDateSafe(dateInput) {
    if (!dateInput) return new Date();
    if (dateInput instanceof Date) return dateInput;
    const isoStr = String(dateInput).replace(' ', 'T');
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? new Date() : d;
}

const SalesManager = {
    currentSaleItems: [],
    customersCache: [],
    productsCache: [],

    async getCustomersList() {
        let list = [];

        if (typeof CustomersManager !== 'undefined' && Array.isArray(CustomersManager.allCustomers) && CustomersManager.allCustomers.length > 0) {
            list = CustomersManager.allCustomers;
        }

        if (list.length === 0 && typeof dbClient !== 'undefined') {
            try {
                const { data } = await dbClient.from('customers').select('*').order('name', { ascending: true });
                if (data && data.length > 0) list = data;
            } catch (e) {
                console.warn('Erro ao buscar tabela customers:', e);
            }
        }

        if (list.length === 0) {
            try {
                list = JSON.parse(localStorage.getItem('dly_customers') || '[]');
            } catch (e) {
                list = [];
            }
        }

        if (list.length === 0) {
            let orders = [];
            if (typeof state !== 'undefined' && Array.isArray(state.orders) && state.orders.length > 0) {
                orders = state.orders;
            } else {
                try {
                    orders = JSON.parse(localStorage.getItem('dly_orders') || '[]');
                } catch (e) {
                    orders = [];
                }
            }

            if (orders.length === 0 && typeof dbClient !== 'undefined') {
                try {
                    const { data } = await dbClient.from('orders').select('*');
                    if (data) orders = data;
                } catch (e) {}
            }

            const map = new Map();
            orders.forEach(o => {
                const name = o.customer_name || o.client_name || o.customerName;
                const phone = o.customer_phone || o.phone || o.customerPhone || '';
                const address = o.delivery_address || o.address || '';

                if (name && name !== 'Cliente Balcão') {
                    const key = phone ? phone : name.toLowerCase();
                    if (!map.has(key)) {
                        map.set(key, { id: key, name, phone, address, loyalty_stamps: 0 });
                    }
                }
            });

            list = Array.from(map.values());
        }

        return list;
    },

    async getProductsList() {
        let products = window.currentAdminProducts || [];

        if (products.length === 0 && typeof state !== 'undefined' && Array.isArray(state.menu)) {
            products = state.menu;
        }

        if (products.length === 0 && typeof dbClient !== 'undefined') {
            try {
                const { data } = await dbClient.from('products').select('*').eq('is_active', true);
                if (data && data.length > 0) products = data;
            } catch (e) {}
        }

        if (products.length === 0) {
            try {
                products = JSON.parse(localStorage.getItem('dly_menu') || '[]');
            } catch (e) {
                products = [];
            }
        }

        return products;
    },

    async openSaleModal() {
        this.currentSaleItems = [];

        const customers = await this.getCustomersList();
        const products = await this.getProductsList();

        this.customersCache = customers;
        this.productsCache = products;

        // Data e hora local padrão para o input
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        const defaultDateTime = now.toISOString().slice(0, 16);

        const customerOptions = customers.map(c => {
            const name = escapeHtml(c.name || 'Cliente');
            const phone = escapeHtml(c.phone || c.whatsapp || '');
            const address = escapeHtml(c.address || c.delivery_address || '');
            const stamps = Number(c.loyalty_stamps || c.loyaltyStamps || 0);
            const badge = stamps >= 10 ? ' 🎁 (PASTEL GRÁTIS!)' : stamps > 0 ? ` 🎟️ (${stamps}/10)` : '';

            return `<option value="${escapeHtml(c.id || name)}" data-name="${name}" data-phone="${phone}" data-address="${address}" data-stamps="${stamps}">${name} ${phone ? '(' + phone + ')' : ''}${badge}</option>`;
        }).join('');

        const productOptions = products.map(p => {
            const price = Number(p.price || 0);
            const priceFormatted = price.toFixed(2).replace('.', ',');
            return `<option value="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}" data-price="${price}">${escapeHtml(p.name)} - R$ ${priceFormatted}</option>`;
        }).join('');

        const modalBody = `
            <div style="padding:2px;">
                <!-- CAMPO DE SELEÇÃO DE DATA RETROATIVA -->
                <div class="form-group" style="margin-bottom:10px;">
                    <label style="font-size:11px; color:#F59E0B; font-weight:700;">📅 Data e Hora do Pedido *</label>
                    <input type="datetime-local" id="sale_created_at" value="${defaultDateTime}" style="font-size:12px; padding:8px; width:100%; background:#0F172A; color:#F1F5F9; border:1px solid #334155; border-radius:6px;">
                    <small style="color:#94A3B8; font-size:10px; display:block; margin-top:2px;">
                        Altere este campo para lançar pedidos retroativos de dias anteriores.
                    </small>
                </div>

                <div class="form-group" style="margin-bottom:10px;">
                    <label style="font-size:12px; color:#CBD5E1;">Cliente Cadastrado (Opcional)</label>
                    <select id="sale_customer_select" onchange="SalesManager.onSelectCustomer(this.value)" style="font-size:13px; padding:8px; width:100%; background:#0F172A; color:#F1F5F9; border:1px solid #334155; border-radius:6px;">
                        <option value="">-- Cliente Avulso / Balcão --</option>
                        ${customerOptions}
                    </select>
                </div>

                <!-- ALERTA DE FIDELIDADE / PASTEL GRÁTIS -->
                <div id="sale_loyalty_alert" style="display:none; margin-bottom:10px; padding:8px 10px; border-radius:6px; font-size:12px; font-weight:bold;"></div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:10px;">
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:11px; color:#94A3B8;">Nome do Cliente</label>
                        <input type="text" id="sale_client_name" placeholder="Ex: Maria Souza" style="font-size:12px; padding:8px; background:#0F172A; color:#F1F5F9; border:1px solid #334155; border-radius:6px;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:11px; color:#94A3B8;">WhatsApp</label>
                        <input type="tel" id="sale_phone" placeholder="33999999999" style="font-size:12px; padding:8px; background:#0F172A; color:#F1F5F9; border:1px solid #334155; border-radius:6px;">
                    </div>
                </div>

                <div class="form-group" style="margin-bottom:10px;">
                    <label style="font-size:11px; color:#94A3B8;">Endereço de Entrega / Observação</label>
                    <input type="text" id="sale_address" placeholder="Rua, Número, Bairro (ou Balcão)" style="font-size:12px; padding:8px; background:#0F172A; color:#F1F5F9; border:1px solid #334155; border-radius:6px; width:100%;">
                </div>

                <div class="form-group" style="margin-bottom:12px;">
                    <label style="font-size:11px; color:#94A3B8;">Forma de Pagamento *</label>
                    <select id="sale_payment_method" style="font-size:12px; padding:8px; width:100%; background:#0F172A; color:#F1F5F9; border:1px solid #334155; border-radius:6px;">
                        <option value="Pix">⚡ Pix</option>
                        <option value="Cartão">💳 Cartão de Débito/Crédito</option>
                        <option value="Dinheiro">💵 Dinheiro (Em espécie)</option>
                    </select>
                </div>

                <div style="border-top:1px solid #334155; padding-top:10px; margin-top:10px;">
                    <div style="font-size:12px; font-weight:700; color:#FF6B35; margin-bottom:8px;">🛍️ Adicionar Itens do Cardápio</div>
                    <div style="display:flex; gap:6px; margin-bottom:10px;">
                        <select id="sale_product_select" style="flex:1; font-size:12px; padding:8px; background:#1E293B; color:#F1F5F9; border:1px solid #475569; border-radius:6px;">
                            <option value="">-- Selecione o Prato/Item --</option>
                            ${productOptions}
                        </select>
                        <input type="number" id="sale_product_qty" value="1" min="1" style="width:60px; font-size:12px; padding:8px; text-align:center; background:#1E293B; color:#F1F5F9; border:1px solid #475569; border-radius:6px;">
                        <button class="btn btn-sm btn-success" onclick="SalesManager.addItemToSale()" style="width:auto; padding:0 14px; font-weight:700; min-height:40px; touch-action:manipulation;">+ Add</button>
                    </div>

                    <div id="sale_selected_items_list" style="background:#0F172A; border:1px solid #334155; border-radius:8px; padding:8px; min-height:60px; margin-bottom:12px;">
                        <div style="color:#94A3B8; font-size:11px; text-align:center; padding:15px;">Nenhum item adicionado ainda.</div>
                    </div>
                </div>

                <div style="background:#1E293B; border-radius:8px; padding:10px; border:1px solid #334155;">
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#CBD5E1; margin-bottom:6px;">
                        <span>Subtotal dos Itens:</span>
                        <strong id="sale_subtotal_display" style="color:#F1F5F9;">R$ 0,00</strong>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; align-items:center;">
                        <div>
                            <label style="font-size:11px; color:#94A3B8;">Desconto (R$)</label>
                            <input type="number" step="0.01" id="sale_discount_input" value="0.00" oninput="SalesManager.updateSaleTotals()" style="font-size:12px; padding:8px; background:#0F172A; color:#F1F5F9; border:1px solid #334155; border-radius:6px; width:100%;">
                        </div>
                        <div>
                            <label style="font-size:11px; color:#94A3B8;">Valor Final a Cobrar</label>
                            <input type="number" step="0.01" id="sale_final_total" value="0.00" style="font-size:14px; font-weight:800; color:#10B981; padding:8px; background:#0F172A; border:1px solid #334155; border-radius:6px; width:100%;">
                        </div>
                    </div>
                </div>

                <button class="btn btn-large" onclick="SalesManager.saveManualSale()" style="margin-top:14px; background:#FF6B35; color:#fff; width:100%; min-height:48px; touch-action:manipulation;">💾 Lançar Pedido em Preparo</button>
            </div>
        `;

        if (typeof openModal === 'function') {
            openModal('💰 Nova Venda / Entrada Manual', modalBody);
        }
    },

    onSelectCustomer(val) {
        const alertBox = document.getElementById('sale_loyalty_alert');
        const nameInput = document.getElementById('sale_client_name');
        const phoneInput = document.getElementById('sale_phone');
        const addressInput = document.getElementById('sale_address');

        if (!val || !this.customersCache) {
            if (alertBox) alertBox.style.display = 'none';
            return;
        }

        const customer = this.customersCache.find(c => String(c.id) === String(val) || String(c.name) === String(val));
        if (!customer) {
            if (alertBox) alertBox.style.display = 'none';
            return;
        }

        if (nameInput) nameInput.value = customer.name || '';
        if (phoneInput) phoneInput.value = customer.phone || customer.whatsapp || '';
        if (addressInput) addressInput.value = customer.address || customer.delivery_address || '';

        // Exibe alerta do Cartão Fidelidade se aplicável
        const stamps = Number(customer.loyalty_stamps || customer.loyaltyStamps || 0);

        if (alertBox) {
            if (stamps >= 10) {
                alertBox.style.display = 'block';
                alertBox.style.background = 'rgba(16, 185, 129, 0.2)';
                alertBox.style.border = '1px solid #10B981';
                alertBox.style.color = '#10B981';
                alertBox.innerHTML = `🎁 <strong>CLIENTE VIP!</strong> Este cliente completou 10 carimbos e tem direito a <strong>1 Pastel Grátis (Frango ou Queijo)</strong> neste pedido!`;
            } else if (stamps > 0) {
                alertBox.style.display = 'block';
                alertBox.style.background = 'rgba(245, 158, 11, 0.15)';
                alertBox.style.border = '1px solid #F59E0B';
                alertBox.style.color = '#F59E0B';
                alertBox.innerHTML = `🎟️ <strong>Cartão Fidelidade:</strong> ${stamps}/10 carimbos acumulados (Mínimo R$ 25,00 por carimbo).`;
            } else {
                alertBox.style.display = 'none';
            }
        }
    },

    addItemToSale() {
        const select = document.getElementById('sale_product_select');
        const qtyInput = document.getElementById('sale_product_qty');
        
        if (!select || !select.value) return;

        const opt = select.options[select.selectedIndex];
        const id = select.value;
        const name = opt.getAttribute('data-name') || '';
        const price = parseFloat(opt.getAttribute('data-price')) || 0;
        const qty = Math.max(1, parseInt(qtyInput?.value) || 1);

        const existingItem = this.currentSaleItems.find(i => String(i.id) === String(id));
        if (existingItem) {
            existingItem.qty += qty;
            existingItem.total = existingItem.price * existingItem.qty;
        } else {
            this.currentSaleItems.push({
                uid: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                id,
                name,
                price,
                qty,
                total: price * qty
            });
        }

        this.renderSelectedItemsList();
        this.updateSaleTotals();
    },

    removeItemFromSale(uid) {
        this.currentSaleItems = this.currentSaleItems.filter(i => String(i.uid) !== String(uid));
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

        container.innerHTML = this.currentSaleItems.map(item => {
            const priceFormatted = item.price.toFixed(2).replace('.', ',');
            const totalFormatted = item.total.toFixed(2).replace('.', ',');
            const safeUid = escapeHtml(item.uid);

            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #1E293B; font-size:12px;">
                    <div>
                        <strong style="color:#F1F5F9;">${item.qty}x ${escapeHtml(item.name)}</strong>
                        <div style="font-size:10px; color:#94A3B8;">Unit: R$ ${priceFormatted}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="color:#10B981; font-weight:700;">R$ ${totalFormatted}</span>
                        <button class="btn btn-sm" onclick="SalesManager.removeItemFromSale('${safeUid}')" style="background:#EF4444; color:#fff; padding:4px 8px; min-height:32px; font-size:10px; touch-action:manipulation;">✕</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    updateSaleTotals() {
        const subtotal = this.currentSaleItems.reduce((acc, i) => acc + i.total, 0);
        const discount = parseFloat(document.getElementById('sale_discount_input')?.value) || 0;
        const finalTotal = Math.max(0, subtotal - discount);

        const subtotalEl = document.getElementById('sale_subtotal_display');
        const finalTotalInput = document.getElementById('sale_final_total');

        if (subtotalEl) subtotalEl.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
        if (finalTotalInput) finalTotalInput.value = finalTotal.toFixed(2);
    },

    async saveManualSale() {
        const createdAtInput = document.getElementById('sale_created_at')?.value;
        const client_name = document.getElementById('sale_client_name')?.value.trim() || 'Cliente Balcão';
        const phone = document.getElementById('sale_phone')?.value.trim() || '';
        const address = document.getElementById('sale_address')?.value.trim() || 'Venda no Balcão';
        const payment_method = document.getElementById('sale_payment_method')?.value || 'Pix';
        const discount = parseFloat(document.getElementById('sale_discount_input')?.value) || 0;
        const total = parseFloat(document.getElementById('sale_final_total')?.value) || 0;

        if (this.currentSaleItems.length === 0 && total <= 0) {
            if (typeof showToast === 'function') showToast('Adicione pelo menos um item ou informe o valor!', 'error');
            else alert('Adicione pelo menos um item ou informe o valor!');
            return;
        }

        const subtotal = this.currentSaleItems.reduce((acc, i) => acc + i.total, 0);

        const orderId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
            ? `sale_${crypto.randomUUID()}` 
            : `sale_${Date.now()}`;

        // Processa a data do pedido: retroativa ou atual
        const orderDate = createdAtInput ? new Date(createdAtInput).toISOString() : new Date().toISOString();

        const orderData = {
            id: orderId,
            client_name,
            customer_name: client_name,
            phone,
            customer_phone: phone,
            address,
            delivery_address: address,
            order_type: 'pickup',
            payment_method: payment_method,
            items: this.currentSaleItems,
            subtotal: subtotal > 0 ? subtotal : total,
            delivery_fee: 0,
            discount: discount,
            total: total,
            status: 'preparing',
            source: 'Manual',
            created_at: orderDate
        };

        let savedToCloud = false;

        try {
            if (typeof dbClient !== 'undefined') {
                const { error } = await dbClient.from('orders').insert([orderData]);
                if (!error) {
                    savedToCloud = true;
                } else {
                    console.warn('Erro retornado pelo Supabase:', error);
                }

                // Sincroniza tabela de clientes automaticamente
                if (phone || client_name !== 'Cliente Balcão') {
                    try {
                        await dbClient.from('customers').upsert([{
                            name: client_name,
                            phone: phone || null,
                            address: address !== 'Venda no Balcão' ? address : null,
                            last_order_at: orderDate
                        }], { onConflict: 'phone' });
                    } catch (errCust) {
                        console.warn('Erro ao atualizar cadastro do cliente:', errCust);
                    }
                }
            }
        } catch (e) {
            console.error('Erro ao salvar no Supabase:', e);
        }

        let localSales = [];
        try {
            localSales = JSON.parse(localStorage.getItem('dly_sales') || '[]');
        } catch (e) {
            localSales = [];
        }

        localSales.unshift(orderData);
        localStorage.setItem('dly_sales', JSON.stringify(localSales));

        if (typeof state !== 'undefined') {
            if (!Array.isArray(state.orders)) state.orders = [];
            state.orders.unshift(orderData);
            if (!Array.isArray(state.sales)) state.sales = [];
            state.sales.unshift(orderData);
            if (typeof DB !== 'undefined') {
                DB.save('dly_orders', state.orders);
                DB.save('dly_sales', state.sales);
            }
        }

        if (typeof showToast === 'function') {
            showToast(savedToCloud ? 'Pedido registrado no histórico!' : 'Pedido salvo localmente!');
        }
        if (typeof closeModal === 'function') closeModal();

        if (typeof renderSalesList === 'function') renderSalesList();
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof OrdersManager !== 'undefined' && OrdersManager.fetchOrders) OrdersManager.fetchOrders();
    }
};

async function renderSalesList() {
    const container = document.getElementById('salesList');
    if (!container) return;

    let sales = [];
    try {
        if (typeof dbClient !== 'undefined') {
            const { data, error } = await dbClient.from('orders').select('*').order('created_at', { ascending: false });
            if (!error && data) {
                sales = data.filter(s => s.source === 'Manual' || String(s.id).startsWith('sale_'));
            }
        }
    } catch (e) {
        console.warn('Erro ao carregar vendas manuais:', e);
    }

    if (sales.length === 0) {
        try {
            sales = JSON.parse(localStorage.getItem('dly_sales') || '[]');
        } catch (e) {
            sales = [];
        }
    }

    if (sales.length === 0) {
        container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px; font-size:12px;">Nenhuma venda manual registrada ainda.</div>';
        return;
    }

    container.innerHTML = sales.map(s => {
        let itemsList = s.items;
        if (typeof itemsList === 'string') {
            try { itemsList = JSON.parse(itemsList); } catch (e) { itemsList = []; }
        }
        const itemsCount = Array.isArray(itemsList) ? itemsList.length : 0;

        const totalFormatted = Number(s.total || 0).toFixed(2).replace('.', ',');
        const dateStr = parseDateSafe(s.created_at || s.createdAt).toLocaleDateString('pt-BR');

        return `
            <div class="card" style="margin-bottom:8px; padding:12px; background:#1E293B; border-left:4px solid #10B981; border-radius:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="color:#F1F5F9; font-size:13px; display:block;">👤 ${escapeHtml(s.client_name || s.customer_name || s.customerName || 'Cliente Balcão')}</strong>
                        <span style="font-size:11px; color:#94A3B8;">
                            ${dateStr} • ${escapeHtml(s.payment_method || 'Pix')} • ${itemsCount} item(ns)
                        </span>
                    </div>
                    <strong style="color:#10B981; font-size:15px;">R$ ${totalFormatted}</strong>
                </div>
            </div>
        `;
    }).join('');
}

window.SalesManager = SalesManager;
window.openSaleModal = () => SalesManager.openSaleModal();
window.renderSalesList = renderSalesList;

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('salesList')) {
        renderSalesList();
    }
});
