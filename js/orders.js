// js/orders.js - Gestão Completa de Pedidos ao Vivo com Supabase Realtime, Cancelamento, Frete, WhatsApp e Fidelidade

if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = function(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(text ?? '')));
        return div.innerHTML;
    };
}

const OrdersManager = {
    knownOrderIds: new Set(),
    isFirstLoad: true,
    timerInterval: null,
    realtimeChannel: null,
    allOrders: [],
    audioCtx: null,
    selectedDate: null,

    getStoreName() {
        try {
            const localSettings = JSON.parse(localStorage.getItem('dly_settings') || '{}');
            return localSettings.storeName || 'Pastel e Batata Imperial';
        } catch (e) {
            return 'Pastel e Batata Imperial';
        }
    },

    getPixKey() {
        try {
            const localSettings = JSON.parse(localStorage.getItem('dly_settings') || '{}');
            return localSettings.pixKey || '';
        } catch (e) {
            return '';
        }
    },

    parseDateSafe(dateInput) {
        if (!dateInput) return new Date();
        if (dateInput instanceof Date) return dateInput;
        return new Date(String(dateInput).replace(' ', 'T'));
    },

    getLocalDateStr(dateInput) {
        if (!dateInput) return '';
        const d = this.parseDateSafe(dateInput);
        if (isNaN(d.getTime())) return '';

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    unlockAudio() {
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(err => {
                    console.warn('AudioContext.resume() aguarda interação do usuário:', err);
                });
            }
        } catch (e) {
            console.warn('Web Audio API indisponível:', e);
            this.audioCtx = null;
        }
    },

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

        try {
            if (typeof dbClient === 'undefined') return;

            const { data: orders, error } = await dbClient
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error || !orders || orders.length === 0) {
                container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:30px; font-size:13px;">Nenhum pedido registrado no momento.</div>';
                this.allOrders = [];
                this.renderDatePaginationBar([]);
                this.stopLiveTimers();
                return;
            }

            this.allOrders = orders;

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
                const totalVal = Number(newestOrder.total || 0).toFixed(2).replace('.', ',');

                if (typeof showToast === 'function') {
                    showToast(`🔔 NOVO PEDIDO RECEBIDO! (${clientName})`, 'success');
                }

                if (typeof sendNativeNotification === 'function') {
                    sendNativeNotification('🛍️ NOVO PEDIDO RECEBIDO!', `Pedido de ${clientName} - R$ ${totalVal}`);
                }
            }

            const uniqueDates = [...new Set(orders.map(o => this.getLocalDateStr(o.created_at)))];
            
            this.renderDatePaginationBar(uniqueDates);
            this.renderFilteredOrders();

        } catch (e) {
            console.error('Erro ao carregar pedidos:', e);
            container.innerHTML = `<div style="color:#EF4444; text-align:center; padding:20px;">Erro ao carregar pedidos: ${escapeHtml(e.message)}</div>`;
        }
    },

    renderDatePaginationBar(groupedDates) {
        const container = document.getElementById('live-orders-container');
        if (!container) return;

        let bar = document.getElementById('orders-date-pagination-bar');

        if (!this.allOrders || this.allOrders.length === 0) {
            if (bar) bar.style.display = 'none';
            return;
        }

        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'orders-date-pagination-bar';
            bar.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:#1E293B; border:1px solid #334155; padding:8px 12px; border-radius:12px; margin-bottom:12px;';
            container.parentNode.insertBefore(bar, container);
        } else {
            bar.style.display = 'flex';
        }

        const todayStr = this.getLocalDateStr(new Date());
        if (!this.selectedDate) this.selectedDate = todayStr;

        const currentDateObj = this.parseDateSafe(this.selectedDate + 'T00:00:00');
        
        const prevDateObj = new Date(currentDateObj);
        prevDateObj.setDate(prevDateObj.getDate() - 1);
        const prevDateStr = this.getLocalDateStr(prevDateObj);

        const nextDateObj = new Date(currentDateObj);
        nextDateObj.setDate(nextDateObj.getDate() + 1);
        const nextDateStr = this.getLocalDateStr(nextDateObj);

        const isToday = this.selectedDate === todayStr;
        const parts = this.selectedDate.split('-');
        const y = parts[0] || '', m = parts[1] || '', d = parts[2] || '';
        const displayLabel = isToday ? `Hoje (${d}/${m})` : `${d}/${m}/${y}`;
        
        const countForDay = this.allOrders.filter(o => this.getLocalDateStr(o.created_at) === this.selectedDate).length;

        bar.innerHTML = `
            <button onclick="OrdersManager.selectDatePage('${prevDateStr}')" style="background:#0F172A; color:#F1F5F9; border:1px solid #334155; padding:8px 14px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px; min-height:44px; touch-action:manipulation;">
                ◄
            </button>

            <div style="position:relative; text-align:center;">
                <div style="font-size:13px; font-weight:800; color:#FF6B35; display:flex; align-items:center; gap:6px; cursor:pointer;">
                    📅 ${displayLabel}
                    <span style="font-size:10px; background:#334155; color:#F1F5F9; padding:2px 6px; border-radius:10px;">${countForDay} ${countForDay === 1 ? 'pedido' : 'pedidos'}</span>
                </div>
                <input type="date" value="${this.selectedDate}" onchange="OrdersManager.selectDatePage(this.value)" 
                    style="position:absolute; inset:0; opacity:0; width:100%; height:100%; cursor:pointer;">
            </div>

            <button onclick="OrdersManager.selectDatePage('${nextDateStr}')" ${isToday ? 'disabled style="opacity:0.3; background:#0F172A; color:#F1F5F9; border:1px solid #334155; padding:8px 14px; border-radius:8px; font-size:14px; min-height:44px;"' : 'style="background:#0F172A; color:#F1F5F9; border:1px solid #334155; padding:8px 14px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px; min-height:44px; touch-action:manipulation;"'}>
                ►
            </button>
        `;
    },

    selectDatePage(dateStr) {
        if (!dateStr) return;
        this.selectedDate = dateStr;
        
        const groupedDates = [...new Set(this.allOrders.map(o => this.getLocalDateStr(o.created_at)))];
        this.renderDatePaginationBar(groupedDates);
        this.renderFilteredOrders();
    },

    renderFilteredOrders() {
        const container = document.getElementById('live-orders-container');
        if (!container) return;

        const filtered = this.allOrders.filter(o => this.getLocalDateStr(o.created_at) === this.selectedDate);

        if (filtered.length === 0) {
            const parts = (this.selectedDate || '').split('-');
            const y = parts[0] || '', m = parts[1] || '', d = parts[2] || '';
            const formatted = d ? `${d}/${m}/${y}` : 'esta data';
            container.innerHTML = `<div style="color:#94A3B8; text-align:center; padding:40px 20px; background:#1E293B; border-radius:12px; border:1px solid #334155;">📭 Nenhum pedido registrado em <strong>${formatted}</strong>.</div>`;
            this.stopLiveTimers();
            return;
        }

        container.innerHTML = filtered.map(o => this.renderOrderCard(o)).join('');
        this.startLiveTimers();
    },

    renderOrderCard(o) {
        const dateFormatted = this.parseDateSafe(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        let items = o.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch(e) { items = []; }
        }

        const itemsSummary = Array.isArray(items) && items.length > 0
            ? items.slice(0, 2).map(i => `${i.qty}x ${escapeHtml(i.name)}`).join(', ') + (items.length > 2 ? '...' : '')
            : 'Sem itens';

        const clientOrdersCount = this.getClientOrdersCount(o.phone || o.customer_phone, o.client_name || o.customer_name);

        // Verifica status de fidelidade do cliente
        const customer = typeof CustomersManager !== 'undefined' && Array.isArray(CustomersManager.allCustomers)
            ? CustomersManager.allCustomers.find(c => {
                const cPhone = c.phone ? String(c.phone).replace(/\D/g, '') : '';
                const oPhone = (o.phone || o.customer_phone) ? String(o.phone || o.customer_phone).replace(/\D/g, '') : '';
                return (cPhone && oPhone && cPhone === oPhone) || (c.name && o.client_name && c.name.toLowerCase() === o.client_name.toLowerCase());
            }) : null;

        const isRewardReady = customer && (customer.loyaltyStamps >= 10 || customer.loyalty_stamps >= 10);

        let statusBadge = '🟢 Novo';
        if (o.status === 'preparing') statusBadge = '👨‍🍳 Em Preparo';
        else if (o.status === 'completed') statusBadge = '✅ Concluído';
        else if (o.status === 'cancelled') statusBadge = '❌ Cancelado';

        const safeOrderId = escapeHtml(o.id);
        const safeClientName = escapeHtml(o.client_name || o.customer_name || 'Cliente');
        const safePhone = escapeHtml(o.phone || o.customer_phone || '');
        const totalFormatted = Number(o.total || 0).toFixed(2).replace('.', ',');

        const needsFreight = o.order_type === 'delivery' && Number(o.delivery_fee || 0) === 0;

        return `
            <div class="card" onclick="OrdersManager.openOrderDetails('${safeOrderId}')" style="margin-bottom:12px; padding:14px; border-left:4px solid ${o.status === 'pending' ? '#F59E0B' : o.status === 'preparing' ? '#3B82F6' : o.status === 'completed' ? '#10B981' : '#EF4444'}; cursor:pointer; transition: transform 0.1s;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            <strong style="color:#F1F5F9; font-size:15px;">👤 ${safeClientName}</strong>
                            <span style="font-size:10px; background:#1E293B; color:#F59E0B; padding:2px 6px; border-radius:10px; font-weight:bold;">👑 ${clientOrdersCount}º pedido</span>
                        </div>
                        <div style="font-size:11px; color:#94A3B8; margin-top:2px;">⏰ ${dateFormatted} • ${o.order_type === 'delivery' ? '🛵 Entrega' : '🏪 Retirada'}</div>
                        <div style="font-size:11px; color:#10B981; margin-top:2px; font-weight:600;">💳 ${escapeHtml(o.payment_method || o.reference || 'Pagamento na entrega')}</div>
                        ${needsFreight ? `<div style="font-size:10px; color:#F59E0B; font-weight:bold; margin-top:2px;">⚠️ Frete a definir</div>` : ''}
                    </div>

                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                        <span class="badge" style="background:#0F172A; border:1px solid #334155;">${statusBadge}</span>
                        <span class="order-timer-tag" data-created="${o.created_at}" data-status="${o.status}" style="font-size:11px; font-weight:bold; padding:3px 8px; border-radius:6px; background:#1E293B; color:#94A3B8;">
                            ⏱️ 00m 00s
                        </span>
                    </div>
                </div>

                ${isRewardReady ? `
                    <div style="margin-top:8px; background:rgba(16,185,129,0.15); border:1px solid #10B981; color:#10B981; padding:6px 10px; border-radius:6px; font-size:11px; font-weight:bold;">
                        🎁 CLIENTE TEM PASTEL GRÁTIS! (10/10 Carimbos)
                    </div>
                ` : ''}

                <div style="font-size:12px; color:#CBD5E1; margin:10px 0; background:#0F172A; padding:8px 10px; border-radius:6px;">
                    📝 <strong>Itens:</strong> ${itemsSummary}
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed #334155; padding-top:8px;">
                    <strong style="color:#FF6B35; font-size:16px;">Total: R$ ${totalFormatted}</strong>
                    <div style="display:flex; gap:6px;" onclick="event.stopPropagation();">
                        <button class="btn btn-sm btn-secondary" onclick="OrdersManager.printOrder('${safeOrderId}')" title="Imprimir Comanda">🖨️</button>
                        <button class="btn btn-sm" style="background:#25D366; color:#fff;" onclick="OrdersManager.sendConfirmationWhatsApp('${safeOrderId}')" title="Enviar Whats">💬 Confirmar</button>
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
            ? items.map(i => {
                const uPrice = Number(i.unit_price || i.price || 0).toFixed(2).replace('.', ',');
                const iTotal = Number(i.total || (i.qty * (i.unit_price || i.price || 0))).toFixed(2).replace('.', ',');
                return `
                    <div style="padding:8px 0; border-bottom:1px solid #1E293B; display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <div style="font-size:13px; font-weight:bold; color:#F1F5F9;">${i.qty}x ${escapeHtml(i.name)}</div>
                            ${i.notes ? `<div style="font-size:11px; color:#F59E0B; margin-top:2px;">📌 Obs/Opcionais: ${escapeHtml(i.notes)}</div>` : ''}
                            <div style="font-size:11px; color:#64748B;">Unitário: R$ ${uPrice}</div>
                        </div>
                        <div style="font-size:13px; font-weight:bold; color:#FF6B35;">R$ ${iTotal}</div>
                    </div>
                `;
            }).join('')
            : '<div style="color:#94A3B8; font-size:12px;">Nenhum item listado.</div>';

        const clientOrdersCount = this.getClientOrdersCount(o.phone || o.customer_phone, o.client_name || o.customer_name);
        const dateFormatted = this.parseDateSafe(o.created_at).toLocaleString('pt-BR');

        const safeOrderId = escapeHtml(o.id);
        const safeClientName = escapeHtml(o.client_name || o.customer_name || 'Cliente');
        const safePhone = escapeHtml(o.phone || o.customer_phone || '');
        const safeAddress = escapeHtml(o.address || o.delivery_address || 'A combinar');
        const safeNumber = escapeHtml(o.number || 'S/N');
        const safeReference = escapeHtml(o.payment_method || o.reference || 'Não informada');

        const subtotalVal = Number(o.subtotal || 0);
        const feeVal = Number(o.delivery_fee || 0);

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
                <div style="display:flex; justify-content:space-between; font-size:12px; color:#94A3B8; margin-bottom:6px;">
                    <span>Subtotal dos Itens:</span>
                    <span>R$ ${subtotalVal.toFixed(2).replace('.', ',')}</span>
                </div>
                ${o.order_type === 'delivery' ? `
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; background:#0F172A; padding:8px; border-radius:6px;">
                        <span style="font-size:12px; color:#F59E0B; font-weight:bold;">🛵 Valor do Frete (R$):</span>
                        <div style="display:flex; gap:6px;">
                            <input type="number" id="input-fee-${safeOrderId}" value="${feeVal}" step="0.5" style="width:70px; background:#1E293B; color:#fff; border:1px solid #334155; padding:4px 8px; border-radius:6px; font-size:13px; font-weight:bold;">
                            <button onclick="OrdersManager.saveDeliveryFee('${safeOrderId}')" style="background:#F59E0B; color:#000; border:none; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:12px; cursor:pointer;">💾 Salvar</button>
                        </div>
                    </div>
                ` : ''}
                <div style="display:flex; justify-content:space-between; font-size:15px; font-weight:800; color:#10B981; border-top:1px dashed #334155; padding-top:6px;">
                    <span>TOTAL DO PEDIDO:</span>
                    <span>R$ ${Number(o.total || (subtotalVal + feeVal)).toFixed(2).replace('.', ',')}</span>
                </div>
            </div>

            <div style="font-size:12px; font-weight:bold; color:#94A3B8; margin-bottom:8px;">⚡ Ações do Pedido:</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                <button class="btn btn-sm" style="background:#25D366; color:#fff; padding:10px; min-height:44px; touch-action:manipulation;" onclick="OrdersManager.sendConfirmationWhatsApp('${safeOrderId}')">
                    💬 Enviar Confirmação
                </button>
                <button class="btn btn-sm btn-secondary" style="padding:10px; min-height:44px; touch-action:manipulation;" onclick="OrdersManager.printOrder('${safeOrderId}')">
                    🖨️ Imprimir Comanda
                </button>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
                <button class="btn btn-sm" style="background:#3B82F6; color:#fff; padding:10px; min-height:44px; touch-action:manipulation;" onclick="OrdersManager.updateStatus('${safeOrderId}', 'preparing'); closeModal();">
                    👨‍🍳 Preparo
                </button>
                <button class="btn btn-sm btn-success" style="padding:10px; min-height:44px; touch-action:manipulation;" onclick="OrdersManager.updateStatus('${safeOrderId}', 'completed'); closeModal();">
                    ✅ Concluir
                </button>
                <button class="btn btn-sm" style="background:#EF4444; color:#fff; padding:10px; min-height:44px; touch-action:manipulation;" onclick="if(confirm('Tem certeza que deseja cancelar este pedido?')) { OrdersManager.updateStatus('${safeOrderId}', 'cancelled'); closeModal(); }">
                    ❌ Cancelar
                </button>
            </div>
        `;

        if (typeof openModal === 'function') {
            openModal('📋 Detalhes do Pedido', bodyHtml);
        }
    },

    async saveDeliveryFee(orderId) {
        const input = document.getElementById(`input-fee-${orderId}`);
        if (!input) return;

        const newFee = parseFloat(input.value) || 0;
        const o = this.allOrders.find(item => String(item.id) === String(orderId));
        if (!o) return;

        const subtotal = Number(o.subtotal || 0);
        const newTotal = subtotal + newFee;

        try {
            if (typeof dbClient !== 'undefined') {
                const { error } = await dbClient
                    .from('orders')
                    .update({ delivery_fee: newFee, total: newTotal })
                    .eq('id', orderId);

                if (error) throw error;
            }

            o.delivery_fee = newFee;
            o.total = newTotal;

            if (typeof showToast === 'function') showToast('Frete atualizado com sucesso!');
            this.fetchOrders();
            this.openOrderDetails(orderId);

        } catch (e) {
            console.error('Erro ao salvar frete:', e);
            alert('Erro ao atualizar o frete no banco de dados.');
        }
    },

    sendConfirmationWhatsApp(orderId) {
        const o = this.allOrders.find(item => String(item.id) === String(orderId));
        if (!o) return;

        const phone = o.phone || o.customer_phone || '';
        if (!phone) {
            if (typeof showToast === 'function') showToast('Cliente sem telefone cadastrado!', 'error');
            else alert('Cliente sem telefone cadastrado.');
            return;
        }

        let cleanPhone = String(phone).replace(/\D/g, '');
        if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

        const storeName = this.getStoreName();
        const pixKey = this.getPixKey();
        const clientName = o.client_name || o.customer_name || 'Cliente';
        const firstName = clientName ? clientName.split(' ')[0] : 'Cliente';

        let items = o.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch(e) { items = []; }
        }

        const itemsTxt = (Array.isArray(items) && items.length > 0)
            ? items.map(i => `• ${i.qty}x ${i.name}`).join('\n')
            : '• Itens do pedido';

        const subtotalVal = Number(o.subtotal || 0).toFixed(2).replace('.', ',');
        const feeVal = Number(o.delivery_fee || 0).toFixed(2).replace('.', ',');
        const totalVal = Number(o.total || (Number(o.subtotal || 0) + Number(o.delivery_fee || 0))).toFixed(2).replace('.', ',');
        const payMethod = o.payment_method || o.reference || 'Não informado';
        const isPix = payMethod.toLowerCase().includes('pix');

        let pixSection = '';
        if (isPix) {
            pixSection = pixKey 
                ? `\n⚡ *Chave Pix para pagamento:*\n\`${pixKey}\`\n`
                : `\n⚡ *Pagamento via Pix.* (Solicite a chave caso precise)\n`;
        }

        let msg = '';

        if (o.order_type === 'delivery') {
            const address = o.address || o.delivery_address || 'A combinar';
            const number = o.number || 'S/N';

            msg = `Olá, *${firstName}*! Confirmamos o seu pedido com muito carinho! 🥟✨\n\n` +
                  `📋 *ITENS DO PEDIDO:*\n${itemsTxt}\n\n` +
                  `═══════════════════════\n` +
                  `💵 *Subtotal:* R$ ${subtotalVal}\n` +
                  `🛵 *Taxa de Entrega:* R$ ${feeVal}\n` +
                  `💰 *TOTAL FINAL:* R$ ${totalVal}\n` +
                  `💳 *Pagamento:* ${payMethod}\n` +
                  `📍 *Entrega em:* ${address}, Nº ${number}\n` +
                  `${pixSection}\n` +
                  `Por favor, confira os dados acima. Se estiver tudo certinho, já colocaremos seu pedido em produção!\n\n` +
                  `_– Equipe ${storeName}_`;
        } else {
            msg = `Olá, *${firstName}*! Recebemos seu pedido para retirada! 🏪✨\n\n` +
                  `📋 *ITENS DO PEDIDO:*\n${itemsTxt}\n\n` +
                  `═══════════════════════\n` +
                  `💰 *TOTAL DOS ITENS:* R$ ${subtotalVal}\n` +
                  `💳 *Pagamento:* ${payMethod}\n` +
                  `${pixSection}\n` +
                  `Já estamos preparando tudo com capricho. Te avisaremos aqui no Whats assim que estiver prontinho para você vir buscar!\n\n` +
                  `_– Equipe ${storeName}_`;
        }

        window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
    },

    getClientOrdersCount(phone, clientName) {
        if (!this.allOrders || this.allOrders.length === 0) return 1;
        const cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';

        return this.allOrders.filter(ord => {
            const ordPhone = (ord.phone || ord.customer_phone) ? String(ord.phone || ord.customer_phone).replace(/\D/g, '') : '';
            const ordName = ord.client_name || ord.customer_name;
            return (cleanPhone && ordPhone === cleanPhone) || (clientName && ordName === clientName);
        }).length;
    },

    // Processa a contagem do Cartão Fidelidade ao concluir o pedido
    async processLoyaltyStamp(phone, orderTotal) {
        if (!phone) return;
        const cleanPhone = String(phone).replace(/\D/g, '');
        if (!cleanPhone) return;

        try {
            if (typeof dbClient !== 'undefined' && dbClient) {
                const { data: customer } = await dbClient
                    .from('customers')
                    .select('id, name, phone, loyalty_stamps')
                    .or(`phone.eq.${phone},phone.eq.${cleanPhone}`)
                    .maybeSingle();

                if (customer) {
                    let currentStamps = Number(customer.loyalty_stamps || 0);
                    let newStamps = currentStamps;

                    if (currentStamps >= 10) {
                        newStamps = Number(orderTotal || 0) >= 25.00 ? 1 : 0;
                        if (typeof showToast === 'function') {
                            showToast(`🎁 Pastel grátis entregue! Novo ciclo do Cartão Fidelidade iniciado (${newStamps}/10).`, 'success');
                        }
                    } else if (Number(orderTotal || 0) >= 25.00) {
                        newStamps = currentStamps + 1;
                        if (newStamps === 10) {
                            if (typeof showToast === 'function') {
                                showToast(`🎉 ${customer.name || 'Cliente'} completou 10 carimbos e ganhou 1 Pastel!`, 'success');
                            }
                        } else {
                            if (typeof showToast === 'function') {
                                showToast(`🎟️ Carimbo fidelidade registrado! (${newStamps}/10)`, 'info');
                            }
                        }
                    }

                    await dbClient
                        .from('customers')
                        .update({ loyalty_stamps: newStamps })
                        .eq('id', customer.id);
                }
            }
        } catch (e) {
            console.warn('Erro ao processar programa de fidelidade:', e);
        }
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
                const createdAtStr = tag.getAttribute('data-created');
                const status = tag.getAttribute('data-status');

                if (status === 'completed' || status === 'cancelled') {
                    tag.innerHTML = status === 'completed' ? '🏁 Concluído' : '❌ Cancelado';
                    tag.style.background = '#1E293B';
                    tag.style.color = '#64748B';
                    return;
                }

                const createdAt = this.parseDateSafe(createdAtStr);
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

            let receiptEl = document.getElementById('printable-receipt');
            if (!receiptEl) {
                receiptEl = document.createElement('div');
                receiptEl.id = 'printable-receipt';
                document.body.appendChild(receiptEl);
            }

            const dateFormatted = this.parseDateSafe(o.created_at).toLocaleString('pt-BR');
            const storeName = this.getStoreName();

            let items = o.items;
            if (typeof items === 'string') {
                try { items = JSON.parse(items); } catch(e) { items = []; }
            }

            const itemsFormatted = Array.isArray(items) && items.length > 0
                ? items.map(i => {
                    const totalVal = Number(i.total || (i.qty * (i.unit_price || i.price || 0))).toFixed(2).replace('.', ',');
                    return `
                        <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold; margin-bottom:4px;">
                            <span>${i.qty}x ${escapeHtml(i.name)}</span>
                            <span>R$ ${totalVal}</span>
                        </div>
                    `;
                }).join('')
                : '<div>Sem itens</div>';

            const clientName = escapeHtml(o.client_name || o.customer_name || 'Não informado');
            const phone = escapeHtml(o.phone || o.customer_phone || 'S/N');
            const address = escapeHtml(o.address || o.delivery_address || '');
            const number = escapeHtml(o.number || 'S/N');
            const reference = escapeHtml(o.payment_method || o.reference || 'Não informado');

            const subtotalVal = Number(o.subtotal || 0).toFixed(2).replace('.', ',');
            const feeVal = Number(o.delivery_fee || 0).toFixed(2).replace('.', ',');
            const totalVal = Number(o.total || (Number(o.subtotal || 0) + Number(o.delivery_fee || 0))).toFixed(2).replace('.', ',');

            receiptEl.innerHTML = `
                <div style="font-family:'Courier New', Courier, monospace; width:100%; max-width:300px; margin:0 auto; padding:10px; color:#000; background:#fff;">
                    <div style="text-align:center; font-size:16px; font-weight:bold;">${escapeHtml(storeName.toUpperCase())}</div>
                    <div style="text-align:center; font-size:11px; margin-bottom:3px;">*** COMANDA DE PRODUÇÃO ***</div>
                    <div style="border-bottom:1px dashed #000; margin:8px 0;"></div>

                    <div style="font-size:11px; margin-bottom:3px;"><strong>DATA:</strong> ${dateFormatted}</div>
                    <div style="font-size:11px; margin-bottom:3px;"><strong>TIPO:</strong> ${o.order_type === 'delivery' ? '🛵 ENTREGA' : '🏪 RETIRADA'}</div>
                    <div style="font-size:11px; margin-bottom:3px;"><strong>CLIENTE:</strong> ${clientName}</div>
                    <div style="font-size:11px; margin-bottom:3px;"><strong>TEL:</strong> ${phone}</div>
                    ${o.order_type === 'delivery' ? `<div style="font-size:11px; margin-bottom:3px;"><strong>ENDEREÇO:</strong> ${address}, Nº ${number}</div>` : ''}
                    <div style="font-size:11px; margin-bottom:3px;"><strong>PAGAMENTO:</strong> ${reference}</div>

                    <div style="border-bottom:1px dashed #000; margin:8px 0;"></div>
                    <div style="font-weight:bold; font-size:12px; margin-bottom:6px;">ITENS DO PEDIDO:</div>
                    ${itemsFormatted}

                    <div style="border-bottom:1px dashed #000; margin:8px 0;"></div>
                    <div style="font-size:11px;">Subtotal: R$ ${subtotalVal}</div>
                    <div style="font-size:11px;">Taxa Entrega: R$ ${feeVal}</div>
                    <div style="font-size:15px; font-weight:bold; margin-top:4px;">TOTAL: R$ ${totalVal}</div>

                    <div style="border-bottom:1px dashed #000; margin:8px 0;"></div>
                    <div style="text-align:center; font-size:11px;">Obrigado pela preferência!</div>
                </div>
            `;

            receiptEl.style.display = 'block';
            window.print();
            receiptEl.style.display = 'none';

        } catch(e) {
            console.error('Erro ao gerar comanda:', e);
            if (typeof showToast === 'function') showToast('Erro ao gerar comanda para impressão.', 'error');
        }
    },

    async updateStatus(orderId, newStatus) {
        try {
            const o = this.allOrders.find(item => String(item.id) === String(orderId));
            const clientName = o?.client_name || o?.customer_name || '';
            const phone = o?.phone || o?.customer_phone || '';
            const storeName = this.getStoreName();

            if (typeof dbClient !== 'undefined') {
                await dbClient.from('orders').update({ status: newStatus }).eq('id', orderId);
            }

            if (newStatus === 'preparing' && phone) {
                let cleanPhone = String(phone).replace(/\D/g, '');
                if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

                const firstName = clientName ? clientName.split(' ')[0] : 'Cliente';
                const msg = `Olá, *${firstName}*! Tudo bem? A equipe do *${storeName}* já colocou a mão na massa e o seu pedido está em preparo! 🥟👑 Em instantes ele estará prontinho.\n\n_– Equipe ${storeName}_`;

                window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
            }

            if (newStatus === 'completed') {
                // Processa o carimbo do programa de fidelidade ao concluir o pedido
                if (phone) {
                    await this.processLoyaltyStamp(phone, Number(o?.total || 0));
                }

                if (phone) {
                    let cleanPhone = String(phone).replace(/\D/g, '');
                    if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

                    const firstName = clientName ? clientName.split(' ')[0] : 'Cliente';
                    let msg = '';

                    if (o?.order_type === 'pickup') {
                        msg = `Olá, *${firstName}*! Passando pra avisar que seu pedido acabou de ficar pronto e está quentinho! 🥟🔥\n\nPode vir buscar aqui no balcão. Estamos te aguardando! 😊\n\n_– Equipe ${storeName}_`;
                    } else {
                        msg = `Olá, *${firstName}*! Seu pedido ficou pronto e acabou de sair para entrega em seu endereço! 🛵😋\n\nEm instantes chega aí. Um excelente apetite!\n\n_– Equipe ${storeName}_`;
                    }

                    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
                }
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

document.addEventListener('click', () => OrdersManager.unlockAudio(), { once: true });
document.addEventListener('touchstart', () => OrdersManager.unlockAudio(), { once: true });

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        OrdersManager.stopLiveTimers();
    } else if (document.getElementById('live-orders-container')) {
        OrdersManager.startLiveTimers();
        OrdersManager.fetchOrders();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    OrdersManager.initRealtime();
    OrdersManager.fetchOrders();

    const urlParams = new URLSearchParams(window.location.search);
    const targetOrderId = urlParams.get('orderId');

    if (targetOrderId) {
        let attempts = 0;
        const MAX_ATTEMPTS = 30;

        const checkExist = setInterval(() => {
            attempts++;

            if (attempts >= MAX_ATTEMPTS) {
                clearInterval(checkExist);
                console.warn('Pedido não encontrado após timeout:', targetOrderId);
                return;
            }

            if (OrdersManager.allOrders && OrdersManager.allOrders.length > 0) {
                const targetOrder = OrdersManager.allOrders.find(o => String(o.id) === String(targetOrderId));
                clearInterval(checkExist);
                if (targetOrder) {
                    const orderDate = OrdersManager.getLocalDateStr(targetOrder.created_at);
                    OrdersManager.selectDatePage(orderDate);
                    OrdersManager.openOrderDetails(targetOrderId);
                }
            }
        }, 300);
    }
});
