// Central de Notificações do Delivery Control

function getActiveNotifications() {
    const alerts = [];

    // --- ALERTA DE ESTOQUE BAIXO ---
    if (typeof state !== 'undefined' && state.stock && Array.isArray(state.stock)) {
        state.stock.forEach(item => {
            const minQty = Number(item.minQty || 5);
            const currentQty = Number(item.quantity || 0);

            if (currentQty <= 0) {
                alerts.push({
                    id: `stock-empty-${item.id}`,
                    type: 'danger',
                    icon: '🚨',
                    title: 'Estoque Esgotado',
                    message: `O insumo **${item.name}** acabou! Adicione mais no estoque.`,
                    linkTab: 'stock'
                });
            } else if (currentQty <= minQty) {
                alerts.push({
                    id: `stock-low-${item.id}`,
                    type: 'warning',
                    icon: '📦',
                    title: 'Estoque Baixo',
                    message: `O insumo **${item.name}** está com apenas ${currentQty} ${item.unit || 'un'}.`,
                    linkTab: 'stock'
                });
            }
        });
    }

    // --- ALERTA DE CONTAS FIXAS VENCENDO ---
    if (typeof state !== 'undefined' && state.expenses && state.expenses.fixed && Array.isArray(state.expenses.fixed)) {
        const today = new Date().getDate();
        state.expenses.fixed.forEach(exp => {
            const dueDay = Number(exp.dueDay);
            if (dueDay) {
                if (dueDay === today) {
                    alerts.push({
                        id: `exp-today-${exp.id}`,
                        type: 'danger',
                        icon: '📋',
                        title: 'Conta Vencendo Hoje',
                        message: `A conta **${exp.description}** (R$ ${Number(exp.amount).toFixed(2)}) vence hoje!`,
                        linkTab: 'expenses'
                    });
                } else if (dueDay > today && dueDay <= today + 2) {
                    alerts.push({
                        id: `exp-soon-${exp.id}`,
                        type: 'warning',
                        icon: '⏳',
                        title: 'Conta Vencendo Em Breve',
                        message: `A conta **${exp.description}** vence dia ${dueDay}.`,
                        linkTab: 'expenses'
                    });
                }
            }
        });
    }

    return alerts;
}

function updateNotificationBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;

    const alerts = getActiveNotifications();
    const count = alerts.length;

    if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function openNotificationCenter() {
    const alerts = getActiveNotifications();
    let contentHtml = '';

    if (alerts.length === 0) {
        contentHtml = `
            <div style="text-align:center; padding:30px 10px; color:#94A3B8;">
                <div style="font-size:40px; margin-bottom:10px;">🎉</div>
                <p style="font-weight:600; color:#F1F5F9;">Tudo em dia!</p>
                <p style="font-size:13px; margin-top:4px;">Nenhum alerta de estoque ou conta pendente.</p>
            </div>
        `;
    } else {
        contentHtml = `<div style="display:flex; flex-direction:column; gap:10px; max-height:350px; overflow-y:auto;">`;
        alerts.forEach(alert => {
            const bg = alert.type === 'danger' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)';
            const border = alert.type === 'danger' ? '#EF4444' : '#F59E0B';

            contentHtml += `
                <div style="background:${bg}; border-left:4px solid ${border}; border-radius:10px; padding:12px; display:flex; gap:10px; align-items:flex-start;">
                    <span style="font-size:20px;">${alert.icon}</span>
                    <div style="flex:1;">
                        <div style="font-size:14px; font-weight:700; color:#F1F5F9;">${alert.title}</div>
                        <div style="font-size:12px; color:#CBD5E1; margin-top:2px;">${alert.message}</div>
                        <button class="btn btn-sm btn-secondary" onclick="closeModal(); switchTab('${alert.linkTab}');" style="margin-top:8px; width:auto; padding:4px 10px; font-size:11px;">
                            Ir para a aba
                        </button>
                    </div>
                </div>
            `;
        });
        contentHtml += `</div>`;
    }

    if ('Notification' in window && Notification.permission !== 'granted') {
        contentHtml += `
            <button class="btn btn-sm" onclick="requestBrowserNotificationPermission()" style="margin-top:16px; background:#3B82F6; width:100%;">
                🔔 Ativar Notificações no Celular
            </button>
        `;
    }

    if (typeof openModal === 'function') {
        openModal('🔔 Notificações e Alertas', contentHtml);
    }
}

function requestBrowserNotificationPermission() {
    if (!('Notification' in window)) {
        if (typeof showToast === 'function') showToast('Navegador não suporta notificações', 'error');
        return;
    }

    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            if (typeof showToast === 'function') showToast('Notificações ativadas com sucesso!');
            if (typeof closeModal === 'function') closeModal();
            sendNativeNotification('Delivery Control 🚀', 'Notificações ativadas! Avisaremos sobre pedidos, estoque e contas.');
        } else {
            if (typeof showToast === 'function') showToast('Permissão de notificação negada', 'error');
        }
    });
}

function sendNativeNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification(title, {
                body: body,
                icon: 'icon-192.png'
            });
        } catch(e) {
            console.warn('Erro ao enviar notificação nativa:', e);
        }
    }
}

// Exporta as funções para o escopo global
window.sendNativeNotification = sendNativeNotification;
window.requestBrowserNotificationPermission = requestBrowserNotificationPermission;
window.openNotificationCenter = openNotificationCenter;
window.updateNotificationBadge = updateNotificationBadge;

document.addEventListener('DOMContentLoaded', () => {
    const notifBtn = document.getElementById('notifBtn');
    if (notifBtn) {
        notifBtn.addEventListener('click', openNotificationCenter);
    }
});
