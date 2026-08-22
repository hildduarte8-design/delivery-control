// Configuração do Supabase
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

// Carrega dados locais e busca atualizações na nuvem (Supabase)
async function loadAll() {
    // 1. Carregamento imediato do cache local
    state.stock = DB.load('dly_stock', []);
    state.recipes = DB.load('dly_recipes', []);
    state.sales = DB.load('dly_sales', []);
    state.expenses = DB.load('dly_expenses', { fixed: [], logistics: [] });
    state.settings = DB.load('dly_settings', { storeName: '', phone: '', password: '' });

    // 2. Sincronização em segundo plano com o Supabase
    try {
        const [stockRes, salesRes, expRes, cfgRes] = await Promise.all([
            dbClient.from('stock').select('*'),
            dbClient.from('sales').select('*'),
            dbClient.from('expenses').select('*'),
            dbClient.from('store_settings').select('*').eq('id', 1).maybeSingle()
        ]);

        if (stockRes.data) {
            state.stock = stockRes.data.map(i => ({
                id: i.id, name: i.name, quantity: i.quantity, unit: i.unit, minQty: i.min_qty, unitCost: i.unit_cost
            }));
            DB.save('dly_stock', state.stock);
        }

        if (salesRes.data) {
            state.sales = salesRes.data;
            DB.save('dly_sales', state.sales);
        }

        if (expRes.data) {
            state.expenses.fixed = expRes.data.filter(e => e.type === 'fixed');
            state.expenses.logistics = expRes.data.filter(e => e.type === 'logistics');
            DB.save('dly_expenses', state.expenses);
        }

        if (cfgRes.data) {
            state.settings = {
                storeName: cfgRes.data.store_name,
                phone: cfgRes.data.phone,
                password: cfgRes.data.password
            };
            DB.save('dly_settings', state.settings);
        }

        // Atualiza telas se a interface já estiver visível
        if (typeof renderDashboard === 'function') renderDashboard();
    } catch (err) {
        console.log('Operando em modo offline (dados carregados do dispositivo)');
    }
}
