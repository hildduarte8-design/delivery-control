function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.bottom-nav button').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.add('active');
    
    const btn = document.querySelector(`.bottom-nav button[data-tab="${tabId}"]`);
    if (btn) btn.classList.add('active');
    
    if (tabId === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
}

function openModal(title, bodyHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.className = 'toast', 3000);
}

// Configuração do Botão Flutuante (FAB)
document.addEventListener('DOMContentLoaded', () => {
    const fabBtn = document.getElementById('fabBtn');
    const fabMenu = document.getElementById('fabMenu');
    if (fabBtn && fabMenu) {
        fabBtn.addEventListener('click', () => {
            fabMenu.classList.toggle('active');
        });
    }
    
    document.querySelectorAll('.bottom-nav button').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            if (tab) switchTab(tab);
        });
    });
});

function quickAction(action) {
    document.getElementById('fabMenu')?.classList.remove('active');
    if (action === 'sale' && typeof openSaleModal === 'function') openSaleModal();
    if (action === 'stock' && typeof openStockModal === 'function') openStockModal();
    if (action === 'logistics' && typeof openLogisticsModal === 'function') openLogisticsModal();
    if (action === 'fixed' && typeof openFixedExpenseModal === 'function') openFixedExpenseModal();
}
