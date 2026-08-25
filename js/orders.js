// js/orders.js - Pedidos ao Vivo com Notificação WhatsApp e Impressão de Comanda

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
                <button class="btn btn-sm btn-success" onclick="OrdersManager.updateStatus('${o.id}', 'completed', '${(o.client_name || '').replace(/'/g, "\\'")}', '${o.phone || ''}')">
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

        const orderDataEscaped = encodeURIComponent(JSON.stringify(o));

        return `
            <div class="card" style="margin-bottom:12px; padding:14px; border-left:4px solid ${o.status === 'pending' ? '#F59E0B' : o.status === 'preparing' ? '#3B82F6' : '#10B981'};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <strong style="color:#F1F5F9; font-size:15px;">👤 ${o.client_name || 'Cliente'}</strong>
                        ${o.phone ? `<div style="font-size:11px; color:#94A3B8;">📱 ${o.phone}</div>` : ''}
                        <div style="font-size:11px; color:#94A3B8;">⏰ ${dateFormatted} • ${o.order_type === 'delivery' ? '🛵 Entrega' : '🏪 Retirada'}</div>
                        <div style="font-size:11px; color:#10B981; margin-top:2px; font-weight:600;">💳 ${o.reference || 'Forma de pagamento não informada'}</div>
                    </div>
                    <span class="badge" style="background:#0F172A; border:1px solid #334155;">${statusBadge}</span>
                </div>

                <ul style="margin:10px 0; padding-left:18px; font-size:13px; color:#E2E8F0;">
                    ${itemsHtml}
                </ul>

                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed #334155; padding-top:8px;">
                    <strong style="color:#FF6B35; font-size:16px;">Total: R$ ${Number(o.total || 0).toFixed(2)}</strong>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-sm btn-secondary" onclick="OrdersManager.printOrder('${orderDataEscaped}')" title="Imprimir Comanda">
                            🖨️ Comanda
                        </button>
                        ${actionButtons}
                    </div>
                </div>
            </div>
        `;
    },

    printOrder(orderDataEscaped) {
        try {
            const o = JSON.parse(decodeURIComponent(orderDataEscaped));
            const dateFormatted = new Date(o.created_at).toLocaleString('pt-BR');

            let items = o.items;
            if (typeof items === 'string') {
                try { items = JSON.parse(items); } catch(e) { items = []; }
            }

            const itemsFormatted = Array.isArray(items) 
                ? items.map(i => `<div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold; margin-bottom:4px;">
                    <span>${i.qty}x ${i.name}</span>
                    <span>R$ ${Number(i.total || 0).toFixed(2)}</span>
                </div>`).join('')
                : '<div>Sem itens</div>';

            const printWindow = window.open('', '_blank', 'width=400,height=600');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Comanda - ${o.client_name || 'Cliente'}</title>
                    <style>
                        @page { margin: 0; }
                        body {
                            font-family: 'Courier New', Courier, monospace;
                            width: 100%;
                            max-width: 300px;
                            margin: 0 auto;
                            padding: 10px;
                            color: #000;
                            background: #fff;
                        }
                        .text-center { text-align: center; }
                        .line { border-bottom: 1px dashed #000; margin: 8px 0; }
                        .title { font-size: 16px; font-weight: bold; }
                        .info { font-size: 11px; margin-bottom: 3px; }
                        .total { font-size: 15px; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="text-center title">PASTEL E BATATA IMPERIAL</div>
                    <div class="text-center info">*** COMANDA DE PRODUÇÃO ***</div>
                    <div class="line"></div>

                    <div class="info"><strong>DATA:</strong> ${dateFormatted}</div>
                    <div class="info"><strong>TIPO:</strong> ${o.order_type === 'delivery' ? '🛵 ENTREGA' : '🏪 RETIRADA'}</div>
                    <div class="info"><strong>CLIENTE:</strong> ${o.client_name || 'Não informado'}</div>
                    <div class="info"><strong>TEL:</strong> ${o.phone || 'S/N'}</div>
                    ${o.order_type === 'delivery' ? `
                        <div class="info"><strong>ENDEREÇO:</strong> ${o.address || ''}, Nº ${o.number || 'S/N'}</div>
                    ` : ''}
                    <div class="info"><strong>PAGAMENTO:</strong> ${o.reference || 'Não informado'}</div>

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
                        window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                        };
                    <\/script>
                </body>
                </html>
            `);
            printWindow.document.close();
        } catch(e) {
            console.error('Erro ao gerar comanda:', e);
            alert('Erro ao gerar a comanda para impressão.');
        }
    },

    async updateStatus(orderId, newStatus, clientName = '', phone = '') {
        try {
            if (typeof dbClient !== 'undefined') {
                await dbClient.from('orders').update({ status: newStatus }).eq('id', orderId);
            }

            // Notificação ao colocar em Preparo
            if (newStatus === 'preparing' && phone) {
                let cleanPhone = phone.replace(/\D/g, '');
                if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

                const firstName = clientName ? clientName.split(' ')[0] : 'Cliente';
                const msg = `Olá, ${firstName}! 👨‍🍳\n\nSeu pedido no *Pastel e Batata Imperial* já entrou em preparo com muito carinho! Em breve estará a caminho. 🛵💨`;

                window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, '_blank');
            }

            // Notificação ao Concluir o Pedido
            if (newStatus === 'completed' && phone) {
                let cleanPhone = phone.replace(/\D/g, '');
                if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

                const firstName = clientName ? clientName.split(' ')[0] : 'Cliente';
                const msg = `Olá, ${firstName}! 👑\n\nSeu pedido no *Pastel e Batata Imperial* foi finalizado e já está pronto / a caminho! 🛵😋\n\nAgradecemos imensamente a preferência e desejamos um excelente apetite!`;

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
