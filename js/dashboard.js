// js/dashboard.js - Painel Principal com Seletor de Mês no Card de Saldo Principal e PDF sem Cortes

if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = function(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(text ?? '')));
        return div.innerHTML;
    };
}

function parseDateSafe(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;
    const isoStr = String(dateInput).replace(' ', 'T');
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? null : d;
}

function getIFoodWeeklyCycle(referenceDate = new Date()) {
    const d = parseDateSafe(referenceDate) || new Date();
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

window.dashboardSelectedMonth = window.dashboardSelectedMonth || null;

function selectDashboardMonth(monthStr) {
    if (!monthStr) return;
    window.dashboardSelectedMonth = monthStr;
    renderDashboard();
}

async function exportMenuPDF() {
    try {
        if (typeof showToast === 'function') showToast('⌛ Gerando PDF do cardápio...', 'info');

        let products = [];
        if (typeof dbClient !== 'undefined' && dbClient) {
            try {
                const { data, error } = await dbClient
                    .from('products')
                    .select('*')
                    .eq('is_active', true)
                    .order('display_order', { ascending: true });
                if (!error && data) products = data;
            } catch (e) {
                console.warn('Erro ao buscar produtos para PDF:', e);
            }
        }
        
        if (products.length === 0 && window.currentAdminProducts) {
            products = window.currentAdminProducts.filter(p => p.is_active);
        }

        if (!products || products.length === 0) {
            if (typeof showToast === 'function') showToast('Nenhum prato ativo encontrado.', 'error');
            return;
        }

        const grouped = {};
        products.forEach(p => {
            const cat = p.category || 'Geral';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(p);
        });

        const pdfContainer = document.createElement('div');
        pdfContainer.style.cssText = 'padding: 12px; font-family: Arial, sans-serif; color: #1E293B; background: #FFFFFF; width: 100%; box-sizing: border-box;';

        let categoriesHtml = '';
        for (const [catName, catProds] of Object.entries(grouped)) {
            const itemsHtml = catProds.map(p => {
                const discount = Number(p.discount_pct || 0);
                const originalPrice = Number(p.price || 0);
                const finalPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;
                const safeDesc = p.description ? escapeHtml(p.description) : '';
                
                const imgHtml = p.image_url 
                    ? `<img src="${escapeHtml(p.image_url)}" style="width: 80px; height: 80px; border-radius: 8px; object-fit: cover; flex-shrink: 0;" crossorigin="anonymous">` 
                    : '';

                return `
                    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; padding: 12px 0; border-bottom: 1px dashed #CBD5E1; break-inside: avoid; page-break-inside: avoid;">
                        <div style="display:flex; align-items:flex-start; gap:12px; flex:1;">
                            ${imgHtml}
                            <div style="flex:1;">
                                <strong style="font-size:18px; color:#0F172A; display:block; line-height:1.25; margin-bottom:4px;">${escapeHtml(p.name)}</strong>
                                ${safeDesc ? `<span style="font-size:14px; color:#475569; display:block; line-height:1.4;">${safeDesc}</span>` : ''}
                            </div>
                        </div>
                        <div style="font-size:20px; font-weight:800; color:#0F172A; white-space:nowrap; padding-left:8px; align-self: flex-start;">
                            R$ ${finalPrice.toFixed(2).replace('.', ',')}
                        </div>
                    </div>
                `;
            }).join('');

            categoriesHtml += `
                <div style="margin-bottom:24px; break-inside: avoid; page-break-inside: avoid;">
                    <h3 style="font-size:22px; color:#FF6B35; text-transform:uppercase; border-bottom:3px solid #FF6B35; padding-bottom:6px; margin-bottom:12px; margin-top:16px; break-after: avoid; page-break-after: avoid;">
                        📌 ${escapeHtml(catName)}
                    </h3>
                    ${itemsHtml}
                </div>
            `;
        }

        pdfContainer.innerHTML = `
            <div style="text-align:center; margin-bottom:20px; border-bottom:3px solid #E2E8F0; padding-bottom:12px;">
                <h1 style="margin:0; font-size:28px; color:#0F172A; font-weight:800;">📋 Cardápio Digital</h1>
                <p style="margin:4px 0 0 0; font-size:14px; color:#64748B;">Atualizado em ${new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            ${categoriesHtml}
        `;

        if (typeof html2pdf === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        const opt = {
            margin: [8, 8, 8, 8],
            filename: 'Cardapio_Digital.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, allowTaint: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().set(opt).from(pdfContainer).save();

        if (typeof showToast === 'function') showToast('📄 PDF baixado com sucesso!', 'success');
    } catch (e) {
        console.error('Erro ao gerar PDF do cardápio:', e);
        if (typeof showToast === 'function') showToast('Erro ao gerar PDF.', 'error');
    }
}

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
            try {
                const { data: oData, error: oErr } = await dbClient.from('orders').select('*').order('created_at', { ascending: false });
                if (!oErr && oData) orders = oData;
            } catch (errO) {
                console.warn('Erro ao carregar orders do Supabase:', errO);
            }

            try {
                const { data: eData, error: eErr } = await dbClient.from('expenses').select('*');
                if (!eErr && eData) expenses = eData;
            } catch (errE) {
                console.warn('Tabela de expenses não encontrada ou inacessível no Supabase:', errE);
            }
        }

        if (orders.length === 0) {
            if (typeof state !== 'undefined' && Array.isArray(state.orders) && state.orders.length > 0) {
                orders = state.orders;
            } else if (typeof state !== 'undefined' && Array.isArray(state.sales) && state.sales.length > 0) {
                orders = state.sales;
            } else {
                try {
                    orders = JSON.parse(localStorage.getItem('dly_orders') || localStorage.getItem('dly_sales') || '[]');
                } catch (e) {
                    orders = [];
                }
            }
        }

        if (expenses.length === 0) {
            if (typeof state !== 'undefined' && state.expenses) {
                expenses = [...(state.expenses.fixed || []), ...(state.expenses.logistics || [])];
            } else {
                try {
                    expenses = JSON.parse(localStorage.getItem('dly_expenses') || '[]');
                } catch (e) {
                    expenses = [];
                }
            }
        }

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const validOrders = orders.filter(o => o.status !== 'cancelled');

        if (!window.dashboardSelectedMonth || typeof window.dashboardSelectedMonth !== 'string' || !window.dashboardSelectedMonth.includes('-')) {
            window.dashboardSelectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        let [selYear, selMonth] = window.dashboardSelectedMonth.split('-').map(Number);
        if (isNaN(selYear) || isNaN(selMonth) || selMonth < 1 || selMonth > 12) {
            selYear = now.getFullYear();
            selMonth = now.getMonth() + 1;
            window.dashboardSelectedMonth = `${selYear}-${String(selMonth).padStart(2, '0')}`;
        }

        const startOfMonth = new Date(selYear, selMonth - 1, 1, 0, 0, 0, 0);
        const endOfMonth = new Date(selYear, selMonth, 0, 23, 59, 59, 999);

        // Pedidos do mês selecionado
        const monthOrders = validOrders.filter(o => {
            const d = parseDateSafe(o.created_at || o.date);
            return d && d >= startOfMonth && d <= endOfMonth;
        });

        const monthExp = expenses.filter(e => {
            const d = parseDateSafe(e.expense_date || e.created_at || e.date);
            return d && d >= startOfMonth && d <= endOfMonth;
        });

        const monthInVal = monthOrders.reduce((acc, o) => acc + (Number(o.total || o.amount) || 0), 0);
        const monthOutVal = monthExp.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
        const monthNet = monthInVal - monthOutVal;

        const monthLabel = startOfMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

        const prevMonthObj = new Date(selYear, selMonth - 2, 1);
        const nextMonthObj = new Date(selYear, selMonth, 1);
        const prevMonthStr = `${prevMonthObj.getFullYear()}-${String(prevMonthObj.getMonth() + 1).padStart(2, '0')}`;
        const nextMonthStr = `${nextMonthObj.getFullYear()}-${String(nextMonthObj.getMonth() + 1).padStart(2, '0')}`;

        // 1. Destaque Principal (Top Card): Valor do Mês + Seletor de Mês Direto no Topo
        balanceValue.textContent = `R$ ${monthNet.toFixed(2).replace('.', ',')}`;
        
        if (balanceTrend) {
            balanceTrend.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-top:8px;">
                    <button onclick="selectDashboardMonth('${prevMonthStr}')" title="Mês anterior" style="background:#0F172A; color:#F1F5F9; border:1px solid #334155; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold; min-height:30px;">◄</button>
                    
                    <div style="position:relative; cursor:pointer; background:#0F172A; border:1px solid #334155; padding:4px 12px; border-radius:6px;">
                        <span style="font-weight:bold; color:#FF6B35; font-size:13px;">📅 ${capitalizedMonth}</span>
                        <input type="month" value="${window.dashboardSelectedMonth}" onchange="selectDashboardMonth(this.value)" style="position:absolute; inset:0; opacity:0; width:100%; height:100%; cursor:pointer;">
                    </div>

                    <button onclick="selectDashboardMonth('${nextMonthStr}')" title="Próximo mês" style="background:#0F172A; color:#F1F5F9; border:1px solid #334155; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold; min-height:30px;">►</button>
                </div>
                <div style="font-size:11px; color:#94A3B8; margin-top:6px;">${monthOrders.length} pedido(s) registrado(s) neste mês</div>
            `;
        }

        // 2. Entradas de Hoje
        const todayOrders = validOrders.filter(o => {
            const orderDate = parseDateSafe(o.created_at || o.date);
            if (!orderDate) return false;
            const orderDateStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
            return orderDateStr === todayStr;
        });
        const todayIn = todayOrders.reduce((acc, o) => acc + (Number(o.total || o.amount) || 0), 0);

        // 3. Gastos de Hoje
        const todayExp = expenses.filter(e => {
            const dateVal = e.expense_date || e.created_at || e.date;
            const expDate = parseDateSafe(dateVal);
            if (!expDate) return false;
            const expDateStr = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}-${String(expDate.getDate()).padStart(2, '0')}`;
            return expDateStr === todayStr;
        });
        const todayOut = todayExp.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

        if (inToday) inToday.textContent = `R$ ${todayIn.toFixed(2).replace('.', ',')}`;
        if (outToday) outToday.textContent = `R$ ${todayOut.toFixed(2).replace('.', ',')}`;

        // 4. Saldo da Semana (Quinta a Quarta - Ciclo iFood)
        const { cycleStart, cycleEnd } = getIFoodWeeklyCycle(now);

        const weekOrders = validOrders.filter(o => {
            const d = parseDateSafe(o.created_at || o.date);
            return d && d >= cycleStart && d <= cycleEnd;
        });

        const weekExp = expenses.filter(e => {
            const d = parseDateSafe(e.expense_date || e.created_at || e.date);
            return d && d >= cycleStart && d <= cycleEnd;
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

        // 5. Card Secundário do Mês
        if (monthBalance) monthBalance.textContent = `R$ ${monthNet.toFixed(2).replace('.', ',')}`;

        if (monthRange) {
            monthRange.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-top:4px;">
                    <button onclick="selectDashboardMonth('${prevMonthStr}')" style="background:#0F172A; color:#F1F5F9; border:1px solid #334155; padding:2px 8px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;">◄</button>
                    
                    <div style="position:relative; cursor:pointer;">
                        <span style="font-weight:bold; color:#FF6B35; font-size:13px;">📅 ${capitalizedMonth}</span>
                        <input type="month" value="${window.dashboardSelectedMonth}" onchange="selectDashboardMonth(this.value)" style="position:absolute; inset:0; opacity:0; width:100%; height:100%; cursor:pointer;">
                    </div>

                    <button onclick="selectDashboardMonth('${nextMonthStr}')" style="background:#0F172A; color:#F1F5F9; border:1px solid #334155; padding:2px 8px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;">►</button>
                </div>
            `;
        }

        if (monthBadge) {
            monthBadge.textContent = `${monthOrders.length} pedido(s) • ${monthNet >= 0 ? '🟢 Lucro' : '🔴 Prejuízo'}`;
            monthBadge.style.background = monthNet >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)';
            monthBadge.style.color = monthNet >= 0 ? '#10B981' : '#EF4444';
        }

        // 6. Últimas Movimentações
        if (movList) {
            const recentOrders = validOrders.slice(0, 5);
            if (recentOrders.length === 0) {
                movList.innerHTML = '<div style="color:#94A3B8; text-align:center; padding:15px; font-size:12px;">Nenhuma movimentação recente</div>';
            } else {
                movList.innerHTML = recentOrders.map(o => {
                    const d = parseDateSafe(o.created_at || o.date);
                    const timeStr = d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
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
            try {
                window.AnalyticsManager.render(orders);
            } catch (errAnalytics) {
                console.warn('Erro ao renderizar Analytics:', errAnalytics);
                const analyticsEl = document.getElementById('analyticsContainer') || document.querySelector('[data-analytics-container]');
                if (analyticsEl) analyticsEl.innerHTML = '<div style="color:#94A3B8; font-size:11px; padding:10px; text-align:center;">Estatísticas temporariamente indisponíveis.</div>';
            }
        }

    } catch (e) {
        console.error('Erro geral ao renderizar Dashboard:', e);
    }
}

window.selectDashboardMonth = selectDashboardMonth;
window.renderDashboard = renderDashboard;
window.exportMenuPDF = exportMenuPDF;

document.addEventListener('DOMContentLoaded', () => {
    renderDashboard();
});
