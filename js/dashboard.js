// js/dashboard.js - Painel Principal do Dashboard & Resumo Financeiro

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

        // Busca dados do Supabase se disponível, ou usa o estado local
        if (typeof dbClient !== 'undefined') {
            const [ordersRes, expRes] = await Promise.all([
                dbClient.from('orders').select('*').order('created_at', { ascending: false }),
                dbClient.from('expenses').select('*')
            ]);
            orders = ordersRes.data || [];
            expenses = expRes.data || [];
        } else if (typeof state !== 'undefined') {
            orders = state.sales || [];
            expenses = [...(state.expenses?.fixed || []), ...(state.expenses?.logistics || [])];
        }

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // 1. Entradas de Hoje
        const todayOrders = orders.filter(o => {
            if (o.status === 'cancelled') return false;
            const orderDate = new Date(o.created_at || o.date).toISOString().split('T')[0];
            return orderDate === todayStr;
        });
        const todayIn = todayOrders.reduce((acc, o) => acc + (Number(o.total || o.amount) || 0), 0);

        // 2. Gastos de Hoje
        const todayExp = expenses.filter(e => {
            const expDate = new Date(e.created_at || e.date).toISOString().split('T')[0];
            return expDate === todayStr;
        });
        const todayOut = todayExp.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

        if (inToday) inToday.textContent = `R$ ${todayIn.toFixed(2)}`;
        if (outToday) outToday.textContent = `R$ ${todayOut.toFixed(2)}`;

        // 3. Saldo Atual Geral (Entradas - Gastos)
        const totalInGeral = orders
            .filter(o => o.status !== 'cancelled')
            .reduce((acc, o) => acc + (Number(o.total || o.amount) || 0), 0);
        const totalOutGeral = expenses
            .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
        const currentBalance = totalInGeral - totalOutGeral;

        balanceValue.textContent = `R$ ${currentBalance.toFixed(2)}`;
        if (balanceTrend) {
            balanceTrend.textContent = orders.length > 0 
                ? `${orders.length} pedido(s) registrado(s)` 
                : 'Sem movimentações ainda';
        }

        // 4. Saldo da Semana
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0,0,0,0);

        const weekOrders = orders.filter(o => o.status !== 'cancelled' && new Date(o.created_at || o.date) >= startOfWeek);
        const weekExp = expenses.filter(e => new Date(e.created_at || e.date) >= startOfWeek);
        const weekInVal = weekOrders.reduce((acc, o) => acc + (Number(o.total || o.amount) || 0), 0);
        const weekOutVal = weekExp.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
        const weekNet = weekInVal - weekOutVal;

        if (weekBalance) weekBalance.textContent = `R$ ${weekNet.toFixed(2)}`;
        if (weekRange) weekRange.textContent = `${startOfWeek.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})} até hoje`;
        if (weekBadge) {
            weekBadge.textContent = weekNet >= 0 ? '🟢 Positivo' : '🔴 Deficit';
            weekBadge.style.background = weekNet >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)';
            weekBadge.style.color = weekNet >= 0 ? '#10B981' : '#EF4444';
        }

        // 5. Saldo do Mês
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthOrders = orders.filter(o => o.status !== 'cancelled' && new Date(o.created_at || o.date) >= startOfMonth);
        const monthExp = expenses.filter(e => new Date(e.created_at || e.date) >= startOfMonth);
        const monthInVal = monthOrders.reduce((acc, o) => acc + (Number(o.total || o.amount) || 0), 0);
        const monthOutVal = monthExp.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
        const monthNet = monthInVal - monthOutVal;

        if (monthBalance) monthBalance.textContent = `R$ ${monthNet.toFixed(2)}`;
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
                    const timeStr = new Date(o.created_at || o.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    return `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #1E293B;">
                            <div>
                                <strong style="color:#F1F5F9; font-size:13px; display:block;">👤 ${o.client_name || 'Venda/Pedido'}</strong>
                                <span style="font-size:11px; color:#94A3B8;">⏰ ${timeStr} • ${o.order_type === 'delivery' ? '🛵 Entrega' : '🏪 Balcão'}</span>
                            </div>
                            <span style="font-size:14px; font-weight:bold; color:#10B981;">+ R$ ${Number(o.total || o.amount || 0).toFixed(2)}</span>
                        </div>
                    `;
                }).join('');
            }
        }

        // 7. Renderiza Analytics
        if (typeof AnalyticsManager !== 'undefined' && typeof AnalyticsManager.render === 'function') {
            AnalyticsManager.render();
        }

    } catch (e) {
        console.error('Erro ao renderizar Dashboard:', e);
    }
}
