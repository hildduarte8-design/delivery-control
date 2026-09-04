// js/dashboard.js - Painel Principal & Fechamento Financeiro

// Declaração segura do escapeHtml para evitar duplicidade no escopo global (NR-07)
if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = function(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(text ?? '')));
        return div.innerHTML;
    };
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

// Painel Principal
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

        if (typeof dbClient !== 'undefined' && dbClient) {
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

        // 2. Gastos de Hoje (Prioriza expense_date para alinhamento correto)
        const todayExp = expenses.filter(e => {
            const dateVal = e.expense_date || e.created_at || e.date;
            const expDate = parseDateSafe(dateVal);
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
            return d >= cycleStart && d <= cycleEnd;
        });

        const weekExp = expenses.filter(e => {
            const d = parseDateSafe(e.expense_date || e.created_at || e.date);
            return d >= cycleStart && d <= cycleEnd;
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

        // 5. Saldo do Mês (Considera expense_date)
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthOrders = orders.filter(o => o.status !== 'cancelled' && parseDateSafe(o.created_at || o.date) >= startOfMonth);
        const monthExp = expenses.filter(e => parseDateSafe(e.expense_date || e.created_at || e.date) >= startOfMonth);
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

        // 7. Renderiza Analytics repassando o array de pedidos (Evita re-query no Supabase - NR-09)
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
