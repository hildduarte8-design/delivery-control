// js/sales.js - Vendas Manuais de Balcão (Busca por WhatsApp + Fidelidade + Cardápio Visual)

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
    draftForm: null, // Guarda temporariamente os dados digitados ao abrir o cardápio visual
    selectedCategory: 'all',

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

    saveDraftForm() {
        this.draftForm = {
            createdAt: document.getElementById('sale_created_at')?.value || '',
            phone: document.getElementById('sale_phone')?.value || '',
            clientName: document.getElementById('sale_client_name')?.value || '',
            customerSelect: document.getElementById('sale_customer_select')?.value || '',
            address: document.getElementById('sale_address')?.value || '',
            paymentMethod: document.getElementById('sale_payment_method')?.value || 'Pix',
            discount: document.getElementById('sale_discount_input')?.value || '0.00'
        };
    },

    async openSaleModal(isRestoring = false) {
        if (!isRestoring) {
            this.currentSaleItems = [];
            this.draftForm = null;
        }

        const customers = await this.getCustomersList();
        const products = await this.getProductsList();

        this.customersCache = customers;
        this.productsCache = products;

        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        const defaultDateTime = this.draftForm?.createdAt || now.toISOString().slice(0, 16);

        const customerOptions = customers.map(c => {
            const name = escapeHtml(c.name || 'Cliente');
            const phone = escapeHtml(c.phone || c.whatsapp || '');
            const stamps = Number(c.loyalty_stamps || c.loyaltyStamps || 0);
            const badge = stamps >= 10 ? ' 🎁 (PASTEL GRÁTIS!)' : stamps > 0 ? ` 🎟️ (${stamps}/10)` : '';

            return `<option value="${escapeHtml(c.id || name)}">${name} ${phone ? '(' + phone + ')' : ''}${badge}</option>`;
        }).join('');

        const productOptions = products.map(p => {
            const price = Number(p.price || 0);
            const priceFormatted = price.toFixed(2).replace('.', ',');
            return `<option value="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}" data-price="${price}">${escapeHtml(p.name)} - R$ ${priceFormatted}</option>`;
        }).join('');

        const modalBody = `
            <div style="padding:2px; box-sizing:border-box; width:100%;">
                <!-- CAMPO DE SELEÇÃO DE DATA RETROATIVA -->
                <div class="form-group" style="margin-bottom:10px;">
                    <label style="font-size:11px; color:#F59E0B; font-weight:700;">📅 Data e Hora do Pedido *</label>
                    <input type="datetime-local" id="sale_created_at" value="${defaultDateTime}" style="font-size:12px; padding:8px; width:100%; background:#0F172A; color:#F1F5F9; border:1px solid #334155; border-radius:6px; box-sizing:border-box;">
                </div>

                <!-- 1. WHATSAPP EM DESTAQUE PARA BUSCA AUTOMÁTICA -->
                <div class="form-group" style="margin-bottom:10px;">
                    <label style="font-size:12px; color:#25D366; font-weight:800;">📱 WhatsApp / Telefone do Cliente *</label>
                    <input type="tel" id="sale_phone" placeholder="Digite o DDD + Número (ex: 33999999999)" oninput="SalesManager.lookupCustomerByPhone(this.value)" autofocus style="font-size:14px; font-weight:bold; padding:10px; background:#0F172A; color:#25D366; border:2px solid #25D366; border-radius:8px; width:100%; box-sizing:border-box;">
                    <small style="color:#94A3B8; font-size:10px; display:block; margin-top:2px;">
                        Digite o número para puxar o nome, endereço e pontos do cliente automaticamente.
                    </small>
                </div>

                <!-- ALERTA DE FIDELIDADE / NOVO CLIENTE -->
                <div id="sale_loyalty_alert" style="display:none; margin-bottom:10px; padding:8px 10px; border-radius:6px; font-size:12px; font-weight:bold;"></div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:10px;">
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:11px; color:#94A3B8;">Nome do Cliente *</label>
                        <input type="text" id="sale_client_name" placeholder="Ex: Maria Souza" style="font-size:12px; padding:8px; background:#0F172A; color:#F1F5F9; border:1px solid #334155; border-radius:6px; width:100%; box-sizing:border-box;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:11px; color:#94A3B8;">Buscar por Nome (Opção)</label>
                        <select id="sale_customer_select" onchange="SalesManager.onSelectCustomer(this.value)" style="font-size:12px; padding:8px; width:100%; background:#0F172A; color:#F1F5F9; border:1px solid #334155; border-radius:6px; box-sizing:border-box;">
                            <option value="">-- Ou selecione da lista --</option>
                            ${customerOptions}
                        </select>
                    </div>
                </div>

                <div class="form-group" style="margin-bottom:10px;">
                    <label style="font-size:11px; color:#94A3B8;">Endereço de Entrega / Observação</label>
                    <input type="text" id="sale_address" placeholder="Rua, Número, Bairro (ou Balcão)" style="font-size:12px; padding:8px; background:#0F172A; color:#F1F5F9; border:1px solid #334155; border-radius:6px; width:100%; box-sizing:border-box;">
                </div>

                <div class="form-group" style="margin-bottom:12px;">
                    <label style="font-size:11px; color:#94A3B8;">Forma de Pagamento *</label>
                    <select id="sale_payment_method" style="font-size:12px; padding:8px; width:100%; background:#0F172A; color:#F1F5F9; border:1px solid #334155; border-radius:6px; box-sizing:border-box;">
                        <option value="Pix">⚡ Pix</option>
                        <option value="Cartão">💳 Cartão de Débito/Crédito</option>
                        <option value="Dinheiro">💵 Dinheiro (Em espécie)</option>
                    </select>
                </div>

                <!-- BOTÃO DE DESTAQUE: CARDÁPIO VISUAL POR CATEGORIAS -->
                <div style="border-top:1px solid #334155; padding-top:10px; margin-top:10px;">
                    <button type="button" class="btn" onclick="SalesManager.openVisualMenuModal()" style="width:100%; margin-bottom:10px; background:linear-gradient(135deg, #FF6B35, #F59E0B); color:#fff; font-weight:800; padding:12px; border-radius:8px; border:none; display:flex; align-items:center; justify-content:center; gap:8px; font-size:13px; box-shadow:0 4px 12px rgba(255,107,53,0.3); touch-action:manipulation;">
                        📱 🖼️ Selecionar pelo Cardápio Visual (Categorias & Fotos)
                    </button>

                    <!-- OPÇÃO RÁPIDA SECUNDÁRIA POR LISTA -->
                    <details style="margin-bottom:10px; background:#0F172A; border:1px solid #334155; border-radius:6px; padding:6px 10px;">
                        <summary style="font-size:11px; color:#94A3B8; cursor:pointer; font-weight:600;">Ou adicione rapidamente por lista suspensa</summary>
                        <div style="display:flex; gap:6px; margin-top:8px; width:100%; align-items:center; box-sizing:border-box;">
                            <select id="sale_product_select" style="flex:1; min-width:0; font-size:12px; padding:8px 6px; background:#1E293B; color:#F1F5F9; border:1px solid #475569; border-radius:6px; text-overflow:ellipsis;">
                                <option value="">-- Selecione o Prato/Item --</option>
                                ${productOptions}
                            </select>
                            <input type="number" id="sale_product_qty" value="1" min="1" style="width:48px; flex-shrink:0; font-size:12px; padding:8px 4px; text-align:center; background:#1E293B; color:#F1F5F9; border:1px solid #475569; border-radius:6px; box-sizing:border-box;">
                            <button class="btn btn-sm btn-success" onclick="SalesManager.addItemToSale()" style="flex-shrink:0; width:auto; padding:0 12px; font-weight:700; min-height:36px; touch-action:manipulation;">+ Add</button>
                        </div>
                    </details>

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
                            <input type="number" step="0.01" id="sale_discount_input" value="${this.draftForm?.discount || '0.00'}" oninput="SalesManager.updateSaleTotals()" style="font-size:12px; padding:8px; background:#0F172A; color:#F1F5F9; border:1px solid #334155; border-radius:6px; width:100%; box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="font-size:11px; color:#94A3B8;">Valor Final a Cobrar</label>
                            <input type="number" step="0.01" id="sale_final_total" value="0.00" style="font-size:14px; font-weight:800; color:#10B981; padding:8px; background:#0F172A; border:1px solid #334155; border-radius:6px; width:100%; box-sizing:border-box;">
                        </div>
                    </div>
                </div>

                <button class="btn btn-large" onclick="SalesManager.saveManualSale()" style="margin-top:14px; background:#FF6B35; color:#fff; width:100%; min-height:48px; touch-action:manipulation;">💾 Lançar Pedido</button>
            </div>
        `;

        if (typeof openModal === 'function') {
            openModal('💰 Nova Venda / Entrada Manual', modalBody);
        }

        // Restaura campos preenchidos previamente se estiver voltando do Cardápio Visual
        if (this.draftForm) {
            if (document.getElementById('sale_phone')) document.getElementById('sale_phone').value = this.draftForm.phone;
            if (document.getElementById('sale_client_name')) document.getElementById('sale_client_name').value = this.draftForm.clientName;
            if (document.getElementById('sale_customer_select')) document.getElementById('sale_customer_select').value = this.draftForm.customerSelect;
            if (document.getElementById('sale_address')) document.getElementById('sale_address').value = this.draftForm.address;
            if (document.getElementById('sale_payment_method')) document.getElementById('sale_payment_method').value = this.draftForm.paymentMethod;
            if (document.getElementById('sale_discount_input')) document.getElementById('sale_discount_input').value = this.draftForm.discount;

            if (this.draftForm.phone) {
                this.lookupCustomerByPhone(this.draftForm.phone);
            }
        }

        this.renderSelectedItemsList();
        this.updateSaleTotals();
    },

    // ABRIR O CARDÁPIO VISUAL CATEGORIZADO
    openVisualMenuModal() {
        this.saveDraftForm();

        const categories = Array.from(new Set((this.productsCache || []).map(p => p.category || 'Geral')));
        
        const categoryPills = `
            <button class="btn btn-sm ${this.selectedCategory === 'all' ? '' : 'btn-secondary'}" onclick="SalesManager.filterCategory('all')" style="font-size:11px; padding:6px 12px; border-radius:14px; white-space:nowrap;">🔥 Todos</button>
            ${categories.map(cat => `
                <button class="btn btn-sm ${this.selectedCategory === cat ? '' : 'btn-secondary'}" onclick="SalesManager.filterCategory('${escapeHtml(cat)}')" style="font-size:11px; padding:6px 12px; border-radius:14px; white-space:nowrap;">📌 ${escapeHtml(cat)}</button>
            `).join('')}
        `;

        const modalBody = `
            <div style="padding:2px; box-sizing:border-box; width:100%;">
                <!-- BUSCA RÁPIDA E CATEGORIAS -->
                <div style="margin-bottom:10px;">
                    <input type="text" id="visual_menu_search" placeholder="🔍 Buscar prato..." oninput="SalesManager.renderVisualGrid()" style="width:100%; padding:10px; font-size:13px; background:#0F172A; color:#F1F5F9; border:1px solid #334155; border-radius:8px; box-sizing:border-box; margin-bottom:8px;">
                    
                    <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:6px; scrollbar-width:none;">
                        ${categoryPills}
                    </div>
                </div>

                <!-- GRADE DE PRATOS CATEGORIZADOS -->
                <div id="visual_products_grid" style="max-height:55vh; overflow-y:auto; padding-right:2px; display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:10px; margin-bottom:60px;">
                </div>

                <!-- BARRA FIXA INFERIOR DE CONFIRMAÇÃO -->
                <div style="position:sticky; bottom:0; left:0; right:0; background:#0F172A; border-top:2px solid #FF6B35; padding:10px; display:flex; justify-content:space-between; align-items:center; border-radius:0 0 10px 10px; box-shadow:0 -4px 12px rgba(0,0,0,0.5);">
                    <div>
                        <span id="visual_footer_count" style="color:#94A3B8; font-size:11px; display:block;">0 item(ns)</span>
                        <strong id="visual_footer_total" style="color:#10B981; font-size:15px;">R$ 0,00</strong>
                    </div>
                    <button class="btn btn-success" onclick="SalesManager.confirmVisualSelection()" style="padding:10px 16px; font-weight:800; font-size:13px; touch-action:manipulation;">
                        ✅ Confirmar e Voltar
                    </button>
                </div>
            </div>
        `;

        if (typeof openModal === 'function') {
            openModal('🛍️ Cardápio Visual - Seleção Rápida', modalBody);
        }

        this.renderVisualGrid();
    },

    filterCategory(cat) {
        this.selectedCategory = cat;
        this.openVisualMenuModal();
    },

    renderVisualGrid() {
        const grid = document.getElementById('visual_products_grid');
        const searchTerm = (document.getElementById('visual_menu_search')?.value || '').toLowerCase().trim();
        if (!grid) return;

        let filtered = this.productsCache || [];

        if (this.selectedCategory !== 'all') {
            filtered = filtered.filter(p => (p.category || 'Geral') === this.selectedCategory);
        }

        if (searchTerm) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm) || (p.description && p.description.toLowerCase().includes(searchTerm)));
        }

        if (filtered.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1 / -1; color:#94A3B8; text-align:center; padding:30px; font-size:12px;">Nenhum item encontrado.</div>`;
            this.updateVisualFooter();
            return;
        }

        grid.innerHTML = filtered.map(p => {
            const price = Number(p.price || 0);
            const priceFormatted = price.toFixed(2).replace('.', ',');
            const safeName = escapeHtml(p.name);
            const safeId = escapeHtml(p.id);

            // Verifica quantidade atual deste item no carrinho
            const cartItem = this.currentSaleItems.find(i => String(i.id) === String(p.id));
            const currentQty = cartItem ? cartItem.qty : 0;

            const imgHtml = p.image_url 
                ? `<img src="${escapeHtml(p.image_url)}" style="width:100%; height:80px; object-fit:cover; border-radius:6px; margin-bottom:6px;">`
                : `<div style="width:100%; height:60px; background:#0F172A; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:24px; margin-bottom:6px;">🥟</div>`;

            return `
                <div style="background:#1E293B; border:1px solid ${currentQty > 0 ? '#10B981' : '#334155'}; border-radius:8px; padding:8px; display:flex; flex-direction:column; justify-space-between; text-align:center; position:relative;">
                    ${imgHtml}
                    <strong style="font-size:11px; color:#F1F5F9; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; height:28px; line-height:1.2; margin-bottom:4px;">${safeName}</strong>
                    <span style="font-size:12px; font-weight:800; color:#10B981; margin-bottom:8px;">R$ ${priceFormatted}</span>

                    ${currentQty > 0 ? `
                        <div style="display:flex; justify-content:center; align-items:center; gap:6px; background:#0F172A; padding:4px; border-radius:6px;">
                            <button onclick="SalesManager.updateVisualQty('${safeId}', -1)" style="background:#EF4444; color:#fff; border:none; border-radius:4px; width:26px; height:26px; font-weight:bold; cursor:pointer;">-</button>
                            <span style="color:#F1F5F9; font-weight:800; font-size:13px;">${currentQty}</span>
                            <button onclick="SalesManager.updateVisualQty('${safeId}', 1)" style="background:#10B981; color:#fff; border:none; border-radius:4px; width:26px; height:26px; font-weight:bold; cursor:pointer;">+</button>
                        </div>
                    ` : `
                        <button onclick="SalesManager.updateVisualQty('${safeId}', 1)" style="background:#FF6B35; color:#fff; border:none; padding:6px; border-radius:6px; font-size:11px; font-weight:bold; width:100%; cursor:pointer; touch-action:manipulation;">
                            + Adicionar
                        </button>
                    `}
                </div>
            `;
        }).join('');

        this.updateVisualFooter();
    },

    updateVisualQty(productId, delta) {
        const product = (this.productsCache || []).find(p => String(p.id) === String(productId));
        if (!product) return;

        const price = parseFloat(product.price || 0);
        const existingItem = this.currentSaleItems.find(i => String(i.id) === String(productId));

        if (existingItem) {
            existingItem.qty += delta;
            if (existingItem.qty <= 0) {
                this.currentSaleItems = this.currentSaleItems.filter(i => String(i.id) !== String(productId));
            } else {
                existingItem.total = existingItem.price * existingItem.qty;
            }
        } else if (delta > 0) {
            this.currentSaleItems.push({
                uid: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                id: product.id,
                name: product.name,
                price: price,
                qty: 1,
                total: price
            });
        }

        this.renderVisualGrid();
    },

    updateVisualFooter() {
        const countEl = document.getElementById('visual_footer_count');
        const totalEl = document.getElementById('visual_footer_total');

        const totalItems = this.currentSaleItems.reduce((acc, i) => acc + i.qty, 0);
        const totalValue = this.currentSaleItems.reduce((acc, i) => acc + i.total, 0);

        if (countEl) countEl.textContent = `${totalItems} item(ns) selecionado(s)`;
        if (totalEl) totalEl.textContent = `R$ ${totalValue.toFixed(2).replace('.', ',')}`;
    },

    confirmVisualSelection() {
        this.openSaleModal(true);
    },

    lookupCustomerByPhone(val) {
        const clean = String(val || '').replace(/\D/g, '');
        const alertBox = document.getElementById('sale_loyalty_alert');

        if (clean.length < 8) {
            if (alertBox) alertBox.style.display = 'none';
            return;
        }

        const customer = (this.customersCache || []).find(c => {
            const cPhone = String(c.phone || c.whatsapp || '').replace(/\D/g, '');
            return cPhone && (cPhone === clean || cPhone.endsWith(clean) || clean.endsWith(cPhone));
        });

        if (customer) {
            const nameInput = document.getElementById('sale_client_name');
            const addressInput = document.getElementById('sale_address');
            const selectEl = document.getElementById('sale_customer_select');

            if (nameInput) nameInput.value = customer.name || '';
            if (addressInput) addressInput.value = customer.address || customer.delivery_address || '';
            if (selectEl) selectEl.value = customer.id || customer.name;

            this.displayLoyaltyAlert(customer);
        } else if (clean.length >= 10) {
            if (alertBox) {
                alertBox.style.display = 'block';
                alertBox.style.background = 'rgba(59, 130, 246, 0.15)';
                alertBox.style.border = '1px solid #3B82F6';
                alertBox.style.color = '#60A5FA';
                alertBox.innerHTML = `✨ <strong>Novo Cliente!</strong> Número não encontrado no cadastro. Digite o nome para registrar.`;
            }
        }
    },

    displayLoyaltyAlert(customer) {
        const alertBox = document.getElementById('sale_loyalty_alert');
        if (!alertBox || !customer) return;

        const stamps = Number(customer.loyalty_stamps || customer.loyaltyStamps || 0);

        if (stamps >= 10) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(16, 185, 129, 0.2)';
            alertBox.style.border = '1px solid #10B981';
            alertBox.style.color = '#10B981';
            alertBox.innerHTML = `🎁 <strong>CLIENTE VIP!</strong> Este cliente completou 10 carimbos e tem direito a <strong>1 Pastel Grátis (Frango ou Queijo)</strong>!`;
        } else if (stamps > 0) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(245, 158, 11, 0.15)';
            alertBox.style.border = '1px solid #F59E0B';
            alertBox.style.color = '#F59E0B';
            alertBox.innerHTML = `🎟️ <strong>Cartão Fidelidade:</strong> ${stamps}/10 carimbos acumulados (Mínimo R$ 25,00 por carimbo).`;
        } else {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(255, 255, 255, 0.05)';
            alertBox.style.border = '1px solid #334155';
            alertBox.style.color = '#94A3B8';
            alertBox.innerHTML = `👤 Cliente encontrado! Sem carimbos no momento.`;
        }
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
        if (addressInput) addressInput.value = customer.address || customer.delivery_address || '';

        this.displayLoyaltyAlert(customer);
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

        const orderDateObj = createdAtInput ? new Date(createdAtInput) : new Date();
        const orderDate = orderDateObj.toISOString();

        const isRetroactive = (new Date() - orderDateObj) > (5 * 60 * 1000);
        const autoStatus = isRetroactive ? 'completed' : 'preparing';

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
            status: autoStatus,
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

                if (autoStatus === 'completed' && phone && typeof OrdersManager !== 'undefined' && OrdersManager.processLoyaltyStamp) {
                    await OrdersManager.processLoyaltyStamp(phone, total);
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
            const msg = isRetroactive ? 'Pedido retroativo registrado como Concluído!' : 'Pedido lançado em preparo!';
            showToast(msg, 'success');
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
