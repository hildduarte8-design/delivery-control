// js/app.js - Inicialização, Autenticação, Tema Dinâmico e Gestos de Navegação

// Aplica a cor da marca dinamicamente no CSS do app
function applyThemeColor(colorHex) {
    if (!colorHex) return;
    document.documentElement.style.setProperty('--primary-color', colorHex);
    
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', colorHex);
}

function updateHeader() {
    const d = new Date();
    const hh = d.getHours();
    let g = 'Bom dia ☀️';
    if (hh >= 12 && hh < 18) g = 'Boa tarde 🌤️';
    else if (hh >= 18 || hh < 5) g = 'Boa noite 🌙';
    
    const greetingEl = document.getElementById('greetingText');
    const dateEl = document.getElementById('currentDate');
    
    if (greetingEl) greetingEl.textContent = g;
    if (dateEl) dateEl.textContent = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function showWelcome() {
    if (localStorage.getItem('dly_welcomed')) return;
    openModal('🎉 Bem-vindo ao Delivery Control!', `
        <p style="color:#F1F5F9; font-size:15px; margin-bottom:14px;">
            Seu app de gestão para Delivery está pronto.
        </p>
        <div style="background:#0F172A; border-radius:12px; padding:14px; margin-bottom:14px; border:1px solid #334155;">
            <div style="font-size:13px; color:#94A3B8; line-height:1.7;">
                <strong style="color:var(--primary-color, #FF6B35);">🛍️ Pedidos:</strong> acompanhamento ao vivo<br>
                <strong style="color:var(--primary-color, #FF6B35);">🍔 Cardápio:</strong> gestão de pratos e preços<br>
                <strong style="color:var(--primary-color, #FF6B35);">📊 Gestão:</strong> insumos, contas e logística<br>
                <strong style="color:var(--primary-color, #FF6B35);">🏠 Dashboard:</strong> saldo em tempo real
            </div>
        </div>
        <button class="btn btn-large" onclick="localStorage.setItem('dly_welcomed','1'); closeModal(); if(typeof weeklyNotificationBanner === 'function') weeklyNotificationBanner();">
            🚀 Começar a usar
        </button>
    `);
}

// Controle da Tela de Login / Bloqueio Total
function checkAdminAuth() {
    const settings = typeof DB !== 'undefined' ? DB.load('dly_settings', {}) : {};
    const savedPassword = settings.password;
    const loginScreen = document.getElementById('loginScreen');
    const storeTitle = document.getElementById('login_store_title');

    const storeName = settings.store_name || settings.storeName;
    const primaryColor = settings.primary_color || settings.primaryColor;

    if (storeTitle && storeName) storeTitle.textContent = storeName;
    if (primaryColor) applyThemeColor(primaryColor);

    if (!savedPassword || sessionStorage.getItem('dly_auth') === 'true') {
        if (loginScreen) loginScreen.style.display = 'none';
        return true;
    }

    if (loginScreen) loginScreen.style.display = 'flex';
    return false;
}

function validatePassword() {
    const input = document.getElementById('admin_pass_input')?.value;
    const settings = typeof DB !== 'undefined' ? DB.load('dly_settings', {}) : {};
    const loginScreen = document.getElementById('loginScreen');

    if (input && input === settings.password) {
        sessionStorage.setItem('dly_auth', 'true');
        if (loginScreen) loginScreen.style.display = 'none';
        if (typeof showToast === 'function') showToast('Acesso liberado!');
        
        if (typeof switchTab === 'function') switchTab('dashboard');
        if (typeof renderDashboard === 'function') renderDashboard();
    } else {
        if (typeof showToast === 'function') showToast('Senha incorreta!', 'error');
    }
}

// --- NAVEGAÇÃO POR GESTOS (5 ABAS UNIFICADAS) ---
function initGestureNavigation() {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isDragging = false;

    const tabsOrder = ['dashboard', 'orders', 'menu', 'financial', 'settings'];
    const mainContainer = document.querySelector('main');

    if (!mainContainer) return;

    mainContainer.style.willChange = 'transform, opacity';

    mainContainer.addEventListener('touchstart', (e) => {
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

// CORREÇÃO AUDITORIA #01/#04: Função de inicialização assíncrona com await no banco
async function init() {
    if (typeof setupManifest === 'function') setupManifest();
    if (typeof setupServiceWorker === 'function') setupServiceWorker();
    
    updateHeader();
    
    // Aguarda o banco/cache carregar completamente antes de pintar o painel
    if (typeof loadAll === 'function') {
        await loadAll();
    }
    
    const isAuthed = checkAdminAuth();
    if (isAuthed) {
        if (typeof switchTab === 'function') switchTab('dashboard');
        if (typeof renderDashboard === 'function') renderDashboard();
    }

    if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
    
    if (typeof OrdersManager !== 'undefined' && OrdersManager.initRealtime) {
        OrdersManager.initRealtime();
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
