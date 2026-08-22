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

function checkAdminAuth() {
    const settings = DB.load('dly_settings', {});
    const savedPassword = settings.password;

    // Se nenhuma senha foi definida ainda, libera o acesso livremente
    if (!savedPassword) return;

    // Se já foi autenticado nesta sessão do navegador, libera
    if (sessionStorage.getItem('dly_auth') === 'true') return;

    // Solicita a senha para desbloquear a interface
    openModal('🔒 Acesso Restrito', `
        <div class="form-group" style="margin-top: 10px;">
            <label>Digite a senha do gestor</label>
            <input type="password" id="admin_pass_input" placeholder="****" style="margin-top: 6px;">
        </div>
        <button class="btn btn-large" onclick="validatePassword()" style="margin-top: 12px;">Entrar no Painel</button>
    `);
}

function validatePassword() {
    const input = document.getElementById('admin_pass_input')?.value;
    const settings = DB.load('dly_settings', {});

    if (input && input === settings.password) {
        sessionStorage.setItem('dly_auth', 'true');
        closeModal();
        showToast('Acesso liberado!');
    } else {
        showToast('Senha incorreta!', 'error');
    }
}

function init() {
    setupManifest();
    setupServiceWorker();
    loadAll();
    updateHeader();
    checkAdminAuth();
    switchTab('dashboard');
    renderDashboard();
    updateNotificationBadge();
    setInterval(updateHeader, 60000);
    checkWeeklyNotification();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
