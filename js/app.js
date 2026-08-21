function updateHeader() {
    const d = new Date();
    const hh = d.getHours();
    let g = 'Bom dia';
    if (hh >= 12 && hh < 18) g = 'Boa tarde';
    else if (hh >= 18 || hh < 5) g = 'Boa noite';
    document.getElementById('greetingText').textContent = g;
    document.getElementById('currentDate').textContent = d.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });
}

function showWelcome() {
    if (localStorage.getItem('dly_welcomed')) return;
    openModal('🎉 Bem-vindo ao Delivery Control!', `
        <p style="color:#F1F5F9; font-size:15px; margin-bottom:14px;">
            Seu app de gestão para Delivery está pronto.
        </p>
        <div style="background:#0F172A; border-radius:12px; padding:14px; margin-bottom:14px; border:1px solid #334155;">
            <div style="font-size:13px; color:#94A3B8; line-height:1.7;">
                <strong style="color:#FF6B35;">📦 Estoque:</strong> insumos + calculadora de custo<br>
                <strong style="color:#FF6B35;">💰 Entradas:</strong> vendas e serviços com canal<br>
                <strong style="color:#FF6B35;">📊 Gastos:</strong> contas fixas e logística<br>
                <strong style="color:#FF6B35;">🏠 Dashboard:</strong> saldo em tempo real
            </div>
        </div>
        <button class="btn btn-large" onclick="localStorage.setItem('dly_welcomed','1'); closeModal(); weeklyNotificationBanner();">
            🚀 Começar a usar
        </button>
    `);
}

function init() {
    setupManifest();
    setupServiceWorker();
    loadAll();
    updateHeader();
    switchTab('dashboard');
    renderDashboard();
    setInterval(updateHeader, 60000);
    checkWeeklyNotification();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
