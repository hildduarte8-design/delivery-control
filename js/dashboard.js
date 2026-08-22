function renderDashboard() {
    const totals = calculateDashboardTotals();
    
    const balEl = document.getElementById('balanceValue');
    if (balEl) balEl.textContent = totals.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    const inEl = document.getElementById('inToday');
    if (inEl) inEl.textContent = totals.inToday.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    const outEl = document.getElementById('outToday');
    if (outEl) outEl.textContent = totals.outToday.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    renderRecentMovements();
}

function renderRecentMovements() {
    const listEl = document.getElementById('movList');
    if (!listEl) return;
    
    const salesList = (state.sales || []).map(s => ({ ...s, movType: 'in' }));
    const expList = (state.expenses?.logistics || []).map(l => ({ ...l, movType: 'out' }));
    
    const all = [...salesList, ...expList]
        .sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 5);

    if (all.length === 0) {
        listEl.innerHTML = '<div style="color:#94A3B8; font-size:13px; text-align:center; padding:10px;">Nenhuma movimentação registrada.</div>';
        return;
    }

    listEl.innerHTML = all.map(m => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #334155;">
            <div>
                <div style="font-weight:600; font-size:13px; color:#F1F5F9;">${m.description || 'Movimentação'}</div>
                <div style="font-size:11px; color:#94A3B8;">${new Date(m.created_at || Date.now()).toLocaleDateString('pt-BR')}</div>
            </div>
            <div style="font-weight:700; font-size:14px; color:${m.movType === 'in' ? '#10B981' : '#EF4444'}">
                ${m.movType === 'in' ? '+' : '-'} R$ ${Number(m.amount || 0).toFixed(2)}
            </div>
        </div>
    `).join('');
}
