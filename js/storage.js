// js/storage.js - Gerenciamento de Armazenamento, Estado Global e Sincronização

const SUPABASE_URL = 'https://wdxqkagwuzekzxdhxbnp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_raTvDULM2YDmTngVIOM11g_CZe6jZWj';

const dbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
    expenses: { fixed: [], logistics: [] },
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
    state.expenses = DB.load('dly_expenses', { fixed: [], logistics: [] });
    state.settings = DB.load('dly_settings', { storeName: 'Delivery Control', phone: '', password: '' });

    // 2. Sincronização em nuvem com o Supabase
    try {
        const [stockRes, recipeRes, salesRes, expRes, cfgRes] = await Promise.all([
            dbClient.from('stock').select('*'),
            dbClient.from('recipes').select('*'),
            dbClient.from('sales').select('*'),
            dbClient.from('expenses').select('*'),
            dbClient.from('store_settings').select('*').eq('id', 1).maybeSingle()
        ]);

        // Estoque: Mantém a estrutura original do banco para compatibilidade com stock.js e calculator.js
        if (stockRes.data) {
            state.stock = stockRes.data;
            DB.save('dly_stock', state.stock);
        }

        // Receitas / Fichas Técnicas
        if (recipeRes.data) {
            state.recipes = recipeRes.data;
            DB.save('dly_recipes', state.recipes);
        }

        // Vendas
        if (salesRes.data) {
            state.sales = salesRes.data;
            DB.save('dly_sales', state.sales);
        }

        // Despesas (Fixas e Logística)
        if (expRes.data) {
            state.expenses.fixed = expRes.data.filter(e => e.type === 'fixed');
            state.expenses.logistics = expRes.data.filter(e => e.type === 'logistics');
            DB.save('dly_expenses', state.expenses);
        }

        // Configurações da Loja: Preserva ambas as nomenclaturas para evitar divergências
        if (cfgRes.data) {
            const c = cfgRes.data;
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
