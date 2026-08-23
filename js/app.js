// js/app.js - Inicialização, Autenticação, Relógio e Gestos de Navegação

function updateHeader() {
    const d = new Date();
    const hh = d.getHours();
    let g = 'Bom dia';
    if (hh >= 12 && hh < 18) g = 'Boa tarde';
    else if (hh >= 18 || hh < 5) g = 'Boa noite';
    
    const greetingEl = document.getElementById('greetingText');
    const dateEl = document.getElementById('currentDate');
    
    if (greetingEl) greetingEl.textContent = g;
    if (dateEl) dateEl.textContent = d.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });
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
        <button class="btn btn-large" onclick="localStorage.setItem('dly_welcomed','1'); closeModal(); if(typeof weeklyNotificationBanner === 'function') weeklyNotificationBanner();">
            🚀 Começar a usar
        </button>
    `);
}

function checkAdminAuth() {
    if (typeof DB === 'undefined') return;
    const settings = DB.load('dly_settings', {});
    const savedPassword = settings.password;

    // Se nenhuma senha foi definida ainda, libera o acesso
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
    const settings = typeof DB !== 'undefined' ? DB.load('dly_settings', {}) : {};

    if (input && input === settings.password) {
        sessionStorage.setItem('dly_auth', 'true');
        closeModal();
        showToast('Acesso liberado!');
    } else {
        showToast('Senha incorreta!', 'error');
    }
}

// --- NAVEGAÇÃO POR GESTOS (ARRASTAR TELA NO MOBILE) ---
function initGestureNavigation() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    const tabsOrder = ['dashboard', 'stock', 'sales', 'expenses', 'settings'];
    const mainContainer = document.querySelector('main');

    if (!mainContainer) return;

    mainContainer.addEventListener('touchstart', (e) => {
        // Ignora toques em modais, inputs, seletores ou listas horizontais
        if (e.target.closest('.cross-sell-items, .subtabs, .modal-overlay, input, textarea, select')) {
            touchStartX = 0;
            touchStartY = 0;
            return;
        }
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    mainContainer.addEventListener('touchend', (e) => {
        if (touchStartX === 0) return;

        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipeGesture();
    }, { passive: true });

    function handleSwipeGesture() {
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        // Movimento horizontal significativo (maior que 60px)
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 60) {
            const activeNavBtn = document.querySelector('.bottom-nav button.active');
            const currentTab = activeNavBtn ? activeNavBtn.dataset.tab : 'dashboard';
            const currentIndex = tabsOrder.indexOf(currentTab);

            if (currentIndex === -1) return;

            if (deltaX < 0) {
                // Arrastou para a esquerda ➔ Avança a aba
                if (currentIndex < tabsOrder.length - 1) {
                    const nextTab = tabsOrder[currentIndex + 1];
                    if (typeof switchTab === 'function') switchTab(nextTab);
                }
            } else {
                // Arrastou para a direita ➔ Volta a aba
                if (currentIndex > 0) {
                    const prevTab = tabsOrder[currentIndex - 1];
                    if (typeof switchTab === 'function') switchTab(prevTab);
                }
            }
        }
        
        touchStartX = 0;
        touchStartY = 0;
    }
}

function init() {
    if (typeof setupManifest === 'function') setupManifest();
    if (typeof setupServiceWorker === 'function') setupServiceWorker();
    if (typeof loadAll === 'function') loadAll();
    
    updateHeader();
    checkAdminAuth();
    
    if (typeof switchTab === 'function') switchTab('dashboard');
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
    
    initGestureNavigation();
    
    setInterval(updateHeader, 60000);
    if (typeof checkWeeklyNotification === 'function') checkWeeklyNotification();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
