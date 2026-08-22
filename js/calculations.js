function calculateDashboardTotals() {
    const today = new Date().toISOString().split('T')[0];
    
    const inToday = (state.sales || [])
        .filter(s => s.created_at && s.created_at.startsWith(today))
        .reduce((acc, s) => acc + Number(s.amount || 0), 0);
        
    const outToday = (state.expenses?.logistics || [])
        .filter(e => e.created_at && e.created_at.startsWith(today))
        .reduce((acc, e) => acc + Number(e.amount || 0), 0);
        
    const totalSales = (state.sales || []).reduce((acc, s) => acc + Number(s.amount || 0), 0);
    const totalFixed = (state.expenses?.fixed || []).reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const totalLogistics = (state.expenses?.logistics || []).reduce((acc, e) => acc + Number(e.amount || 0), 0);
    
    const balance = totalSales - (totalFixed + totalLogistics);
    
    return { inToday, outToday, balance, totalSales, totalFixed, totalLogistics };
}
