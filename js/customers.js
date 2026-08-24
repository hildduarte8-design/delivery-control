// js/customers.js - Gestão e Histórico de Clientes (CRM)

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

            if (error || !orders || orders.length === 0) {
                container.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:30px; font-size:13px;">Nenhum cliente registrado ainda.</div>';
                if (countEl) countEl.textContent = '0 clientes';
                return;
            }

            // Agrupa pedidos por cliente
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
                        lastOrderDate: o.created_at,
                        itemsFrequency: {}
                    };
                }

                const cust = customersMap[clientKey];
                cust.ordersCount += 1;
                cust.totalSpent += Number(o.total || 0);

                if (new Date(o.created_at) > new Date(cust.lastOrderDate)) {
                    cust.lastOrderDate = o.created_at;
                }

                let items = o.items;
                if (typeof items === 'string') {
                    try { items = JSON.parse(items); } catch(e) { items = []; }
                }

                if (Array.isArray(items)) {
                    items.forEach(item => {
                        const itemName = item.name || 'Item';
                        const qty = Number(item.qty || 1);
                        cust.itemsFrequency[itemName] = (cust.itemsFrequency[itemName] || 0) + qty;
                    });
                }
            });

            const customersList = Object.values(customersMap).sort((a, b) => b.totalSpent - a.totalSpent);

            if (countEl) countEl.textContent = `${customersList.length} cliente(s)`;

            container.innerHTML = customersList.map(c => this.renderCustomerCard(c)).join('');

        } catch (e) {
            console.error('Erro ao carregar clientes:', e);
            container.innerHTML = '<div style="color:#EF4444; text-align:center; padding:20px; font-size:13px;">Erro ao carregar lista de clientes.</div>';
        }
    },

    renderCustomerCard(c) {
        const lastDate = new Date(c.lastOrderDate).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
        });

        // Seleciona os 3 pratos mais pedidos pelo cliente
        const sortedItems = Object.entries(c.itemsFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        const favsHtml = sortedItems.length > 0
            ? sortedItems.map(([name, qty]) => `<span style="background:#0F172A; border:1px solid #334155; color:#F1F5F9; font-size:11px; padding:2px 8px; border-radius:12px;">❤️ ${name} (${qty}x)</span>`).join(' ')
            : '<span style="color:#94A3B8; font-size:11px;">Sem dados de pratos</span>';

        return `
            <div class="card" style="margin-bottom:12px; padding:14px; border-left:4px solid #FF6B35;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div>
                        <strong style="color:#F1F5F9; font-size:15px;">👤 ${c.name}</strong>
                        ${c.phone ? `<div style="font-size:11px; color:#94A3B8;">📱 ${c.phone}</div>` : ''}
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:15px; font-weight:800; color:#10B981;">R$ ${c.totalSpent.toFixed(2)}</div>
                        <div style="font-size:10px; color:#94A3B8;">${c.ordersCount} pedido(s)</div>
                    </div>
                </div>

                <div style="font-size:11px; color:#94A3B8; margin-bottom:8px;">
                    ⏰ <strong>Último pedido:</strong> ${lastDate}
                </div>

                <div style="border-top:1px dashed #334155; padding-top:8px; margin-top:6px;">
                    <div style="font-size:11px; color:#94A3B8; margin-bottom:4px; font-weight:600;">Favoritos do cliente:</div>
                    <div style="display:flex; flex-wrap:wrap; gap:4px;">
                        ${favsHtml}
                    </div>
                </div>
            </div>
        `;
    }
};

document.addEventListener('click', (e) => {
    if (e.target && e.target.matches('[data-sub="customers"]')) {
        CustomersManager.fetchCustomers();
    }
});
