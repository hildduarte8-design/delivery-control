// js/storage.js - Gerenciamento de Armazenamento, Estado Global e Sincronização

const SUPABASE_URL = 'https://wdxqkagwuzekzxdhxbnp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_raTvDULM2YDmTngVIOM11g_CZe6jZWj';

const dbClient = typeof supabase !== 'undefined' ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Helper para verificar se a conexão com o banco está pronta
function isDbReady() {
    return !!dbClient;
}
window.isDbReady = isDbReady;

// Gerenciador de Armazenamento Local (Offline First)
const DB = {
    load(key, fallback) {
        try { 
            return JSON.parse(localStorage.getItem(key)) ?? fallback; 
        } catch { 
            return fallback; 
        }
    },
    save(key, val) { 
        localStorage.setItem(key, JSON.stringify(val)); 
    }
};

// Estado Global do Aplicativo
const state = {
    stock: [], 
    recipes: [], 
    sales: [],
    orders: [],
    menu: [],
    expenses: { fixed: [], logistics: [], general: [], all: [] },
    settings: {}
};

// Helper Global para obter o nome atualizado da loja em tempo de execução
function getStoreName() {
    if (state.settings && (state.settings.storeName || state.settings.store_name)) {
        return state.settings.storeName || state.settings.store_name;
    }
    const localSettings = DB.load('dly_settings', {});
    return localSettings.storeName || localSettings.store_name || 'Delivery Control';
}

// Carrega dados locais e busca atualizações na nuvem (Supabase)
async function loadAll() {
    // 1. Carregamento imediato do cache local para renderização ultra-rápida
    state.stock = DB.load('dly_stock', []);
    state.recipes = DB.load('dly_recipes', []);
    state.sales = DB.load('dly_sales', []);
    state.orders = DB.load('dly_orders', []);
    state.menu = DB.load('dly_menu', []);
    state.expenses = DB.load('dly_expenses', { fixed: [], logistics: [], general: [], all: [] });
    state.settings = DB.load('dly_settings', { storeName: 'Delivery Control', phone: '', password: '' });

    // 2. Sincronização em nuvem com o Supabase
    if (!isDbReady()) {
        console.warn('Cliente Supabase não inicializado. Operando estritamente offline.');
        return;
    }

    try {
        // Usa Promise.allSettled para garantir que a falha de uma tabela não aborte as outras 6
        const results = await Promise.allSettled([
            dbClient.from('stock').select('*'),
            dbClient.from('recipes').select('*'),
            dbClient.from('sales').select('*'),
            dbClient.from('orders').select('*'),
            dbClient.from('products').select('*'),
            dbClient.from('expenses').select('*'),
            dbClient.from('store_settings').select('*').eq('id', 1).maybeSingle()
        ]);

        const [stockRes, recipeRes, salesRes, ordersRes, productsRes, expRes, cfgRes] = results;

        // Estoque
        if (stockRes.status === 'fulfilled' && stockRes.value?.data) {
            state.stock = stockRes.value.data;
            DB.save('dly_stock', state.stock);
        }

        // Receitas / Fichas Técnicas
        if (recipeRes.status === 'fulfilled' && recipeRes.value?.data) {
            state.recipes = recipeRes.value.data;
            DB.save('dly_recipes', state.recipes);
        }

        // Vendas
        if (salesRes.status === 'fulfilled' && salesRes.value?.data) {
            state.sales = salesRes.value.data;
            DB.save('dly_sales', state.sales);
        }

        // Pedidos ao vivo
        if (ordersRes.status === 'fulfilled' && ordersRes.value?.data) {
            state.orders = ordersRes.value.data;
            DB.save('dly_orders', state.orders);
        }

        // Cardápio / Produtos
        if (productsRes.status === 'fulfilled' && productsRes.value?.data) {
            state.menu = productsRes.value.data;
            DB.save('dly_menu', state.menu);
        }

        // Despesas (Fixas, Logística e Compras/Geral)
        if (expRes.status === 'fulfilled' && expRes.value?.data) {
            const allExp = expRes.value.data;
            state.expenses.fixed = allExp.filter(e => e.type === 'fixed');
            state.expenses.logistics = allExp.filter(e => e.type === 'logistics');
            state.expenses.general = allExp.filter(e => e.type !== 'fixed' && e.type !== 'logistics');
            state.expenses.all = allExp;
            DB.save('dly_expenses', state.expenses);
        }

        // Configurações da Loja: Preserva ambas as nomenclaturas para evitar divergências
        if (cfgRes.status === 'fulfilled' && cfgRes.value?.data) {
            const c = cfgRes.value.data;
            state.settings = {
                storeName: c.store_name || 'Delivery Control',
                store_name: c.store_name || 'Delivery Control',
                phone: c.phone || '',
                password: c.password || '',
                pixKey: c.pix_key || '',
                pix_key: c.pix_key || '',
                logoUrl: c.logo_url || '',
                logo_url: c.logo_url || '',
                primaryColor: c.primary_color || '#FF6B35',
                primary_color: c.primary_color || '#FF6B35'
            };
            DB.save('dly_settings', state.settings);
        }

        // 3. Re-renderiza os componentes com os dados atualizados do banco
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof renderStockList === 'function') renderStockList();
        if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
        if (typeof CalculatorManager !== 'undefined' && CalculatorManager.refreshStockList) {
            CalculatorManager.refreshStockList(true);
        }

    } catch (err) {
        console.warn('Operando em modo offline (dados carregados do cache local):', err);
    }
}
