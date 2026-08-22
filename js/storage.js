// Configuração do Supabase
const SUPABASE_URL = 'https://wdxqkagwuzekzxdhxbnp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_raTvDULM2YDmTngVIOM11g_CZe6jZWj';

const dbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Gerenciador de Armazenamento Local
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

function loadAll() {
    state.stock = DB.load('dly_stock', []);
    state.recipes = DB.load('dly_recipes', []);
    state.sales = DB.load('dly_sales', []);
    state.expenses = DB.load('dly_expenses', { fixed: [], logistics: [] });
    state.settings = DB.load('dly_settings', { storeName: '', phone: '', password: '' });
}
