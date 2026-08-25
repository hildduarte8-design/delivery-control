// js/analytics.js - Módulo de Desempenho, Faturamento por Pagamento, Ranking e Exportação CSV

const AnalyticsManager = {
    currentPeriod: 'all', // 'today', '7days', 'month', 'all'
    lastFilteredOrders: [],

    async render() {
        const container = document.getElementById('analytics-container');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center; color:#94A3B8; padding:30px;">⌛ Carregando dados de desempenho...</div>';

        try {
            if (typeof dbClient === 'undefined') {
                container.innerHTML = '<div style="text-align:center; color:#EF4444; padding:20px;">Erro de conexão com o banco de dados.</div>';
                return;
            }

            // Busca pedidos do banco
            const { data: orders, error } = await dbClient
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error || !orders) {
                container.innerHTML = '<div style="text-align:center; color:#EF4444; padding:20px;">Erro ao carregar dados de vendas.</div>';
                return;
            }

            // Filtra por pedidos concluídos / válidos
            const completedOrders = orders.filter(o => o.status === 'completed' || Number(o.total || 0) > 0);

            // Filtra por período selecionado
            const filteredOrders = this.filterOrdersByPeriod(completedOrders, this.currentPeriod);
            this.lastFilteredOrders = filteredOrders;

            // Processa as estatísticas
            const stats = this.processStats(filteredOrders);

            // Renderiza o painel completo
            container.innerHTML = `
                <!-- Filtros de Período e Exportação -->
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; overflow-x:auto; margin-bottom:16px; padding-bottom:4px;">
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-sm ${this.currentPeriod === 'today' ? '' : 'btn-secondary'}" onclick="AnalyticsManager.setPeriod('today')" style="font-size:11px; padding:6px 10px; white-space:nowrap;">📅 Hoje</button>
                        <button class="btn btn-sm ${this.currentPeriod === '7days' ? '' : 'btn-secondary'}" onclick="AnalyticsManager.setPeriod('7days')" style="font-size:11px; padding:6px 10px; white-space:nowrap;">🗓️ 7 Dias</button>
                        <button class="btn btn-sm ${this.currentPeriod === 'month' ? '' : 'btn-secondary'}" onclick="AnalyticsManager.setPeriod('month')" style="font-size:11px; padding:6px 10px; white-space:nowrap;">📆 Este Mês</button>
                        <button class="btn btn-sm ${this.currentPeriod === 'all' ? '' : 'btn-secondary'}" onclick="AnalyticsManager.setPeriod('all')" style="font-size:11px; padding:6px 10px; white-space:nowrap;">🌐 Tudo</button>
                    </div>
                    <button class="btn btn-sm btn-success" onclick="AnalyticsManager.exportToCSV()" style="font-size:11px; padding:6px 12px; white-space:nowrap;">
                        📊 Baixar Excel/CSV
                    </button>
                </div>

                <!-- Cards de Resumo Rápido -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:16px;">
                    <div class="card" style="padding:12px; text-align:center; border-top:3px solid #10B981; margin:0;">
                        <span style="font-size:11px; color:#94A3B8;">Faturamento</span>
                        <strong style="display:block; font-size:17px; color:#10B981; margin-top:2px;">R$ ${stats.totalRevenue.toFixed(2)}</strong>
                    </div>

                    <div class="card" style="padding:12px; text-align:center; border-top:3px solid #3B82F6; margin:0;">
                        <span style="font-size:11px; color:#94A3B8;">Total Pedidos</span>
                        <strong style="display:block; font-size:17px; color:#3B82F6; margin-top:2px;">${stats.totalOrders}</strong>
                    </div>

                    <div class="card" style="padding:12px; text-align:center; border-top:3px solid #F59E0B; margin:0;">
                        <span style="font-size:11px; color:#94A3B8;">Ticket Médio</span>
                        <strong style="display:block; font-size:17px; color:#F59E0B; margin-top:2px;">R$ ${stats.ticketMedio.toFixed(2)}</strong>
                    </div>

                    <div class="card" style="padding:12px; text-align:center; border-top:3px solid #FF6B35; margin:0;">
                        <span style="font-size:11px; color:#94A3B8;">Itens Vendidos</span>
                        <strong style="display:block; font-size:17px; color:#FF6B35; margin-top:2px;">${stats.totalItemsSold} un</strong>
                    </div>
                </div>

                <!-- Resumo por Forma de Pagamento -->
                <div class="card" style="padding:14px; margin-bottom:16px;">
                    <div style="font-size:13px; font-weight:bold; color:#F1F5F9; margin-bottom:10px;">💳 Faturamento por Forma de Pagamento</div>
                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; text-align:center;">
                        <div style="background:#0F172A; padding:10px 6px; border-radius:8px; border:1px solid #1E293B;">
                            <span style="font-size:10px; color:#94A3B8; display:block;">⚡ Pix</span>
                            <strong style="font-size:14px; color:#10B981;">R$ ${stats.paymentBreakdown.Pix.toFixed(2)}</strong>
                        </div>
                        <div style="background:#0F172A; padding:10px 6px; border-radius:8px; border:1px solid #1E293B;">
                            <span style="font-size:10px; color:#94A3B8; display:block;">💳 Cartão</span>
                            <strong style="font-size:14px; color:#3B82F6;">R$ ${stats.paymentBreakdown.Cartao.toFixed(2)}</strong>
                        </div>
                        <div style="background:#0F172A; padding:10px 6px; border-radius:8px; border:1px solid #1E293B;">
                            <span style="font-size:10px; color:#94A3B8; display:block;">💵 Dinheiro</span>
                            <strong style="font-size:14px; color:#F59E0B;">R$ ${stats.paymentBreakdown.Dinheiro.toFixed(2)}</strong>
                        </div>
                    </div>
                </div>

                <!-- Ranking dos Pratos Mais Vendidos -->
                <div class="card" style="padding:16px; margin-bottom:16px;">
                    <h3 style="font-size:15px; color:#F1F5F9; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
                        <span>🏆 Ranking dos Pratos Mais Vendidos</span>
                        <span style="font-size:11px; color:#94A3B8; font-weight:normal;">${stats.productsList.length} pratos vendidos</span>
                    </h3>

                    ${stats.productsList.length === 0 ? `
                        <div style="text-align:center; color:#94A3B8; padding:20px; font-size:12px;">Nenhum item vendido neste período.</div>
                    ` : stats.productsList.map((p, index) => {
                        const percent = stats.maxQty > 0 ? (p.qty / stats.maxQty) * 100 : 0;
                        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

                        return `
                            <div style="margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #1E293B;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:13px;">
                                    <div>
                                        <span style="font-size:14px; margin-right:4px;">${medal}</span>
                                        <strong style="color:#F1F5F9;">${p.name}</strong>
                                    </div>
                                    <div style="text-align:right;">
                                        <strong style="color:#FF6B35;">${p.qty} un</strong>
                                        <span style="font-size:11px; color:#94A3B8; margin-left:6px;">(R$ ${p.revenue.toFixed(2)})</span>
                                    </div>
                                </div>
                                <div style="background:#0F172A; height:6px; border-radius:3px; overflow:hidden;">
                                    <div style="background: linear-gradient(90deg, #FF6B35, #10B981); height:100%; width:${percent}%; border-radius:3px; transition: width 0.3s;"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

        } catch (e) {
            console.error('Erro no Analytics:', e);
            container.innerHTML = '<div style="text-align:center; color:#EF4444; padding:20px;">Falha ao processar métricas.</div>';
        }
    },

    setPeriod(period) {
        this.currentPeriod = period;
        this.render();
    },

    filterOrdersByPeriod(orders, period) {
        if (period === 'all') return orders;

        const now = new Date();
        return orders.filter(o => {
            const orderDate = new Date(o.created_at);

            if (period === 'today') {
                return orderDate.toDateString() === now.toDateString();
            }

            if (period === '7days') {
                const diffTime = Math.abs(now - orderDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays <= 7;
            }

            if (period === 'month') {
                return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
            }

            return true;
        });
    },

    processStats(orders) {
        let totalRevenue = 0;
        let totalItemsSold = 0;
        const productsMap = {};
        const paymentBreakdown = { Pix: 0, Cartao: 0, Dinheiro: 0, Outros: 0 };

        orders.forEach(o => {
            const total = Number(o.total || 0);
            totalRevenue += total;

            // Classificação automática por forma de pagamento
            const ref = (o.reference || '').toLowerCase();
            if (ref.includes('pix')) {
                paymentBreakdown.Pix += total;
            } else if (ref.includes('cart') || ref.includes('débito') || ref.includes('crédito')) {
                paymentBreakdown.Cartao += total;
            } else if (ref.includes('dinheiro') || ref.includes('espécie')) {
                paymentBreakdown.Dinheiro += total;
            } else {
                paymentBreakdown.Outros += total;
            }

            let items = o.items;
            if (typeof items === 'string') {
                try { items = JSON.parse(items); } catch(e) { items = []; }
            }

            if (Array.isArray(items)) {
                items.forEach(i => {
                    const qty = Number(i.qty || 1);
                    const name = i.name || 'Item Avulso';
                    const unitPrice = Number(i.unit_price || 0);

                    totalItemsSold += qty;

                    if (!productsMap[name]) {
                        productsMap[name] = { name: name, qty: 0, revenue: 0 };
                    }

                    productsMap[name].qty += qty;
                    productsMap[name].revenue += (qty * unitPrice);
                });
            }
        });

        const productsList = Object.values(productsMap).sort((a, b) => b.qty - a.qty);
        const maxQty = productsList.length > 0 ? productsList[0].qty : 0;
        const totalOrders = orders.length;
        const ticketMedio = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

        return {
            totalRevenue,
            totalOrders,
            ticketMedio,
            totalItemsSold,
            productsList,
            maxQty,
            paymentBreakdown
        };
    },

    exportToCSV() {
        if (!this.lastFilteredOrders || this.lastFilteredOrders.length === 0) {
            if (typeof showToast === 'function') showToast('Não há vendas no período para exportar.', 'warning');
            else alert('Não há vendas no período para exportar.');
            return;
        }

        let csv = 'Data/Hora;Cliente;Telefone;Tipo;Pagamento;Subtotal;Frete;Total;Status\n';

        this.lastFilteredOrders.forEach(o => {
            const date = new Date(o.created_at).toLocaleString('pt-BR');
            const name = (o.client_name || '').replace(/;/g, '');
            const phone = (o.phone || '').replace(/;/g, '');
            const type = o.order_type === 'delivery' ? 'Entrega' : 'Retirada';
            const payment = (o.reference || 'Não informado').replace(/;/g, '');
            const subtotal = Number(o.subtotal || 0).toFixed(2);
            const freight = Number(o.delivery_fee || 0).toFixed(2);
            const total = Number(o.total || 0).toFixed(2);
            const status = o.status || 'pending';

            csv += `"${date}";"${name}";"${phone}";"${type}";"${payment}";"${subtotal}";"${freight}";"${total}";"${status}"\n`;
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Relatorio_Vendas_${this.currentPeriod}_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
    }
};
