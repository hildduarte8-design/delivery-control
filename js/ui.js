// js/ui.js - Interface, Modais, Toasts, Navegação e Sub-abas

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.bottom-nav button').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.add('active');
    
    const btn = document.querySelector(`.bottom-nav button[data-tab="${tabId}"]`);
    if (btn) btn.classList.add('active');
    
    // Fecha o menu flutuante (FAB) se estiver aberto
    document.getElementById('fabMenu')?.classList.remove('active');

    // Executa o carregamento de dados da aba selecionada
    if (tabId === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
    if (tabId === 'orders' && typeof OrdersManager !== 'undefined' && OrdersManager.fetchOrders) OrdersManager.fetchOrders();
    if (tabId === 'menu' && typeof MenuAdminManager !== 'undefined' && MenuAdminManager.renderAdminProductsList) MenuAdminManager.renderAdminProductsList();
    if (tabId === 'financial') {
        if (typeof renderStockList === 'function') renderStockList();
        if (typeof renderFixedList === 'function') renderFixedList();
        if (typeof renderLogisticsList === 'function') renderLogisticsList();
    }
    if (tabId === 'settings' && typeof loadSettingsUI === 'function') loadSettingsUI();
}

function openModal(title, bodyHtml) {
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const overlay = document.getElementById('modalOverlay');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = bodyHtml;
    if (overlay) {
        overlay.classList.add('active');
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Evita rolagem da página ao fundo
    }
}

function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.style.display = 'none';
        document.body.style.overflow = ''; // Restaura a rolagem do fundo
    }
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.className = 'toast', 3000);
}

function quickAction(action) {
    document.getElementById('fabMenu')?.classList.remove('active');
    if (action === 'sale' && typeof openSaleModal === 'function') openSaleModal();
    if (action === 'stock' && typeof openStockModal === 'function') openStockModal();
    if (action === 'logistics' && typeof openLogisticsModal === 'function') openLogisticsModal();
    if (action === 'fixed' && typeof openFixedExpenseModal === 'function') openFixedExpenseModal();
}

// Configuração de Eventos Globais de Interface
document.addEventListener('DOMContentLoaded', () => {
    const fabBtn = document.getElementById('fabBtn');
    const fabMenu = document.getElementById('fabMenu');
    
    if (fabBtn && fabMenu) {
        fabBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fabMenu.classList.toggle('active');
        });

        // Fecha o menu FAB ao clicar fora
        document.addEventListener('click', (e) => {
            if (!fabMenu.contains(e.target) && e.target !== fabBtn) {
                fabMenu.classList.remove('active');
            }
        });
    }
    
    document.querySelectorAll('.bottom-nav button').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            if (tab) switchTab(tab);
        });
    });

    // Fechar modal ao clicar no fundo escuro (backdrop)
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });
    }

    // Fechar modal ao apertar a tecla ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
});

// --- GERENCIADOR GLOBAL DE SUB-ABAS (SUBTABS) ---
document.addEventListener('click', (e) => {
    const subBtn = e.target.closest('.subtabs button');
    if (!subBtn) return;

    const subtabsContainer = subBtn.closest('.subtabs');
    const parentSection = subBtn.closest('.tab-content');
    if (!subtabsContainer || !parentSection) return;

    const targetSub = subBtn.dataset.sub;

    // 1. Troca o destaque do botão ativo
    subtabsContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    subBtn.classList.add('active');

    // 2. Alterna a visibilidade dos painéis internos
    parentSection.querySelectorAll('.sub-panel').forEach(panel => {
        if (panel.dataset.panel === targetSub) {
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    });

    // 3. Executa a busca/renderização de dados correspondente à sub-aba aberta
    if (targetSub === 'live-orders' && typeof OrdersManager !== 'undefined' && OrdersManager.fetchOrders) {
        OrdersManager.fetchOrders();
    }
    if (targetSub === 'manual-sales' && typeof renderSalesList === 'function') {
        renderSalesList();
    }
    if (targetSub === 'customers' && typeof CustomersManager !== 'undefined' && CustomersManager.fetchCustomers) {
        CustomersManager.fetchCustomers();
    }
    if (targetSub === 'insumos' && typeof renderStockList === 'function') {
        renderStockList();
    }
    if (targetSub === 'fixed' && typeof renderFixedList === 'function') {
        renderFixedList();
    }
    if (targetSub === 'logistics' && typeof renderLogisticsList === 'function') {
        renderLogisticsList();
    }
    if (targetSub === 'recipes' && typeof CalculatorManager !== 'undefined' && CalculatorManager.loadSavedRecipes) {
        CalculatorManager.loadSavedRecipes();
    }
});

// Exposição global de funções de interface
window.switchTab = switchTab;
window.openModal = openModal;
window.closeModal = closeModal;
window.showToast = showToast;
window.quickAction = quickAction;
