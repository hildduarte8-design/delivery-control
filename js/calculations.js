// js/calculations.js

function getAnalyticsData(period = 'today') {
    const now = new Date();
    let startDate = new Date();

    if (period === 'today') {
        startDate.setHours(0, 0, 0, 0);
    } else if (period === '7days') {
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
    }

    // 1. Vendas no período
    const filteredSales = (state.sales || []).filter(s => new Date(s.created_at || Date.now()) >= startDate);
    const totalRevenue = filteredSales.reduce((acc, s) => acc + Number(s.amount || 0), 0);

    // 2. Despesas no período
    const filteredLogistics = (state.expenses?.logistics || []).filter(e => new Date(e.created_at || Date.now()) >= startDate);
    const totalExpenses = filteredLogistics.reduce((acc, e) => acc + Number(e.amount || 0), 0);

    // 3. Lucro Líquido
    const netProfit = totalRevenue - totalExpenses;

    // 4. Ranking de Produtos Mais Vendidos
    const productCounts = {};
    filteredSales.forEach(s => {
        if (s.items && Array.isArray(s.items)) {
            s.items.forEach(item => {
                productCounts[item.name] = (productCounts[item.name] || 0) + Number(item.qty || 1);
            });
        } else if (s.description) {
            productCounts[s.description] = (productCounts[s.description] || 0) + 1;
        }
    });

    const topProducts = Object.entries(productCounts)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

    return {
        totalRevenue,
        totalExpenses,
        netProfit,
        salesCount: filteredSales.length,
        topProducts
    };
}
