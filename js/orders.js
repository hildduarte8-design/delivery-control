// js/orders.js - Painel de Controle de Pedidos em Tempo Real

const OrdersManager = {
    timer: null,
    lastOrdersCount: 0,

    init() {
        this.fetchOrders();
        // Atualiza a lista a cada 10 segundos automaticamente
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => this.fetchOrders(), 10000);
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
                container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:30px;">Nenhum pedido recebido hoje.</div>';
                return;
            }

            // Notificação sonora/toast para novos pedidos pendentes
            const pendingCount = orders.filter(o => o.status === 'pending').length;
            if (pendingCount > this.lastOrdersCount && this.lastOrdersCount !== 0) {
                if (typeof showToast === 'function') showToast('🔔 NOVO PEDIDO RECEBIDO!');
            }
            this.lastOrdersCount = pendingCount;

            container.innerHTML = orders.map(order => this.renderOrderCard(order)).join('');

        } catch (e) {
            console.error('Erro ao buscar pedidos:', e);
        }
    },

    renderOrderCard(o) {
        const dateFormatted = new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        const statusBadges = {
            'pending': { label: '🟡 Novo Pedido', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
            'preparing': { label: '👨‍🍳 Em Preparo', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
            'out_for_delivery': { label: '🛵 Saiu p/ Entrega', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
            'completed': { label: '✅ Concluído', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
            'cancelled': { label: '🔴 Cancelado', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' }
        };

        const currentStatus = statusBadges[o.status] || statusBadges['pending'];

        const itemsList = Array.isArray(o.items) 
            ? o.items.map(i => `<li style="font-size:12px; color:#F1F5F9;"><strong>${i.qty}x</strong> ${i.name} - R$ ${Number(i.total).toFixed(2)}</li>`).join('')
            : '';

        return `
            <div class="card" style="margin-bottom:12px; border-left: 4px solid ${currentStatus.color};">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div>
                        <strong style="color:#F1F5F9; font-size:14px;">👤 ${o.client_name}</strong>
                        <div style="font-size:11px; color:#94A3B8;">⏰ ${dateFormatted} • ${o.order_type === 'delivery' ? '🛵 Entrega' : '🏪 Retirada'}</div>
                    </div>
                    <span style="background:${currentStatus.bg}; color:${currentStatus.color}; font-size:11px; font-weight:800; padding:4px 8px; border-radius:6px;">
                        ${currentStatus.label}
                    </span>
                </div>

                ${o.order_type === 'delivery' ? `
                    <div style="font-size:12px; color:#94A3B8; margin-bottom:8px; background:#0F172A; padding:6px 10px; border-radius:8px;">
                        🏠 ${o.address}, Nº ${o.number || 'S/N'} ${o.reference ? `(${o.reference})` : ''}
                    </div>
                ` : ''}

                <ul style="padding-left:16px; margin-bottom:10px;">
                    ${itemsList}
                </ul>

                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #334155; padding-top:8px;">
                    <div style="font-weight:800; color:#FF6B35; font-size:14px;">
                        Total: R$ ${Number(o.total).toFixed(2)}
                    </div>

                    <div style="display:flex; gap:4px;">
                        ${o.status === 'pending' ? `<button class="btn btn-sm" onclick="OrdersManager.updateStatus('${o.id}', 'preparing')" style="background:#3B82F6; font-size:10px; padding:4px 8px;">👨‍🍳 Preparar</button>` : ''}
                        ${o.status === 'preparing' ? `<button class="btn btn-sm" onclick="OrdersManager.updateStatus('${o.id}', 'out_for_delivery')" style="background:#8B5CF6; font-size:10px; padding:4px 8px;">🛵 Enviar</button>` : ''}
                        ${o.status === 'out_for_delivery' ? `<button class="btn btn-sm btn-success" onclick="OrdersManager.updateStatus('${o.id}', 'completed')" style="font-size:10px; padding:4px 8px;">✅ Concluir</button>` : ''}
                        ${o.status !== 'completed' && o.status !== 'cancelled' ? `<button class="btn btn-sm btn-danger" onclick="OrdersManager.updateStatus('${o.id}', 'cancelled')" style="font-size:10px; padding:4px 6px;">✕</button>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    async updateStatus(orderId, newStatus) {
        try {
            if (typeof dbClient !== 'undefined') {
                await dbClient.from('orders').update({ status: newStatus }).eq('id', orderId);
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
