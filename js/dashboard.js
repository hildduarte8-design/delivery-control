// js/dashboard.js

let currentAnalyticsPeriod = 'today';

function renderDashboard() {
    const dashEl = document.getElementById('tab-dashboard');
    if (!dashEl) return;

    const analytics = getAnalyticsData(currentAnalyticsPeriod);

    dashEl.innerHTML = `
        <div style="display:flex; justify-size:space-between; align-items:center; margin-bottom:16px;">
            <div class="section-title" style="margin:0;">📊 Resumo de Vendas</div>
            <select id="analytics-period" onchange="changeAnalyticsPeriod(this.value)" style="background:#1E293B; color:#F1F5F9; border:1px solid #334155; padding:6px 10px; border-radius:8px; font-size:12px; font-weight:bold;">
                <option value="today" ${currentAnalyticsPeriod === 'today' ? 'selected' : ''}>Hoje</option>
                <option value="7days" ${currentAnalyticsPeriod === '7days' ? 'selected' : ''}>Últimos 7 Dias</option>
                <option value="month" ${currentAnalyticsPeriod === 'month' ? 'selected' : ''}>Este Mês</option>
            </select>
        </div>

        <!-- CARDS DE SALDO E LUCRO -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
            <div class="card" style="margin:0; padding:14px; background:#1E293B; border-left:4px solid #10B981;">
                <div style="font-size:11px; color:#94A3B8; text-transform:uppercase; font-weight:bold;">Faturamento</div>
                <div style="font-size:18px; font-weight:800; color:#10B981; margin-top:4px;">
                    R$ ${analytics.totalRevenue.toFixed(2)}
                </div>
                <div style="font-size:10px; color:#64748B; margin-top:2px;">${analytics.salesCount} pedidos</div>
            </div>

            <div class="card" style="margin:0; padding:14px; background:#1E293B; border-left:4px solid #EF4444;">
                <div style="font-size:11px; color:#94A3B8; text-transform:uppercase; font-weight:bold;">Custos/Saídas</div>
                <div style="font-size:18px; font-weight:800; color:#EF4444; margin-top:4px;">
                    R$ ${analytics.totalExpenses.toFixed(2)}
                </div>
            </div>
        </div>

        <div class="card" style="background:#0F172A; border:1px solid #334155; margin-bottom:16px; padding:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:13px; font-weight:bold; color:#CBD5E1;">LUCRO LÍQUIDO REAL</span>
                <span style="font-size:20px; font-weight:800; color:${analytics.netProfit >= 0 ? '#10B981' : '#EF4444'};">
                    R$ ${analytics.netProfit.toFixed(2)}
                </span>
            </div>
        </div>

        <!-- CARD DO CARDÁPIO DIGITAL NO DASHBOARD -->
<div class="card" style="background: linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(30,41,59,1) 100%); border-color: rgba(245,158,11,0.3); padding: 16px;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
        <div>
            <div style="font-size:15px; font-weight:800; color:#F59E0B;">📖 Cardápio Digital</div>
            <div style="font-size:12px; color:#94A3B8; margin-top:2px;">Divulgue sua loja e receba pedidos organizados</div>
        </div>
        <span style="font-size: 24px;">🛵</span>
    </div>
    
    <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
        <button class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText(window.location.origin + '/cardapio.html'); showToast('Link copiado!');" style="font-size:12px; padding:10px;">
            📋 Copiar Link
        </button>
        <button class="btn btn-sm" style="background:#25D366; color:#fff; font-size:12px; padding:10px;" onclick="window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent('Olá! Confira nosso cardápio e faça seu pedido por aqui: ' + window.location.origin + '/cardapio.html'), '_blank')">
            📲 Enviar Whats
        </button>
        <button class="btn btn-sm btn-secondary" onclick="exportMenuToPDF()" style="font-size:12px; padding:10px;">
            📄 Baixar PDF
        </button>
        <button class="btn btn-sm" style="background:#F59E0B; color:#fff; font-size:12px; padding:10px;" onclick="window.location.href='cardapio.html'">
            👁️ Abrir
        </button>
    </div>
</div>

        <!-- PRODUTOS MAIS VENDIDOS -->
        <div class="card" style="margin-bottom:16px;">
            <div style="font-size:13px; font-weight:bold; color:#F1F5F9; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                🏆 Produtos Mais Vendidos
            </div>
            <div id="top-products-list">
                ${renderTopProductsHtml(analytics.topProducts)}
            </div>
        </div>

        <!-- BOTÃO DE FECHAMENTO DE CAIXA -->
        <button class="btn btn-large" onclick="closeDailyCashier()" style="background:#FF6B35; font-weight:bold;">
            🔒 Fechar Caixa do Dia
        </button>
    `;
}

function renderTopProductsHtml(products) {
    if (!products || products.length === 0) {
        return '<div style="font-size:12px; color:#64748B; text-align:center; padding:10px;">Nenhum produto vendido neste período.</div>';
    }

    return products.map((p, index) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #334155;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:12px; font-weight:bold; color:#FF6B35; background:#0F172A; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center;">${index + 1}</span>
                <span style="font-size:13px; font-weight:600; color:#F1F5F9;">${p.name}</span>
            </div>
            <span style="font-size:12px; font-weight:bold; color:#94A3B8;">${p.qty}x un.</span>
        </div>
    `).join('');
}

function changeAnalyticsPeriod(period) {
    currentAnalyticsPeriod = period;
    renderDashboard();
}

function closeDailyCashier() {
    const analytics = getAnalyticsData('today');
    
    if (confirm(`Deseja fechar o caixa de hoje?\n\nFaturamento: R$ ${analytics.totalRevenue.toFixed(2)}\nLucro: R$ ${analytics.netProfit.toFixed(2)}\nTotal Pedidos: ${analytics.salesCount}`)) {
        showToast('Caixa do dia fechado e registrado no histórico!');
    }
}
