// js/customers.js - Gestão de Clientes (CRM + Disparo de Marketing no WhatsApp)

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(text || '')));
    return div.innerHTML;
}

const CustomersManager = {
    allCustomers: [],

    async fetchCustomers() {
        const container = document.getElementById('customersList');
        const countEl = document.getElementById('customersCount');
        if (!container) return;

        let topBarHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <button class="btn btn-sm btn-success" onclick="CustomersManager.openNewCustomerModal()" style="width:100%; padding:10px; font-size:13px;">
                    👤 + Cadastrar Novo Cliente
                </button>
            </div>
        `;

        try {
            let dbCustomers = [];
            let dbOrders = [];

            if (typeof dbClient !== 'undefined') {
                // 1. Busca cadastros da tabela de clientes
                try {
                    const { data: custData } = await dbClient.from('customers').select('*').order('created_at', { ascending: false });
                    if (custData) dbCustomers = custData;
                } catch (e) {
                    console.warn('Tabela "customers" ainda não existe ou indisponível:', e);
                }

                // 2. Busca histórico de pedidos para agregação do CRM
                try {
                    const { data: ordData } = await dbClient.from('orders').select('*').order('created_at', { ascending: false });
                    if (ordData) dbOrders = ordData;
                } catch (e) {
                    console.warn('Erro ao buscar pedidos para CRM:', e);
                }
            }

            const customersMap = {};

            // Mapeia cadastros explícitos de clientes
            dbCustomers.forEach(c => {
                const key = (c.phone || c.name || '').trim().toLowerCase();
                if (!key) return;
                customersMap[key] = {
                    id: c.id,
                    name: c.name || 'Cliente Sem Nome',
                    phone: c.phone || '',
                    address: c.address || '',
                    totalSpent: 0,
                    ordersCount: 0,
                    lastOrderDate: null,
                    itemsFrequency: {}
                };
            });

            // Agrega métricas e histórico de pedidos reais
            dbOrders.forEach(o => {
                const phoneKey = o.phone ? o.phone.trim().toLowerCase() : '';
                const nameKey = o.client_name ? o.client_name.trim().toLowerCase() : '';
                const key = phoneKey || nameKey;

                if (!key) return;

                if (!customersMap[key]) {
                    customersMap[key] = {
                        id: null,
                        name: o.client_name || 'Cliente Sem Nome',
                        phone: o.phone || '',
                        address: o.address || '',
                        totalSpent: 0,
                        ordersCount: 0,
                        lastOrderDate: null,
                        itemsFrequency: {}
                    };
                }

                const cust = customersMap[key];
                if (o.phone && !cust.phone) cust.phone = o.phone;
                if (o.address && !cust.address) cust.address = o.address;

                let items = o.items;
                if (typeof items === 'string') {
                    try { items = JSON.parse(items); } catch(e) { items = []; }
                }

                const isRealOrder = o.status !== 'cancelled' &&
                                    o.status !== 'customer_profile' &&
                                    o.order_type !== 'customer_register' &&
                                    Number(o.total || 0) > 0;

                if (isRealOrder) {
                    cust.ordersCount += 1;
                    cust.totalSpent += Number(o.total || 0);

                    if (Array.isArray(items)) {
                        items.forEach(item => {
                            const itemName = item.name || 'Item';
                            const qty = Number(item.qty || 1);
                            cust.itemsFrequency[itemName] = (cust.itemsFrequency[itemName] || 0) + qty;
                        });
                    }

                    if (!cust.lastOrderDate || new Date(o.created_at) > new Date(cust.lastOrderDate)) {
                        cust.lastOrderDate = o.created_at;
                    }
                }
            });

            const customersList = Object.values(customersMap).sort((a, b) => b.totalSpent - a.totalSpent);
            this.allCustomers = customersList;

            if (typeof state !== 'undefined') state.customers = customersList;

            if (countEl) countEl.textContent = `${customersList.length} cliente(s)`;

            if (customersList.length === 0) {
                container.innerHTML = topBarHtml + '<div style="color:#94A3B8; text-align:center; padding:30px; font-size:13px;">Nenhum cliente registrado ainda.</div>';
                return;
            }

            container.innerHTML = topBarHtml + customersList.map((c, index) => this.renderCustomerCard(c, index)).join('');

        } catch (e) {
            console.error('Erro ao carregar clientes:', e);
            container.innerHTML = topBarHtml + '<div style="color:#EF4444; text-align:center; padding:20px; font-size:13px;">Erro ao carregar lista de clientes.</div>';
        }
    },

    renderCustomerCard(c, index) {
        const lastDateText = (c.ordersCount > 0 && c.lastOrderDate)
            ? new Date(c.lastOrderDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
            : 'Nenhum pedido realizado';

        const sortedItems = Object.entries(c.itemsFrequency || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        const favsHtml = sortedItems.length > 0
            ? sortedItems.map(([name, qty]) => `<span style="background:#0F172A; border:1px solid #334155; color:#F1F5F9; font-size:11px; padding:2px 8px; border-radius:12px;">❤️ ${escapeHtml(name)} (${qty}x)</span>`).join(' ')
            : '<span style="color:#94A3B8; font-size:11px;">Sem pedidos anteriores</span>';

        const cleanPhone = c.phone ? c.phone.replace(/\D/g, '') : '';
        const safeName = escapeHtml(c.name);
        const safePhone = escapeHtml(c.phone);

        return `
            <div class="card" style="margin-bottom:12px; padding:14px; border-left:4px solid #FF6B35;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div>
                        <strong style="color:#F1F5F9; font-size:15px;">👤 ${safeName}</strong>
                        ${c.phone ? `<div style="font-size:11px; color:#94A3B8;">📱 ${safePhone}</div>` : '<div style="font-size:11px; color:#EF4444;">Sem WhatsApp cadastrado</div>'}
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:15px; font-weight:800; color:#10B981;">R$ ${Number(c.totalSpent || 0).toFixed(2)}</div>
                        <div style="font-size:10px; color:#94A3B8;">${c.ordersCount} pedido(s)</div>
                    </div>
                </div>

                <div style="font-size:11px; color:#94A3B8; margin-bottom:8px;">
                    ⏰ <strong>Último pedido:</strong> ${lastDateText}
                </div>

                <div style="border-top:1px dashed #334155; padding-top:8px; margin-top:6px; display:flex; justify-content:space-between; align-items:flex-end;">
                    <div>
                        <div style="font-size:11px; color:#94A3B8; margin-bottom:4px; font-weight:600;">Favoritos do cliente:</div>
                        <div style="display:flex; flex-wrap:wrap; gap:4px;">
                            ${favsHtml}
                        </div>
                    </div>

                    ${cleanPhone ? `
                        <button class="btn btn-sm" onclick="CustomersManager.openMarketingModalByIndex(${index})" style="background:#25D366; color:#fff; font-size:11px; padding:6px 10px; white-space:nowrap; margin-left:8px;">
                            💬 Enviar Mensagem
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },

    openNewCustomerModal() {
        if (typeof openModal !== 'function') return;

        openModal('👤 Cadastrar Novo Cliente', `
            <div class="form-group">
                <label>Nome do Cliente *</label>
                <input type="text" id="new_cust_name" placeholder="Ex: João Silva">
            </div>
            <div class="form-group">
                <label>WhatsApp / Telefone (com DDD) *</label>
                <input type="tel" id="new_cust_phone" placeholder="33999999999">
            </div>
            <div class="form-group">
                <label>Endereço Padrão (Opcional)</label>
                <input type="text" id="new_cust_address" placeholder="Rua, Número, Bairro">
            </div>

            <button class="btn btn-large" onclick="CustomersManager.saveNewCustomer()" style="margin-top:12px;">
                💾 Cadastrar Cliente
            </button>
        `);
    },

    async saveNewCustomer() {
        const name = document.getElementById('new_cust_name')?.value.trim();
        const phone = document.getElementById('new_cust_phone')?.value.trim() || '';
        const address = document.getElementById('new_cust_address')?.value.trim() || 'Balcão';

        if (!name) {
            if (typeof showToast === 'function') showToast('Informe o nome do cliente!', 'error');
            return;
        }

        const customerPayload = {
            id: `cust_${Date.now()}`,
            name,
            phone,
            address,
            created_at: new Date().toISOString()
        };

        try {
            if (typeof dbClient !== 'undefined') {
                const { error } = await dbClient.from('customers').upsert([customerPayload]);
                if (error) console.error('Erro no Supabase ao salvar cliente:', error);
            }

            if (typeof closeModal === 'function') closeModal();
            if (typeof showToast === 'function') showToast('Cliente cadastrado com sucesso!');
            this.fetchCustomers();

        } catch (e) {
            console.error('Erro ao salvar cliente:', e);
            if (typeof showToast === 'function') showToast('Erro ao cadastrar cliente.', 'error');
        }
    },

    openMarketingModalByIndex(index) {
        const c = this.allCustomers[index];
        if (!c) return;

        const cleanPhone = c.phone ? c.phone.replace(/\D/g, '') : '';
        this.openMarketingModal(c.name, cleanPhone);
    },

    openMarketingModal(name, phone) {
        if (typeof openModal !== 'function') return;

        const safeName = escapeHtml(name);

        openModal(`💬 Mensagem para ${safeName}`, `
            <p style="font-size:12px; color:#94A3B8; margin-bottom:12px;">
                Selecione o modelo de campanha para gerar a mensagem personalizada:
            </p>

            <div class="form-group">
                <label>Modelo de Mensagem</label>
                <select id="mkt_template_select" onchange="CustomersManager.updateMktPreview('${safeName.replace(/'/g, "\\'")}')">
                    <option value="winback">🎁 Cupom para Sumidos (Reativação)</option>
                    <option value="promo">🔥 Oferta do Dia / Promoção</option>
                    <option value="new_product">🍔 Novidade no Cardápio</option>
                    <option value="vip">⭐ Cliente VIP / Agradecimento</option>
                </select>
            </div>

            <div class="form-group">
                <label>Texto da Mensagem (Editável)</label>
                <textarea id="mkt_message_text" rows="5" style="width:100%; font-size:12px; line-height:1.4; padding:8px;"></textarea>
            </div>

            <button class="btn btn-large" onclick="CustomersManager.sendMarketingWhatsApp('${escapeHtml(phone)}')" style="background:#25D366; color:#fff; margin-top:10px;">
                🚀 Abrir WhatsApp e Enviar
            </button>
        `);

        this.updateMktPreview(name);
    },

    updateMktPreview(name) {
        const template = document.getElementById('mkt_template_select')?.value;
        const textEl = document.getElementById('mkt_message_text');
        if (!textEl) return;

        const firstName = name.split(' ')[0];

        const templates = {
            'winback': `Oi ${firstName}! Saudades de você por aqui! 🍕\n\nPreparamos um cupom especial de *10% OFF* no seu próximo pedido. Que tal aproveitar hoje?\n\nFaça seu pedido diretamente pelo nosso cardápio! 😉`,
            'promo': `Fala ${firstName}! Tudo bem? 🍔\n\nHoje estamos com uma super promoção imperdível no nosso delivery. Dá uma olhada no nosso cardápio e aproveite antes que acabe!`,
            'new_product': `Olá ${firstName}! Tem novidade quentinha no nosso cardápio hoje! 😋\n\nLançamos um prato incrível e achamos a sua cara. Vem conferir!`,
            'vip': `Oi ${firstName}! Passando para agradecer por sempre pedir com a gente! ⭐\n\nComo cliente VIP, seu próximo pedido tem *Frete Grátis*. É só avisar a gente por aqui!`
        };

        textEl.value = templates[template] || templates['winback'];
    },

    sendMarketingWhatsApp(phone) {
        const text = document.getElementById('mkt_message_text')?.value;
        if (!text) return;

        let cleanPhone = phone.replace(/\D/g, '');
        if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

        window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`, '_blank');
        if (typeof closeModal === 'function') closeModal();
    }
};

document.addEventListener('click', (e) => {
    if (e.target && e.target.matches('[data-sub="customers"]')) {
        CustomersManager.fetchCustomers();
    }
});
