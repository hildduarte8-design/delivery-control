// js/app.js - Inicialização, Autenticação, Relógio e Gestos de Navegação com Física Tátil

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
                <strong style="color:#FF6B35;">🛍️ Pedidos:</strong> acompanhamento ao vivo<br>
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

// --- NAVEGAÇÃO POR GESTOS (INCLUINDO A ABA PEDIDOS) ---
function initGestureNavigation() {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isDragging = false;

    // Incluído 'orders' no fluxo de telas
    const tabsOrder = ['dashboard', 'orders', 'stock', 'sales', 'expenses', 'settings'];
    const mainContainer = document.querySelector('main');

    if (!mainContainer) return;

    mainContainer.style.willChange = 'transform, opacity';

    mainContainer.addEventListener('touchstart', (e) => {
        // Ignora toques em modais, inputs, seletores ou listas horizontais
        if (e.target.closest('.cross-sell-items, .subtabs, .modal-overlay, input, textarea, select, .category-scroll-bar')) {
            isDragging = false;
            return;
        }

        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        currentX = startX;
        isDragging = true;
        
        mainContainer.style.transition = 'none';
    }, { passive: true });

    mainContainer.addEventListener('touchmove', (e) => {
        if (!isDragging) return;

        currentX = e.touches[0].clientX;
        const deltaX = currentX - startX;
        const deltaY = e.touches[0].clientY - startY;

        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaX) < 15) {
            isDragging = false;
            mainContainer.style.transform = 'translateX(0px)';
            mainContainer.style.opacity = '1';
            return;
        }

        const activeNavBtn = document.querySelector('.bottom-nav button.active');
        const currentTab = activeNavBtn ? activeNavBtn.dataset.tab : 'dashboard';
        const currentIndex = tabsOrder.indexOf(currentTab);

        const isFirstTab = currentIndex === 0 && deltaX > 0;
        const isLastTab = currentIndex === tabsOrder.length - 1 && deltaX < 0;

        if (isFirstTab || isLastTab) {
            mainContainer.style.transform = `translateX(${deltaX / 3}px)`;
        } else {
            mainContainer.style.transform = `translateX(${deltaX}px)`;
            const progress = Math.min(Math.abs(deltaX) / (window.innerWidth * 0.4), 1);
            mainContainer.style.opacity = `${1 - (progress * 0.2)}`;
        }
    }, { passive: true });

    mainContainer.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;

        const deltaX = currentX - startX;
        const threshold = window.innerWidth * 0.30;
        const activeNavBtn = document.querySelector('.bottom-nav button.active');
        const currentTab = activeNavBtn ? activeNavBtn.dataset.tab : 'dashboard';
        const currentIndex = tabsOrder.indexOf(currentTab);

        mainContainer.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
        mainContainer.style.opacity = '1';

        if (Math.abs(deltaX) >= threshold && currentIndex !== -1) {
            if (deltaX < 0 && currentIndex < tabsOrder.length - 1) {
                if (typeof switchTab === 'function') switchTab(tabsOrder[currentIndex + 1]);
            } else if (deltaX > 0 && currentIndex > 0) {
                if (typeof switchTab === 'function') switchTab(tabsOrder[currentIndex - 1]);
            }
        }

        mainContainer.style.transform = 'translateX(0px)';
        startX = 0;
        currentX = 0;
    }, { passive: true });
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
    
    // Inicializa a escuta de pedidos em tempo real
    if (typeof OrdersManager !== 'undefined' && OrdersManager.init) {
        OrdersManager.init();
    }
    
    initGestureNavigation();
    
    setInterval(updateHeader, 60000);
    if (typeof checkWeeklyNotification === 'function') checkWeeklyNotification();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
