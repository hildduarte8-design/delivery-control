// js/orders.js - Painel de Controle de Pedidos em Tempo Real com Campainha Sonora

const OrdersManager = {
    timer: null,
    lastOrdersCount: -1, // -1 indica o carregamento inicial

    init() {
        this.fetchOrders();
        // Atualiza a lista a cada 10 segundos automaticamente
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => this.fetchOrders(), 10000);
    },

    // Emite um sinal sonoro tátil quando entra pedido novo no painel
    playNotificationSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
            osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5

            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
        } catch (e) {
            console.log('Alerta sonoro não permitido sem interação prévia do usuário.');
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
                .order('created_at', { ascending: false })
                .limit(30);

            if (error || !orders || orders.length === 0) {
                container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:30px; font-size:13px;">Nenhum pedido recebido hoje.</div>';
                return;
            }

            const pendingCount = orders.filter(o => o.status === 'pending').length;

            // Se for uma atualização subsequente e o número de pendentes aumentou, dispara o som e o aviso
            if (this.lastOrdersCount !== -1 && pendingCount > this.lastOrdersCount) {
                this.playNotificationSound();
                if (typeof showToast === 'function') showToast('🔔 NOVO PEDIDO RECEBIDO!');
            }
            this.lastOrdersCount = pendingCount;

            container.innerHTML = orders.map(order => this.renderOrderCard(order)).join('');

        } catch (e) {
            console.error('Erro ao buscar pedidos:', e);
        }
    },

    renderOrderCard(o) {
        let dateFormatted = 'Agora';
        try {
            if (o.created_at) {
                dateFormatted = new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            }
        } catch (e) {}

        const statusBadges = {
            'pending': { label: '🟡 Novo Pedido', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
            'preparing': { label: '👨‍🍳 Em Preparo', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
            'out_for_delivery': { label: '🛵 Saiu p/ Entrega', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
            'completed': { label: '✅ Concluído', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
            'cancelled': { label: '🔴 Cancelado', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' }
        };

        const currentStatus = statusBadges[o.status] || statusBadges['pending'];

        // Trata os itens salvos no banco em JSONB ou Array
        let rawItems = o.items;
        if (typeof rawItems === 'string') {
            try { rawItems = JSON.parse(rawItems); } catch (e) { rawItems = []; }
        }

        const itemsList = Array.isArray(rawItems)
            ? rawItems.map(i => `<li style="font-size:12px; color:#F1F5F9; margin-bottom:3px;"><strong>${i.qty}x</strong> ${i.name} — <span style="color:#94A3B8;">R$ ${Number(i.total || (i.unit_price * i.qty) || 0).toFixed(2)}</span></li>`).join('')
            : '<li style="font-size:12px; color:#94A3B8;">Itens não detalhados</li>';

        return `
            <div class="card" style="margin-bottom:12px; border-left: 4px solid ${currentStatus.color}; padding:14px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div>
                        <strong style="color:#F1F5F9; font-size:15px;">👤 ${o.client_name || 'Cliente'}</strong>
                        <div style="font-size:11px; color:#94A3B8; margin-top:2px;">⏰ ${dateFormatted} • ${o.order_type === 'delivery' ? '🛵 Entrega' : '🏪 Retirada no Balcão'}</div>
                    </div>
                    <span style="background:${currentStatus.bg}; color:${currentStatus.color}; font-size:11px; font-weight:800; padding:4px 8px; border-radius:6px; white-space:nowrap;">
                        ${currentStatus.label}
                    </span>
                </div>

                ${o.order_type === 'delivery' ? `
                    <div style="font-size:12px; color:#CBD5E1; margin-bottom:10px; background:#0F172A; padding:8px 10px; border-radius:8px; border:1px solid #334155;">
                        <strong>🏠 Endereço:</strong> ${o.address || 'Endereço não informado'}, Nº ${o.number || 'S/N'}
                        ${o.reference ? `<br><small style="color:#94A3B8;">Ref: ${o.reference}</small>` : ''}
                    </div>
                ` : ''}

                <ul style="padding-left:18px; margin-bottom:12px; line-height:1.4;">
                    ${itemsList}
                </ul>

                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #334155; padding-top:10px; margin-top:6px;">
                    <div style="font-weight:800; color:#FF6B35; font-size:15px;">
                        Total: R$ ${Number(o.total || 0).toFixed(2)}
                    </div>

                    <div style="display:flex; gap:6px;">
                        ${o.status === 'pending' ? `<button class="btn btn-sm" onclick="OrdersManager.updateStatus('${o.id}', 'preparing')" style="background:#3B82F6; font-size:11px; padding:6px 10px;">👨‍🍳 Preparar</button>` : ''}
                        ${o.status === 'preparing' ? `<button class="btn btn-sm" onclick="OrdersManager.updateStatus('${o.id}', 'out_for_delivery')" style="background:#8B5CF6; font-size:11px; padding:6px 10px;">🛵 Enviar</button>` : ''}
                        ${o.status === 'out_for_delivery' ? `<button class="btn btn-sm btn-success" onclick="OrdersManager.updateStatus('${o.id}', 'completed')" style="font-size:11px; padding:6px 10px;">✅ Concluir</button>` : ''}
                        ${o.status !== 'completed' && o.status !== 'cancelled' ? `<button class="btn btn-sm btn-danger" onclick="OrdersManager.updateStatus('${o.id}', 'cancelled')" style="font-size:11px; padding:6px 8px;" title="Cancelar Pedido">✕</button>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    async updateStatus(orderId, newStatus) {
        try {
            if (typeof dbClient !== 'undefined') {
                const { error } = await dbClient.from('orders').update({ status: newStatus }).eq('id', orderId);
                if (error) {
                    if (typeof showToast === 'function') showToast('Erro ao atualizar pedido', 'error');
                    return;
                }
                if (typeof showToast === 'function') showToast('Status atualizado!');
                this.fetchOrders();
            }
        } catch (e) {
            console.error('Erro ao atualizar status:', e);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    OrdersManager.init();
});
