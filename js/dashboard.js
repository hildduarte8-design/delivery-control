// js/analytics.js & js/dashboard.js - Painel Principal e Métricas de Vendas

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(text ?? '')));
    return div.innerHTML;
}

// Helper para converter datas do Supabase/Local sem falhas no iOS/Safari
function parseDateSafe(dateInput) {
    if (!dateInput) return new Date();
    if (dateInput instanceof Date) return dateInput;
    const isoStr = String(dateInput).replace(' ', 'T');
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? new Date() : d;
}

// Helper: Calcula o intervalo do ciclo semanal estilo iFood (Quinta 00:00 a Quarta 23:59)
function getIFoodWeeklyCycle(referenceDate = new Date()) {
    const d = parseDateSafe(referenceDate);
    d.setHours(0, 0, 0, 0);

    const dayOfWeek = d.getDay();
    const daysSinceThursday = (dayOfWeek + 3) % 7;

    const cycleStart = new Date(d);
    cycleStart.setDate(d.getDate() - daysSinceThursday);
    cycleStart.setHours(0, 0, 0, 0);

    const cycleEnd = new Date(cycleStart);
    cycleEnd.setDate(cycleStart.getDate() + 6);
    cycleEnd.setHours(23, 59, 59, 999);

    return { cycleStart, cycleEnd };
}

