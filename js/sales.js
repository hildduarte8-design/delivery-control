// js/sales.js - Vendas Manuais de Balcão (Carregamento Dinâmico de Clientes e Produtos)

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(text || '')));
    return div.innerHTML;
}

const SalesManager = {
    currentSaleItems: [],
    customersCache: [],
    productsCache: [],

    async openSaleModal() {
        this.currentSaleItems = [];

        const modalBody = `
            <div style="padding:2px;">
                <!-- SELEÇÃO DE CLIENTE CADASTRADO -->
                <div class="form-group" style="margin-bottom:10px;">
                    <label style="font-size:12px; color:#CBD5E1;">Cliente Cadastrado (Opcional)</label>
                    <select id="sale_customer_select" onchange="SalesManager.onSelectCustomer(this.value)" style="font-size:13px; padding:8px; width:100%; background:#0F172A; color:#F1F5F9; border:1px solid #334155;">
                        <option value="">🔄 Carregando clientes...</option>
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
                        <select id="sale_product_select" style="flex:1; font-size:12px; padding:6px; background:#1E293B; color:#F1F5F9; border:1px solid #475569;">
                            <option value="">🔄 Carregando pratos...</option>
                        </select>
                        <input type="number" id="sale_product_qty" value="1" min="1" style="width:60px; font-size:12px; padding:6px; text-align:center;">
                        <button class="btn btn-sm btn-success" onclick="SalesManager.addItemToSale()" style="width:auto; padding:0 12px; font-weight:700;">+ Add</button>
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

                <button class="btn btn-large" onclick="SalesManager.saveManualSale()" style="margin-top:14px; background:#FF6B35; color:#fff;">💾 Finalizar Venda Manual</button>
            </div>
        `;

        if (typeof openModal === 'function') {
            openModal('💰 Nova Venda / Entrada Manual', modalBody);
        }

        // Popula as listas assincronamente após renderizar o modal
        setTimeout(async () => {
            await this.loadCustomersDropdown();
            await this.loadProductsDropdown();
        }, 50);
    },

    async loadCustomersDropdown() {
        const selectEl = document.getElementById('sale_customer_select');
        if (!selectEl) return;

        let customers = [];
        try {
            if (typeof dbClient !== 'undefined') {
                const { data, error } = await dbClient.from('customers').select('*').order('name', { ascending: true });
                if (!error && data && data.length > 0) customers = data;
            }
        } catch (e) {
            console.warn('Erro ao buscar clientes no Supabase:', e);
        }

        if (customers.length === 0 && typeof CustomersManager !== 'undefined' && CustomersManager.allCustomers) {
            customers = CustomersManager.allCustomers;
        }

        if (customers.length === 0 && typeof state !== 'undefined' && state.customers) {
            customers = state.customers;
        }

        if (customers.length === 0) {
            customers = JSON.parse(localStorage.getItem('dly_customers') || localStorage.getItem('customers') || '[]');
        }

        this.customersCache = customers;

        let optionsHtml = '<option value="">-- Cliente Avulso / Balcão --</option>';
        customers.forEach(c => {
            const name = escapeHtml(c.name || 'Cliente');
            const phone = escapeHtml(c.phone || c.whatsapp || '');
            optionsHtml += `<option value="${escapeHtml(c.id || name)}" data-name="${name}" data-phone="${phone}" data-address="${escapeHtml(c.address || '')}">${name} ${phone ? '(' + phone + ')' : ''}</option>`;
        });

        selectEl.innerHTML = optionsHtml;
    },

    onSelectCustomer(val) {
        if (!val || !this.customersCache) return;

        const customer = this.customersCache.find(c => String(c.id) === String(val) || String(c.name) === String(val));
        if (!customer) return;

        const nameInput = document.getElementById('sale_client_name');
        const phoneInput = document.getElementById('sale_phone');
        const addressInput = document.getElementById('sale_address');

        if (nameInput) nameInput.value = customer.name || '';
        if (phoneInput) phoneInput.value = customer.phone || customer.whatsapp || '';
        if (addressInput && customer.address) addressInput.value = customer.address;
    },

    async loadProductsDropdown() {
        const selectEl = document.getElementById('sale_product_select');
        if (!selectEl) return;

        let products = window.currentAdminProducts || [];
        if (products.length === 0 && typeof dbClient !== 'undefined') {
            try {
                const { data } = await dbClient.from('products').select('*').eq('is_active', true);
                products = data || [];
            } catch (e) {
                console.warn('Erro ao buscar produtos:', e);
            }
        }
        if (products.length === 0) {
            products = JSON.parse(localStorage.getItem('dly_menu') || '[]');
        }

        this.productsCache = products;

        let optionsHtml = '<option value="">-- Selecione o Prato/Item --</option>';
        products.forEach(p => {
            const price = Number(p.price || 0);
            optionsHtml += `<option value="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}" data-price="${price}">${escapeHtml(p.name)} - R$ ${price.toFixed(2)}</option>`;
        });

        selectEl.innerHTML = optionsHtml;
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

        const existingItem = this.currentSaleItems.find(i => i.id === id);
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
        this.currentSaleItems = this.currentSaleItems.filter(i => i.uid !== uid);
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

        container.innerHTML = this.currentSaleItems.map(item => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #1E293B; font-size:12px;">
                <div>
                    <strong style="color:#F1F5F9;">${item.qty}x ${escapeHtml(item.name)}</strong>
                    <div style="font-size:10px; color:#94A3B8;">Unit: R$ ${item.price.toFixed(2)}</div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="color:#10B981; font-weight:700;">R$ ${item.total.toFixed(2)}</span>
                    <button class="btn btn-sm" onclick="SalesManager.removeItemFromSale('${escapeHtml(item.uid)}')" style="background:#EF4444; color:#fff; padding:1px 6px; font-size:10px;">✕</button>
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
            if (typeof showToast === 'function') showToast('Adicione pelo menos um item ou informe o valor!', 'error');
            else alert('Adicione pelo menos um item ou informe o valor!');
            return;
        }

        const subtotal = this.currentSaleItems.reduce((acc, i) => acc + i.total, 0);

        const orderData = {
            id: `sale_${Date.now()}`,
            client_name,
            customer_name: client_name,
            phone,
            customer_phone: phone,
            address,
            delivery_address: address,
            order_type: 'pickup',
            payment_method: 'Dinheiro/Pix',
            items: this.currentSaleItems,
            subtotal: subtotal > 0 ? subtotal : total,
            delivery_fee: 0,
            discount: discount,
            total: total,
            status: 'completed',
            source: 'Manual',
            created_at: new Date().toISOString()
        };

        let savedToCloud = false;

        try {
            if (typeof dbClient !== 'undefined') {
                const { error } = await dbClient.from('orders').insert([orderData]);
                if (!error) savedToCloud = true;
            }
        } catch (e) {
            console.error('Erro ao salvar no Supabase:', e);
        }

        let localSales = JSON.parse(localStorage.getItem('dly_sales') || '[]');
        localSales.unshift(orderData);
        localStorage.setItem('dly_sales', JSON.stringify(localSales));

        if (typeof state !== 'undefined') {
            if (!Array.isArray(state.sales)) state.sales = [];
            state.sales.unshift(orderData);
            if (typeof DB !== 'undefined') DB.save('dly_sales', state.sales);
        }

        if (typeof showToast === 'function') {
            showToast(savedToCloud ? 'Venda manual registrada com sucesso!' : 'Venda registrada localmente (offline)');
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
            const { data, error } = await dbClient.from('orders').select('*').eq('source', 'Manual').order('created_at', { ascending: false });
            if (!error && data) sales = data;
        }
    } catch (e) {
        console.warn('Erro ao carregar vendas manuais:', e);
    }

    if (sales.length === 0) {
        sales = JSON.parse(localStorage.getItem('dly_sales') || '[]');
    }

    if (sales.length === 0) {
        container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:20px; font-size:12px;">Nenhuma venda manual registrada ainda.</div>';
        return;
    }

    container.innerHTML = sales.map(s => `
        <div class="card" style="margin-bottom:8px; padding:12px; background:#1E293B; border-left:4px solid #10B981;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="color:#F1F5F9; font-size:13px; display:block;">👤 ${escapeHtml(s.client_name || s.customer_name || s.customerName || 'Cliente Balcão')}</strong>
                    <span style="font-size:11px; color:#94A3B8;">
                        ${new Date(s.created_at || s.createdAt).toLocaleDateString('pt-BR')} • ${s.items?.length || 0} item(ns)
                    </span>
                </div>
                <strong style="color:#10B981; font-size:15px;">R$ ${Number(s.total || 0).toFixed(2)}</strong>
            </div>
        </div>
    `).join('');
}

window.SalesManager = SalesManager;
window.openSaleModal = () => SalesManager.openSaleModal();
window.renderSalesList = renderSalesList;

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('salesList')) {
        renderSalesList();
    }
});
