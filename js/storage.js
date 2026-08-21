const DB = {
    load(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
        catch { return fallback; }
    },
    save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
};

const state = {
    stock: [], recipes: [], sales: [],
    expenses: { fixed: [], logistics: [] },
    settings: {}
};

function loadAll() {
    state.stock = DB.load('dly_stock', []);
    state.recipes = DB.load('dly_recipes', []);
    state.sales = DB.load('dly_sales', []);
    state.expenses = DB.load('dly_expenses', { fixed: [], logistics: [] });
    state.settings = DB.load('dly_settings', { welcomed: false, notifAsked: false });
}
