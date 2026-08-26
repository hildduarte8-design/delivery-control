// js/customers.js - Gestão de Clientes (CRM + Disparo de Marketing no WhatsApp)

const CustomersManager = {
    async fetchCustomers() {
        const container = document.getElementById('customersList');
        const countEl = document.getElementById('customersCount');
        if (!container) return;

        try {
            if (typeof dbClient === 'undefined') return;

            const { data: orders, error } = await dbClient
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            let topBarHtml = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                    <button class="btn btn-sm btn-success" onclick="CustomersManager.openNewCustomerModal()" style="width:100%; padding:10px; font-size:13px;">
                        👤 + Cadastrar Novo Cliente
                    </button>
                </div>
            `;

            if (error || !orders || orders.length === 0) {
                container.innerHTML = topBarHtml + '<div style="color:#94A3B8; text-align:center; padding:30px; font-size:13px;">Nenhum cliente registrado ainda.</div>';
                if (countEl) countEl.textContent = '0 clientes';
                return;
            }

            const customersMap = {};

            orders.forEach(o => {
                const clientKey = (o.client_name || 'Cliente Sem Nome').trim().toLowerCase();
                const displayName = o.client_name || 'Cliente Sem Nome';

                if (!customersMap[clientKey]) {
                    customersMap[clientKey] = {
                        name: displayName,
                        phone: o.phone || '',
                        totalSpent: 0,
                        ordersCount: 0,
                        lastOrderDate: null,
                        itemsFrequency: {}
                    };
                }

                const cust = customersMap[clientKey];
                if (o.phone && !cust.phone) cust.phone = o.phone;

                let items = o.items;
                if (typeof items === 'string') {
                    try { items = JSON.parse(items); } catch(e) { items = []; }
                }

                // CORREÇÃO: CONTABILIZA PEDIDO E VALORES APENAS SE FOR UMA COMPRA REAL (Não cadastro fake)
                const isRealOrder = o.status !== 'customer_profile' && 
                                    o.order_type !== 'customer_register' && 
                                    o.status !== 'cancelled' && 
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

            if (countEl) countEl.textContent = `${customersList.length} cliente(s)`;

            container.innerHTML = topBarHtml + customersList.map(c => this.renderCustomerCard(c)).join('');

        } catch (e) {
            console.error('Erro ao carregar clientes:', e);
            container.innerHTML = '<div style="color:#EF4444; text-align:center; padding:20px; font-size:13px;">Erro ao carregar lista de clientes.</div>';
        }
    },

    renderCustomerCard(c) {
        const lastDateText = (c.ordersCount > 0 && c.lastOrderDate)
            ? new Date(c.lastOrderDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
            : 'Nenhum pedido realizado';

        const sortedItems = Object.entries(c.itemsFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        const favsHtml = sortedItems.length > 0
            ? sortedItems.map(([name, qty]) => `<span style="background:#0F172A; border:1px solid #334155; color:#F1F5F9; font-size:11px; padding:2px 8px; border-radius:12px;">❤️ ${name} (${qty}x)</span>`).join(' ')
            : '<span style="color:#94A3B8; font-size:11px;">Sem pedidos anteriores</span>';

        const cleanPhone = c.phone ? c.phone.replace(/\D/g, '') : '';

        return `
            <div class="card" style="margin-bottom:12px; padding:14px; border-left:4px solid #FF6B35;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div>
                        <strong style="color:#F1F5F9; font-size:15px;">👤 ${c.name}</strong>
                        ${c.phone ? `<div style="font-size:11px; color:#94A3B8;">📱 ${c.phone}</div>` : '<div style="font-size:11px; color:#EF4444;">Sem WhatsApp cadastrado</div>'}
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:15px; font-weight:800; color:#10B981;">R$ ${c.totalSpent.toFixed(2)}</div>
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
                        <button class="btn btn-sm" onclick="CustomersManager.openMarketingModal('${c.name.replace(/'/g, "\\'")}', '${cleanPhone}')" style="background:#25D366; color:#fff; font-size:11px; padding:6px 10px; white-space:nowrap; margin-left:8px;">
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
        let phone = document.getElementById('new_cust_phone')?.value.trim() || '';
        const address = document.getElementById('new_cust_address')?.value.trim() || 'Balcão';

        if (!name) {
            if (typeof showToast === 'function') showToast('Informe o nome do cliente!', 'error');
            return;
        }

        try {
            if (typeof dbClient !== 'undefined') {
                // CORREÇÃO: REGISTRA O CLIENTE SEM CRIAR PEDIDO FANTASMA NAS VENDAS/ANALYTICS
                const { error } = await dbClient.from('orders').insert([{
                    client_name: name,
                    phone: phone,
                    order_type: 'customer_register',
                    address: address,
                    items: [],
                    subtotal: 0,
                    delivery_fee: 0,
                    total: 0,
                    status: 'customer_profile'
                }]);

                if (error) {
                    if (typeof showToast === 'function') showToast('Erro ao cadastrar cliente', 'error');
                    return;
                }
            }

            if (typeof closeModal === 'function') closeModal();
            if (typeof showToast === 'function') showToast('Cliente cadastrado com sucesso!');
            this.fetchCustomers();

        } catch (e) {
            console.error('Erro ao salvar cliente:', e);
        }
    },

    openMarketingModal(name, phone) {
        if (typeof openModal !== 'function') return;

        openModal(`💬 Mensagem para ${name}`, `
            <p style="font-size:12px; color:#94A3B8; margin-bottom:12px;">
                Selecione o modelo de campanha para gerar a mensagem personalizada:
            </p>

            <div class="form-group">
                <label>Modelo de Mensagem</label>
                <select id="mkt_template_select" onchange="CustomersManager.updateMktPreview('${name.replace(/'/g, "\\'")}')">
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

            <button class="btn btn-large" onclick="CustomersManager.sendMarketingWhatsApp('${phone}')" style="background:#25D366; color:#fff; margin-top:10px;">
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
