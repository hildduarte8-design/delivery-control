// js/dashboard.js - Painel Principal, Fechamento Financeiro e Exportação de Cardápio em PDF

if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = function(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(text ?? '')));
        return div.innerHTML;
    };
}

function parseDateSafe(dateInput) {
    if (!dateInput) return new Date();
    if (dateInput instanceof Date) return dateInput;
    const isoStr = String(dateInput).replace(' ', 'T');
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? new Date() : d;
}

// Retorna a data no formato YYYY-MM-DD considerando o fuso horário local do navegador
function getLocalDateString(dateInput) {
    const d = parseDateSafe(dateInput);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

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

async function exportMenuPDF() {
    try {
        if (typeof showToast === 'function') showToast('⌛ Gerando PDF do cardápio ampliado...', 'info');

        let products = [];
        if (typeof dbClient !== 'undefined' && dbClient) {
            const { data, error } = await dbClient
                .from('products')
                .select('*')
                .eq('is_active', true)
                .order('display_order', { ascending: true });
            if (!error && data) products = data;
        } else if (window.currentAdminProducts) {
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
        pdfContainer.style.cssText = 'padding: 8px; font-family: Arial, sans-serif; color: #1E293B; background: #FFFFFF; width: 100%; box-sizing: border-box;';

        let categoriesHtml = '';
        for (const [catName, catProds] of Object.entries(grouped)) {
            const itemsHtml = catProds.map(p => {
                const discount = Number(p.discount_pct || 0);
                const originalPrice = Number(p.price || 0);
                const finalPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;
                const safeDesc = p.description ? escapeHtml(p.description) : '';
                
                const imgHtml = p.image_url 
                    ? `<img src="${escapeHtml(p.image_url)}" style="width: 85px; height: 85px; border-radius: 10px; object-fit: cover; flex-shrink: 0;" crossorigin="anonymous">` 
                    : '';

                return `
                    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; padding: 14px 0; border-bottom: 1px dashed #CBD5E1; page-break-inside: avoid;">
                        <div style="display:flex; align-items:flex-start; gap:14px; flex:1;">
                            ${imgHtml}
                            <div style="flex:1;">
                                <strong style="font-size:20px; color:#0F172A; display:block; line-height:1.25; margin-bottom:4px;">${escapeHtml(p.name)}</strong>
                                ${safeDesc ? `<span style="font-size:15px; color:#475569; display:block; line-height:1.4;">${safeDesc}</span>` : ''}
                            </div>
                        </div>
                        <div style="font-size:22px; font-weight:800; color:#0F172A; white-space:nowrap; padding-left:8px; align-self: flex-start;">
                            R$ ${finalPrice.toFixed(2).replace('.', ',')}
                        </div>
                    </div>
                `;
            }).join('');

            categoriesHtml += `
                <div style="margin-bottom:26px; page-break-inside: avoid;">
                    <h3 style="font-size:24px; color:#FF6B35; text-transform:uppercase; border-bottom:3px solid #FF6B35; padding-bottom:6px; margin-bottom:12px; margin-top:18px;">
                        📌 ${escapeHtml(catName)}
                    </h3>
                    ${itemsHtml}
                </div>
            `;
        }

        pdfContainer.innerHTML = `
            <div style="text-align:center; margin-bottom:22px; border-bottom:3px solid #E2E8F0; padding-bottom:14px;">
                <h1 style="margin:0; font-size:32px; color:#0F172A; font-weight:800;">📋 Cardápio Digital</h1>
                <p style="margin:6px 0 0 0; font-size:15px; color:#64748B;">Atualizado em ${new Date().toLocaleDateString('pt-BR')}</p>
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
            margin: [4, 4, 4, 4],
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
        const todayStr = getLocalDateString(now);

        // Descarte de pedidos cancelados ou cadastros de perfis fictícios
        const validOrders = orders.filter(o => 
            o.status !== 'cancelled' && 
            o.status !== 'customer_profile' && 
            o.order_type !== 'customer_register' &&
            Number(o.total || o.amount || 0) > 0
        );

        // 1. Entradas de Hoje (Apenas Válidos e com fuso local)
        const todayOrders = validOrders.filter(o => getLocalDateString(o.created_at || o.date) === todayStr);
        const todayIn = todayOrders.reduce((acc, o) => acc + (Number(o.total || o.amount) || 0), 0);

        // 2. Gastos de Hoje
        const todayExp = expenses.filter(e => getLocalDateString(e.expense_date || e.created_at || e.date) === todayStr);
        const todayOut = todayExp.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

        if (inToday) inToday.textContent = `R$ ${todayIn.toFixed(2).replace('.', ',')}`;
        if (outToday) outToday.textContent = `R$ ${todayOut.toFixed(2).replace('.', ',')}`;

        // 3. Saldo Atual Geral
        const totalInGeral = validOrders.reduce((acc, o) => acc + (Number(o.total || o.amount) || 0), 0);
        const totalOutGeral = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
        const currentBalance = totalInGeral - totalOutGeral;

        balanceValue.textContent = `R$ ${currentBalance.toFixed(2).replace('.', ',')}`;
        if (balanceTrend) {
            balanceTrend.textContent = validOrders.length > 0 
                ? `${validOrders.length} pedido(s) válido(s) registrado(s)` 
                : 'Sem movimentações ainda';
        }

        // 4. Saldo da Semana (Quinta a Quarta)
        const { cycleStart, cycleEnd } = getIFoodWeeklyCycle(now);

        const weekOrders = validOrders.filter(o => {
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

        // 5. Saldo do Mês
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthOrders = validOrders.filter(o => parseDateSafe(o.created_at || o.date) >= startOfMonth);
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

        // 6. Últimas Movimentações (Apenas pedidos válidos)
        if (movList) {
            const recentOrders = validOrders.slice(0, 5);
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

        // 7. Repassa apenas pedidos válidos para o Analytics
        if (window.AnalyticsManager && typeof window.AnalyticsManager.render === 'function') {
            window.AnalyticsManager.render(validOrders);
        }

    } catch (e) {
        console.error('Erro ao renderizar Dashboard:', e);
    }
}

window.renderDashboard = renderDashboard;
window.exportMenuPDF = exportMenuPDF;

document.addEventListener('DOMContentLoaded', () => {
    renderDashboard();
});
