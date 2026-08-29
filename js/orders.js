// js/orders.js - Gestão Completa de Pedidos ao Vivo com Supabase Realtime, Paginação por Data e Chat WhatsApp

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(text || '')));
    return div.innerHTML;
}

const OrdersManager = {
    knownOrderIds: new Set(),
    isFirstLoad: true,
    timerInterval: null,
    realtimeChannel: null,
    allOrders: [],
    audioCtx: null,
    selectedDate: null, // Armazena a data selecionada (formato YYYY-MM-DD)

    // Helper para converter data para o fuso local (YYYY-MM-DD) sem distorção de fuso horário
    getLocalDateStr(dateInput) {
        const d = new Date(dateInput);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // Desbloqueia a permissão de áudio do navegador após o primeiro clique do usuário
    unlockAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    },

    // Emite som de campainha de novo pedido
    playAlertSound() {
        try {
            this.unlockAudio();
            const ctx = this.audioCtx;
            if (!ctx) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);

            gain.gain.setValueAtTime(0.4, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.8);
        } catch (e) {
            console.log('Alerta sonoro aguardando primeira interação do usuário.');
        }
    },

    // Inicializa a escuta em Tempo Real (Supabase Realtime)
    initRealtime() {
        if (typeof dbClient === 'undefined' || this.realtimeChannel) return;

        try {
            this.realtimeChannel = dbClient
                .channel('public:orders-live')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                    console.log('🔔 Alteração detectada nos pedidos em tempo real:', payload.eventType);
                    this.fetchOrders();
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Supabase Realtime conectado com sucesso para pedidos ao vivo!');
                    }
                });
        } catch (e) {
            console.error('Erro ao conectar Supabase Realtime:', e);
        }
    },

    async fetchOrders() {
        const container = document.getElementById('live-orders-container');
        if (!container) return;

        this.initRealtime();

        try {
            if (typeof dbClient === 'undefined') return;

            const { data: orders, error } = await dbClient
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error || !orders || orders.length === 0) {
                container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:30px; font-size:13px;">Nenhum pedido registrado no momento.</div>';
                this.allOrders = [];
                this.stopLiveTimers();
                return;
            }

            this.allOrders = orders;

            // Detecta se há pedidos realmente NOVOS usando IDs individuais
            const newOrdersDetected = [];
            orders.forEach(o => {
                const idStr = String(o.id);
                if (!this.knownOrderIds.has(idStr)) {
                    if (!this.isFirstLoad) {
                        newOrdersDetected.push(o);
                    }
                    this.knownOrderIds.add(idStr);
                }
            });

            if (this.isFirstLoad) {
                this.isFirstLoad = false;
            } else if (newOrdersDetected.length > 0) {
                this.playAlertSound();
                const newestOrder = newOrdersDetected[0];
                const clientName = newestOrder.client_name || newestOrder.customer_name || 'Cliente';
                const totalVal = Number(newestOrder.total || 0).toFixed(2);

                if (typeof showToast === 'function') {
                    showToast(`🔔 NOVO PEDIDO RECEBIDO! (${clientName})`, 'success');
                }

                if (typeof sendNativeNotification === 'function') {
                    sendNativeNotification('🛍️ NOVO PEDIDO RECEBIDO!', `Pedido de ${clientName} - R$ ${totalVal}`);
                }
            }

            // Coleta todas as datas disponíveis nos pedidos
            const uniqueDates = [...new Set(orders.map(o => this.getLocalDateStr(o.created_at)))];
            
            // Renderiza os botões de paginação por dia e depois os pedidos do dia selecionado
            this.renderDatePaginationBar(uniqueDates);
            this.renderFilteredOrders();

        } catch (e) {
            console.error('Erro ao carregar pedidos:', e);
            container.innerHTML = '<div style="color:#EF4444; text-align:center; padding:20px;">Erro ao carregar pedidos.</div>';
        }
    },

    // RENDERIZA A BARRA SUPERIOR DE DIAS (PAGINAÇÃO)
    renderDatePaginationBar(groupedDates) {
        const container = document.getElementById('live-orders-container');
        if (!container) return;

        let bar = document.getElementById('orders-date-pagination-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'orders-date-pagination-bar';
            bar.style.cssText = 'display:flex; gap:8px; overflow-x:auto; padding:4px 0 14px 0; margin-bottom:12px; scrollbar-width:none;';
            container.parentNode.insertBefore(bar, container);
        }

        const todayStr = this.getLocalDateStr(new Date());
        if (!groupedDates.includes(todayStr)) {
            groupedDates.unshift(todayStr);
        }

        // Ordena do dia mais recente para o mais antigo
        groupedDates.sort((a, b) => new Date(b) - new Date(a));

        if (!this.selectedDate || !groupedDates.includes(this.selectedDate)) {
            this.selectedDate = todayStr;
        }

        bar.innerHTML = groupedDates.map(dateStr => {
            const [y, m, d] = dateStr.split('-');
            const isToday = dateStr === todayStr;
            const displayLabel = isToday ? `Hoje (${d}/${m})` : `${d}/${m}/${y}`;
            
            // Conta quantos pedidos existem nesse dia
            const countForDay = this.allOrders.filter(o => this.getLocalDateStr(o.created_at) === dateStr).length;

            const isActive = this.selectedDate === dateStr;
            const activeStyle = isActive 
                ? 'background:#FF6B35; color:#fff; border-color:#FF6B35; box-shadow: 0 2px 8px rgba(255,107,53,0.3);' 
                : 'background:#1E293B; color:#94A3B8; border-color:#334155;';

            return `
                <button onclick="OrdersManager.selectDatePage('${dateStr}')" style="${activeStyle} border:1px solid; padding:8px 16px; border-radius:20px; font-size:12px; font-weight:700; white-space:nowrap; cursor:pointer; transition:all 0.2s;">
                    📅 ${displayLabel} <span style="font-size:10px; background:rgba(255,255,255,0.2); padding:2px 6px; border-radius:10px; margin-left:4px;">${countForDay}</span>
                </button>
            `;
        }).join('');
    },

    selectDatePage(dateStr) {
        this.selectedDate = dateStr;
        
        // Atualiza estilo dos botões
        const groupedDates = [...new Set(this.allOrders.map(o => this.getLocalDateStr(o.created_at)))];
        this.renderDatePaginationBar(groupedDates);
        
        // Renderiza lista filtrada
        this.renderFilteredOrders();
    },

    renderFilteredOrders() {
        const container = document.getElementById('live-orders-container');
        if (!container) return;

        const filtered = this.allOrders.filter(o => this.getLocalDateStr(o.created_at) === this.selectedDate);

        if (filtered.length === 0) {
            const [y, m, d] = (this.selectedDate || '').split('-');
            const formatted = d ? `${d}/${m}/${y}` : 'esta data';
            container.innerHTML = `<div style="color:#94A3B8; text-align:center; padding:40px 20px; background:#1E293B; border-radius:12px; border:1px solid #334155;">📭 Nenhum pedido registrado em <strong>${formatted}</strong>.</div>`;
            this.stopLiveTimers();
            return;
        }

        container.innerHTML = filtered.map(o => this.renderOrderCard(o)).join('');
        this.startLiveTimers();
    },

    renderOrderCard(o) {
        const dateFormatted = new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        let items = o.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch(e) { items = []; }
        }

        const itemsSummary = Array.isArray(items) && items.length > 0
            ? items.slice(0, 2).map(i => `${i.qty}x ${escapeHtml(i.name)}`).join(', ') + (items.length > 2 ? '...' : '')
            : 'Sem itens';

        const clientOrdersCount = this.getClientOrdersCount(o.phone, o.client_name);

        let statusBadge = '🟢 Novo';
        if (o.status === 'preparing') statusBadge = '👨‍🍳 Em Preparo';
        else if (o.status === 'completed') statusBadge = '✅ Concluído';
        else if (o.status === 'cancelled') statusBadge = '❌ Cancelado';

        const safeOrderId = escapeHtml(o.id);
        const safeClientName = escapeHtml(o.client_name || 'Cliente');
        const safePhone = escapeHtml(o.phone || '');

        return `
            <div class="card" onclick="OrdersManager.openOrderDetails('${safeOrderId}')" style="margin-bottom:12px; padding:14px; border-left:4px solid ${o.status === 'pending' ? '#F59E0B' : o.status === 'preparing' ? '#3B82F6' : o.status === 'completed' ? '#10B981' : '#EF4444'}; cursor:pointer; transition: transform 0.1s;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <strong style="color:#F1F5F9; font-size:15px;">👤 ${safeClientName}</strong>
                            <span style="font-size:10px; background:#1E293B; color:#F59E0B; padding:2px 6px; border-radius:10px; font-weight:bold;">👑 ${clientOrdersCount}º pedido</span>
                        </div>
                        <div style="font-size:11px; color:#94A3B8; margin-top:2px;">⏰ ${dateFormatted} • ${o.order_type === 'delivery' ? '🛵 Entrega' : '🏪 Retirada'}</div>
                        <div style="font-size:11px; color:#10B981; margin-top:2px; font-weight:600;">💳 ${escapeHtml(o.payment_method || o.reference || 'Pagamento na entrega')}</div>
                    </div>

                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                        <span class="badge" style="background:#0F172A; border:1px solid #334155;">${statusBadge}</span>
                        <span class="order-timer-tag" data-created="${o.created_at}" data-status="${o.status}" style="font-size:11px; font-weight:bold; padding:3px 8px; border-radius:6px; background:#1E293B; color:#94A3B8;">
                            ⏱️ 00m 00s
                        </span>
                    </div>
                </div>

                <div style="font-size:12px; color:#CBD5E1; margin:10px 0; background:#0F172A; padding:8px 10px; border-radius:6px;">
                    📝 <strong>Itens:</strong> ${itemsSummary}
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed #334155; padding-top:8px;">
                    <strong style="color:#FF6B35; font-size:16px;">Total: R$ ${Number(o.total || 0).toFixed(2)}</strong>
                    <div style="display:flex; gap:6px;" onclick="event.stopPropagation();">
                        <button class="btn btn-sm btn-secondary" onclick="OrdersManager.printOrder('${safeOrderId}')" title="Imprimir Comanda">🖨️</button>
                        <button class="btn btn-sm" style="background:#25D366; color:#fff;" onclick="OrdersManager.openWhatsAppChat('${safePhone}', '${safeClientName}')" title="WhatsApp">💬 Chat</button>
                    </div>
                </div>
            </div>
        `;
    },

    openOrderDetails(orderId) {
        const o = this.allOrders.find(item => String(item.id) === String(orderId));
        if (!o) return;

        let items = o.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch(e) { items = []; }
        }

        const itemsDetailHtml = Array.isArray(items) && items.length > 0
            ? items.map(i => `
                <div style="padding:8px 0; border-bottom:1px solid #1E293B; display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div style="font-size:13px; font-weight:bold; color:#F1F5F9;">${i.qty}x ${escapeHtml(i.name)}</div>
                        ${i.notes ? `<div style="font-size:11px; color:#F59E0B; margin-top:2px;">📌 Obs/Opcionais: ${escapeHtml(i.notes)}</div>` : ''}
                        <div style="font-size:11px; color:#64748B;">Unitário: R$ ${Number(i.unit_price || i.price || 0).toFixed(2)}</div>
                    </div>
                    <div style="font-size:13px; font-weight:bold; color:#FF6B35;">R$ ${Number(i.total || (i.qty * (i.unit_price || i.price || 0))).toFixed(2)}</div>
                </div>
            `).join('')
            : '<div style="color:#94A3B8; font-size:12px;">Nenhum item listado.</div>';

        const clientOrdersCount = this.getClientOrdersCount(o.phone, o.client_name);
        const dateFormatted = new Date(o.created_at).toLocaleString('pt-BR');

        const safeOrderId = escapeHtml(o.id);
        const safeClientName = escapeHtml(o.client_name || 'Cliente');
        const safePhone = escapeHtml(o.phone || '');
        const safeAddress = escapeHtml(o.address || 'A combinar');
        const safeNumber = escapeHtml(o.number || 'S/N');
        const safeReference = escapeHtml(o.payment_method || o.reference || 'Não informada');

        const bodyHtml = `
            <div style="background:#0F172A; padding:12px; border-radius:8px; margin-bottom:14px; border:1px solid #1E293B;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:16px; color:#F1F5F9;">👤 ${safeClientName}</strong>
                    <span style="font-size:11px; background:#1E293B; color:#F59E0B; padding:3px 8px; border-radius:12px; font-weight:bold;">
                        👑 ${clientOrdersCount}º Pedido na Loja
                    </span>
                </div>
                <div style="font-size:12px; color:#94A3B8; margin-top:4px;">📱 ${safePhone || 'Telefone não informado'}</div>
                <div style="font-size:11px; color:#64748B; margin-top:2px;">⏰ Recebido em: ${dateFormatted}</div>
            </div>

            <div style="margin-bottom:14px; font-size:12px; color:#CBD5E1;">
                <div style="font-weight:bold; color:#3B82F6; margin-bottom:4px;">📍 TIPO: ${o.order_type === 'delivery' ? '🛵 ENTREGA' : '🏪 RETIRADA NO BALCÃO'}</div>
                ${o.order_type === 'delivery' ? `
                    <div><strong>Endereço:</strong> ${safeAddress}, Nº ${safeNumber}</div>
                ` : ''}
                <div style="margin-top:4px;"><strong>Forma de Pagamento / Ref:</strong> <span style="color:#10B981; font-weight:bold;">${safeReference}</span></div>
            </div>

            <div style="margin-bottom:14px;">
                <div style="font-size:12px; font-weight:bold; color:#94A3B8; text-transform:uppercase; margin-bottom:6px;">📋 Itens Solicitados</div>
                <div style="background:#0F172A; padding:10px; border-radius:8px; border:1px solid #1E293B;">
                    ${itemsDetailHtml}
                </div>
            </div>

            <div style="background:#1E293B; padding:12px; border-radius:8px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; font-size:12px; color:#94A3B8; margin-bottom:4px;">
                    <span>Subtotal dos Itens:</span>
                    <span>R$ ${Number(o.subtotal || 0).toFixed(2)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:12px; color:#94A3B8; margin-bottom:6px;">
                    <span>Taxa de Entrega (Frete):</span>
                    <span>R$ ${Number(o.delivery_fee || 0).toFixed(2)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:15px; font-weight:800; color:#10B981; border-top:1px dashed #334155; padding-top:6px;">
                    <span>TOTAL DO PEDIDO:</span>
                    <span>R$ ${Number(o.total || 0).toFixed(2)}</span>
                </div>
            </div>

            <div style="font-size:12px; font-weight:bold; color:#94A3B8; margin-bottom:8px;">⚡ Atualizar Status do Pedido:</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px;">
                <button class="btn btn-sm" style="background:#3B82F6; color:#fff; padding:10px;" onclick="OrdersManager.updateStatus('${safeOrderId}', 'preparing'); closeModal();">
                    👨‍🍳 Colocar em Preparo
                </button>
                <button class="btn btn-sm btn-success" style="padding:10px;" onclick="OrdersManager.updateStatus('${safeOrderId}', 'completed'); closeModal();">
                    ✅ Concluir Pedido
                </button>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <button class="btn btn-sm" style="background:#25D366; color:#fff; padding:10px;" onclick="OrdersManager.openWhatsAppChat('${safePhone}', '${safeClientName}')">
                    💬 Conversar no Whats
                </button>
                <button class="btn btn-sm btn-secondary" style="padding:10px;" onclick="OrdersManager.printOrder('${safeOrderId}')">
                    🖨️ Imprimir Comanda
                </button>
            </div>
        `;

        if (typeof openModal === 'function') {
            openModal('📋 Detalhes do Pedido', bodyHtml);
        }
    },

    getClientOrdersCount(phone, clientName) {
        if (!this.allOrders || this.allOrders.length === 0) return 1;
        const cleanPhone = phone ? phone.replace(/\D/g, '') : '';

        return this.allOrders.filter(ord => {
            const ordPhone = ord.phone ? ord.phone.replace(/\D/g, '') : '';
            return (cleanPhone && ordPhone === cleanPhone) || (clientName && ord.client_name === clientName);
        }).length;
    },

    openWhatsAppChat(phone, clientName) {
        if (!phone) {
            if (typeof showToast === 'function') showToast('Cliente sem telefone cadastrado!', 'error');
            else alert('Cliente sem telefone cadastrado.');
            return;
        }
        let cleanPhone = phone.replace(/\D/g, '');
        if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

        const firstName = clientName ? clientName.split(' ')[0] : 'Cliente';
        const msg = `Olá, ${firstName}! Tudo bem? A equipe do *Pastel e Batata Imperial* já colocou a mão na massa e o seu pedido está em preparo! 🥟👑 Em instantes ele estará prontinho para você aproveitar.`;

        window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, '_blank');
    },

    stopLiveTimers() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

    startLiveTimers() {
        this.stopLiveTimers();

        const updateFn = () => {
            const timerTags = document.querySelectorAll('.order-timer-tag');
            const now = new Date();

            timerTags.forEach(tag => {
                const createdAt = new Date(tag.getAttribute('data-created'));
                const status = tag.getAttribute('data-status');

                if (status === 'completed' || status === 'cancelled') {
                    tag.innerHTML = status === 'completed' ? '🏁 Concluído' : '❌ Cancelado';
                    tag.style.background = '#1E293B';
                    tag.style.color = '#64748B';
                    return;
                }

                const diffMs = Math.max(0, now - createdAt);
                const totalMins = Math.floor(diffMs / 60000);
                const secs = Math.floor((diffMs % 60000) / 1000);

                const minsFormatted = String(totalMins).padStart(2, '0');
                const secsFormatted = String(secs).padStart(2, '0');

                let bgColor = 'rgba(16, 185, 129, 0.2)';
                let textColor = '#10B981';
                let icon = '⏱️';

                if (totalMins >= 15 && totalMins < 30) {
                    bgColor = 'rgba(245, 158, 11, 0.2)';
                    textColor = '#F59E0B';
                    icon = '⚠️';
                } else if (totalMins >= 30) {
                    bgColor = 'rgba(239, 68, 68, 0.2)';
                    textColor = '#EF4444';
                    icon = '🚨';
                }

                tag.style.background = bgColor;
                tag.style.color = textColor;
                tag.innerHTML = `${icon} ${minsFormatted}m ${secsFormatted}s`;
            });
        };

        updateFn();
        this.timerInterval = setInterval(updateFn, 1000);
    },

    printOrder(orderId) {
        try {
            const o = this.allOrders.find(item => String(item.id) === String(orderId));
            if (!o) return;

            const dateFormatted = new Date(o.created_at).toLocaleString('pt-BR');
            const storeName = 'Pastel e Batata Imperial';

            let items = o.items;
            if (typeof items === 'string') {
                try { items = JSON.parse(items); } catch(e) { items = []; }
            }

            const itemsFormatted = Array.isArray(items) && items.length > 0
                ? items.map(i => `<div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold; margin-bottom:4px;">
                    <span>${i.qty}x ${escapeHtml(i.name)}</span>
                    <span>R$ ${Number(i.total || (i.qty * (i.unit_price || i.price || 0))).toFixed(2)}</span>
                </div>`).join('')
                : '<div>Sem itens</div>';

            const printWindow = window.open('', '_blank', 'width=400,height=600');
            if (!printWindow) return alert('Bloqueador de pop-ups ativado no seu navegador.');

            printWindow.document.write(`
                <html>
                <head>
                    <title>Comanda - ${escapeHtml(o.client_name || 'Cliente')}</title>
                    <style>
                        @page { margin: 0; }
                        body { font-family: 'Courier New', Courier, monospace; width: 100%; max-width: 300px; margin: 0 auto; padding: 10px; color: #000; background: #fff; }
                        .text-center { text-align: center; }
                        .line { border-bottom: 1px dashed #000; margin: 8px 0; }
                        .title { font-size: 16px; font-weight: bold; }
                        .info { font-size: 11px; margin-bottom: 3px; }
                        .total { font-size: 15px; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="text-center title">${escapeHtml(storeName.toUpperCase())}</div>
                    <div class="text-center info">*** COMANDA DE PRODUÇÃO ***</div>
                    <div class="line"></div>

                    <div class="info"><strong>DATA:</strong> ${dateFormatted}</div>
                    <div class="info"><strong>TIPO:</strong> ${o.order_type === 'delivery' ? '🛵 ENTREGA' : '🏪 RETIRADA'}</div>
                    <div class="info"><strong>CLIENTE:</strong> ${escapeHtml(o.client_name || 'Não informado')}</div>
                    <div class="info"><strong>TEL:</strong> ${escapeHtml(o.phone || 'S/N')}</div>
                    ${o.order_type === 'delivery' ? `<div class="info"><strong>ENDEREÇO:</strong> ${escapeHtml(o.address || '')}, Nº ${escapeHtml(o.number || 'S/N')}</div>` : ''}
                    <div class="info"><strong>PAGAMENTO:</strong> ${escapeHtml(o.payment_method || o.reference || 'Não informado')}</div>

                    <div class="line"></div>
                    <div style="font-weight:bold; font-size:12px; margin-bottom:6px;">ITENS DO PEDIDO:</div>
                    ${itemsFormatted}

                    <div class="line"></div>
                    <div class="info">Subtotal: R$ ${Number(o.subtotal || 0).toFixed(2)}</div>
                    <div class="info">Taxa Entrega: R$ ${Number(o.delivery_fee || 0).toFixed(2)}</div>
                    <div class="total" style="margin-top:4px;">TOTAL: R$ ${Number(o.total || 0).toFixed(2)}</div>

                    <div class="line"></div>
                    <div class="text-center info">Obrigado pela preferência!</div>

                    <script>
                        window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };
                    <\/script>
                </body>
                </html>
            `);
            printWindow.document.close();
        } catch(e) {
            console.error('Erro ao gerar comanda:', e);
            if (typeof showToast === 'function') showToast('Erro ao gerar comanda para impressão.', 'error');
        }
    },

    async updateStatus(orderId, newStatus) {
        try {
            const o = this.allOrders.find(item => String(item.id) === String(orderId));
            const clientName = o?.client_name || '';
            const phone = o?.phone || '';

            if (typeof dbClient !== 'undefined') {
                await dbClient.from('orders').update({ status: newStatus }).eq('id', orderId);
            }

            if (newStatus === 'preparing' && phone) {
                let cleanPhone = phone.replace(/\D/g, '');
                if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

                const firstName = clientName ? clientName.split(' ')[0] : 'Cliente';
                const msg = `Olá, ${firstName}! Tudo bem? A equipe do *Pastel e Batata Imperial* já colocou a mão na massa e o seu pedido está em preparo! 🥟👑 Em instantes ele estará prontinho para você aproveitar.`;

                window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, '_blank');
            }

            if (newStatus === 'completed' && phone) {
                let cleanPhone = phone.replace(/\D/g, '');
                if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

                const firstName = clientName ? clientName.split(' ')[0] : 'Cliente';
                const msg = `Olá, ${firstName}! 👑\n\nSeu pedido no *Pastel e Batata Imperial* foi finalizado e já está pronto / a caminho! 🛵😋\n\nAgradecemos imensamente a preferência e desejamos um excelente apetite!`;

                window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, '_blank');
            }

            if (typeof showToast === 'function') showToast('Status do pedido atualizado!');
            this.fetchOrders();

            if (typeof CustomersManager !== 'undefined' && CustomersManager.fetchCustomers) CustomersManager.fetchCustomers();
            if (typeof renderDashboard === 'function') renderDashboard();

        } catch (e) {
            console.error('Erro ao atualizar status:', e);
        }
    }
};

// Escuta cliques do usuário para destravar áudio do navegador
document.addEventListener('click', () => OrdersManager.unlockAudio(), { once: true });
document.addEventListener('touchstart', () => OrdersManager.unlockAudio(), { once: true });

// Gerenciamento de ciclo de vida
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        OrdersManager.stopLiveTimers();
    } else if (document.getElementById('live-orders-container')) {
        OrdersManager.startLiveTimers();
    }
});

// Abertura automática ao clicar no link do WhatsApp com parâmetro ?orderId=XYZ
document.addEventListener('DOMContentLoaded', () => {
    OrdersManager.initRealtime();

    const urlParams = new URLSearchParams(window.location.search);
    const targetOrderId = urlParams.get('orderId');

    if (targetOrderId) {
        const checkExist = setInterval(() => {
            if (OrdersManager.allOrders && OrdersManager.allOrders.length > 0) {
                OrdersManager.openOrderDetails(targetOrderId);
                clearInterval(checkExist);
            }
        }, 300);
    }
});