// Módulo de Analytics
if (!window.AnalyticsManager) {
    window.AnalyticsManager = {
        currentFilter: 'all',
        cachedOrders: [],

        setFilter(filterType) {
            this.currentFilter = filterType;
            this.render();
        },

        render(ordersList = null) {
            if (ordersList && Array.isArray(ordersList)) {
                this.cachedOrders = ordersList;
            }

            let orders = this.cachedOrders;
            if (!orders || orders.length === 0) {
                if (typeof state !== 'undefined' && Array.isArray(state.orders)) orders = state.orders;
                else {
                    try {
                        orders = JSON.parse(localStorage.getItem('dly_orders') || localStorage.getItem('dly_sales') || '[]');
                    } catch (e) {
                        orders = [];
                    }
                }
            }

            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            const filteredOrders = orders.filter(o => {
                if (o.status === 'cancelled') return false;

                const orderDate = parseDateSafe(o.created_at || o.date);
                const orderDateStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;

                if (this.currentFilter === 'today') return orderDateStr === todayStr;
                if (this.currentFilter === '7days') {
                    const diffDays = Math.ceil(Math.abs(now - orderDate) / (1000 * 60 * 60 * 24));
                    return diffDays <= 7;
                }
                if (this.currentFilter === 'month') {
                    return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
                }
                return true;
            });

            let totalRevenue = 0;
            let totalOrdersCount = filteredOrders.length;
            let totalItemsQty = 0;

            let totalPix = 0;
            let totalCard = 0;
            let totalCash = 0;

            const rankingMap = new Map();

            filteredOrders.forEach(o => {
                const orderTotal = Number(o.total || o.amount || 0);
                totalRevenue += orderTotal;

                const method = String(o.payment_method || o.reference || o.paymentMethod || '').toLowerCase();

                if (method.includes('pix')) {
                    totalPix += orderTotal;
                } else if (method.includes('carta') || method.includes('cartão') || method.includes('credito') || method.includes('debito') || method.includes('card')) {
                    totalCard += orderTotal;
                } else {
                    totalCash += orderTotal;
                }

                let items = o.items;
                if (typeof items === 'string') {
                    try { items = JSON.parse(items); } catch (e) { items = []; }
                }

                if (Array.isArray(items) && items.length > 0) {
                    items.forEach(item => {
                        const qty = Number(item.qty || item.quantity || 1);
                        totalItemsQty += qty;

                        const name = item.name || 'Item do Cardápio';

                        let itemTotal = Number(item.total || 0);
                        if (itemTotal <= 0) {
                            const unitPrice = Number(item.price || item.unit_price || item.unitPrice || (orderTotal > 0 ? orderTotal / items.length : 0));
                            itemTotal = unitPrice * qty;
                        }

                        if (!rankingMap.has(name)) {
                            rankingMap.set(name, { qty: 0, revenue: 0 });
                        }

                        const curr = rankingMap.get(name);
                        curr.qty += qty;
                        curr.revenue += itemTotal;
                    });
                }
            });

            const elFaturamento = document.getElementById('dash_faturamento') || document.getElementById('analyticsRevenue');
            const elTotalPedidos = document.getElementById('dash_total_pedidos') || document.getElementById('analyticsOrdersCount');
            const elTicketMedio = document.getElementById('dash_ticket_medio') || document.getElementById('analyticsTicket');
            const elItensVendidos = document.getElementById('dash_itens_vendidos') || document.getElementById('analyticsItemsCount');

            const elPix = document.getElementById('dash_pay_pix') || document.getElementById('payPixVal');
            const elCard = document.getElementById('dash_pay_card') || document.getElementById('payCardVal');
            const elCash = document.getElementById('dash_pay_cash') || document.getElementById('payCashVal');

            const ticketMedioVal = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

            if (elFaturamento) elFaturamento.textContent = `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`;
            if (elTotalPedidos) elTotalPedidos.textContent = totalOrdersCount;
            if (elTicketMedio) elTicketMedio.textContent = `R$ ${ticketMedioVal.toFixed(2).replace('.', ',')}`;
            if (elItensVendidos) elItensVendidos.textContent = `${totalItemsQty} un`;

            if (elPix) elPix.textContent = `R$ ${totalPix.toFixed(2).replace('.', ',')}`;
            if (elCard) elCard.textContent = `R$ ${totalCard.toFixed(2).replace('.', ',')}`;
            if (elCash) elCash.textContent = `R$ ${totalCash.toFixed(2).replace('.', ',')}`;

            const rankingContainer = document.getElementById('dash_ranking_list') || document.getElementById('rankingContainer');
            if (rankingContainer) {
                const sortedRanking = Array.from(rankingMap.entries()).sort((a, b) => b[1].qty - a[1].qty);

                if (sortedRanking.length === 0) {
                    rankingContainer.innerHTML = '<div style="color:#94A3B8; font-size:12px; padding:15px; text-align:center;">Nenhum prato vendido ainda.</div>';
                } else {
                    rankingContainer.innerHTML = sortedRanking.map(([name, data], idx) => {
                        const trophy = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🏅';
                        const revFormatted = data.revenue.toFixed(2).replace('.', ',');
                        return `
                            <div style="margin-bottom:10px; padding:8px; background:#0F172A; border-radius:6px; border:1px solid #1E293B;">
                                <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; color:#F1F5F9;">
                                    <span>${trophy} <strong>${escapeHtml(name)}</strong></span>
                                    <strong style="color:#10B981;">${data.qty} un <span style="color:#94A3B8; font-size:11px; font-weight:normal;">(R$ ${revFormatted})</span></strong>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }
        }
    };
}

// Painel Principal com Fechamento Semanal Estilo iFood (Quinta a Quarta)
async function renderDashboard() {
    const balanceValue = document.getElementById('balanceValue');
    const balanceTrend = document.getElementById('balanceTrend');
    const inToday = document.getElementById('inToday');
    const outToday = document.getElementById('outToday');
    const weekBalance = document.getElementById('weekBalance');
    const weekRange = document.getElementById('weekRange');
    const weekBadge = document.getElementById('weekBadge');
    const monthBalance = document.getElementById('monthBalance');
    const monthRange = document.getElementById('monthRange');
    const monthBadge = document.getElementById('monthBadge');
    const movList = document.getElementById('movList');

    if (!balanceValue) return;

    try {
        let orders = [];
        let expenses = [];

        if (typeof dbClient !== 'undefined') {
            const [ordersRes, expRes] = await Promise.all([
                dbClient.from('orders').select('*').order('created_at', { ascending: false }),
                dbClient.from('expenses').select('*')
            ]);
            orders = ordersRes.data || [];
            expenses = expRes.data || [];
        } else if (typeof state !== 'undefined') {
            orders = state.sales || state.orders || [];
            expenses = [...(state.expenses?.fixed || []), ...(state.expenses?.logistics || [])];
        }

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // 1. Entradas de Hoje
        const todayOrders = orders.filter(o => {
            if (o.status === 'cancelled') return false;
            const orderDate = parseDateSafe(o.created_at || o.date);
            const orderDateStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
            return orderDateStr === todayStr;
        });
        const todayIn = todayOrders.reduce((acc, o) => acc + (Number(o.total || o.amount) || 0), 0);

        // 2. Gastos de Hoje
        const todayExp = expenses.filter(e => {
            const expDate = parseDateSafe(e.created_at || e.date);
            const expDateStr = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}-${String(expDate.getDate()).padStart(2, '0')}`;
            return expDateStr === todayStr;
        });
        const todayOut = todayExp.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

        if (inToday) inToday.textContent = `R$ ${todayIn.toFixed(2).replace('.', ',')}`;
        if (outToday) outToday.textContent = `R$ ${todayOut.toFixed(2).replace('.', ',')}`;

        // 3. Saldo Atual Geral
        const totalInGeral = orders
            .filter(o => o.status !== 'cancelled')
            .reduce((acc, o) => acc + (Number(o.total || o.amount) || 0), 0);
        const totalOutGeral = expenses
            .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
        const currentBalance = totalInGeral - totalOutGeral;

        balanceValue.textContent = `R$ ${currentBalance.toFixed(2).replace('.', ',')}`;
        if (balanceTrend) {
            balanceTrend.textContent = orders.length > 0 
                ? `${orders.length} pedido(s) registrado(s)` 
                : 'Sem movimentações ainda';
        }

        // 4. Saldo da Semana (Ciclo de Repasse: Quinta a Quarta)
        const { cycleStart, cycleEnd } = getIFoodWeeklyCycle(now);

        const weekOrders = orders.filter(o => {
            if (o.status === 'cancelled') return false;
            const d = parseDateSafe(o.created_at || o.date);
            return d >= cycleStart && d <= now;
        });

        const weekExp = expenses.filter(e => {
            const d = parseDateSafe(e.created_at || e.date);
            return d >= cycleStart && d <= now;
        });

        const weekInVal = weekOrders.reduce((acc, o) => acc + (Number(o.total || o.amount) || 0), 0);
        const weekOutVal = weekExp.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
        const weekNet = weekInVal - weekOutVal;

        const isWednesday = now.getDay() === 3;

        if (weekBalance) weekBalance.textContent = `R$ ${weekNet.toFixed(2).replace('.', ',')}`;
        if (weekRange) {
            const startStr = cycleStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const endStr = cycleEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            weekRange.textContent = `Ciclo: ${startStr} (Qui) a ${endStr} (Qua)`;
        }

        if (weekBadge) {
            if (isWednesday) {
                weekBadge.textContent = '💰 Fechamento Hoje!';
                weekBadge.style.background = 'rgba(245, 158, 11, 0.25)';
                weekBadge.style.color = '#F59E0B';
            } else {
                weekBadge.textContent = weekNet >= 0 ? '🟢 Em andamento' : '🔴 Em andamento';
                weekBadge.style.background = weekNet >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)';
                weekBadge.style.color = weekNet >= 0 ? '#10B981' : '#EF4444';
            }
        }

        // 5. Saldo do Mês
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthOrders = orders.filter(o => o.status !== 'cancelled' && parseDateSafe(o.created_at || o.date) >= startOfMonth);
        const monthExp = expenses.filter(e => parseDateSafe(e.created_at || e.date) >= startOfMonth);
        const monthInVal = monthOrders.reduce((acc, o) => acc + (Number(o.total || o.amount) || 0), 0);
        const monthOutVal = monthExp.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
        const monthNet = monthInVal - monthOutVal;

        if (monthBalance) monthBalance.textContent = `R$ ${monthNet.toFixed(2).replace('.', ',')}`;
        if (monthRange) monthRange.textContent = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        if (monthBadge) {
            monthBadge.textContent = monthNet >= 0 ? '🟢 Positivo' : '🔴 Deficit';
            monthBadge.style.background = monthNet >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)';
            monthBadge.style.color = monthNet >= 0 ? '#10B981' : '#EF4444';
        }

        // 6. Últimas Movimentações (5 mais recentes)
        if (movList) {
            const recentOrders = orders.slice(0, 5);
            if (recentOrders.length === 0) {
                movList.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:15px; font-size:12px;">Nenhuma movimentação recente</div>';
            } else {
                movList.innerHTML = recentOrders.map(o => {
                    const timeStr = parseDateSafe(o.created_at || o.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const valFormatted = Number(o.total || o.amount || 0).toFixed(2).replace('.', ',');
                    return `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #1E293B;">
                            <div>
                                <strong style="color:#F1F5F9; font-size:13px; display:block;">👤 ${escapeHtml(o.client_name || o.customer_name || 'Venda/Pedido')}</strong>
                                <span style="font-size:11px; color:#94A3B8;">⏰ ${timeStr} • ${o.order_type === 'delivery' ? '🛵 Entrega' : '🏪 Balcão'}</span>
                            </div>
                            <span style="font-size:14px; font-weight:bold; color:#10B981;">+ R$ ${valFormatted}</span>
                        </div>
                    `;
                }).join('');
            }
        }

        // 7. Renderiza Analytics
        if (window.AnalyticsManager && typeof window.AnalyticsManager.render === 'function') {
            window.AnalyticsManager.render(orders);
        }

    } catch (e) {
        console.error('Erro ao renderizar Dashboard:', e);
    }
}

window.renderDashboard = renderDashboard;

document.addEventListener('DOMContentLoaded', () => {
    renderDashboard();
});
