// js/orders.js - Pedidos ao Vivo com Alerta Sonoro e Notificação de Preparo via WhatsApp

const OrdersManager = {
    knownOrdersCount: 0,

    // Emite som de campainha de novo pedido usando Web Audio API
    playAlertSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.6);
        } catch (e) {
            console.log('Alerta sonoro bloqueado pela interação do navegador.');
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
                container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:30px; font-size:13px;">Nenhum pedido ao vivo no momento.</div>';
                this.knownOrdersCount = 0;
                return;
            }

            // Toca som se entrou um pedido novo
            if (this.knownOrdersCount > 0 && orders.length > this.knownOrdersCount) {
                this.playAlertSound();
                if (typeof showToast === 'function') showToast('🔔 NOVO PEDIDO RECEBIDO!', 'success');
            }
            this.knownOrdersCount = orders.length;

            container.innerHTML = orders.map(o => this.renderOrderCard(o)).join('');

        } catch (e) {
            console.error('Erro ao carregar pedidos:', e);
            container.innerHTML = '<div style="color:#EF4444; text-align:center; padding:20px;">Erro ao carregar pedidos.</div>';
        }
    },

    renderOrderCard(o) {
        const dateFormatted = new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        let items = o.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch(e) { items = []; }
        }

        const itemsHtml = Array.isArray(items) && items.length > 0
            ? items.map(i => `<li><strong>${i.qty}x</strong> ${i.name} — R$ ${Number(i.total || 0).toFixed(2)}</li>`).join('')
            : '<li>Nenhum item listado</li>';

        let statusBadge = '🟢 Novo Pedido';
        let actionButtons = `
            <button class="btn btn-sm" style="background:#3B82F6; color:#fff;" onclick="OrdersManager.updateStatus('${o.id}', 'preparing', '${(o.client_name || '').replace(/'/g, "\\'")}', '${o.phone || ''}')">
                👨‍🍳 Preparar
            </button>
            <button class="btn btn-sm btn-danger" onclick="OrdersManager.updateStatus('${o.id}', 'cancelled')">X</button>
        `;

        if (o.status === 'preparing') {
            statusBadge = '👨‍🍳 Em Preparo';
            actionButtons = `
                <button class="btn btn-sm btn-success" onclick="OrdersManager.updateStatus('${o.id}', 'completed')">
                    ✅ Concluir Pedido
                </button>
            `;
        } else if (o.status === 'completed') {
            statusBadge = '✅ Concluído';
            actionButtons = '';
        } else if (o.status === 'cancelled') {
            statusBadge = '❌ Cancelado';
            actionButtons = '';
        }

        const safePhone = o.phone ? o.phone.replace(/\D/g, '') : '';

        return `
            <div class="card" style="margin-bottom:12px; padding:14px; border-left:4px solid ${o.status === 'pending' ? '#F59E0B' : o.status === 'preparing' ? '#3B82F6' : '#10B981'};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <strong style="color:#F1F5F9; font-size:15px;">👤 ${o.client_name || 'Cliente'}</strong>
                        ${o.phone ? `<div style="font-size:11px; color:#94A3B8;">📱 ${o.phone}</div>` : ''}
                        <div style="font-size:11px; color:#94A3B8;">⏰ ${dateFormatted} • ${o.order_type === 'delivery' ? '🛵 Entrega' : '🏪 Retirada'}</div>
                    </div>
                    <span class="badge" style="background:#0F172A; border:1px solid #334155;">${statusBadge}</span>
                </div>

                <ul style="margin:10px 0; padding-left:18px; font-size:13px; color:#E2E8F0;">
                    ${itemsHtml}
                </ul>

                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed #334155; padding-top:8px;">
                    <strong style="color:#FF6B35; font-size:16px;">Total: R$ ${Number(o.total || 0).toFixed(2)}</strong>
                    <div style="display:flex; gap:6px;">
                        ${actionButtons}
                    </div>
                </div>
            </div>
        `;
    },

    async updateStatus(orderId, newStatus, clientName = '', phone = '') {
        try {
            if (typeof dbClient !== 'undefined') {
                await dbClient.from('orders').update({ status: newStatus }).eq('id', orderId);
            }

            if (newStatus === 'preparing' && phone) {
                let cleanPhone = phone.replace(/\D/g, '');
                if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

                const firstName = clientName ? clientName.split(' ')[0] : 'Cliente';
                const msg = `Olá, ${firstName}! 👨‍🍳\n\nSeu pedido no *Pastel e Batata Imperial* já entrou em preparo com muito carinho! Em breve estará a caminho. 🛵💨`;

                window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, '_blank');
            }

            if (typeof showToast === 'function') showToast('Status do pedido atualizado!');
            this.fetchOrders();

            if (typeof CustomersManager !== 'undefined') CustomersManager.fetchCustomers();
            if (typeof renderDashboard === 'function') renderDashboard();

        } catch (e) {
            console.error('Erro ao atualizar status:', e);
        }
    }
};

// Polling automático a cada 10 segundos para verificar novos pedidos
setInterval(() => {
    const ordersTab = document.getElementById('tab-orders');
    if (ordersTab && ordersTab.classList.contains('active')) {
        OrdersManager.fetchOrders();
    }
}, 10000);
