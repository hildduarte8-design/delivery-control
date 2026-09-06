// js/customers.js - Gestão de Clientes (CRM + Fidelidade Automática + WhatsApp)

if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = function(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(text ?? '')));
        return div.innerHTML;
    };
}

const CustomersManager = {
    allCustomers: [],

    // Normaliza telefone e nome para agrupamento perfeito no CRM
    getCleanKey(phone, name) {
        let cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';
        // Remove o DDI 55 se estiver presente para padronizar com/sem 55
        if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
            cleanPhone = cleanPhone.slice(2);
        }
        if (cleanPhone.length >= 8) return cleanPhone;
        return name ? String(name).trim().toLowerCase() : '';
    },

    async fetchCustomers() {
        const container = document.getElementById('customersList');
        const countEl = document.getElementById('customersCount');
        if (!container) return;

        let topBarHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <button class="btn btn-sm btn-success" onclick="CustomersManager.openNewCustomerModal()" style="width:100%; padding:10px; font-size:13px; font-weight:bold; min-height:44px; touch-action:manipulation;">
                    👤 + Cadastrar Novo Cliente
                </button>
            </div>
        `;

        try {
            let dbCustomers = [];
            let dbOrders = [];

            if (typeof dbClient !== 'undefined') {
                try {
                    const { data: custData } = await dbClient.from('customers').select('*').order('created_at', { ascending: false });
                    if (custData) dbCustomers = custData;
                } catch (e) {
                    console.warn('Tabela "customers" indisponível ou não criada:', e);
                }

                try {
                    const { data: ordData } = await dbClient.from('orders').select('*').order('created_at', { ascending: false });
                    if (ordData) dbOrders = ordData;
                } catch (e) {
                    console.warn('Erro ao buscar pedidos para CRM:', e);
                }
            }

            const customersMap = {};

            // 1. Mapeia cadastros explícitos da tabela 'customers'
            dbCustomers.forEach(c => {
                const key = this.getCleanKey(c.phone, c.name);
                if (!key) return;

                const stampsInDb = Number(c.loyalty_stamps ?? c.loyaltyStamps ?? 0);

                customersMap[key] = {
                    id: c.id,
                    name: c.name || 'Cliente Sem Nome',
                    phone: c.phone || '',
                    address: c.address || '',
                    dbStamps: stampsInDb,
                    loyaltyStamps: stampsInDb,
                    totalSpent: 0,
                    ordersCount: 0,
                    validOrdersMin25Count: 0,
                    lastOrderDate: null,
                    itemsFrequency: {}
                };
            });

            // 2. Agrega métricas e histórico a partir dos pedidos
            dbOrders.forEach(o => {
                const rawPhone = o.phone || o.customer_phone || '';
                const rawName = o.client_name || o.customer_name || '';
                const key = this.getCleanKey(rawPhone, rawName);

                if (!key) return;

                if (!customersMap[key]) {
                    customersMap[key] = {
                        id: null,
                        name: rawName || 'Cliente Sem Nome',
                        phone: rawPhone,
                        address: o.address || o.delivery_address || '',
                        dbStamps: 0,
                        loyaltyStamps: 0,
                        totalSpent: 0,
                        ordersCount: 0,
                        validOrdersMin25Count: 0,
                        lastOrderDate: null,
                        itemsFrequency: {}
                    };
                }

                const cust = customersMap[key];
                if (rawPhone && !cust.phone) cust.phone = rawPhone;
                if ((o.address || o.delivery_address) && !cust.address) cust.address = o.address || o.delivery_address;

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
                    const orderTotal = Number(o.total || 0);
                    cust.totalSpent += orderTotal;

                    // Conta pedidos válidos de R$ 25,00 ou mais para o cartão fidelidade
                    if (orderTotal >= 25.00) {
                        cust.validOrdersMin25Count += 1;
                    }

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

            // 3. Define carimbos: considera o MAIOR valor entre o gravado no banco e os pedidos válidos calculados (>= R$ 25)
            Object.values(customersMap).forEach(cust => {
                cust.loyaltyStamps = Math.max(cust.dbStamps, cust.validOrdersMin25Count);
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
        let lastDateText = 'Nenhum pedido realizado';
        if (c.ordersCount > 0 && c.lastOrderDate) {
            const iso = String(c.lastOrderDate).replace(' ', 'T').replace(/([+-]\d{2}):?(\d{2})$/, '') + 'Z';
            const d = new Date(iso);
            if (!isNaN(d.getTime())) {
                lastDateText = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
            }
        }

        const sortedItems = Object.entries(c.itemsFrequency || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        const favsHtml = sortedItems.length > 0
            ? sortedItems.map(([name, qty]) => `<span style="background:#0F172A; border:1px solid #334155; color:#F1F5F9; font-size:11px; padding:2px 8px; border-radius:12px;">❤️ ${escapeHtml(name)} (${qty}x)</span>`).join(' ')
            : '<span style="color:#94A3B8; font-size:11px;">Sem histórico de itens</span>';

        const cleanPhone = c.phone ? String(c.phone).replace(/\D/g, '') : '';
        const safeName = escapeHtml(c.name);
        const safePhone = escapeHtml(c.phone);
        const totalSpentFormatted = Number(c.totalSpent || 0).toFixed(2).replace('.', ',');

        // --- DADOS DO CARTÃO FIDELIDADE ---
        const stamps = c.loyaltyStamps || 0;
        const progressPercent = Math.min(100, (stamps / 10) * 100);
        const isRewardReady = stamps >= 10;

        return `
            <div class="card" style="margin-bottom:12px; padding:14px; border-left:4px solid ${isRewardReady ? '#10B981' : '#FF6B35'}; background:#1E293B;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div>
                        <strong style="color:#F1F5F9; font-size:15px;">👤 ${safeName}</strong>
                        ${c.phone ? `<div style="font-size:11px; color:#94A3B8;">📱 ${safePhone}</div>` : '<div style="font-size:11px; color:#EF4444;">Sem WhatsApp cadastrado</div>'}
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:15px; font-weight:800; color:#10B981;">R$ ${totalSpentFormatted}</div>
                        <div style="font-size:10px; color:#94A3B8;">${c.ordersCount} pedido(s)</div>
                    </div>
                </div>

                <!-- CARTÃO FIDELIDADE VISUAL E CONTROLE MANUAL -->
                <div style="background:#0F172A; border:1px solid ${isRewardReady ? '#10B981' : '#334155'}; border-radius:8px; padding:10px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; margin-bottom:6px;">
                        <span style="color:#CBD5E1; font-weight:700;">🎫 Fidelidade (Mín. R$ 25)</span>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-weight:800; color:${isRewardReady ? '#10B981' : '#F59E0B'};">
                                ${isRewardReady ? '🎉 10/10 - GANHOU PASTEL!' : `🎟️ ${stamps}/10 Carimbos`}
                            </span>
                            <div style="display:flex; gap:2px;">
                                <button onclick="CustomersManager.updateCustomerStamps(${index}, -1)" title="Remover carimbo" style="background:#334155; color:#F1F5F9; border:none; padding:2px 6px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">-</button>
                                <button onclick="CustomersManager.updateCustomerStamps(${index}, 1)" title="Adicionar carimbo" style="background:#FF6B35; color:#fff; border:none; padding:2px 6px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">+</button>
                            </div>
                        </div>
                    </div>
                    <div style="background:#1E293B; height:8px; border-radius:4px; overflow:hidden;">
                        <div style="background:${isRewardReady ? '#10B981' : 'linear-gradient(90deg, #FF6B35, #F59E0B)'}; height:100%; width:${progressPercent}%; transition:width 0.3s;"></div>
                    </div>
                    ${isRewardReady ? `
                        <div style="font-size:11px; color:#10B981; margin-top:6px; font-weight:700; text-align:center;">
                            🎁 Direito a 1 Pastel Grátis (Frango ou Queijo) no próximo pedido!
                        </div>
                    ` : ''}
                </div>

                <div style="font-size:11px; color:#94A3B8; margin-bottom:8px;">
                    ⏰ <strong>Último pedido:</strong> ${lastDateText}
                </div>

                <div style="border-top:1px dashed #334155; padding-top:8px; margin-top:6px; display:flex; justify-content:space-between; align-items:flex-end; gap:8px;">
                    <div>
                        <div style="font-size:11px; color:#94A3B8; margin-bottom:4px; font-weight:600;">Favoritos do cliente:</div>
                        <div style="display:flex; flex-wrap:wrap; gap:4px;">
                            ${favsHtml}
                        </div>
                    </div>

                    ${cleanPhone ? `
                        <button class="btn btn-sm" onclick="CustomersManager.openMarketingModalByIndex(${index})" style="background:#25D366; color:#fff; font-size:11px; font-weight:bold; padding:8px 12px; white-space:nowrap; min-height:44px; touch-action:manipulation;">
                            💬 Enviar Mensagem
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // Ajusta carimbos manualmente no Supabase
    async updateCustomerStamps(index, delta) {
        const c = this.allCustomers[index];
        if (!c) return;

        const currentStamps = c.loyaltyStamps || 0;
        const newStamps = Math.max(0, Math.min(10, currentStamps + delta));

        if (currentStamps === newStamps) return;

        try {
            if (typeof dbClient !== 'undefined' && dbClient) {
                const cleanPhone = c.phone ? String(c.phone).replace(/\D/g, '') : '';
                
                // Atualiza ou cria o registro no Supabase
                const payload = {
                    name: c.name,
                    phone: c.phone || cleanPhone,
                    address: c.address || '',
                    loyalty_stamps: newStamps
                };

                if (c.id) payload.id = c.id;
                else payload.id = `cust_${Date.now()}`;

                const { error } = await dbClient.from('customers').upsert([payload]);
                if (error) throw error;
            }

            c.loyaltyStamps = newStamps;
            c.dbStamps = newStamps;

            if (typeof showToast === 'function') showToast(`Carimbos de ${c.name} atualizados para ${newStamps}/10!`);
            this.fetchCustomers();

        } catch (e) {
            console.error('Erro ao atualizar carimbos:', e);
            if (typeof showToast === 'function') showToast('Erro ao atualizar carimbos no banco.', 'error');
        }
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

            <button class="btn btn-large" onclick="CustomersManager.saveNewCustomer()" style="margin-top:12px; width:100%; min-height:44px; touch-action:manipulation;">
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
            else alert('Informe o nome do cliente!');
            return;
        }

        const customerPayload = {
            id: `cust_${Date.now()}`,
            name,
            phone,
            address,
            loyalty_stamps: 0,
            created_at: new Date().toISOString()
        };

        try {
            if (typeof dbClient !== 'undefined') {
                const { error } = await dbClient.from('customers').upsert([customerPayload]);
                if (error) {
                    throw new Error(error.message);
                }
            }

            if (typeof closeModal === 'function') closeModal();
            if (typeof showToast === 'function') showToast('Cliente cadastrado com sucesso!');
            this.fetchCustomers();

        } catch (e) {
            console.error('Erro ao salvar cliente:', e);
            if (typeof showToast === 'function') showToast(`Erro ao cadastrar cliente: ${e.message}`, 'error');
            else alert(`Erro ao cadastrar cliente: ${e.message}`);
        }
    },

    openMarketingModalByIndex(index) {
        const c = this.allCustomers[index];
        if (!c) return;

        const cleanPhone = c.phone ? String(c.phone).replace(/\D/g, '') : '';
        this.openMarketingModal(c.name, cleanPhone, c.loyaltyStamps || 0);
    },

    openMarketingModal(name, phone, loyaltyStamps = 0) {
        if (typeof openModal !== 'function') return;

        const safeName = escapeHtml(name);
        const safePhone = escapeHtml(phone);

        openModal(`💬 Mensagem para ${safeName}`, `
            <p style="font-size:12px; color:#94A3B8; margin-bottom:12px;">
                Selecione o modelo de campanha para gerar a mensagem personalizada:
            </p>

            <div class="form-group">
                <label>Modelo de Mensagem</label>
                <select id="mkt_template_select" onchange="CustomersManager.updateMktPreview()">
                    <option value="loyalty_reward">🎁 Aviso de Pastel Grátis (Fidelidade)</option>
                    <option value="winback">🎁 Cupom para Sumidos (Reativação)</option>
                    <option value="promo">🔥 Oferta do Dia / Promoção</option>
                    <option value="new_product">😋 Novidade no Cardápio</option>
                    <option value="vip">⭐ Cliente VIP / Agradecimento</option>
                </select>
            </div>

            <div class="form-group">
                <label>Texto da Mensagem (Editável)</label>
                <textarea id="mkt_message_text" rows="5" style="width:100%; font-size:12px; line-height:1.4; padding:8px; border-radius:8px; background:#0F172A; color:#F1F5F9; border:1px solid #334155;"></textarea>
            </div>

            <button class="btn btn-large" onclick="CustomersManager.sendMarketingWhatsApp('${safePhone}')" style="background:#25D366; color:#fff; margin-top:10px; width:100%; min-height:44px; touch-action:manipulation;">
                🚀 Abrir WhatsApp e Enviar
            </button>
        `);

        const modalEl = document.getElementById('mkt_template_select');
        if (modalEl) {
            modalEl.dataset.clientName = name;
            modalEl.dataset.stamps = loyaltyStamps;
        }

        this.updateMktPreview();
    },

    updateMktPreview() {
        const selectEl = document.getElementById('mkt_template_select');
        const textEl = document.getElementById('mkt_message_text');
        if (!selectEl || !textEl) return;

        const template = selectEl.value;
        const fullName = selectEl.dataset.clientName || 'Cliente';
        const firstName = fullName.split(' ')[0];

        const templates = {
            'loyalty_reward': `Parabéns, ${firstName}! 🎉\n\nVocê completou seus carimbos no nosso Cartão Fidelidade! 🎟️✨\n\nNo seu próximo pedido, você ganhou *1 Pastel Grátis* (Frango ou Queijo)! Aproveite e peça pelo nosso cardápio! 😋`,
            'winback': `Oi ${firstName}! Saudades de você por aqui! 😋\n\nPreparamos um cupom especial de *10% OFF* no seu próximo pedido. Que tal aproveitar hoje?\n\nFaça seu pedido diretamente pelo nosso cardápio! 😉`,
            'promo': `Fala ${firstName}! Tudo bem? 🔥\n\nHoje estamos com uma super promoção imperdível no nosso delivery. Dá uma olhada no nosso cardápio e aproveite antes que acabe!`,
            'new_product': `Olá ${firstName}! Tem novidade quentinha no nosso cardápio hoje! 😋\n\nLançamos uma opção incrível e achamos a sua cara. Vem conferir!`,
            'vip': `Oi ${firstName}! Passando para agradecer por sempre pedir com a gente! ⭐\n\nComo cliente VIP, seu próximo pedido tem *Frete Grátis*. É só avisar a gente por aqui!`
        };

        textEl.value = templates[template] || templates['loyalty_reward'];
    },

    sendMarketingWhatsApp(phone) {
        const text = document.getElementById('mkt_message_text')?.value;
        if (!text) return;

        let cleanPhone = String(phone).replace(/\D/g, '');
        if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

        window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
        if (typeof closeModal === 'function') closeModal();
    }
};

document.addEventListener('click', (e) => {
    if (e.target && e.target.matches('[data-sub="customers"]')) {
        CustomersManager.fetchCustomers();
    }
});
